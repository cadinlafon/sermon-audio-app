import { db } from "../firebase";
import { doc, setDoc, deleteDoc, getDoc, serverTimestamp } from "firebase/firestore";

export const toggleSaveSermon = async (userId, sermon) => {
  if (!userId) return;

  const ref = doc(db, "saved", `${userId}_${sermon.id}`);

  const existing = await getDoc(ref);

  if (existing.exists()) {
    // ❌ Unsave
    await deleteDoc(ref);
    return false;
  } else {
    // Store the complete audio record so a saved item can be played and
    // summarized just like it can from its original listing.
    const { id, ...audio } = sermon;
    await setDoc(ref, {
      ...audio,
      userId,
      sermonId: id,
      title: sermon.title || "Unknown",
      speaker: sermon.speaker || "Unknown",
      createdAt: serverTimestamp()
    });
    return true;
  }
};
