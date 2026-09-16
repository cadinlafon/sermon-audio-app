import { db } from "../firebase";
import {
  doc,
  setDoc,
  addDoc,
  collection,
  increment,
  serverTimestamp,
} from "firebase/firestore";

const statsRef = (userId) => doc(db, "userStats", userId);

// One row per actual play, for the admin Audio Stats page — unlike
// trackPlay below, this isn't gated on being signed in, so it's the
// only place that captures guest listens at all. userId is null for a
// guest; that's what "who listened" (Guests vs Users) is derived from.
export const recordListen = async ({ sermonId, userId }) => {
  if (!sermonId) return;
  try {
    await addDoc(collection(db, "appUsage"), {
      sermonId,
      userId: userId || null,
      createdAt: serverTimestamp(),
    });
  } catch (err) {
    console.error("Unable to record listen:", err);
  }
};

// A play is recorded once per selected audio item. Time is recorded separately
// so pausing, resuming, or a periodic sync never inflates the play count.
export const trackPlay = async ({ userId, sermonId, title, speaker }) => {
  if (!userId || !sermonId) return;

  try {
    await setDoc(
      statsRef(userId),
      {
        totalPlays: increment(1),
        sermons: {
          [sermonId]: {
            title: title || "Untitled",
            speaker: speaker || "Unknown",
            count: increment(1),
            lastPlayedAt: serverTimestamp(),
          },
        },
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Unable to record play:", err);
  }
};

export const trackListenTime = async ({
  userId,
  sermonId,
  title,
  speaker,
  seconds,
}) => {
  const listenedSeconds = Number(seconds);
  if (!userId || !sermonId || !Number.isFinite(listenedSeconds) || listenedSeconds <= 0) return;

  try {
    await setDoc(
      statsRef(userId),
      {
        totalSeconds: increment(listenedSeconds),

        sermons: {
          [sermonId]: {
            title: title || "Untitled",
            speaker: speaker || "Unknown",
            seconds: increment(listenedSeconds),
            lastPlayedAt: serverTimestamp(),
          },
        },

        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    console.error("Tracking error:", err);
  }
};
