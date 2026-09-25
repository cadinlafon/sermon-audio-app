import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { supabase } from "../supabase";

export const MAX_DOWNLOADS = 5;

// Lets lists, filters and the Downloads page refresh when a download is added or removed.
export const notifyDownloadsChanged = () => window.dispatchEvent(new Event("downloads-changed"));

// The actual audio bytes live in IndexedDB — per-device, never synced.
// users/{uid}.downloads in Firestore is the cross-device source of truth
// for the 5-download cap, so switching devices doesn't reset it, even
// though a download made on one device isn't automatically usable on
// another (there's no server-side sync of the cached bytes themselves).
const DB_NAME = "offlineAudio";
const STORE_NAME = "downloads";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function localKey(userId, audioId) {
  return `${userId}_${audioId}`;
}

async function putRecord(record) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getRecord(key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).get(key);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

async function deleteRecord(key) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function isDownloadedLocally(userId, audioId) {
  if (!userId) return false;
  const record = await getRecord(localKey(userId, audioId));
  return !!record;
}

// Used by playback when offline — resolves straight to the cached blob
// instead of requesting a signed URL from the network.
export async function getLocalBlobUrl(userId, audioId) {
  if (!userId) return null;
  const record = await getRecord(localKey(userId, audioId));
  if (!record?.blob) return null;
  return URL.createObjectURL(record.blob);
}

