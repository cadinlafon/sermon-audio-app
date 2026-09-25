import { auth } from "../firebase";
import { getDownloadedMeta } from "./offlineDownloads";

// Best-effort local copy of every audio doc the app has loaded, so the audio
// lists still render when the connection drops. Non-downloaded items show
// (grayed out, see AudioCard); downloaded ones stay playable.
const KEY = "audioCache:v1";
const FETCH_TIMEOUT_MS = 8000;

const readMap = () => {
  try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch { return {}; }
};

// `matchesType` says which slice of the collection `items` is a complete
// answer for, so entries deleted upstream can be dropped from that slice.
export function cacheAudioItems(items, matchesType) {
  try {
    const map = readMap();
    const fresh = new Set(items.map((i) => i.id));
    for (const [id, item] of Object.entries(map)) {
      if (matchesType(item) && !fresh.has(id)) delete map[id];
    }
    for (const item of items) if (item?.id) map[item.id] = JSON.parse(JSON.stringify(item));
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // Storage full or unavailable — caching is optional.
  }
}

export async function getOfflineAudio(matchesType) {
  const byId = new Map(Object.values(readMap()).filter(matchesType).map((i) => [i.id, i]));
  try {
    const user = auth.currentUser;
    if (user) {
      for (const meta of await getDownloadedMeta(user.uid)) {
        if (matchesType(meta) && !byId.has(meta.id)) byId.set(meta.id, meta);
      }
    }
  } catch (error) {
    console.warn("Couldn't read downloaded audio", error);
  }
  return [...byId.values()].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function loadAudioList(fetchFn, matchesType) {
  if (navigator.onLine) {
    try {
      const data = await Promise.race([
        fetchFn(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), FETCH_TIMEOUT_MS)),
      ]);
      cacheAudioItems(data, matchesType);
      return data;
    } catch (error) {
      console.warn("Couldn't load audio list — using the offline copy", error);
    }
  }
  return getOfflineAudio(matchesType);
}
