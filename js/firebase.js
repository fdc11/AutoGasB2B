import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

export const firebaseConfig = {
  apiKey: "AIzaSyAOnDrFABYwTnr11j3eko8GaolesmBna-w",
  authDomain: "autogas-b2b.firebaseapp.com",
  projectId: "autogas-b2b",
  storageBucket: "autogas-b2b.firebasestorage.app",
  messagingSenderId: "442560802159",
  appId: "1:442560802159:web:e73fa455ff171bd542cc9a"
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);