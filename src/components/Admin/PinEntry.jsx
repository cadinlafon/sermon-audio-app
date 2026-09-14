import { useState } from "react";

// Shared PIN/password/passkey UI used by both the full-screen dashboard
// lock (AdminPinContext's entry screen) and the in-page action gate
// (AdminPinContext's modal). `mode` toggles between typing the PIN and
// typing the account password; the passkey button (when available)
// works from either mode since it's a one-tap action, not a form.
export default function PinEntry({
  title,
  subtitle,
  onSubmitPin,
  onSubmitPassword,
  onUsePasskey,
  showPinOption = true,
  showPasskeyOption,
  showPasswordOption,
  submitting,
  error,
}) {
  const [mode, setMode] = useState(showPinOption ? "pin" : "password");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (mode === "pin") {
      if (!pin) return;
      onSubmitPin(pin);
    } else {
      if (!password) return;
      onSubmitPassword(password);
    }
  };

  return (
    <form onSubmit={handleSubmit} style={wrap}>
      <span style={lockIcon}>🔒</span>
      <h2 style={heading}>{title}</h2>
      {subtitle && <p style={subheading}>{subtitle}</p>}

      {mode === "pin" ? (
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
      ) : (
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Account password"
          style={passwordInput}
        />
      )}

      {error && <p style={errorText}>{error}</p>}

      <button type="submit" disabled={submitting || (mode === "pin" ? !pin : !password)} style={submitBtn}>
        {submitting ? "Checking…" : "Unlock"}
      </button>

      {mode === "pin" && showPasswordOption && (
        <button type="button" onClick={() => setMode("password")} disabled={submitting} style={secondaryBtn}>
          🔑 Use Account Password Instead
        </button>
      )}

      {mode === "password" && showPinOption && (
        <button type="button" onClick={() => setMode("pin")} disabled={submitting} style={secondaryBtn}>
          ⌨️ Use PIN Instead
        </button>
      )}

      {showPasskeyOption && (
        <button type="button" onClick={onUsePasskey} disabled={submitting} style={secondaryBtn}>
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

const passwordInput = {
  width: "100%",
  boxSizing: "border-box",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  fontSize: "15px",
  textAlign: "center",
  color: "#3d2200",
  fontFamily: "sans-serif",
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

const secondaryBtn = {
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
