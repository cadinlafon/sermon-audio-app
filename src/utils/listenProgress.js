import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Below this many seconds in, a card still reads as "not started" —
// avoids flagging something "in progress" just because a page loaded
// and briefly buffered a couple seconds before the user backed out.
const RESUME_THRESHOLD_SECONDS = 5;
const COMPLETE_RATIO = 0.95;

function progressDocRef(userId, audioId) {
  return doc(db, "listenProgress", `${userId}_${audioId}`);
}

export function statusFromPosition(position, duration) {
  if (!duration || position <= RESUME_THRESHOLD_SECONDS) return "not-started";
  if (position / duration >= COMPLETE_RATIO) return "completed";
  return "in-progress";
}

export async function fetchListenProgress(userId, audioId) {
  if (!userId || !audioId) return null;
  const snap = await getDoc(progressDocRef(userId, audioId));
  return snap.exists() ? snap.data() : null;
}

// Called from AudioPlayerContext as playback progresses/stops.
export async function saveListenProgress(userId, audioId, { position, duration }) {
  if (!userId || !audioId) return;
  const status = statusFromPosition(position, duration);
  if (status === "not-started") return;
  try {
    await setDoc(
      progressDocRef(userId, audioId),
      { position, duration, status, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch (error) {
    console.error("Couldn't save listen progress", error);
  }
}

// The "Change" dropdown — an explicit manual override.
export async function setListenStatus(userId, audioId, status) {
  if (!userId || !audioId) return;
  const data = { status, manual: true, updatedAt: serverTimestamp() };
  if (status === "not-started") data.position = 0;
  await setDoc(progressDocRef(userId, audioId), data, { merge: true });
}
