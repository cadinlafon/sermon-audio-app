import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../firebase";

export async function logEvent(event, data = {}) {
  try {
    //////////////////////////////////////////////////
    // SESSION
    //////////////////////////////////////////////////
    let sessionId = localStorage.getItem("sessionId");

    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("sessionId", sessionId);
      localStorage.setItem("sessionStart", Date.now());
    }

    //////////////////////////////////////////////////
    // USER INFO 🔥 (THIS WAS MISSING)
    //////////////////////////////////////////////////
    const currentUser = auth.currentUser;

    let userData = {
      userId: null,
      fullName: null,
      email: null,
    };

    if (currentUser) {
      userData.userId = currentUser.uid;
      userData.email = currentUser.email || null;

      // OPTIONAL: if you stored fullName in Firestore
      // we’ll rely on Logs.jsx mapping instead (better performance)
    }

    //////////////////////////////////////////////////
    // LOG OBJECT
    //////////////////////////////////////////////////
    const logData = {
      event,
      ...data,

      sessionId,

      ...userData, // 🔥 attach user info

      page: window.location.pathname,

      createdAt: serverTimestamp(),
    };

    console.log("Logging event:", logData);

    await addDoc(collection(db, "logs"), logData);

  } catch (error) {
    console.error("Logging error:", error);
  }
}