import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

// The list is ordered by `order`: the highest number is the NEWEST recording
// (listeners see newest first). Normal uploads take the next number up.
export const ADD_TO_TOP = "top";
export const ADD_TO_BOTTOM = "bottom";

// For adding OLDER recordings that aren't in the library yet: numbers below
// the current lowest, so they land at the very bottom of "newest → oldest".
// `count` reserves a block (bulk uploads); the first of the block is returned
// and the rest count up from it, so later files in a batch stay "newer" than
// earlier ones, exactly like a normal upload. Numbers can go below 1 (even
// negative) — that's fine, only their order matters.
export async function getBottomAudioOrder(count = 1) {
  const snapshot = await getDocs(collection(db, "audio"));
  let minOrder = null;
  snapshot.forEach((doc) => {
    const o = doc.data().order;
    if (typeof o === "number" && Number.isFinite(o) && (minOrder === null || o < minOrder)) minOrder = o;
  });
  return (minOrder === null ? 1 : minOrder) - Math.max(1, count);
}

export async function getNextAudioOrder() {
  const snapshot = await getDocs(collection(db, "audio"));
  let maxOrder = 0;
  snapshot.forEach((doc) => {
    if (doc.data().order > maxOrder) maxOrder = doc.data().order;
  });
  return maxOrder + 1;
}
