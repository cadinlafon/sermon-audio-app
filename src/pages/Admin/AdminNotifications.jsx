export default function AdminNotifications() {
  const openOneSignal = () => window.open("https://dashboard.onesignal.com/apps/1ef262cd-90f7-499d-a3d9-b35ecd259745/push", "_blank");

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Notifications</h1>
        <p style={pageSubtitle}>Send push notifications to app users via OneSignal.</p>
      </div>

      <div style={card}>
        <div style={iconBlock}>
          <span style={bigIcon}>🔔</span>
        </div>
        <h2 style={cardTitle}>Push Notifications</h2>
        <p style={cardBody}>
          Use the OneSignal dashboard to craft and send notifications to your audience.
          You can target all users, specific segments, and schedule sends.
        </p>
        <button style={mainBtn} onClick={openOneSignal}>Open OneSignal Dashboard →</button>
      </div>

      <div style={infoCard}>
        <p style={infoLabel}>What you can do in OneSignal</p>
        <div style={infoGrid}>
          {["Create notifications", "Target users or segments", "Schedule sends", "View delivery analytics"].map((item) => (
            <div key={item} style={infoItem}>
              <span style={checkIcon}>✓</span>
              <span style={infoText}>{item}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={comingCard}>
        <p style={comingTitle}>💡 Presets — Coming Soon</p>
        <p style={comingBody}>Saved notification templates will appear here so you can send common messages in one tap.</p>
      </div>
    </div>
  );
}

const page = { maxWidth: "640px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "18px", padding: "28px", textAlign: "center", marginBottom: "16px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const iconBlock = { marginBottom: "12px" };
const bigIcon = { fontSize: "40px" };
const cardTitle = { fontSize: "20px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: "0 0 10px" };
const cardBody = { fontSize: "14px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.7, margin: "0 0 20px" };
const mainBtn = { display: "inline-block", padding: "13px 24px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "15px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 12px rgba(160,80,20,0.28)" };

const infoCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "20px 24px", marginBottom: "16px" };
const infoLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.08em", textTransform: "uppercase", margin: "0 0 14px" };
const infoGrid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" };
const infoItem = { display: "flex", alignItems: "center", gap: "8px" };
const checkIcon = { width: "20px", height: "20px", borderRadius: "50%", background: "#f6e4b0", color: "#7a5a10", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "11px", flexShrink: 0 };
const infoText = { fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e" };

const comingCard = { background: "#fdf8f3", border: "1px dashed #eddfc8", borderRadius: "14px", padding: "18px 22px" };
const comingTitle = { fontSize: "14px", fontFamily: "sans-serif", color: "#7a4f10", margin: "0 0 6px", fontWeight: "600" };
const comingBody = { fontSize: "13px", fontFamily: "sans-serif", color: "#9b7040", margin: 0, lineHeight: 1.6 };