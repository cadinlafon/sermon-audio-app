import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useShutdown } from "../context/ShutdownContext";
import {
  getLastAdminActivity,
  isAdminBusy,
  recordAdminActivity,
  relockAdmin,
  setAdminExpired,
} from "../utils/adminIdle";

const ACTIVITY_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "scroll", "touchstart"];
const CHECK_EVERY_MS = 10 * 1000;
// pointermove fires constantly — only touch storage this often.
const RECORD_THROTTLE_MS = 5 * 1000;

// Mount once, inside the admin layout. Time is checked against a real
// timestamp (not a single long setTimeout) so it still expires correctly
// after a laptop sleeps or a background tab's timers are throttled.
export default function useAdminIdleTimeout() {
  const navigate = useNavigate();
  // On/off and length are set in Admin → Advanced. Nothing runs until the
  // saved setting has loaded, so a longer limit isn't cut short by the default.
  const { adminTimeoutEnabled, adminTimeoutMinutes, configLoaded } = useShutdown();
  const idleMs = adminTimeoutMinutes * 60 * 1000;

  useEffect(() => {
    if (!configLoaded || !adminTimeoutEnabled) return undefined;

    // Coming back to /admin after being away from it for longer than the
    // limit: it should be locked again, same as if it had timed out here.
    const previous = getLastAdminActivity();
    if (previous && Date.now() - previous > idleMs) relockAdmin();
    recordAdminActivity();

    let lastRecorded = Date.now();
    let expiredNow = false;

    const onActivity = () => {
      const now = Date.now();
      if (now - lastRecorded < RECORD_THROTTLE_MS) return;
      lastRecorded = now;
      recordAdminActivity();
    };

    const check = () => {
      if (expiredNow) return;
      if (isAdminBusy()) {
        recordAdminActivity();
        lastRecorded = Date.now();
        return;
      }
      const last = getLastAdminActivity() ?? lastRecorded;
      if (Date.now() - last < idleMs) return;
      expiredNow = true;
      relockAdmin();
      setAdminExpired(true);
      navigate("/", { replace: true });
    };

    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, onActivity, { passive: true, capture: true }));
    const interval = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, onActivity, { capture: true }));
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [navigate, configLoaded, adminTimeoutEnabled, idleMs]);
}
