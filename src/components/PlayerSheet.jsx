import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

////////////////////////////////////////////////////////////////
// PLAYER SHEET
//
// The full player (pages/Player.jsx) presented as a sheet that slides up
// over whatever page you were on — like the Now Playing screen in a music
// app. It's still the /player route (deep links, back button and every
// navigate("/player") keep working); App.jsx just keeps the previous page
// mounted underneath.
//
//   open   : slides up from the bottom when it mounts. Swiping up on the
//            mini player (MiniPlayer.jsx) is what usually gets you here.
//   close  : swipe DOWN starting in the upper part of the screen (the
//            sheet follows your finger; let go past the halfway-ish point
//            or flick, and it slides away — otherwise it springs back),
//            or the ← Back button, or Escape.
////////////////////////////////////////////////////////////////

const SheetCloseContext = createContext(null);

// Player.jsx's Back button uses this so it animates closed too.
export function useSheetClose() {
  return useContext(SheetCloseContext);
}

const OPEN_MS = 380;
const CLOSE_MS = 300;
const EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
// A swipe-down only starts in this top share of the screen, so dragging the
// seek bar / volume / lower controls never closes the player by accident.
const DRAG_ZONE = 0.6;
const CLOSE_DISTANCE = 0.22; // of screen height
const CLOSE_VELOCITY = 0.55; // px per ms
const AXIS_LOCK_PX = 8;

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

export default function PlayerSheet({ children }) {
  const navigate = useNavigate();
  const sheetRef = useRef(null);
  // "opening" -> "open"; "closing" while sliding away; "dragging" while a finger moves it.
  const [phase, setPhase] = useState("opening");
  const [offset, setOffset] = useState(() => (typeof window !== "undefined" ? window.innerHeight : 800));
  const closingRef = useRef(false);

  // Slide up on mount.
  useEffect(() => {
    const raf = requestAnimationFrame(() => requestAnimationFrame(() => setOffset(0)));
    const done = setTimeout(() => setPhase("open"), reducedMotion() ? 0 : OPEN_MS + 40);
    return () => { cancelAnimationFrame(raf); clearTimeout(done); };
  }, []);

  // The page underneath mustn't scroll while the sheet is up.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  const finishClose = useCallback(() => {
    // Back to the page we came from; if the player was opened directly
    // (nothing in-app to go back to), land on Home instead of leaving the site.
    if ((window.history.state?.idx ?? 0) > 0) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setPhase("closing");
    setOffset(window.innerHeight);
    setTimeout(finishClose, reducedMotion() ? 0 : CLOSE_MS);
  }, [finishClose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !document.querySelector('[role="dialog"]')) close(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Swipe down to close. Native listeners: touchmove has to be non-passive
  // so the page can be stopped from scrolling once we've taken the gesture.
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return undefined;

    let g = null; // { x, y, t, lastY, lastT, v, mode: "pending" | "drag" | "ignore" }

    const onStart = (e) => {
      if (closingRef.current || e.touches.length !== 1) { g = null; return; }
      const t = e.touches[0];
      const inZone = t.clientY < window.innerHeight * DRAG_ZONE;
      const blocked = e.target.closest?.('input[type="range"], textarea, select, [data-no-sheet-drag]');
      if (!inZone || blocked || el.scrollTop > 0) { g = null; return; }
      g = { x: t.clientX, y: t.clientY, t: e.timeStamp, lastY: t.clientY, lastT: e.timeStamp, v: 0, mode: "pending" };
    };

    const onMove = (e) => {
      if (!g || g.mode === "ignore") return;
      const t = e.touches[0];
      const dx = t.clientX - g.x;
      const dy = t.clientY - g.y;
      if (g.mode === "pending") {
        if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
        // Only a mostly-vertical, downward gesture belongs to the sheet.
        if (dy > 0 && Math.abs(dy) > Math.abs(dx)) { g.mode = "drag"; setPhase("dragging"); }
        else { g.mode = "ignore"; return; }
      }
      e.preventDefault();
      const dt = e.timeStamp - g.lastT;
      if (dt > 0) g.v = (t.clientY - g.lastY) / dt;
      g.lastY = t.clientY;
      g.lastT = e.timeStamp;
      // Rubber-band if they pull back above the start.
      setOffset(dy > 0 ? dy : dy * 0.2);
    };

    const onEnd = () => {
      if (!g) return;
      const wasDrag = g.mode === "drag";
      const dy = g.lastY - g.y;
      const v = g.v;
      g = null;
      if (!wasDrag) return;
      if (dy > window.innerHeight * CLOSE_DISTANCE || v > CLOSE_VELOCITY) {
        close();
      } else {
        setPhase("open");
        setOffset(0); // spring back
      }
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [close]);

  const moving = phase !== "open";
  const style = {
    ...sheetBase,
    // At rest there must be NO transform: it would turn the sheet into the
    // containing block for the player's own fixed-position popups.
    transform: phase === "open" && offset === 0 ? "none" : `translate3d(0, ${offset}px, 0)`,
    transition: phase === "dragging" || reducedMotion() ? "none" : `transform ${phase === "closing" ? CLOSE_MS : OPEN_MS}ms ${EASE}`,
    borderTopLeftRadius: moving || offset > 0 ? "22px" : 0,
    borderTopRightRadius: moving || offset > 0 ? "22px" : 0,
    boxShadow: moving || offset > 0 ? "0 -10px 40px rgba(40,18,0,0.28)" : "none",
  };

  return (
    <SheetCloseContext.Provider value={close}>
      <div ref={sheetRef} style={style} role="region" aria-label="Now playing">
        <div style={grabber} aria-hidden="true" />
        {children}
      </div>
    </SheetCloseContext.Provider>
  );
}

const sheetBase = {
  position: "fixed",
  inset: 0,
  zIndex: 2500,
  overflowY: "auto",
  overscrollBehavior: "contain",
  background: "var(--color-fdf8f3)",
  willChange: "transform",
};

// Small handle at the top hinting that the sheet can be pulled down.
const grabber = {
  position: "absolute",
  top: "8px",
  left: "50%",
  transform: "translateX(-50%)",
  width: "40px",
  height: "5px",
  borderRadius: "999px",
  background: "var(--color-eddfc8)",
  pointerEvents: "none",
  zIndex: 1,
};
