import { useState, useSyncExternalStore } from "react";
import { applyAppUpdate, getAppUpdateState, subscribeToAppUpdates } from "../utils/appUpdate";

// "New version available — Refresh". Appears only once a new version
// has actually been installed and is waiting (see utils/appUpdate.js).
// "Later" hides it without applying anything, so nobody gets their
// audio cut off — it comes back if an even newer version lands.
export default function UpdatePrompt() {
  const { updateReady, seq } = useSyncExternalStore(subscribeToAppUpdates, getAppUpdateState);
  const [dismissedSeq, setDismissedSeq] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  if (!updateReady || dismissedSeq === seq) return null;

  return (
    <div style={wrap}>
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

const bar = {
  pointerEvents: "auto",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  maxWidth: "460px",
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
