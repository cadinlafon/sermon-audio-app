////////////////////////////////////////////////////////////////
// ADMIN INACTIVITY TIMEOUT — shared state
//
// After ADMIN_IDLE_MS with no activity inside the admin dashboard, the
// dashboard re-locks itself, sends the person back to the open screen
// and shows an "inactivity" alert (components/AdminTimeoutAlert.jsx).
// The hook that watches for inactivity is hooks/useAdminIdleTimeout.js.
////////////////////////////////////////////////////////////////

import { useEffect } from "react";
import { PIN_UNLOCK_SESSION_KEY } from "../config/adminSecurity";

// Defaults; admins can turn the timeout off or change the length in
// Admin → Advanced (stored on appConfig/status, see ShutdownContext).
export const DEFAULT_IDLE_MINUTES = 5;
export const MIN_IDLE_MINUTES = 1;
export const MAX_IDLE_MINUTES = 240;
export const ADMIN_IDLE_MS = DEFAULT_IDLE_MINUTES * 60 * 1000;

export function clampIdleMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return DEFAULT_IDLE_MINUTES;
  return Math.min(MAX_IDLE_MINUTES, Math.max(MIN_IDLE_MINUTES, n));
}
export const ADMIN_LAST_ACTIVITY_KEY = "pfAdminLastActivity";

function storageGet(key) {
  try { return sessionStorage.getItem(key); } catch { return null; }
}
function storageSet(key, value) {
  try { sessionStorage.setItem(key, value); } catch { /* private mode — fall back to in-memory only */ }
}
function storageRemove(key) {
  try { sessionStorage.removeItem(key); } catch { /* nothing to clean up */ }
}

export function recordAdminActivity() {
  storageSet(ADMIN_LAST_ACTIVITY_KEY, String(Date.now()));
}

export function getLastAdminActivity() {
  const value = Number(storageGet(ADMIN_LAST_ACTIVITY_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

// Re-lock the dashboard: forget the PIN/passkey unlock for this tab, so the
// next time /admin opens it asks again (when entry is PIN-protected).
export function relockAdmin() {
  storageRemove(PIN_UNLOCK_SESSION_KEY);
  storageRemove(ADMIN_LAST_ACTIVITY_KEY);
}

////////////////////////////////////////////////////////////////
// "Busy" — a long upload isn't inactivity. While something registers
// itself busy, the idle clock doesn't expire the session (otherwise a
// big upload would be cut off mid-way).
////////////////////////////////////////////////////////////////

let busyCount = 0;

export function isAdminBusy() {
  return busyCount > 0;
}

export function markAdminBusy() {
  busyCount++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    busyCount = Math.max(0, busyCount - 1);
    recordAdminActivity();
  };
}

export function useAdminBusy(active = true) {
  useEffect(() => {
    if (!active) return undefined;
    return markAdminBusy();
  }, [active]);
}

////////////////////////////////////////////////////////////////
// Expired notice — survives the route change so the alert can show on
// the open screen after the redirect.
////////////////////////////////////////////////////////////////

let expired = false;
const listeners = new Set();

export function subscribeAdminExpired(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAdminExpired() {
  return expired;
}

export function setAdminExpired(value) {
  expired = value;
  listeners.forEach((l) => l());
}
