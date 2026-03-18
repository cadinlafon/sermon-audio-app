import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

export async function logEvent(type, data = {}) {

  try {

    const logData = {
      type,
      ...data,
      timestamp: serverTimestamp()
    };

    console.log("Logging event:", logData);

    await addDoc(collection(db, "logs"), logData);

    console.log("Log successfully written");

  } catch (error) {

    console.error("Logging error:", error);

  }

}