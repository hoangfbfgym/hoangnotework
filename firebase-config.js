// 1) Create a Firebase project.
// 2) Add a Web App in Firebase Project Settings.
// 3) Copy your Firebase config object here.
// 4) Set DEFAULT_NOTE_ID to the same secret/random ID you put in firestore.rules.

const firebaseConfig = {
  apiKey: "AIzaSyCa-QBdHWEV3WUU0jlIPlYJYrWe-HAp5mA",
  authDomain: "hoang-cibc-note.firebaseapp.com",
  projectId: "hoang-cibc-note",
  storageBucket: "hoang-cibc-note.firebasestorage.app",
  messagingSenderId: "766085528986",
  appId: "1:766085528986:web:6246bd2bbea4bc32d30e23",
  measurementId: "G-T85ZZN0Q3F"
};

// Make this long, random, and hard to guess.
// Example: "note_9gKx7mPq3TzR6vN2aLhQ"
export const DEFAULT_NOTE_ID = "hoang_note_1123";
