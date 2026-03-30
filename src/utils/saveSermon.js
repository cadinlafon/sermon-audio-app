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
    // ✅ Save
    await setDoc(ref, {
      userId,
      sermonId: sermon.id,
      title: sermon.title || "Unknown",
      speaker: sermon.speaker || "Unknown",
      createdAt: serverTimestamp()
    });
    return true;
  }
};