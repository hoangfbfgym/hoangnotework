# One Shared Note — GitHub Pages + Firebase Firestore

A tiny browser note app with:

- one shared note
- no login
- anyone with the secret link can edit
- only one active editor at a time
- autosave
- lock heartbeat, so a crashed/closed tab does not stay locked forever
- static hosting through GitHub Pages

## Files

```text
index.html
styles.css
app.js
firebase-config.js
firestore.rules
README.md
```

## How it works

The app has one Firestore document:

```text
/singleNotes/YOUR_RANDOM_NOTE_ID
```

That document stores:

```js
{
  text: "the note text",
  lastSavedAtMs: 1760000000000,
  lock: {
    ownerId: "random tab id",
    ownerLabel: "browser/device label",
    expiresAtMs: 1760000000000,
    updatedAtMs: 1760000000000
  }
}
```

When a browser opens the note:

1. It checks the lock.
2. If the lock is empty or expired, it claims the lock.
3. If another active browser owns the lock, the app blocks editing.
4. The active editor renews the lock every 15 seconds.
5. If the browser crashes or disconnects, the lock expires after about 45 seconds.

## Setup steps

### 1. Create Firebase project

1. Go to Firebase Console.
2. Create a project.
3. Add a Web App.
4. Copy the Firebase config object.

### 2. Create Firestore database

1. In Firebase, open **Firestore Database**.
2. Create a database.
3. Choose a location.
4. Start in production mode if asked.

### 3. Choose your secret note ID

Make a long random note ID, for example:

```text
note_9gKx7mPq3TzR6vN2aLhQ
```

This ID is part of your security. Do not use something obvious like `main` or `note`.

### 4. Edit `firebase-config.js`

Replace the placeholder config:

```js
export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

export const DEFAULT_NOTE_ID = "REPLACE_WITH_LONG_RANDOM_NOTE_ID";
```

Set `DEFAULT_NOTE_ID` to your random note ID.

### 5. Edit `firestore.rules`

Replace:

```text
REPLACE_WITH_LONG_RANDOM_NOTE_ID
```

with the exact same random note ID.

Then in Firebase:

1. Open **Firestore Database**.
2. Open **Rules**.
3. Paste the contents of `firestore.rules`.
4. Publish.

### 6. Test locally

Because this app uses JavaScript modules, open it through a local server, not by double-clicking `index.html`.

If you have Python installed:

```bash
cd one-note-link-lock-app
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

### 7. Deploy to GitHub Pages

1. Create a GitHub repository.
2. Upload these files to the repository root.
3. Go to repository **Settings**.
4. Open **Pages**.
5. Set source to your main branch and root folder.
6. Save.
7. Open the GitHub Pages URL.

Your share link will look like:

```text
https://YOUR_USERNAME.github.io/YOUR_REPO/?note=YOUR_RANDOM_NOTE_ID
```

## Important limitations

This is link-based access, not real authentication.

Anyone with the link can edit the note.

Do not store passwords, banking info, SIN, private medical info, or anything sensitive.

## Difficulty

Basic version: 4/10.

Polished version with better UI and stronger security: 6/10.
