import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, onSnapshot, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../firebase";

////////////////////////////////////////////////////////////////
// PROBLEM REPORTS
//
// "Report Problem" in the account sidebar → problemReports/{id}. One
// document per report:
//   userId, userName, userEmail   who sent it
//   title, details                what they wrote
//   createdAt
//   tags      [string]   set by admins (prebuilt + custom)
//   replies   [{ body, at (ms), by }]   admin replies, oldest first
//   adminSeen   false until an admin opens it   → red dot on Admin → Reports
//   userUnread  true when an admin has replied and the sender hasn't read it
//                                                 → dot in the sender's sidebar
// Rules (firestore.rules): anyone signed in may create their own and read
// their own; they may only clear `userUnread`. Admins do everything else.
////////////////////////////////////////////////////////////////

export const REPORTS = "problemReports";
export const MAX_TITLE = 120;
export const MAX_DETAILS = 3000;
export const MAX_REPLY = 3000;

// Pre-built tags admins can toggle with one tap. Custom ones can be typed in
// too; any custom tag already used on another report is offered again.
export const PREBUILT_TAGS = [
  "Bug", "Audio / Playback", "Login / Account", "Upload", "Display / Layout", "Feature Request",
  "Needs Info", "In Progress", "Resolved", "Won't Fix", "Duplicate",
];

export const toMillis = (value) => (value?.toMillis ? value.toMillis() : value?.seconds ? value.seconds * 1000 : typeof value === "number" ? value : 0);

export async function createReport(user, { title, details }) {
  const t = String(title || "").trim();
  const d = String(details || "").trim();
  if (!t) throw new Error("Please add a short title.");
  if (!d) throw new Error("Please describe the problem.");
  if (!user) throw new Error("Please sign in to report a problem.");
  await addDoc(collection(db, REPORTS), {
    userId: user.uid,
    userName: user.displayName || user.email?.split("@")[0] || "User",
    userEmail: user.email || "",
    title: t.slice(0, MAX_TITLE),
    details: d.slice(0, MAX_DETAILS),
    createdAt: serverTimestamp(),
    tags: [],
    replies: [],
    adminSeen: false,
    userUnread: false,
  });
}

// ── admin side ──────────────────────────────────────────────
export const markSeenByAdmin = (id, seen = true) => updateDoc(doc(db, REPORTS, id), { adminSeen: seen });
export const setTags = (id, tags) => updateDoc(doc(db, REPORTS, id), { tags });
export const deleteReport = (id) => deleteDoc(doc(db, REPORTS, id));

export async function addReply(report, body, adminName) {
  const text = String(body || "").trim();
  if (!text) throw new Error("Write a reply first.");
  const replies = [...(report.replies || []), { body: text.slice(0, MAX_REPLY), at: Date.now(), by: adminName || "Admin" }];
  // The sender gets a dot until they open it; the admin has obviously seen it.
  await updateDoc(doc(db, REPORTS, report.id), { replies, userUnread: true, adminSeen: true });
  return replies;
}

// ── sender side ─────────────────────────────────────────────
export async function markRepliesRead(ids) {
  await Promise.all(ids.map((id) => updateDoc(doc(db, REPORTS, id), { userUnread: false }).catch(() => {})));
}

////////////////////////////////////////////////////////////////
// Live hooks
////////////////////////////////////////////////////////////////

// How many reports no admin has opened yet (Admin → Reports red dot).
export function useUnseenReportCount(enabled) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!enabled) { setCount(0); return undefined; }
    return onSnapshot(
      query(collection(db, REPORTS), where("adminSeen", "==", false)),
      (snap) => setCount(snap.size),
      () => setCount(0)
    );
  }, [enabled]);
  return count;
}

// The signed-in person's own reports (newest first) and how many have an
// admin reply they haven't read.
export function useMyReports(user) {
  const [reports, setReports] = useState([]);
  useEffect(() => {
    if (!user) { setReports([]); return undefined; }
    return onSnapshot(
      query(collection(db, REPORTS), where("userId", "==", user.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setReports(list);
      },
      () => setReports([])
    );
  }, [user]);
  return { reports, unread: reports.filter((r) => r.userUnread === true).length };
}
