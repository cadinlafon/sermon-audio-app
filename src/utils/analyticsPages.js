import { useEffect, useState } from "react";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { isHttpUrl } from "../lib/resourceTypes";

////////////////////////////////////////////////////////////////
// ANALYTICS PAGES
//
// The extra entries under "Analytics" in the admin sidebar (besides the
// built-in "App" page): external dashboards such as Microsoft Clarity or
// Google Analytics. Edited in Admin → Advanced; stored in Firestore
// (appConfig/analyticsPages). Until someone saves a list, the two defaults
// below are used.
////////////////////////////////////////////////////////////////

export const DEFAULT_ANALYTICS_PAGES = [
  {
    id: "clarity",
    label: "Microsoft Clarity",
    url: "https://clarity.microsoft.com/projects/view/vs7cr4m9ne/dashboard?date=Last+3+days",
  },
  {
    id: "google-analytics",
    label: "Google Analytics",
    url: "https://analytics.google.com/analytics/web/?authuser=0#/a404812389p550128688/reports/intelligenthome?params=_u..nav%3Dmaui.",
  },
];

const CHANGED_EVENT = "pf-analytics-pages-changed";

function clean(list) {
  return (Array.isArray(list) ? list : [])
    .filter((p) => p && typeof p.label === "string" && p.label.trim() && isHttpUrl(p.url))
    .map((p, i) => ({ id: p.id || `page-${i + 1}`, label: p.label.trim(), url: p.url.trim() }));
}

export async function loadAnalyticsPages() {
  try {
    const snap = await getDoc(doc(db, "appConfig", "analyticsPages"));
    if (snap.exists() && Array.isArray(snap.data().pages)) return clean(snap.data().pages);
  } catch (err) {
    console.warn("Couldn't load analytics pages; using the defaults", err);
  }
  return DEFAULT_ANALYTICS_PAGES;
}

export async function saveAnalyticsPages(pages) {
  await setDoc(doc(db, "appConfig", "analyticsPages"), { pages: clean(pages), updatedAt: serverTimestamp() });
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

// The admin sidebar uses this; it refreshes when Advanced saves a change.
export function useAnalyticsPages() {
  const [pages, setPages] = useState(DEFAULT_ANALYTICS_PAGES);

  useEffect(() => {
    let cancelled = false;
    const refresh = () => loadAnalyticsPages().then((p) => { if (!cancelled) setPages(p); });
    refresh();
    window.addEventListener(CHANGED_EVENT, refresh);
    return () => { cancelled = true; window.removeEventListener(CHANGED_EVENT, refresh); };
  }, []);

  return pages;
}
