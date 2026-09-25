// Player preferences, remembered per device (localStorage). Read by
// AudioPlayerContext so they apply everywhere — the player page, mini players,
// lock-screen controls — and survive reloads.
export const SKIP_OPTIONS = [10, 15, 30, 45, 60];
export const SPEED_OPTIONS = [0.75, 1, 1.25, 1.5, 1.75, 2];
export const REPEAT_MODES = ["off", "track", "queue"];

export const DEFAULT_SETTINGS = {
  skipBack: 30,
  skipForward: 30,
  speed: 1,
  volume: 1,
  muted: false,
  repeat: "off",
  shuffle: false,
  // Which collapsible sections on the player page are open, and small UI prefs.
  sections: { recent: true, bookmarks: true, related: true },
  showRemaining: false,
  showNotesWhilePlaying: true,
  // Resume by itself when a Bluetooth / wired audio device reconnects after
  // the browser paused playback because it disconnected (car, headphones).
  autoResumeOnReconnect: true,
};

const KEY = "playerSettings:v1";

function sanitize(raw) {
  const s = { ...DEFAULT_SETTINGS, ...(raw && typeof raw === "object" ? raw : {}) };
  if (!SKIP_OPTIONS.includes(s.skipBack)) s.skipBack = DEFAULT_SETTINGS.skipBack;
  if (!SKIP_OPTIONS.includes(s.skipForward)) s.skipForward = DEFAULT_SETTINGS.skipForward;
  if (!(s.speed >= 0.5 && s.speed <= 3)) s.speed = 1;
  s.volume = Math.min(1, Math.max(0, Number(s.volume)));
  if (!Number.isFinite(s.volume)) s.volume = 1;
  s.muted = !!s.muted;
  if (!REPEAT_MODES.includes(s.repeat)) s.repeat = "off";
  s.shuffle = !!s.shuffle;
  s.sections = { ...DEFAULT_SETTINGS.sections, ...(s.sections || {}) };
  s.showRemaining = !!s.showRemaining;
  s.showNotesWhilePlaying = s.showNotesWhilePlaying !== false;
  s.autoResumeOnReconnect = s.autoResumeOnReconnect !== false;
  return s;
}

export function loadPlayerSettings() {
  try {
    return sanitize(JSON.parse(localStorage.getItem(KEY) || "null"));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function savePlayerSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Private mode / storage full — settings just won't persist.
  }
}

// ---- queue + recently-played persistence ---------------------------------
// Only the fields needed to list and replay an item are kept (drops big
// fields like AI summaries) so these stay small.
export const slimTrack = (t) => ({
  id: t.id,
  title: t.title,
  speaker: t.speaker,
  type: t.type,
  date: t.date,
  duration: t.duration,
  order: t.order,
  createdAt: t.createdAt ? JSON.parse(JSON.stringify(t.createdAt)) : undefined,
  audioStorageKey: t.audioStorageKey,
  transcribeStorageKey: t.transcribeStorageKey,
  collection: t.collection,
});

function loadList(key, max) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(value) ? value.filter((t) => t && t.id).slice(0, max) : [];
  } catch {
    return [];
  }
}
function saveList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // ignore
  }
}

export const loadQueue = () => loadList("playerQueue:v1", 200);
export const saveQueue = (queue) => saveList("playerQueue:v1", queue);
export const loadHistory = () => loadList("playerHistory:v1", 30);
export const saveHistory = (history) => saveList("playerHistory:v1", history);

// "8 recordings · 4h 17m"
export function describeQueue(items) {
  const seconds = items.reduce((sum, t) => sum + (Number(t.duration) || 0), 0);
  const count = `${items.length} recording${items.length === 1 ? "" : "s"}`;
  if (!seconds) return count;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${count} · ${h > 0 ? `${h}h ` : ""}${m}m`;
}
