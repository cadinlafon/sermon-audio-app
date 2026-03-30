import { db } from "../firebase";
import {
  doc,
  setDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";

export const trackListenTime = async ({
  userId,
  sermonId,
  title,
  speaker,
  seconds,
}) => {
  if (!userId || !sermonId || !seconds) return;

  try {
    const ref = doc(db, "userStats", userId);

    await setDoc(
      ref,
      {
        totalSeconds: increment(seconds),

        sermons: {
          [sermonId]: {
            title: title || "Untitled",
            speaker: speaker || "Unknown",
            count: increment(1),
          },
        },

        speakers: {
          [speaker || "Unknown"]: increment(1),
        },

        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Tracking error:", err);
  }
};