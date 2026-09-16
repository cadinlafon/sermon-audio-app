import { useEffect, useRef, useState } from "react";
import { supabase } from "../supabase";

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const TURNSTILE_SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";

// The actual email/phone values never live in this file — they're
// only ever returned by the contact-info Edge Function, and only
// after it verifies the Turnstile token server-side. Keeping them out
// of the client bundle entirely is the point: a hidden-until-verified
// <div> would still ship the real values in the JS, readable by any
// scraper regardless of what's rendered.
function useTurnstileScript() {
  const [ready, setReady] = useState(typeof window !== "undefined" && !!window.turnstile);

  useEffect(() => {
    if (window.turnstile) {
      setReady(true);
      return;
    }
    const existing = document.querySelector(`script[src="${TURNSTILE_SCRIPT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => setReady(true));
      return;
    }
    const script = document.createElement("script");
    script.src = TURNSTILE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  return ready;
}

function CopyableValue({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Couldn't copy to clipboard", error);
    }
  };

  return (
    <button type="button" onClick={handleCopy} style={copyValueBtn} title="Click to copy">
      {copied ? "Copied" : text}
      <span style={copied ? { ...copyIcon, ...copyIconDone } : copyIcon}>{copied ? "✓" : "📋"}</span>
    </button>
  );
}

export default function Contact() {
  const scriptReady = useTurnstileScript();
  const widgetHostRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [contacts, setContacts] = useState(null);
  const [error, setError] = useState("");

  const handleToken = async (token) => {
    setVerifying(true);
    setError("");
    try {
      const { data, error: invokeError } = await supabase.functions.invoke("contact-info", { body: { token } });
      if (invokeError || !data?.success) {
        const responseBody = await invokeError?.context?.json().catch(() => null);
        throw new Error(responseBody?.error || invokeError?.message || "Verification failed.");
      }
      setContacts(data.contacts);
      setVerified(true);
    } catch (err) {
      console.error("Contact verification failed", err);
      setError(err.message || "Verification failed. Please try again.");
      if (widgetIdRef.current) window.turnstile?.reset(widgetIdRef.current);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    if (!scriptReady || verified || !widgetHostRef.current || widgetIdRef.current) return;
    if (!TURNSTILE_SITE_KEY) {
      setError("Contact reveal isn't configured yet.");
      return;
    }
    widgetIdRef.current = window.turnstile.render(widgetHostRef.current, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: handleToken,
      "error-callback": () => setError("Verification failed. Please try again."),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scriptReady, verified]);

  return (
    <div style={page}>
      <h1 style={pageTitle}>Get in Touch</h1>
      <p style={pageSubtitle}>We'd love to hear from you.</p>

      {!verified && (
        <div style={captchaCard}>
          <span style={captchaIcon}>🔒</span>
          <h2 style={captchaTitle}>Verify to see contact info</h2>
          <p style={captchaBody}>Complete the quick check below to reveal our email addresses and phone numbers.</p>
          <div ref={widgetHostRef} style={widgetHost} />
          {verifying && <p style={captchaHint}>Checking…</p>}
          {error && <p style={captchaError} role="alert">{error}</p>}
        </div>
      )}

      {/* CHURCH */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>⛪</span>
          <h2 style={cardTitle}>Church</h2>
        </div>

        <div style={row}>
          <span style={label}>Name</span>
          <span style={value}>Jonathan Mcintosh</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Email</span>
          <span style={value}>{verified ? <CopyableValue text={contacts.church.email} /> : "Verify above to view"}</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Phone</span>
          <span style={value}>{verified ? <CopyableValue text={contacts.church.phone} /> : "Verify above to view"}</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>For</span>
          <span style={value}>Sermons, events, and church activities</span>
        </div>

        {verified && (
          <button
            style={emailButton}
            onClick={() => (window.location.href = `mailto:${contacts.church.email}`)}
          >
            ✉ Send Email
          </button>
        )}
      </div>

      {/* APP SUPPORT */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>🛠️</span>
          <h2 style={cardTitle}>App Support</h2>
        </div>

        <div style={row}>
          <span style={label}>Name</span>
          <span style={value}>Cadin LaFon</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Email</span>
          <span style={value}>{verified ? <CopyableValue text={contacts.support.email} /> : "Verify above to view"}</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>Phone</span>
          <span style={value}>{verified ? <CopyableValue text={contacts.support.phone} /> : "Verify above to view"}</span>
        </div>
        <div style={divider} />

        <div style={row}>
          <span style={label}>For</span>
          <span style={value}>Technical issues and feature requests</span>
        </div>

        {verified && (
          <button
            style={emailButton}
            onClick={() => (window.location.href = `mailto:${contacts.support.email}`)}
          >
            ✉ Send Email
          </button>
        )}
      </div>

      <p style={footerNote}>
        Verification helps us cut down on spam bots scraping this page — thanks for bearing with it.
      </p>
    </div>
  );
}

const page = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const pageTitle = {
  textAlign: "center",
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "6px",
};

const pageSubtitle = {
  textAlign: "center",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "15px",
  marginBottom: "32px",
};

const captchaCard = {
  background: "#fffbee",
  border: "1px solid #f0d898",
  borderRadius: "18px",
  padding: "26px 24px",
  marginBottom: "20px",
  textAlign: "center",
};

const captchaIcon = {
  fontSize: "28px",
  display: "block",
  marginBottom: "10px",
};

const captchaTitle = {
  margin: "0 0 6px",
  fontSize: "17px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
};

const captchaBody = {
  margin: 0,
  fontSize: "13px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  lineHeight: 1.6,
};

const widgetHost = {
  display: "flex",
  justifyContent: "center",
  marginTop: "16px",
};

const captchaHint = {
  margin: "10px 0 0",
  fontSize: "12px",
  color: "#9b7040",
  fontStyle: "italic",
  fontFamily: "sans-serif",
};

const captchaError = {
  margin: "10px 0 0",
  fontSize: "13px",
  color: "#a33622",
  fontFamily: "sans-serif",
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 24px 18px",
  marginBottom: "20px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "18px",
  paddingBottom: "14px",
  borderBottom: "1px solid #eddfc8",
};

const cardIcon = {
  fontSize: "20px",
};

const cardTitle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "normal",
  color: "#5c3a1e",
};

const row = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  padding: "10px 0",
  gap: "12px",
  flexWrap: "wrap",
};

const divider = {
  height: "1px",
  background: "#f0e4d0",
};

const label = {
  fontFamily: "sans-serif",
  fontSize: "12px",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
  color: "#b08050",
  flexShrink: 0,
  paddingTop: "1px",
};

const value = {
  color: "#3d2200",
  fontFamily: "sans-serif",
  fontSize: "14px",
  textAlign: "right",
};

const copyValueBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "none",
  border: "none",
  padding: 0,
  color: "#3d2200",
  fontFamily: "sans-serif",
  fontSize: "14px",
  cursor: "pointer",
};

const copyIcon = {
  fontSize: "11px",
  opacity: 0.55,
};

const copyIconDone = {
  opacity: 1,
  color: "#16a34a",
};

const emailButton = {
  marginTop: "18px",
  width: "100%",
  padding: "13px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "15px",
  fontFamily: "sans-serif",
  boxShadow: "0 4px 14px rgba(160,80,20,0.28)",
  letterSpacing: "0.02em",
};

const footerNote = {
  textAlign: "center",
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
  lineHeight: 1.6,
  marginTop: "10px",
  fontStyle: "italic",
};
