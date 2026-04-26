// 1) Create a Firebase project.
// 2) Add a Web App in Firebase Project Settings.
// 3) Copy your Firebase config object here.
// 4) Set DEFAULT_NOTE_ID to the same secret/random ID you put in firestore.rules.

export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};

// Make this long, random, and hard to guess.
// Example: "note_9gKx7mPq3TzR6vN2aLhQ"
export const DEFAULT_NOTE_ID = "REPLACE_WITH_LONG_RANDOM_NOTE_ID";
