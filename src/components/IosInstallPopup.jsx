import { useEffect, useRef, useState } from "react";
import { logEvent } from "../utils/logEvent";
import UptodownBadge from "./UptodownBadge";

////////////////////////////////////////////////////////////////
// INSTALL APP POPUP
//
// iPhone (Safari, not installed): an intro, then a tap-through
// walkthrough for "Add to Home Screen", with the Android app
// download underneath.
// Android (browser, not installed): the same intro, then the
// Android app download from Uptodown.
//
// Same look as CreateAccountPopup. "Do not appear again" is
// remembered on this device.
////////////////////////////////////////////////////////////////

const HIDE_FOREVER_KEY = "pf-install-popup-hidden";

const STEPS = [
  { key: "share", title: "Tap the Share button", detail: "It's the square with an arrow in Safari's toolbar, at the bottom of the screen or next to the address bar." },
  { key: "add", title: "Choose “Add to Home Screen”", detail: "Scroll down the share sheet if you don't see it right away." },
  { key: "webapp", title: "Turn on “Open as Web App”", detail: "Make sure the switch is green so it opens like a real app." },
  { key: "confirm", title: "Tap “Add”", detail: "It's in the top-right corner. The app icon then appears on your Home Screen." },
];

function readFlag(key) {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key) {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Storage blocked: the choice just won't persist.
  }
}

