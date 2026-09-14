const GITHUB_URL = "https://github.com/cadinlafon/sermon-audio-app";
const LIVE_URL = "https://app.palousefellowship.com";

const TECH_STACK = [
  { group: "Frontend", items: ["React 19", "Vite", "React Router v7", "Progressive Web App (vite-plugin-pwa)"] },
  { group: "Data & Auth", items: ["Firebase Authentication", "Cloud Firestore"] },
  { group: "Backend", items: ["Supabase Edge Functions (Deno)", "Backblaze B2 audio storage"] },
  { group: "Charts", items: ["Recharts"] },
  { group: "Hosting", items: ["Firebase Hosting"] },
];

const FEATURES = [
  { icon: "🎧", label: "Audio Streaming" },
  { icon: "🗂️", label: "Sermon Management" },
  { icon: "🕘", label: "Listen History" },
  { icon: "⏯️", label: "Progress Tracking" },
  { icon: "🔍", label: "Search & Filter" },
  { icon: "📊", label: "Analytics Dashboard" },
  { icon: "📱", label: "Progressive Web App" },
  { icon: "⚡", label: "Real-time Data" },
  { icon: "🤖", label: "AI Audio Summaries" },
  { icon: "🛡️", label: "Restricted Admin Permissions" },
  { icon: "📖", label: "Doctrine Campaigns" },
  { icon: "🔔", label: "Notices & Alerts" },
];

const SUPABASE_FUNCTIONS = [
  { name: "audio-admin", desc: "Admin audio upload & management" },
  { name: "audio-download-url", desc: "Signed URLs for private audio playback" },
  { name: "public-image", desc: "Public image proxy/serving" },
  { name: "summarize-audio", desc: "AI-generated sermon audio summaries" },
];

export default function DevInfo() {
  return (
    <div style={page}>
      <h1 style={pageTitle}>Dev Info</h1>
      <p style={pageSubtitle}>Everything about how this app is built.</p>

      {/* APP INFO */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>📱</span>
          <h2 style={cardTitle}>App Info</h2>
        </div>
        <InfoRow label="Name" value="Sermon Audio App (Palouse Fellowship)" />
        <InfoRow label="Version" value="1.0.0" />
        <InfoRow label="License" value="Open source" />
        <div style={linkRow}>
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={linkBtn}>
            💻 GitHub Repo
          </a>
          <a href={LIVE_URL} target="_blank" rel="noopener noreferrer" style={linkBtn}>
            🌐 Live Demo
          </a>
        </div>
      </div>

      {/* TECH STACK */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>🛠️</span>
          <h2 style={cardTitle}>Tech Stack</h2>
        </div>
        {TECH_STACK.map((group) => (
          <div key={group.group} style={stackGroup}>
            <p style={stackGroupLabel}>{group.group}</p>
            <div style={chipRow}>
              {group.items.map((item) => (
                <span key={item} style={chip}>{item}</span>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* FEATURES */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>🎯</span>
          <h2 style={cardTitle}>Features</h2>
        </div>
        <div style={featureGrid}>
          {FEATURES.map((f) => (
            <div key={f.label} style={featureTile}>
              <span style={featureIcon}>{f.icon}</span>
              <span style={featureLabel}>{f.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* BACKEND FUNCTIONS */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>⚙️</span>
          <h2 style={cardTitle}>Backend Functions</h2>
        </div>
        {SUPABASE_FUNCTIONS.map((fn, i) => (
          <div key={fn.name} style={fnRow(i === SUPABASE_FUNCTIONS.length - 1)}>
            <span style={fnName}>{fn.name}</span>
            <span style={fnDesc}>{fn.desc}</span>
          </div>
        ))}
      </div>

      {/* SUPPORT */}
      <div style={card}>
        <div style={cardHeader}>
          <span style={cardIcon}>📞</span>
          <h2 style={cardTitle}>Support</h2>
        </div>
        <p style={supportText}>
          Found a bug or have a feature request? Open an issue on{" "}
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" style={inlineLink}>
            GitHub
          </a>
          , or use the Suggest a Feature page in the app.
        </p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={infoRow}>
      <span style={infoLabel}>{label}</span>
      <span style={infoValue}>{value}</span>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

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

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 24px 18px",
  marginBottom: "16px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  paddingBottom: "12px",
  borderBottom: "1px solid #eddfc8",
};

const cardIcon = { fontSize: "18px" };

const cardTitle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "normal",
  color: "#5c3a1e",
};

const infoRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid #f0e4d0",
  fontFamily: "sans-serif",
};

const infoLabel = {
  fontSize: "13px",
  color: "#9b7040",
};

const infoValue = {
  fontSize: "13px",
  color: "#3d2200",
  fontWeight: "600",
  textAlign: "right",
};

const linkRow = {
  display: "flex",
  gap: "10px",
  marginTop: "14px",
  flexWrap: "wrap",
};

const linkBtn = {
  flex: "1 1 auto",
  textAlign: "center",
  padding: "11px 16px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#7a4f10",
  fontFamily: "sans-serif",
  fontSize: "13px",
  fontWeight: "600",
  textDecoration: "none",
};

const stackGroup = {
  marginBottom: "14px",
};

const stackGroupLabel = {
  fontSize: "11px",
  fontFamily: "sans-serif",
  color: "#b08050",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  margin: "0 0 8px",
};

const chipRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
};

const chip = {
  padding: "6px 12px",
  borderRadius: "999px",
  background: "#fbeeda",
  color: "#7a4f10",
  fontFamily: "sans-serif",
  fontSize: "12px",
  fontWeight: "500",
};

const featureGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
  gap: "10px",
};

const featureTile = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 12px",
  borderRadius: "12px",
  background: "#fdf8f3",
  border: "1px solid #f0e4d0",
};

const featureIcon = { fontSize: "16px" };

const featureLabel = {
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "#3d2200",
};

const fnRow = (isLast) => ({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "10px 0",
  borderBottom: isLast ? "none" : "1px solid #f0e4d0",
});

const fnName = {
  fontFamily: "monospace",
  fontSize: "13px",
  color: "#3d2200",
  fontWeight: "600",
};

const fnDesc = {
  fontFamily: "sans-serif",
  fontSize: "12px",
  color: "#9b7040",
};

const supportText = {
  fontFamily: "sans-serif",
  fontSize: "14px",
  color: "#5c3a1e",
  lineHeight: 1.7,
  margin: 0,
};

const inlineLink = {
  color: "#c97c2e",
  fontWeight: "600",
  textDecoration: "none",
};
