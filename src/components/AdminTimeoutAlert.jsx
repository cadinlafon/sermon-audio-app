import { useEffect, useRef, useSyncExternalStore } from "react";
import { useNavigate } from "react-router-dom";
import { getAdminExpired, setAdminExpired, subscribeAdminExpired } from "../utils/adminIdle";

// Shown on the open screen after the admin dashboard times out from
// inactivity (see hooks/useAdminIdleTimeout.js).
export default function AdminTimeoutAlert() {
  const open = useSyncExternalStore(subscribeAdminExpired, getAdminExpired);
  const navigate = useNavigate();
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    buttonRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") setAdminExpired(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  if (!open) return null;

  const signBackIn = () => {
    setAdminExpired(false);
    navigate("/admin");
  };

  return (
    <div style={overlay}>
      <div style={dialog} role="alertdialog" aria-modal="true" aria-labelledby="admin-timeout-title">
        <div style={{ fontSize: "34px", marginBottom: "6px" }} aria-hidden="true">🔒</div>
        <h2 id="admin-timeout-title" style={title}>You were signed out of the admin dashboard due to inactivity</h2>
        <button ref={buttonRef} onClick={signBackIn} style={button}>Sign back in</button>
      </div>
    </div>
  );
}

const overlay = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.45)", zIndex: 5000, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" };
const dialog = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "18px", padding: "28px 24px", maxWidth: "380px", width: "100%", textAlign: "center", boxShadow: "0 16px 48px rgba(40,18,0,0.3)", fontFamily: "sans-serif" };
const title = { fontSize: "17px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif", lineHeight: 1.4, margin: "0 0 20px" };
const button = { padding: "12px 24px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)", color: "var(--color-fff8ee)", fontSize: "14px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