export default function IosInstallPopup() {
  const [device, setDevice] = useState(null); // "iphone" | "android" | null
  const [stage, setStage] = useState("intro"); // "intro" | "steps"
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(() => new Set());
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const primaryRef = useRef(null);
  const closeRef = useRef(null);

  //////////////////////////////////////////////////
  // DETECT DEVICE
  //////////////////////////////////////////////////
  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIos = /iphone|ipad|ipod/i.test(ua);
    const isSafari = /^((?!chrome|android|crios|fxios|edgios).)*safari/i.test(ua);
    const isAndroid = /android/i.test(ua);
    const isStandalone =
      window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
    if (isStandalone || readFlag(HIDE_FOREVER_KEY)) return;

    const found = isIos && isSafari ? "iphone" : isAndroid ? "android" : null;
    if (!found) return;
    setDevice(found);
    logEvent("ios_install_popup_shown", { device: found });
  }, []);

  //////////////////////////////////////////////////
  // ACTIONS
  //////////////////////////////////////////////////
  const close = () => {
    if (dontShowAgain) writeFlag(HIDE_FOREVER_KEY);
    logEvent("ios_install_popup_closed", { step: stage === "steps" ? "instructions" : "intro", device, dontShowAgain });
    setDevice(null);
  };

  useEffect(() => {
    closeRef.current = close;
  });

  const start = () => {
    setStage("steps");
    logEvent("ios_install_button_clicked", { device });
  };

  const back = () => {
    setStage("intro");
    setActive(0);
    setDone(new Set());
  };

  const completeStep = (i) => {
    setDone((prev) => new Set(prev).add(i));
    setActive(Math.min(i + 1, STEPS.length - 1));
    if (i === STEPS.length - 1) logEvent("ios_install_steps_completed", { device });
  };

  const androidClicked = () => logEvent("android_app_download_clicked", { source: "install_popup", device });

  //////////////////////////////////////////////////
  // MODAL BEHAVIOR: Escape, scroll lock, focus
  //////////////////////////////////////////////////
  useEffect(() => {
    if (!device) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeRef.current?.();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [device]);

  useEffect(() => {
    if (device) primaryRef.current?.focus({ preventScroll: true });
  }, [device, stage, active]);

  if (!device) return null;

  const allDone = done.size === STEPS.length;
  const iphone = device === "iphone";

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div
      style={overlay}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <style>{KEYFRAMES}</style>
      <div role="dialog" aria-modal="true" aria-labelledby="install-popup-title" style={dialog}>
        {stage === "intro" ? (
          <>
            <div style={appIconWrap} aria-hidden="true">
              <img src="/icons/icon-192.png" alt="" style={appIcon} />
            </div>
            <h2 id="install-popup-title" style={title}>Install the App</h2>
            <p style={bodyLead}>
              {iphone
                ? "Add the PF Sermon App to your Home Screen for faster access and a real app experience."
                : "Get the PF Sermon App on your Android phone for faster access and a real app experience."}
            </p>
            <p style={bodyList}>It opens full screen, launches from your Home Screen, and keeps your place, just like any other app.</p>

            <div style={actions}>
              <div style={column}>
                <button type="button" style={notNowButton} onClick={close}>
                  Not Now
                </button>
                <DontShow checked={dontShowAgain} onChange={setDontShowAgain} />
              </div>
              <div style={column}>
                <button type="button" ref={primaryRef} style={primaryButton} onClick={start}>
                  {iphone ? "Show Me How" : "Get the App"}
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <h2 id="install-popup-title" style={title}>{iphone ? "Add to Home Screen" : "Get the Android App"}</h2>

            {iphone && (
              <>
                <div style={progressRow} aria-hidden="true">
                  {STEPS.map((s, i) => (
                    <span key={s.key} style={{ ...progressDot, ...(done.has(i) ? progressDotDone : i === active ? progressDotActive : null) }} />
                  ))}
                </div>
                <p style={hint} aria-live="polite">
                  {allDone ? "All set! Look for the app on your Home Screen." : `Step ${active + 1} of ${STEPS.length}. Tap a step once you've done it.`}
                </p>

                <ol style={stepList}>
                  {STEPS.map((s, i) => {
                    const isDone = done.has(i);
                    const isActive = i === active && !isDone;
                    return (
                      <li key={s.key} style={{ listStyle: "none" }}>
                        <button
                          type="button"
                          ref={isActive ? primaryRef : undefined}
                          aria-expanded={isActive}
                          onClick={() => (isActive ? completeStep(i) : setActive(i))}
                          style={{ ...stepCard, ...(isActive ? stepCardActive : null), ...(isDone && !isActive ? stepCardDone : null) }}
                        >
                          <span style={{ ...stepNum, ...(isDone ? stepNumDone : isActive ? stepNumActive : null) }}>{isDone ? "✓" : i + 1}</span>
                          <span style={stepText}>
                            <span style={stepTitle}>{s.title}</span>
                            {isActive && (
                              <span style={stepDetailWrap}>
                                <StepVisual step={s.key} />
                                <span style={stepDetail}>{s.detail}</span>
                                <span style={stepCta}>{i === STEPS.length - 1 ? "Tap when done ✓" : "Did it? Tap for the next step →"}</span>
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>

                <div style={divider} role="separator">
                  <span style={dividerLine} />
                  <span style={dividerText}>Using an Android?</span>
                  <span style={dividerLine} />
                </div>
              </>
            )}

            <div style={androidBox}>
              <p style={androidText}>
                {iphone ? "Download the real Android app, free on Uptodown." : "Download the real Android app, free on Uptodown, and install it like any other app."}
              </p>
              <UptodownBadge onClick={androidClicked} linkRef={iphone ? undefined : primaryRef} />
            </div>

            <div style={{ ...actions, marginTop: "20px" }}>
              <div style={column}>
                <button type="button" style={notNowButton} onClick={back}>
                  Back
                </button>
              </div>
              <div style={column}>
                <button type="button" style={allDone ? primaryButton : notNowButton} onClick={close}>
                  {allDone ? "Finish" : "Close"}
                </button>
              </div>
            </div>
            <DontShow checked={dontShowAgain} onChange={setDontShowAgain} />
          </>
        )}
      </div>
    </div>
  );
}

function DontShow({ checked, onChange }) {
  return (
    <label style={checkboxLabel}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={checkbox} />
      Do not appear again
    </label>
  );
}

/** A small picture of what to look for on each step. */
function StepVisual({ step }) {
  if (step === "share") {
    return (
      <span style={visual}>
        <span style={safariBar}>
          <span style={safariDim}>‹</span>
          <span style={safariDim}>›</span>
          <span style={pulseIcon}>
            <svg width="18" height="22" viewBox="0 0 20 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 15V2M5.5 6.5 10 2l4.5 4.5" />
              <path d="M6 10H3.5A1.5 1.5 0 0 0 2 11.5v9A1.5 1.5 0 0 0 3.5 22h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 16.5 10H14" />
            </svg>
          </span>
          <span style={safariDim}>⌑</span>
          <span style={safariDim}>⧉</span>
        </span>
      </span>
    );
  }
  if (step === "add") {
    return (
      <span style={visual}>
        <span style={sheet}>
          <span style={sheetRow}>Copy</span>
          <span style={sheetRow}>Add to Reading List</span>
          <span style={{ ...sheetRow, ...sheetRowHot }}>
            Add to Home Screen
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </span>
        </span>
      </span>
    );
  }
  if (step === "webapp") {
    return (
      <span style={visual}>
        <span style={{ ...sheetRow, ...sheetRowFlat }}>
          Open as Web App
          <span style={toggleTrack}>
            <span style={toggleKnob} />
          </span>
        </span>
      </span>
    );
  }
  return (
    <span style={visual}>
      <span style={{ ...sheetRow, ...sheetRowFlat }}>
        <span style={safariBlue}>Cancel</span>
        <b style={{ fontSize: "12.5px" }}>Add to Home Screen</b>
        <span style={addPill}>Add</span>
      </span>
    </span>
  );
}

////////////////////////////////////////////////////////////////
// STYLES (matches CreateAccountPopup)
////////////////////////////////////////////////////////////////

const KEYFRAMES = `
@keyframes pfInstallPulse { 0%,100% { box-shadow: 0 0 0 0 rgba(201,124,46,0.5); } 50% { box-shadow: 0 0 0 7px rgba(201,124,46,0); } }
@keyframes pfInstallIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes pfInstallKnob { 0%,35% { transform: translateX(0); } 65%,100% { transform: translateX(16px); } }
@keyframes pfInstallTrack { 0%,35% { background: #d6cfc4; } 65%,100% { background: #34c759; } }
`;

// Above the create-account popup (9000) so this one is dismissed first.
const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 9999,
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

const appIconWrap = { display: "flex", justifyContent: "center", marginBottom: "12px" };
const appIcon = { width: "56px", height: "56px", borderRadius: "14px", boxShadow: "0 3px 10px rgba(160,80,20,0.2)" };

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

const hint = {
  margin: "0 0 12px",
  textAlign: "center",
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "var(--color-9b7040)",
};

const progressRow = { display: "flex", justifyContent: "center", gap: "6px", margin: "-4px 0 8px" };
const progressDot = { width: "8px", height: "8px", borderRadius: "999px", background: "var(--color-eddfc8)", transition: "all .25s" };
const progressDotActive = { width: "22px", background: "var(--color-c97c2e)" };
const progressDotDone = { background: "var(--color-a85e18)" };

const stepList = { margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "8px" };

const stepCard = {
  width: "100%",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  textAlign: "left",
  padding: "11px 12px",
  borderWidth: "1px",
  borderStyle: "solid",
  borderColor: "var(--color-eddfc8)",
  borderRadius: "14px",
  background: "var(--color-fdf8f3)",
  cursor: "pointer",
  fontFamily: "sans-serif",
  color: "var(--color-3d2200)",
  outlineOffset: "2px",
  outlineColor: "var(--color-c97c2e)",
  transition: "border-color .2s, background .2s, box-shadow .2s",
};
const stepCardActive = { background: "var(--color-fffdf9)", borderColor: "var(--color-c97c2e)", boxShadow: "0 3px 12px rgba(160,80,20,0.12)" };
const stepCardDone = { opacity: 0.7 };

const stepNum = {
  flexShrink: 0,
  width: "26px",
  height: "26px",
  borderRadius: "999px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "13px",
  fontWeight: 600,
  background: "var(--color-eddfc8)",
  color: "var(--color-7a4f10)",
};
const stepNumActive = { background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)", color: "var(--color-fff8ee)" };
const stepNumDone = { background: "var(--color-a85e18)", color: "var(--color-fff8ee)" };

const stepText = { display: "flex", flexDirection: "column", minWidth: 0, flex: 1, paddingTop: "3px" };
const stepTitle = { fontSize: "14px", fontWeight: 600, lineHeight: 1.4 };
const stepDetailWrap = { display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", animation: "pfInstallIn .25s ease" };
const stepDetail = { fontSize: "13px", lineHeight: 1.55, color: "var(--color-5c3a1e)" };
const stepCta = { fontSize: "12px", fontWeight: 600, color: "var(--color-a85e18)" };

const visual = { display: "flex", justifyContent: "center", padding: "10px", borderRadius: "10px", background: "var(--color-fdf8f3)", border: "1px dashed var(--color-eddfc8)" };
const safariBar = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "14px", width: "100%", maxWidth: "220px", color: "#007aff" };
const safariDim = { color: "#9aa0a6", fontSize: "15px" };
const safariBlue = { color: "#007aff", fontSize: "12.5px" };
const pulseIcon = { display: "inline-flex", padding: "5px 7px", borderRadius: "8px", background: "#fff", animation: "pfInstallPulse 1.6s ease-in-out infinite" };
const sheet = { display: "flex", flexDirection: "column", width: "100%", maxWidth: "240px", borderRadius: "10px", overflow: "hidden", background: "#fff", border: "1px solid #eee" };
const sheetRow = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", padding: "7px 10px", fontSize: "12.5px", color: "#1c1c1e", borderBottom: "1px solid #f0f0f0" };
const sheetRowHot = { fontWeight: 600, borderBottom: "none", background: "rgba(201,124,46,0.12)", animation: "pfInstallPulse 1.6s ease-in-out infinite" };
const sheetRowFlat = { width: "100%", maxWidth: "240px", boxSizing: "border-box", borderRadius: "10px", background: "#fff", border: "1px solid #eee" };
const toggleTrack = { position: "relative", width: "38px", height: "22px", borderRadius: "999px", flexShrink: 0, animation: "pfInstallTrack 1.4s ease-in-out infinite alternate" };
const toggleKnob = { position: "absolute", top: "2px", left: "2px", width: "18px", height: "18px", borderRadius: "999px", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.3)", animation: "pfInstallKnob 1.4s ease-in-out infinite alternate" };
const addPill = { color: "#007aff", fontWeight: 600, fontSize: "13px", padding: "2px 8px", borderRadius: "6px", animation: "pfInstallPulse 1.6s ease-in-out infinite" };

const divider = { display: "flex", alignItems: "center", gap: "10px", margin: "20px 0 12px" };
const dividerLine = { flex: 1, height: "1px", background: "var(--color-eddfc8)" };
const dividerText = { fontSize: "12px", fontFamily: "sans-serif", fontWeight: 600, color: "var(--color-9b7040)", whiteSpace: "nowrap" };

const androidBox = { display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", textAlign: "center" };
const androidText = { margin: 0, fontSize: "13px", lineHeight: 1.55, fontFamily: "sans-serif", color: "var(--color-5c3a1e)" };

const actions = { display: "flex", alignItems: "flex-start", gap: "12px" };
const column = { flex: 1, minWidth: 0 };

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

const primaryButton = {
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