// Metadata for everything this user has downloaded on this device — lets the
// lists render downloaded audio while offline even without a cached list.
export async function getDownloadedMeta(userId) {
  if (!userId) return [];
  const database = await openDatabase();
  const prefix = `${userId}_`;
  return new Promise((resolve, reject) => {
    const out = [];
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(out);
      const r = cursor.value;
      if (String(r.key).startsWith(prefix)) {
        // Downloads made before metadata was stored fall back to what was saved.
        out.push(r.meta?.id ? r.meta : { id: r.audioId, title: r.title, speaker: r.speaker, type: r.type });
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

async function fetchAudioBlob(audio, token) {
  const body = audio.audioStorageKey
    ? { storageKey: audio.audioStorageKey }
    : { audioId: audio.id, collection: audio.collection || "audio" };

  const { data, error } = await supabase.functions.invoke("audio-download-url", {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    body,
  });
  if (error || !data?.url) {
    throw new Error("Couldn't get a download link for this audio.");
  }

  const response = await fetch(data.url);
  if (!response.ok) throw new Error("Couldn't download this audio.");
  return response.blob();
}

export async function getRemoteDownloadCount(userId) {
  if (!userId) return 0;
  const snap = await getDoc(doc(db, "users", userId));
  const downloads = snap.exists() ? snap.data().downloads : null;
  return Array.isArray(downloads) ? downloads.length : 0;
}

// The account is charged for downloads on every device, but this device's own
// copies always count too, so the cap holds even if the account record lags.
export async function getDownloadCount(userId) {
  const [remote, local] = await Promise.all([getRemoteDownloadCount(userId).catch(() => 0), getDownloadedMeta(userId).then((l) => l.length).catch(() => 0)]);
  return Math.max(remote, local);
}

export async function downloadForOffline(user, audio) {
  if (!user) throw new Error("Sign in to download audio for offline listening.");

  const count = await getDownloadCount(user.uid);
  if (count >= MAX_DOWNLOADS && !(await isDownloadedLocally(user.uid, audio.id))) {
    throw new Error(`You've reached the limit of ${MAX_DOWNLOADS} downloads. Remove one before adding another.`);
  }

  const token = await user.getIdToken();
  const blob = await fetchAudioBlob(audio, token);

  await putRecord({
    key: localKey(user.uid, audio.id),
    audioId: audio.id,
    title: audio.title || "",
    speaker: audio.speaker || "",
    type: audio.type || "",
    // Full doc copy so the audio lists can still show this item offline.
    meta: JSON.parse(JSON.stringify(audio)),
    blob,
    downloadedAt: Date.now(),
  });

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() && Array.isArray(snap.data().downloads) ? snap.data().downloads : [];
  const next = [
    ...existing.filter((d) => d.audioId !== audio.id),
    { audioId: audio.id, title: audio.title || "", downloadedAt: Date.now() },
  ];
  await updateDoc(userRef, { downloads: next });
  notifyDownloadsChanged();
}

export async function removeOfflineDownload(user, audioId) {
  if (!user) return;
  await deleteRecord(localKey(user.uid, audioId));

  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() && Array.isArray(snap.data().downloads) ? snap.data().downloads : [];
  const next = existing.filter((d) => d.audioId !== audioId);
  await updateDoc(userRef, { downloads: next });
  notifyDownloadsChanged();
}

////////////////////////////////////////////////////////////////
// DOWNLOADS PAGE HELPERS
////////////////////////////////////////////////////////////////

// Everything downloaded on this device for this user, with size and date.
export async function listDownloads(userId) {
  if (!userId) return [];
  const database = await openDatabase();
  const prefix = `${userId}_`;
  return new Promise((resolve, reject) => {
    const out = [];
    const request = database.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).openCursor();
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return resolve(out);
      const r = cursor.value;
      if (String(r.key).startsWith(prefix)) {
        out.push({
          audioId: r.audioId,
          meta: r.meta?.id ? r.meta : { id: r.audioId, title: r.title, speaker: r.speaker, type: r.type },
          size: r.blob?.size || 0,
          downloadedAt: r.downloadedAt || 0,
        });
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
}

// Entries the account is charged for (across all devices) — includes ones
// whose audio isn't on this device, so they can be released.
export async function getRemoteDownloads(userId) {
  if (!userId) return [];
  const snap = await getDoc(doc(db, "users", userId));
  const list = snap.exists() ? snap.data().downloads : null;
  return Array.isArray(list) ? list : [];
}

// Undo support: hand back exactly what was stored so it can be restored.
export async function getDownloadRecord(userId, audioId) {
  return getRecord(localKey(userId, audioId));
}

export async function restoreDownloadRecord(user, record) {
  await putRecord(record);
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const existing = snap.exists() && Array.isArray(snap.data().downloads) ? snap.data().downloads : [];
  await updateDoc(userRef, { downloads: [...existing.filter((d) => d.audioId !== record.audioId), { audioId: record.audioId, title: record.title || "", downloadedAt: record.downloadedAt || Date.now() }] });
  notifyDownloadsChanged();
}

// Downloads as many as fit in the remaining slots, newest first. Returns counts.
export async function downloadMany(user, audios, onProgress) {
  const used = await getDownloadCount(user.uid);
  const have = new Set((await listDownloads(user.uid)).map((d) => d.audioId));
  const todo = audios.filter((a) => !have.has(a.id));
  const room = Math.max(0, MAX_DOWNLOADS - used);
  const batch = todo.slice(0, room);
  let done = 0;
  for (const audio of batch) {
    onProgress?.(done, batch.length, audio);
    await downloadForOffline(user, audio);
    done++;
  }
  return { done, skippedForLimit: todo.length - batch.length, alreadyHad: audios.length - todo.length };
}

// "Download for later": remembered on this device and fetched automatically
// once you're online with a free slot.
const PENDING_KEY = "pendingDownloads:v1";
const readPending = () => { try { return JSON.parse(localStorage.getItem(PENDING_KEY) || "[]"); } catch { return []; } };
const writePending = (list) => { try { localStorage.setItem(PENDING_KEY, JSON.stringify(list)); } catch { /* ignore */ } window.dispatchEvent(new Event("pending-downloads-changed")); };

export const getPendingDownloads = (userId) => readPending().filter((p) => p.userId === userId).map((p) => p.audio);
export function downloadForLater(user, audio) {
  const list = readPending().filter((p) => !(p.userId === user.uid && p.audio.id === audio.id));
  list.push({ userId: user.uid, audio: JSON.parse(JSON.stringify(audio)) });
  writePending(list);
}
export function cancelPendingDownload(user, audioId) {
  writePending(readPending().filter((p) => !(p.userId === user.uid && p.audio.id === audioId)));
}

// Fetches queued downloads (oldest first) until the queue empties or slots run out.
export async function processPendingDownloads(user) {
  if (!user || !navigator.onLine) return { done: 0 };
  let done = 0;
  for (const item of readPending().filter((p) => p.userId === user.uid)) {
    try {
      await downloadForOffline(user, item.audio);
      cancelPendingDownload(user, item.audio.id);
      done++;
    } catch (error) {
      if (/limit/i.test(error.message)) break; // no free slots — keep the rest queued
      console.warn("Queued download failed, will retry later", error);
    }
  }
  return { done };
}
