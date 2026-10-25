import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { supabase } from "../supabase";

////////////////////////////////////////////////////////////////
// CLARITY INSIGHTS
//
// Microsoft Clarity's data-export API allows only 10 requests a DAY for
// the whole project, so the admin Analytics page never calls it directly or
// on every visit. The newest result is cached in Firestore
// (appConfig/clarityInsights) where every admin sees it, and a fresh call
// happens only when:
//   • an admin presses Refresh, or
//   • the cached copy is older than AUTO_REFRESH_AFTER_MS (so the page
//     self-updates a few times a day without anyone pressing anything).
// Refreshes stop at DAILY_REFRESH_BUDGET so 2 of the 10 calls are always
// left over for the day. The token itself lives only in the clarity-insights
// edge function (a server-side secret) — never in this app.
////////////////////////////////////////////////////////////////

export const CACHE_PATH = ["appConfig", "clarityInsights"];
export const NUM_OF_DAYS = 3;                       // matches the "Last 3 days" Clarity view
export const AUTO_REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
export const DAILY_REFRESH_BUDGET = 8;

const utcDay = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);

export async function loadCachedInsights() {
  try {
    const snap = await getDoc(doc(db, ...CACHE_PATH));
    if (!snap.exists()) return null;
    const d = snap.data();
    // Stored as a JSON string: Clarity's rows are arrays of arbitrary maps,
    // and one string keeps the document shape trivial.
    const data = typeof d.json === "string" ? JSON.parse(d.json) : null;
    if (!Array.isArray(data)) return null;
    return { data, fetchedAt: d.fetchedAt || 0, numOfDays: d.numOfDays || NUM_OF_DAYS, calls: d.calls || { day: "", count: 0 } };
  } catch (err) {
    console.warn("Couldn't read cached Clarity insights", err);
    return null;
  }
}

export const callsUsedToday = (cached) => (cached?.calls?.day === utcDay() ? cached.calls.count || 0 : 0);
export const refreshesLeftToday = (cached) => Math.max(0, DAILY_REFRESH_BUDGET - callsUsedToday(cached));
export const isStale = (cached) => !cached || Date.now() - cached.fetchedAt > AUTO_REFRESH_AFTER_MS;

/**
 * Ask Clarity for fresh data (one of the day's calls), cache it for every
 * admin, and return it. Throws an Error with a readable message.
 */
export async function refreshInsights(cached) {
  if (refreshesLeftToday(cached) <= 0) {
    throw new Error("Today's Clarity refreshes are used up (the limit is 10 a day, 2 are kept in reserve). Showing the last saved data.");
  }
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again.");

  const token = await user.getIdToken();
  const { data, error } = await supabase.functions.invoke("clarity-insights", {
    headers: { Authorization: `Bearer ${token}` },
    body: { numOfDays: NUM_OF_DAYS },
  });
  if (error) {
    const body = await error.context?.json?.().catch(() => null);
    throw new Error(body?.error || error.message || "Couldn't load Clarity data.");
  }
  if (!Array.isArray(data?.data)) throw new Error(data?.error || "Clarity returned no data.");

  const calls = { day: utcDay(), count: callsUsedToday(cached) + 1 };
  const fresh = { data: data.data, fetchedAt: data.fetchedAt || Date.now(), numOfDays: NUM_OF_DAYS, calls };
  try {
    await setDoc(doc(db, ...CACHE_PATH), { json: JSON.stringify(fresh.data), fetchedAt: fresh.fetchedAt, numOfDays: NUM_OF_DAYS, calls });
  } catch (err) {
    console.warn("Couldn't save the Clarity cache (other admins won't see it until next refresh)", err);
  }
  return fresh;
}

////////////////////////////////////////////////////////////////
// Reading Clarity's response
////////////////////////////////////////////////////////////////

// Metric rows by name, e.g. byMetric(data).Traffic -> array of rows.
export function byMetric(data) {
  const out = {};
  for (const m of Array.isArray(data) ? data : []) {
    if (m && typeof m.metricName === "string" && Array.isArray(m.information)) out[m.metricName] = m.information;
  }
  return out;
}

export function formatDuration(seconds) {
  const s = Math.round(Number(seconds) || 0);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}
