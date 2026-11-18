import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "./AuthContext";
import { useAudioPlayer } from "./AudioPlayerContext";
import PopupView from "../components/PopupView";
import { frequencyAllows, markPopupSeen, pathMatches, popupAvailable, sanitizePopup } from "../lib/popups";
import { logEvent } from "../utils/logEvent";

////////////////////////////////////////////////////////////////
// POPUPS — loads the popups an admin made (Admin → Popups) and shows them:
//   • on demand: any rich-text link "popup:ID" or a button with the
//     "Open a popup" action calls openPopup(id)
//   • automatically: "when the app opens" / "on certain pages", with a delay
//     and a how-often rule
// One small read of the `popups` collection per visit.
////////////////////////////////////////////////////////////////

const PopupContext = createContext(null);
const NOOP = { popups: [], openPopup: () => {}, closePopup: () => {}, reload: () => {}, loading: false };

export const usePopups = () => useContext(PopupContext) || NOOP;

export function PopupProvider({ children }) {
  const { user, isAdmin } = useAuth() || {};
  const location = useLocation();
  const { current } = useAudioPlayer() || {};
  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openIds, setOpenIds] = useState([]);
  const shownThisVisit = useRef(new Set());
  const timers = useRef([]);

  const load = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "popups"));
      setPopups(snap.docs.map((d) => sanitizePopup({ id: d.id, ...d.data() })));
    } catch (err) {
      console.warn("Couldn't load popups", err);
    }
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const byId = useMemo(() => new Map(popups.map((p) => [p.id, p])), [popups]);

  const openPopup = useCallback((id) => {
    const p = byId.get(id);
    if (!p || !popupAvailable(p, { user, isAdmin })) return;
    setOpenIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    shownThisVisit.current.add(id);
    logEvent("popup_open", { popupId: id, popupName: p.name || p.title, via: "link" });
  }, [byId, user, isAdmin]);

  const closePopup = useCallback((id) => {
    setOpenIds((ids) => ids.filter((x) => x !== id));
  }, []);

  // Automatic popups: when the app opens / on matching pages.
  const path = location.pathname;
  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (path.startsWith("/admin")) return undefined; // never interrupt the admin panel
    popups.forEach((p) => {
      const mode = p.trigger.mode;
      if (mode === "manual") return;
      if (mode === "page" && !pathMatches(p.trigger.paths, path)) return;
      if (!popupAvailable(p, { user, isAdmin }) || !frequencyAllows(p, shownThisVisit.current)) return;
      const t = setTimeout(() => {
        if (!frequencyAllows(p, shownThisVisit.current)) return;
        shownThisVisit.current.add(p.id);
        markPopupSeen(p);
        setOpenIds((ids) => (ids.includes(p.id) ? ids : [...ids, p.id]));
        logEvent("popup_open", { popupId: p.id, popupName: p.name || p.title, via: "auto" });
      }, Math.max(0, p.trigger.delaySeconds) * 1000 + 400);
      timers.current.push(t);
    });
    return () => { timers.current.forEach(clearTimeout); timers.current = []; };
  }, [popups, path, user, isAdmin]);

  // Auto-close timers (corner alerts / banners).
  useEffect(() => {
    const ts = openIds.map((id) => {
      const p = byId.get(id);
      return p?.trigger.autoCloseSeconds > 0 ? setTimeout(() => closePopup(id), p.trigger.autoCloseSeconds * 1000) : null;
    });
    return () => ts.forEach((t) => t && clearTimeout(t));
  }, [openIds, byId, closePopup]);

  const value = useMemo(() => ({ popups, openPopup, closePopup, reload: load, loading }), [popups, openPopup, closePopup, load, loading]);

  const offset = current ? 134 : 76; // keep clear of the nav bar (and mini player)
  const open = openIds.map((id) => byId.get(id)).filter(Boolean);
  const topSlot = typeof document !== "undefined" ? document.getElementById("pf-banner-top") : null;

  return (
    <PopupContext.Provider value={value}>
      {children}
      {open.map((p) => {
        const view = <PopupView key={p.id} popup={p} user={user} offset={offset} onClose={() => closePopup(p.id)} />;
        return p.type === "banner" && p.position !== "bottom" && topSlot ? createPortal(view, topSlot, p.id) : view;
      })}
    </PopupContext.Provider>
  );
}
