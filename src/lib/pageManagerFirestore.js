////////////////////////////////////////////////////////////////
// PAGE MANAGER — Firestore data layer
//
// Every write to a page's config goes through here so audit
// logging (Change History) always happens consistently.
////////////////////////////////////////////////////////////////

import {
  doc,
  setDoc,
  deleteDoc,
  addDoc,
  getDocs,
  collection,
  query,
  orderBy,
  writeBatch,
  Timestamp,
} from "firebase/firestore";
import { db } from "../firebase";

// Fields worth recording in the audit log when they change.
const TRACKED_FIELDS = [
  "name",
  "navLabel",
  "description",
  "icon",
  "enabled",
  "status",
  "showInNavigation",
  "badgeEnabled",
  "badgeText",
  "badgeType",
  "badgeColor",
  "pinned",
  "order",
  "accessLevel",
  "requiredRole",
  "requireLogin",
  "maintenanceTitle",
  "maintenanceMessage",
  "comingSoonTitle",
  "comingSoonMessage",
];

function diffTrackedFields(before, after) {
  const changes = [];

  for (const field of TRACKED_FIELDS) {
    const from = before ? before[field] : undefined;
    const to = after[field];

    if (JSON.stringify(from ?? null) !== JSON.stringify(to ?? null)) {
      changes.push({ field, from: from ?? null, to: to ?? null });
    }
  }

  if (JSON.stringify(before?.userOverrides ?? null) !== JSON.stringify(after.userOverrides ?? null)) {
    changes.push({ field: "userOverrides", from: "changed", to: "changed" });
  }

  if (JSON.stringify(before?.schedules ?? null) !== JSON.stringify(after.schedules ?? null)) {
    changes.push({ field: "schedules", from: "changed", to: "changed" });
  }

  return changes;
}

async function writeHistoryEntry(pageId, changes, actor, note) {
  if (changes.length === 0 && !note) return;

  await addDoc(collection(db, "pages", pageId, "history"), {
    changes,
    note: note || null,
    changedBy: actor?.email || actor?.uid || "unknown",
    changedByUid: actor?.uid || null,
    at: Timestamp.now(),
  });
}

////////////////////////////////////////////////////////////////
// SAVE (full editor save, or any partial update)
////////////////////////////////////////////////////////////////

export async function savePageConfig(pageId, beforeConfig, updates, actor) {
  const ref = doc(db, "pages", pageId);

  await setDoc(
    ref,
    {
      ...updates,
      updatedAt: Timestamp.now(),
      updatedBy: actor?.email || actor?.uid || "unknown",
    },
    { merge: true }
  );

  const changes = diffTrackedFields(beforeConfig, { ...beforeConfig, ...updates });
  await writeHistoryEntry(pageId, changes, actor);
}

////////////////////////////////////////////////////////////////
// QUICK TOGGLES
////////////////////////////////////////////////////////////////

export async function quickUpdate(pageId, beforeConfig, field, value, actor) {
  return savePageConfig(pageId, beforeConfig, { [field]: value }, actor);
}

////////////////////////////////////////////////////////////////
// RESET TO DEFAULTS
////////////////////////////////////////////////////////////////

export async function resetPageToDefaults(pageId, beforeConfig, actor) {
  await writeHistoryEntry(pageId, [], actor, "Reset to defaults");
  await deleteDoc(doc(db, "pages", pageId));
}

////////////////////////////////////////////////////////////////
// REORDER (drag & drop) — writes a fresh sequential `order` to
// every page in the affected group so ordering never depends on
// in-memory array position.
////////////////////////////////////////////////////////////////

export async function persistOrder(orderedIds, docsById) {
  const batch = writeBatch(db);

  orderedIds.forEach((id, index) => {
    const ref = doc(db, "pages", id);
    batch.set(ref, { ...(docsById[id] || {}), order: index }, { merge: true });
  });

  await batch.commit();
}

////////////////////////////////////////////////////////////////
// BULK ACTIONS
////////////////////////////////////////////////////////////////

export async function applyBulkAction(pageIds, action, baseConfigsById, actor, extra) {
  const batch = writeBatch(db);

  const updatesByAction = {
    lock: { status: "locked" },
    unlock: { status: "active" },
    hide: { showInNavigation: false },
    show: { showInNavigation: true },
    enable: { enabled: true },
    disable: { enabled: false },
    "add-badge": {
      badgeEnabled: true,
      badgeText: extra?.badgeText || "NEW",
      badgeColor: extra?.badgeColor || "amber",
    },
    "remove-badge": { badgeEnabled: false },
  };

  const updates = updatesByAction[action];
  if (!updates) throw new Error(`Unknown bulk action: ${action}`);

  const now = Timestamp.now();

  pageIds.forEach((id) => {
    const ref = doc(db, "pages", id);
    batch.set(
      ref,
      { ...updates, updatedAt: now, updatedBy: actor?.email || actor?.uid || "unknown" },
      { merge: true }
    );
  });

  await batch.commit();

  await Promise.all(
    pageIds.map((id) => {
      const before = baseConfigsById[id];
      const changes = diffTrackedFields(before, { ...before, ...updates });
      return writeHistoryEntry(id, changes, actor, "Bulk action");
    })
  );
}

////////////////////////////////////////////////////////////////
// HISTORY
////////////////////////////////////////////////////////////////

export async function fetchPageHistory(pageId) {
  const q = query(collection(db, "pages", pageId, "history"), orderBy("at", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

////////////////////////////////////////////////////////////////
// USERS (for individual access exceptions)
////////////////////////////////////////////////////////////////

export async function fetchAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => ({
    uid: d.id,
    email: d.data().email || "",
    name: d.data().fullName || d.data().name || "",
  }));
}
