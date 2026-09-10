// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getMessaging } from "firebase/messaging";

// Your web app's Firebase configuration
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

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const messaging = getMessaging(app);
export const googleProvider = new GoogleAuthProvider();