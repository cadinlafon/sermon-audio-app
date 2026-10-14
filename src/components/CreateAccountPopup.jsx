import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { logEvent } from "../utils/logEvent";

////////////////////////////////////////////////////////////////
// CREATE ACCOUNT POPUP
//
// Shown once per app open to signed-out visitors.
//
//   "Not Now"            -> hidden until the next app open
//   "Do not appear again" -> remembered on this device (localStorage)
//                            and honored by BOTH buttons and by
//                            Escape / tapping outside the popup.
//
// The decision to show is made once, the first time auth resolves.
// It is never re-evaluated mid-session, so signing out later does
// not suddenly throw this at someone.
////////////////////////////////////////////////////////////////

const HIDE_FOREVER_KEY = "pf-create-account-popup-hidden"; // localStorage, "1" = never show again on this device
const SEEN_THIS_SESSION_KEY = "pf-create-account-popup-seen"; // sessionStorage, "1" = already shown this app open

// Landing on one of these means the visitor arrived with a specific
// intent (a shared recording, the auth flow, an admin tool) — don't
// put a modal in front of it.
const SUPPRESSED_PREFIXES = ["/login", "/signup", "/agent-authorize", "/admin", "/listen", "/player", "/tv"];

const SHOW_DELAY_MS = 700;

function readStorage(storage, key) {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch {
    // Private browsing / storage blocked — the choice just won't persist.
  }
}

export default function CreateAccountPopup() {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [open, setOpen] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const decidedRef = useRef(false);
  const dialogRef = useRef(null);
  const createButtonRef = useRef(null);
  const notNowHandlerRef = useRef(null);

  //////////////////////////////////////////////////
  // DECIDE WHETHER TO SHOW (once, when auth resolves)
  //////////////////////////////////////////////////
  useEffect(() => {
    if (authLoading || decidedRef.current) return undefined;

    const skip =
      !!user ||
      readStorage(localStorage, HIDE_FOREVER_KEY) === "1" ||
      readStorage(sessionStorage, SEEN_THIS_SESSION_KEY) === "1" ||
      SUPPRESSED_PREFIXES.some((prefix) => location.pathname.startsWith(prefix));

    if (skip) {
      decidedRef.current = true;
      return undefined;
    }

    const timer = setTimeout(() => {
      decidedRef.current = true;
      writeStorage(sessionStorage, SEEN_THIS_SESSION_KEY, "1");
      setOpen(true);
      logEvent("create_account_popup_shown");
    }, SHOW_DELAY_MS);

    return () => clearTimeout(timer);
  }, [authLoading, user, location.pathname]);

  //////////////////////////////////////////////////
  // ACTIONS
  //////////////////////////////////////////////////
  const rememberChoice = () => {
    if (dontShowAgain) writeStorage(localStorage, HIDE_FOREVER_KEY, "1");
  };

  const handleNotNow = () => {
    rememberChoice();
    logEvent("create_account_popup_not_now", { dontShowAgain });
    setOpen(false);
  };

  const handleCreate = () => {
    rememberChoice();
    logEvent("create_account_popup_create_clicked", { dontShowAgain });
    setOpen(false);
    navigate("/signup");
  };

  // The keydown listener below is registered once per open; this ref
  // keeps it pointing at the latest handler (and checkbox state).
  useEffect(() => {
    notNowHandlerRef.current = handleNotNow;
  });

  //////////////////////////////////////////////////
  // MODAL BEHAVIOR: focus, Escape, focus trap, scroll lock
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!open) return undefined;

    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    createButtonRef.current?.focus();

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        notNowHandlerRef.current?.();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll("button, input");
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused && typeof previouslyFocused.focus === "function") {
        previouslyFocused.focus();
      }
    };
  }, [open]);

  if (!open) return null;

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        // Only a press that starts on the dimmed backdrop itself — a text
        // selection that drags out of the dialog shouldn't dismiss it.
        if (e.target === e.currentTarget) handleNotNow();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-account-popup-title"
        aria-describedby="create-account-popup-body"
        style={dialog}
      >
        <h2 id="create-account-popup-title" style={title}>Create Account</h2>

        <div id="create-account-popup-body">
          <p style={bodyLead}>
            Create an Account for the Pf Sermon App to unlock new features:
          </p>
          <p style={bodyList}>
            View your listening stats, Save sermons, Suggest or vote on new features, View your past listens,
            Access settings, Download Audio for Offline use, Automatically save your spot, and more!
          </p>
        </div>

        <div style={actions}>
          <div style={column}>
            <button type="button" style={notNowButton} onClick={handleNotNow}>
              Not Now
            </button>

            <label style={checkboxLabel}>
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                style={checkbox}
              />
              Do not appear again
            </label>
          </div>

          <div style={column}>
            <button type="button" ref={createButtonRef} style={createButton} onClick={handleCreate}>
              Create Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

////////////////////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////////////////////

// Above the nav/mini-player stack (1000) and notification popup (999);
// below the iOS install prompt (9999) so that one, if it's showing,
// is dismissed first.
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 9000,
};

const dialog = {
  width: "100%",
  maxWidth: "400px",
  maxHeight: "100%",
  overflowY: "auto",
  boxSizing: "border-box",
  background: "var(--color-fffdf9)",
  border: "1px solid var(--color-eddfc8)",
  borderRadius: "18px",
  padding: "26px 24px 22px",
  boxShadow: "0 16px 48px rgba(40,18,0,0.3)",
  fontFamily: "'Georgia', serif",
};

const title = {
  margin: "0 0 14px",
  textAlign: "center",
  fontSize: "22px",
  fontWeight: "normal",
  color: "var(--color-3d2200)",
};

const bodyLead = {
  margin: "0 0 10px",
  fontSize: "14px",
  lineHeight: 1.6,
  color: "var(--color-3d2200)",
  fontFamily: "sans-serif",
};

const bodyList = {
  margin: "0 0 22px",
  fontSize: "14px",
  lineHeight: 1.7,
  color: "var(--color-5c3a1e)",
  fontFamily: "sans-serif",
};

const actions = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
};

const column = {
  flex: 1,
  minWidth: 0,
};

const buttonBase = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 14px",
  borderRadius: "999px",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};

const notNowButton = {
  ...buttonBase,
  border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fdf8f3)",
  color: "var(--color-7a4f10)",
};

const createButton = {
  ...buttonBase,
  border: "none",
  background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)",
  color: "var(--color-fff8ee)",
  fontWeight: "600",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};

const checkboxLabel = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "7px",
  marginTop: "12px",
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "var(--color-9b7040)",
  cursor: "pointer",
  userSelect: "none",
};

const checkbox = {
  margin: 0,
  width: "15px",
  height: "15px",
  flexShrink: 0,
  accentColor: "var(--color-c97c2e)",
  cursor: "pointer",
};
