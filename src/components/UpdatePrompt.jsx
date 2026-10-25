import { useState, useSyncExternalStore } from "react";
import { applyAppUpdate, getAppUpdateState, subscribeToAppUpdates } from "../utils/appUpdate";

// "New version available — Refresh". Appears only once a new version
// has actually been installed and is waiting (see utils/appUpdate.js).
// "Later" hides it without applying anything, so nobody gets their
// audio cut off — it comes back if an even newer version lands.
export default function UpdatePrompt() {
  const { updateReady, seq, details } = useSyncExternalStore(subscribeToAppUpdates, getAppUpdateState);
  const [dismissedSeq, setDismissedSeq] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  if (!updateReady || dismissedSeq === seq) return null;

  const notes = details?.notes || [];

  return (
    <div style={wrap}>
      <div style={barWrap}>
      <div style={bar} role="status" aria-live="polite">
        <span style={text}>New version available —</span>

        <button
          type="button"
          style={refreshButton}
          disabled={refreshing}
          onClick={() => {
            setRefreshing(true);
            applyAppUpdate();
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>

        {notes.length > 0 && !refreshing && (
          <button
            type="button"
            style={laterButton}
            onClick={() => setShowDetails((v) => !v)}
            aria-expanded={showDetails}
            aria-controls="pf-update-details"
          >
            Details {showDetails ? "▴" : "▾"}
          </button>
        )}

        {!refreshing && (
          <button
            type="button"
            style={laterButton}
            onClick={() => setDismissedSeq(seq)}
            aria-label="Dismiss until later"
          >
            Later
          </button>
        )}
      </div>

      {showDetails && notes.length > 0 && (
        <div id="pf-update-details" style={detailsBox}>
          <div style={detailsTitle}>What changed</div>
          <ul style={detailsList}>
            {notes.map((note, i) => <li key={i} style={detailsItem}>{note}</li>)}
          </ul>
          {details?.version && <div style={detailsVersion}>Version {details.version}</div>}
        </div>
      )}
      </div>
    </div>
  );
}

////////////////////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////////////////////

// Under the sticky top bar; above the nav/mini-player stack (1000) and the
// full-screen player sheet (2500), below modal dialogs.
const wrap = {
  position: "fixed",
  top: "72px",
  left: 0,
  right: 0,
  display: "flex",
  justifyContent: "center",
  padding: "0 16px",
  zIndex: 2600,
  pointerEvents: "none",
};

const barWrap = {
  pointerEvents: "auto",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  maxWidth: "460px",
  width: "100%",
};

const detailsBox = {
  background: "var(--color-fffdf9)",
  border: "1px solid var(--color-eddfc8)",
  borderRadius: "16px",
  boxShadow: "0 8px 28px rgba(40,18,0,0.22)",
  padding: "14px 18px",
  maxHeight: "45vh",
  overflowY: "auto",
  fontFamily: "sans-serif",
  boxSizing: "border-box",
};

const detailsTitle = { fontSize: "12px", fontWeight: "700", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-9b7040)", marginBottom: "8px" };
const detailsList = { margin: 0, paddingLeft: "18px", display: "flex", flexDirection: "column", gap: "6px" };
const detailsItem = { fontSize: "13px", color: "var(--color-3d2200)", lineHeight: 1.45 };
const detailsVersion = { fontSize: "11px", color: "var(--color-b08050)", marginTop: "10px" };

const bar = {
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  width: "100%",
  boxSizing: "border-box",
  padding: "10px 12px 10px 16px",
  background: "var(--color-fffdf9)",
  border: "1px solid var(--color-eddfc8)",
  borderRadius: "999px",
  boxShadow: "0 8px 28px rgba(40,18,0,0.22)",
  fontFamily: "sans-serif",
};

const text = {
  flex: 1,
  fontSize: "13.5px",
  color: "var(--color-3d2200)",
};

const refreshButton = {
  padding: "8px 16px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)",
  color: "var(--color-fff8ee)",
  fontSize: "13px",
  fontWeight: "600",
  fontFamily: "sans-serif",
  cursor: "pointer",
};

const laterButton = {
  padding: "8px 6px",
  border: "none",
  background: "none",
  color: "var(--color-9b7040)",
  fontSize: "12.5px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};
