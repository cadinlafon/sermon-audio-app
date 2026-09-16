import { doc, getDoc, setDoc, increment, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";

// Client-side only, same as the rest of this app's admin controls —
// there's no deployed Firestore rules backing this up, so this is a
// UX gate on the sign-up flows, not a hard guarantee against someone
// calling Firebase Auth directly.

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function countDocRef() {
  return doc(db, "registrationCounts", todayKey());
}

export async function checkRegistrationAllowed() {
  const configSnap = await getDoc(doc(db, "appConfig", "status"));
  const config = configSnap.exists() ? configSnap.data() : {};

  if (config.registrationEnabled === false) {
    return { allowed: false, reason: "New sign-ups are currently closed. Please check back later." };
  }

  const maxDaily = Number(config.maxDailyRegistrations) || 0;
  if (maxDaily > 0) {
    const countSnap = await getDoc(countDocRef());
    const count = countSnap.exists() ? countSnap.data().count || 0 : 0;
    if (count >= maxDaily) {
      return { allowed: false, reason: "We've reached today's sign-up limit. Please try again tomorrow." };
    }
  }

  return { allowed: true };
}

export async function recordRegistration() {
  try {
    await setDoc(countDocRef(), { count: increment(1), updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Couldn't record registration count", error);
  }
}
