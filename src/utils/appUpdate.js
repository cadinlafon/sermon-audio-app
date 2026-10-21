import { registerSW } from "virtual:pwa-register";

////////////////////////////////////////////////////////////////
// APP UPDATE DETECTION
//
// Registers the PWA service worker and surfaces "a new version has
// been installed and is waiting" to the UI (UpdatePrompt.jsx).
//
// A browser only re-checks sw.js on navigation and at most about once
// a day on its own, so a tab left open for days (a PWA, or a phone that
// never fully closes the app) would never find out about a deploy.
// This also re-checks every CHECK_INTERVAL_MS and whenever the tab
// becomes visible again.
//
// How the new version is delivered depends on the deploy (see
// vite.config.js): small updates ("auto") refresh the app by themselves
// as soon as it's safe; big ones ("prompt") — and any update that arrives
// while it ISN'T safe (audio playing, someone typing, admin area open) —
// wait for the Refresh button in UpdatePrompt.jsx.
////////////////////////////////////////////////////////////////

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MIN_GAP_BETWEEN_CHECKS_MS = 60 * 1000;
const RELOAD_FALLBACK_MS = 4000;
const SAFE_RECHECK_MS = 20 * 1000;
// If an automatic refresh happened this recently and an update is STILL
// pending, something isn't completing — show the button instead of looping.
const AUTO_LOOP_GUARD_MS = 2 * 60 * 1000;
const AUTO_UPDATE_KEY = "pf-auto-update-at";

let state = { updateReady: false, seq: 0 };
// A small ("auto") update is waiting for a safe moment to apply itself.
let autoPending = false;
const listeners = new Set();
let updateServiceWorker = null;

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

////////////////////////////////////////////////////////////////
// "Is it safe to refresh right now?"
////////////////////////////////////////////////////////////////

const busyKeys = new Set();

// Parts of the app that can't be interrupted register here (e.g. the audio
// player while something is playing).
export function setAppBusy(key, busy) {
  if (busy) busyKeys.add(key);
  else busyKeys.delete(key);
}

function isTypingInField() {
  const el = document.activeElement;
  if (!el || el === document.body) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable === true;
}

function isSafeToRefresh() {
  if (busyKeys.size > 0) return false;
  if (isTypingInField()) return false;
  // Admin pages have long forms and uploads — never refresh under them.
  if (window.location.pathname.startsWith("/admin")) return false;
  return true;
}

export function subscribeToAppUpdates(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAppUpdateState() {
  return state;
}

function showPrompt() {
  // seq lets the prompt tell "same update I already dismissed"
  // apart from a newer deploy landing after a dismissal.
  setState({ updateReady: true, seq: state.seq + 1 });
}

function autoApply() {
  autoPending = false;
  try { sessionStorage.setItem(AUTO_UPDATE_KEY, String(Date.now())); } catch { /* storage unavailable */ }
  setState({ updateReady: false });
  applyAppUpdate();
}

function recentlyAutoUpdated() {
  try {
    const at = Number(sessionStorage.getItem(AUTO_UPDATE_KEY));
    return at > 0 && Date.now() - at < AUTO_LOOP_GUARD_MS;
  } catch {
    return false;
  }
}

// A new version is installed and waiting. Ask the server how this deploy
// wants to be delivered; anything unclear falls back to the button.
async function handleUpdateReady() {
  let mode = "prompt";
  try {
    const response = await fetch(`/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (response.ok) {
      const data = await response.json();
      if (data?.mode === "auto") mode = "auto";
    }
  } catch {
    // offline / blocked — keep the button
  }

  if (mode === "auto" && !recentlyAutoUpdated()) {
    if (isSafeToRefresh()) {
      autoApply();
      return;
    }
    // Not a safe moment: show the button now, and apply on its own as soon
    // as it becomes safe (see the timer / visibility check below).
    autoPending = true;
  }
  showPrompt();
}

export function registerAppUpdates() {
  let registration = null;
  let lastCheckAt = 0;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      handleUpdateReady();
    },
    onRegisteredSW(_swUrl, swRegistration) {
      registration = swRegistration || null;
    },
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  const checkForUpdate = () => {
    if (!registration || registration.installing) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) return;

    const now = Date.now();
    if (now - lastCheckAt < MIN_GAP_BETWEEN_CHECKS_MS) return;
    lastCheckAt = now;

    registration.update().catch(() => {
      // Offline or a transient network error — the next check will retry.
    });
  };

  setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  // A small update that had to wait: refresh once it's safe. Hidden tabs
  // are the ideal moment — nobody sees the reload.
  const applyWhenSafe = () => {
    if (autoPending && isSafeToRefresh()) autoApply();
  };
  setInterval(applyWhenSafe, SAFE_RECHECK_MS);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
    else applyWhenSafe();
  });
}

// Tells the waiting worker to take over; the page reloads itself once
// the new worker is controlling. If that handshake never completes
// (e.g. the waiting worker has already gone), reload anyway so the
// button never appears to do nothing.
export function applyAppUpdate() {
  if (updateServiceWorker) updateServiceWorker(true);
  setTimeout(() => window.location.reload(), RELOAD_FALLBACK_MS);
}
