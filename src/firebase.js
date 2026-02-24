// Import Firebase core
import { initializeApp } from "firebase/app";

// Import services you are using
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBhhdR6mms3JdLhXkl283k9yjm7zyLafpk",
  authDomain: "palousefellowshipsermonapp.firebaseapp.com",
  projectId: "palousefellowshipsermonapp",
  storageBucket: "palousefellowshipsermonapp.firebasestorage.app",
  messagingSenderId: "591678059434",
  appId: "1:591678059434:web:dfa8631fab9a2295f831d3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firestore and Auth
export const db = getFirestore(app);
export const auth = getAuth(app);