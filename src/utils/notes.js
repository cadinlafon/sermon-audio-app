import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

function noteRef(userId, audioId) {
  return doc(db, "notes", `${userId}_${audioId}`);
}

export async function fetchNote(userId, audioId) {
  if (!userId || !audioId) return "";
  try {
    const snap = await getDoc(noteRef(userId, audioId));
    return snap.exists() ? snap.data().text || "" : "";
  } catch (error) {
    console.error("Unable to load note", error);
    return "";
  }
}

export async function saveNote(userId, audioId, text) {
  if (!userId || !audioId) return;
  try {
    await setDoc(noteRef(userId, audioId), { userId, audioId, text, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Unable to save note", error);
  }
}

// Bookmarks are saved on the same per-user, per-audio doc as the note, so they
// need no new Firestore collection: [{ id, t (seconds), label, createdAt (ms) }].
export async function fetchBookmarks(userId, audioId) {
  if (!userId || !audioId) return [];
  try {
    const snap = await getDoc(noteRef(userId, audioId));
    const list = snap.exists() ? snap.data().bookmarks : [];
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.error("Unable to load bookmarks", error);
    return [];
  }
}

export async function saveBookmarks(userId, audioId, bookmarks) {
  if (!userId || !audioId) return;
  try {
    await setDoc(noteRef(userId, audioId), { userId, audioId, bookmarks, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Unable to save bookmarks", error);
  }
}
