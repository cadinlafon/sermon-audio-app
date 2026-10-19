import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ADMIN_IDLE_MS,
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

  useEffect(() => {
    // Coming back to /admin after being away from it for longer than the
    // limit: it should be locked again, same as if it had timed out here.
    const previous = getLastAdminActivity();
    if (previous && Date.now() - previous > ADMIN_IDLE_MS) relockAdmin();
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
      if (Date.now() - last < ADMIN_IDLE_MS) return;
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
  }, [navigate]);
}
