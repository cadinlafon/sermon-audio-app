import {
  addDoc,
  collection,
  serverTimestamp,
  doc,
  getDoc,
  setDoc,
  getDocs,
  deleteDoc,
  query,
  where,
  Timestamp,
} from "firebase/firestore";
import { auth, db } from "../firebase";

// Scoped to "core" admin actions only, per the owner's explicit call — this
// is a deliberate audit trail for sensitive mutations, not a retrofit onto
// every admin write in the app. See src/pages/Admin/Logs.jsx for the viewer.
export const ADMIN_ACTION_CATEGORIES = {
  role_change: "Role & Permissions",
  account_disable: "Account Disable/Enable",
  account_delete: "Account Deletion",
  content_edit: "Content Edit",
  content_delete: "Content Delete",
  settings_change: "Settings Change",
  agent_key: "Agent Keys",
  agent_action: "Agent Actions",
};

function describeDevice() {
  return {
    userAgent: navigator.userAgent,
    platform: navigator.platform || null,
    isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
  };
}

// A device identifier independent of IP address, separate from the
// app-wide analytics sessionId in logEvent.js so it isn't affected by
// that session rotating — persists per-browser for as long as this
// admin keeps using it on this device.
function getAdminDeviceId() {
  let id = localStorage.getItem("adminDeviceId");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("adminDeviceId", id);
  }
  return id;
}

// `before`/`after` are shallow snapshots of just the fields that changed —
// pass plain objects, not full documents, to keep entries small and readable.
export async function logAdminAction({ category, action, targetType, targetId, targetLabel, before, after }) {
  const user = auth.currentUser;
  if (!user) return;

  try {
    await addDoc(collection(db, "adminActions"), {
      category,
      action,
      targetType: targetType || null,
      targetId: targetId || null,
      targetLabel: targetLabel || null,
      before: before ?? null,
      after: after ?? null,
      adminId: user.uid,
      adminEmail: user.email || null,
      adminName: user.displayName || null,
      deviceId: getAdminDeviceId(),
      device: describeDevice(),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Couldn't record admin action", error);
  }
}

//////////////////////////////////////////////////
// RETENTION
//////////////////////////////////////////////////
// There's no scheduled Cloud Function in this app (client-side-enforcement
// model, same as everything else here) — retention is a configured number
// of days plus a manual "Purge now" an admin triggers from the Logs page,
// not an automatic background job.

const RETENTION_DOC = doc(db, "appConfig", "adminLogRetention");

// 0 = keep forever.
export async function fetchRetentionDays() {
  const snap = await getDoc(RETENTION_DOC);
  return snap.exists() ? snap.data().days || 0 : 0;
}

export async function setRetentionDays(days) {
  await setDoc(RETENTION_DOC, { days: Number(days) || 0 }, { merge: true });
}

export async function purgeAdminActionsOlderThan(days) {
  if (!days) return 0;
  const cutoff = Timestamp.fromMillis(Date.now() - days * 24 * 60 * 60 * 1000);
  const snap = await getDocs(query(collection(db, "adminActions"), where("createdAt", "<", cutoff)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
  return snap.docs.length;
}
