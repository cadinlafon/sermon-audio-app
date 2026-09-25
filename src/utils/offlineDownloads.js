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

export async function downloadForOffline(user, audio) {
  if (!user) throw new Error("Sign in to download audio for offline listening.");

  const count = await getRemoteDownloadCount(user.uid);
  if (count >= MAX_DOWNLOADS) {
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
