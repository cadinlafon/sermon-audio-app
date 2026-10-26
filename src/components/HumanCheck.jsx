import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

////////////////////////////////////////////////////////////////
// HUMAN CHECK — the Cloudflare Turnstile "quick check" used on the Contact
// page, packaged for other pages (Dev Info, Sign Up). The token is verified
// SERVER-SIDE by the verify-human edge function; the page is told only once
// that succeeds. (Contact keeps its own copy because its function also
// returns the contact details.)
////////////////////////////////////////////////////////////////

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

function useTurnstileScript() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.turnstile);
  useEffect(() => {
    if (window.turnstile) { setReady(true); return; }
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`);
    if (existing) { existing.addEventListener("load", () => setReady(true)); return; }
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);
  return ready;
}

/**
 * @param {() => void} onVerified  called once the server confirms the check passed
 * @param {string}  title/body     card text (full variant)
 * @param {boolean} compact        small inline version (shows "✓ Verified" afterwards)
 */
export default function HumanCheck({ onVerified, title = "Quick security check", body = "Complete the check below to continue.", compact = false }) {
  const scriptReady = useTurnstileScript();
  const hostRef = useRef(null);
  const widgetId = useRef(null);
  const onVerifiedRef = useRef(onVerified);
  onVerifiedRef.current = onVerified;
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  const handleToken = async (token) => {
    setVerifying(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("verify-human", { body: { token } });
      if (invokeError || !data?.success) {
        const responseBody = await invokeError?.context?.json().catch(() => null);
        throw new Error(responseBody?.error || invokeError?.message || "Verification failed.");
      }
      setVerified(true);
      onVerifiedRef.current?.();
    } catch (err) {
      console.error("Human check failed", err);
      setError(err.message || "Verification failed. Please try again.");
      if (widgetId.current) window.turnstile?.reset(widgetId.current);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!scriptReady || verified || !hostRef.current || widgetId.current) return;
    if (!SITE_KEY) { setError("The security check isn't configured yet."); return; }
    widgetId.current = window.turnstile.render(hostRef.current, {
      sitekey: SITE_KEY,
      theme: "auto",
      callback: handleToken,
      "error-callback": () => setError("Verification failed. Please try again."),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, verified]);

  if (verified && compact) return <div style={okLine} role="status">✓ Security check passed</div>;
  if (verified) return null;

  return (
    <div style={compact ? compactBox : card}>
      {!compact && <span style={{ fontSize: "28px" }} aria-hidden="true">🔒</span>}
      <div style={compact ? compactTitle : cardTitle}>{title}</div>
      {!compact && <p style={cardBody}>{body}</p>}
      <div ref={hostRef} style={{ minHeight: "65px", display: "flex", justifyContent: "center" }} />
      {verifying && <p style={hint}>Checking…</p>}
      {error && <p style={errorText} role="alert">{error}</p>}
    </div>
  );
}

const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "16px", padding: "26px 22px", textAlign: "center", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", fontFamily: "sans-serif" };
const cardTitle = { fontFamily: "'Georgia', serif", fontSize: "18px", color: "var(--color-3d2200)", margin: "6px 0" };
const cardBody = { fontSize: "13.5px", color: "var(--color-7a5530)", lineHeight: 1.5, margin: "0 0 14px" };
const compactBox = { display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontFamily: "sans-serif" };
const compactTitle = { fontSize: "12px", color: "var(--color-7a5530)", letterSpacing: "0.04em" };
const okLine = { fontSize: "12.5px", color: "var(--color-2f8a4a)", fontFamily: "sans-serif", textAlign: "center", padding: "6px 0" };
const hint = { fontSize: "12.5px", color: "var(--color-9b7040)", margin: "8px 0 0" };
const errorText = { fontSize: "12.5px", color: "var(--color-b3432c)", margin: "8px 0 0" };
