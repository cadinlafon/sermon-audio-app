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
// Nothing here swaps versions behind the user's back: the new worker
// waits until applyAppUpdate() is called from the Refresh button.
////////////////////////////////////////////////////////////////

const CHECK_INTERVAL_MS = 30 * 60 * 1000;
const MIN_GAP_BETWEEN_CHECKS_MS = 60 * 1000;
const RELOAD_FALLBACK_MS = 4000;

let state = { updateReady: false, seq: 0 };
const listeners = new Set();
let updateServiceWorker = null;

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeToAppUpdates(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAppUpdateState() {
  return state;
}

export function registerAppUpdates() {
  let registration = null;
  let lastCheckAt = 0;

  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      // seq lets the prompt tell "same update I already dismissed"
      // apart from a newer deploy landing after a dismissal.
      setState({ updateReady: true, seq: state.seq + 1 });
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

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
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
