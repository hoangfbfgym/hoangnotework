import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  onSnapshot,
  runTransaction,
  updateDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

import { firebaseConfig, DEFAULT_NOTE_ID } from "./firebase-config.js";

const LOCK_DURATION_MS = 45_000;
const HEARTBEAT_MS = 15_000;
const AUTOSAVE_DELAY_MS = 750;

const statusText = document.getElementById("statusText");
const saveText = document.getElementById("saveText");
const lockText = document.getElementById("lockText");
const editorPanel = document.getElementById("editorPanel");
const blockedPanel = document.getElementById("blockedPanel");
const blockedText = document.getElementById("blockedText");
const noteInput = document.getElementById("noteInput");
const retryBtn = document.getElementById("retryBtn");
const retryBlockedBtn = document.getElementById("retryBlockedBtn");
const closeBtn = document.getElementById("closeBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

const url = new URL(window.location.href);
const noteId = url.searchParams.get("note") || DEFAULT_NOTE_ID;

let db;
let noteRef;
let hasLock = false;
let heartbeatTimer = null;
let autosaveTimer = null;
let unsubscribe = null;
let loadedInitialText = false;
let lastSavedText = "";
let isClosing = false;

function getOrCreateTabId() {
  const key = "one-note-lock-owner-id";
  let value = sessionStorage.getItem(key);
  if (!value) {
    value = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    sessionStorage.setItem(key, value);
  }
  return value;
}

const ownerId = getOrCreateTabId();
const ownerLabel = `${navigator.platform || "browser"} · ${new Date().toLocaleString()}`;

function validateConfig() {
  const missing = [];
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes("PASTE_")) missing.push("apiKey");
  if (!firebaseConfig.projectId || firebaseConfig.projectId.includes("PASTE_")) missing.push("projectId");
  if (!DEFAULT_NOTE_ID || DEFAULT_NOTE_ID.includes("REPLACE_")) missing.push("DEFAULT_NOTE_ID");
  if (missing.length) {
    throw new Error(`Missing Firebase config: ${missing.join(", ")}`);
  }
}

function showEditor() {
  editorPanel.classList.remove("hidden");
  blockedPanel.classList.add("hidden");
  noteInput.disabled = false;
  closeBtn.disabled = false;
  statusText.textContent = "Editing lock acquired.";
  statusText.className = "status ok";
}

function showBlocked(lock) {
  hasLock = false;
  editorPanel.classList.add("hidden");
  blockedPanel.classList.remove("hidden");
  noteInput.disabled = true;
  closeBtn.disabled = true;

  const seconds = Math.max(0, Math.ceil(((lock?.expiresAtMs || Date.now()) - Date.now()) / 1000));
  blockedText.textContent = `Another browser/device has the edit lock. It should expire in about ${seconds} seconds if that tab was closed or disconnected.`;
  statusText.textContent = "Blocked: note is already open somewhere else.";
  statusText.className = "status warn";
  lockText.textContent = lock?.ownerLabel ? `Locked by: ${lock.ownerLabel}` : "Locked elsewhere";
}

function showError(message) {
  hasLock = false;
  editorPanel.classList.add("hidden");
  blockedPanel.classList.remove("hidden");
  blockedText.textContent = message;
  statusText.textContent = "Error.";
  statusText.className = "status warn";
  saveText.textContent = "Not connected";
}

function formatTime(ms) {
  if (!ms) return "never";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

async function acquireLock() {
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
  hasLock = false;
  loadedInitialText = false;
  statusText.textContent = "Checking lock…";
  statusText.className = "status muted";

  const now = Date.now();
  let blockedLock = null;

  await runTransaction(db, async (transaction) => {
    const snap = await transaction.get(noteRef);

    if (!snap.exists()) {
      transaction.set(noteRef, {
        text: "",
        lastSavedAtMs: now,
        lock: {
          ownerId,
          ownerLabel,
          expiresAtMs: now + LOCK_DURATION_MS,
          updatedAtMs: now
        }
      });
      return;
    }

    const data = snap.data();
    const lock = data.lock || {};
    const lockExpired = !lock.expiresAtMs || lock.expiresAtMs <= now;
    const lockIsMine = lock.ownerId === ownerId;

    if (!lock.ownerId || lockExpired || lockIsMine) {
      transaction.update(noteRef, {
        lock: {
          ownerId,
          ownerLabel,
          expiresAtMs: now + LOCK_DURATION_MS,
          updatedAtMs: now
        }
      });
    } else {
      blockedLock = lock;
    }
  });

  if (blockedLock) {
    showBlocked(blockedLock);
    return;
  }

  hasLock = true;
  showEditor();
  await loadCurrentTextOnce();
  startRealtimeListener();
  startHeartbeat();
  noteInput.focus();
}

async function loadCurrentTextOnce() {
  const snap = await getDoc(noteRef);
  const data = snap.exists() ? snap.data() : {};
  const text = data.text || "";
  noteInput.value = text;
  lastSavedText = text;
  loadedInitialText = true;
  saveText.textContent = `Loaded. Last saved: ${formatTime(data.lastSavedAtMs)}`;
}

function startRealtimeListener() {
  if (unsubscribe) unsubscribe();

  unsubscribe = onSnapshot(noteRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const lock = data.lock || {};

    if (lock.ownerId && lock.ownerId !== ownerId && lock.expiresAtMs > Date.now()) {
      // Another tab took the lock. Stop editing immediately.
      stopHeartbeat();
      showBlocked(lock);
      return;
    }

    if (hasLock) {
      lockText.textContent = `Lock active until ${formatTime(lock.expiresAtMs)}`;
    }

    const incomingText = data.text || "";
    if (!loadedInitialText) {
      noteInput.value = incomingText;
      lastSavedText = incomingText;
      loadedInitialText = true;
    }
  }, (error) => {
    showError(`Realtime connection error: ${error.message}`);
  });
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(renewLock, HEARTBEAT_MS);
  renewLock();
}

function stopHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

async function renewLock() {
  if (!hasLock || isClosing) return;

  const now = Date.now();
  try {
    let lostLock = false;
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(noteRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const lock = data.lock || {};

      if (lock.ownerId !== ownerId) {
        lostLock = true;
        return;
      }

      transaction.update(noteRef, {
        lock: {
          ownerId,
          ownerLabel,
          expiresAtMs: now + LOCK_DURATION_MS,
          updatedAtMs: now
        }
      });
    });

    if (lostLock) {
      hasLock = false;
      stopHeartbeat();
      showBlocked({ ownerLabel: "another tab", expiresAtMs: now + LOCK_DURATION_MS });
    }
  } catch (error) {
    lockText.textContent = `Heartbeat failed: ${error.message}`;
  }
}

function scheduleSave() {
  if (!hasLock) return;
  saveText.textContent = "Unsaved changes…";
  clearTimeout(autosaveTimer);
  autosaveTimer = setTimeout(saveNow, AUTOSAVE_DELAY_MS);
}

async function saveNow() {
  if (!hasLock) return;
  const text = noteInput.value;
  if (text === lastSavedText) {
    saveText.textContent = `Saved: ${formatTime(Date.now())}`;
    return;
  }

  try {
    const now = Date.now();
    await updateDoc(noteRef, {
      text,
      lastSavedAtMs: now
    });
    lastSavedText = text;
    saveText.textContent = `Saved: ${formatTime(now)}`;
  } catch (error) {
    saveText.textContent = `Save failed: ${error.message}`;
  }
}

async function releaseLock() {
  if (!hasLock) return;
  isClosing = true;
  clearTimeout(autosaveTimer);
  await saveNow().catch(() => {});

  try {
    await runTransaction(db, async (transaction) => {
      const snap = await transaction.get(noteRef);
      if (!snap.exists()) return;
      const data = snap.data();
      const lock = data.lock || {};
      if (lock.ownerId === ownerId) {
        transaction.update(noteRef, {
          lock: {
            ownerId: null,
            ownerLabel: null,
            expiresAtMs: 0,
            updatedAtMs: Date.now()
          }
        });
      }
    });
  } finally {
    hasLock = false;
    stopHeartbeat();
    noteInput.disabled = true;
    closeBtn.disabled = true;
    statusText.textContent = "Note closed. You can close this tab.";
    statusText.className = "status muted";
    lockText.textContent = "Lock released";
    isClosing = false;
  }
}

async function copyShareLink() {
  const shareUrl = new URL(window.location.href);
  shareUrl.searchParams.set("note", noteId);
  await navigator.clipboard.writeText(shareUrl.toString());
  copyLinkBtn.textContent = "Copied";
  setTimeout(() => (copyLinkBtn.textContent = "Copy link"), 1200);
}

async function init() {
  try {
    validateConfig();
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    noteRef = doc(db, "singleNotes", noteId);

    retryBtn.addEventListener("click", acquireLock);
    retryBlockedBtn.addEventListener("click", acquireLock);
    closeBtn.addEventListener("click", releaseLock);
    copyLinkBtn.addEventListener("click", copyShareLink);
    noteInput.addEventListener("input", scheduleSave);

    // Best-effort save/release. Browser may kill this early, so heartbeat expiry is still required.
    window.addEventListener("pagehide", () => {
      if (hasLock) {
        saveNow().catch(() => {});
        releaseLock().catch(() => {});
      }
    });

    // Save before backgrounding, but do not release just because the tab is hidden.
    document.addEventListener("visibilitychange", () => {
      if (document.hidden && hasLock) saveNow().catch(() => {});
    });

    await acquireLock();
  } catch (error) {
    showError(error.message);
  }
}

init();
