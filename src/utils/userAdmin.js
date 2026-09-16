import { db } from "../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "firebase/firestore";

// Client-side enforcement, same model as the rest of this admin panel —
// there's no Firebase Admin SDK credential wired up here, so this
// can't touch the actual Firebase Auth login. Disable sets a flag
// AuthContext checks and force-signs-out on; delete does that AND
// purges everything else this app can attribute to the account.

export async function disableUser(uid, reason) {
  await updateDoc(doc(db, "users", uid), {
    disabled: true,
    disabledReason: reason || null,
    disabledAt: serverTimestamp(),
  });
}

export async function enableUser(uid) {
  await updateDoc(doc(db, "users", uid), {
    disabled: false,
    disabledReason: deleteField(),
    disabledAt: deleteField(),
  });
}

export async function resetNotificationSubscription(uid) {
  await updateDoc(doc(db, "users", uid), {
    fcmToken: deleteField(),
    pushToken: deleteField(),
  });
}

async function docsWhereUser(collectionName, uid) {
  const snap = await getDocs(query(collection(db, collectionName), where("userId", "==", uid)));
  return snap.docs;
}

// Purges every doc this app can attribute to the user (saved/liked,
// notes, listen progress, aggregate stats) and finally the profile
// doc itself. Older listenProgress docs written before userId/audioId
// were added as real fields won't be caught by this query — a known
// gap, not silently ignored.
export async function deleteUserData(uid) {
  const [saved, notes, progress] = await Promise.all([
    docsWhereUser("saved", uid),
    docsWhereUser("notes", uid),
    docsWhereUser("listenProgress", uid),
  ]);

  await Promise.all([
    ...saved.map((d) => deleteDoc(d.ref)),
    ...notes.map((d) => deleteDoc(d.ref)),
    ...progress.map((d) => deleteDoc(d.ref)),
    deleteDoc(doc(db, "userStats", uid)).catch(() => {}),
  ]);

  await deleteDoc(doc(db, "users", uid));
}

// A full JSON snapshot of everything this app has stored about the
// user, for the admin "Export user data" action.
export async function exportUserData(uid) {
  const [userSnap, statsSnap, saved, notes, progress] = await Promise.all([
    getDoc(doc(db, "users", uid)),
    getDoc(doc(db, "userStats", uid)),
    docsWhereUser("saved", uid),
    docsWhereUser("notes", uid),
    docsWhereUser("listenProgress", uid),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    profile: userSnap.exists() ? { id: userSnap.id, ...userSnap.data() } : null,
    stats: statsSnap.exists() ? statsSnap.data() : null,
    savedSermons: saved.map((d) => ({ id: d.id, ...d.data() })),
    notes: notes.map((d) => ({ id: d.id, ...d.data() })),
    listenProgress: progress.map((d) => ({ id: d.id, ...d.data() })),
  };
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
