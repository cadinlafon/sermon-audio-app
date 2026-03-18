import { initializeApp } from "firebase/app";

import { 
getAuth,
GoogleAuthProvider
} from "firebase/auth";

import { getFirestore } from "firebase/firestore";

import { getStorage } from "firebase/storage";

import { getMessaging } from "firebase/messaging";

const firebaseConfig = {

apiKey: "AIzaSyBhhdR6mms3JdLhXkl283k9yjm7zyLafpk",
  authDomain: "palousefellowshipsermonapp.firebaseapp.com",
  projectId: "palousefellowshipsermonapp",
  storageBucket: "palousefellowshipsermonapp.firebasestorage.app",
  messagingSenderId: "591678059434",
  appId: "1:591678059434:web:dfa8631fab9a2295f831d3",

};

const app = initializeApp(firebaseConfig);

// AUTH
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// FIRESTORE
export const db = getFirestore(app);

// STORAGE (THIS FIXES YOUR ERROR)
export const storage = getStorage(app);

// PUSH NOTIFICATIONS
export const messaging = getMessaging(app);

