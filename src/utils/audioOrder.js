import { db } from "../firebase";
import { collection, getDocs } from "firebase/firestore";

export async function getNextAudioOrder() {
  const snapshot = await getDocs(collection(db, "audio"));
  let maxOrder = 0;
  snapshot.forEach((doc) => {
    if (doc.data().order > maxOrder) maxOrder = doc.data().order;
  });
  return maxOrder + 1;
}
