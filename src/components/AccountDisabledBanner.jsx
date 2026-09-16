import { useAuth } from "../context/AuthContext";

// Shown once, right after AuthContext force-signs someone out because
// their account was disabled — otherwise that sign-out looks like a
// silent, unexplained logout.
export default function AccountDisabledBanner() {
  const { accountDisabledMessage, clearAccountDisabledMessage } = useAuth();
  if (!accountDisabledMessage) return null;

  return (
    <div style={overlay}>
      <div style={card}>
        <span style={{ fontSize: "30px" }}>🚫</span>
        <h2 style={title}>Account Disabled</h2>
        <p style={body}>{accountDisabledMessage}</p>
        <button style={btn} onClick={clearAccountDisabledMessage}>OK</button>
      </div>
    </div>
  );
}

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.55)",
  zIndex: 5000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "32px 28px",
  maxWidth: "380px",
  width: "100%",
  textAlign: "center",
  border: "1px solid #eddfc8",
  fontFamily: "'Georgia', serif",
};

const title = { fontSize: "19px", fontWeight: "normal", color: "#3d2200", margin: "10px 0 8px" };
const body = { fontSize: "13px", color: "#9b7040", fontFamily: "sans-serif", lineHeight: 1.6, margin: "0 0 20px" };
const btn = {
  padding: "11px 24px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};
