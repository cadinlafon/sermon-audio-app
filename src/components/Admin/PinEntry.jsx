import { useState } from "react";

// Shared PIN-input UI used by both the full-screen dashboard lock
// (AdminPinScreen) and the in-page action gate (AdminPinModal).
export default function PinEntry({
  title,
  subtitle,
  onSubmit,
  onUsePasskey,
  showPasskeyOption,
  submitting,
  error,
}) {
  const [pin, setPin] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!pin) return;
    onSubmit(pin);
  };

  return (
    <form onSubmit={handleSubmit} style={wrap}>
      <span style={lockIcon}>🔒</span>
      <h2 style={heading}>{title}</h2>
      {subtitle && <p style={subheading}>{subtitle}</p>}

      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoFocus
        value={pin}
        onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 10))}
        placeholder="Enter PIN"
        style={pinInput}
      />

      {error && <p style={errorText}>{error}</p>}

      <button type="submit" disabled={submitting || !pin} style={submitBtn}>
        {submitting ? "Checking…" : "Unlock"}
      </button>

      {showPasskeyOption && (
        <button type="button" onClick={onUsePasskey} disabled={submitting} style={passkeyBtn}>
          🪪 Use Passkey Instead
        </button>
      )}
    </form>
  );
}

const wrap = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  maxWidth: "320px",
  margin: "0 auto",
  textAlign: "center",
};

const lockIcon = { fontSize: "34px", marginBottom: "4px" };

const heading = {
  fontSize: "20px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: 0,
};

const subheading = {
  fontSize: "13px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  margin: "0 0 8px",
};

const pinInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  fontSize: "22px",
  letterSpacing: "0.4em",
  textAlign: "center",
  color: "#3d2200",
  fontFamily: "monospace",
  outline: "none",
  marginTop: "8px",
};

const errorText = {
  color: "#a33622",
  fontSize: "13px",
  fontFamily: "sans-serif",
  margin: 0,
};

const submitBtn = {
  width: "100%",
  padding: "13px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff8ee",
  fontSize: "14px",
  fontWeight: "600",
  fontFamily: "sans-serif",
  cursor: "pointer",
  marginTop: "6px",
};

const passkeyBtn = {
  width: "100%",
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "transparent",
  color: "#7a4f10",
  fontSize: "13px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};
