import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { DEV_INFO_DEFAULTS, mergeDevInfo } from "../data/devInfoDefaults";
import { isHttpUrl } from "../lib/resourceTypes";
import HumanCheck from "../components/HumanCheck";
import { useAuth } from "../context/AuthContext";

const VERIFIED_KEY = "pf-human-verified";
const VERIFIED_FOR_MS = 30 * 60 * 1000;

function rememberedVerification() {
  try {
    const at = Number(sessionStorage.getItem(VERIFIED_KEY));
    return at > 0 && Date.now() - at < VERIFIED_FOR_MS;
  } catch {
    return false;
  }
}

export default function DevInfo() {
  // Same quick security check as the Contact page, once per visit (it's
  // remembered for 30 minutes). Signed-in admins skip it.
  const { isAdmin } = useAuth();
  const [passed, setPassed] = useState(rememberedVerification);
  const allowed = passed || isAdmin;

  if (!allowed) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Dev Info</h1>
        <p style={pageSubtitle}>Everything about how this app is built.</p>
        <HumanCheck
          title="Verify to see Dev Info"
          body="Complete the quick check below to view how this app is built."
          onVerified={() => {
            try { sessionStorage.setItem(VERIFIED_KEY, String(Date.now())); } catch { /* private mode — just this view */ }
            setPassed(true);
          }}
        />
      </div>
    );
  }

  return <DevInfoContent />;
}

function DevInfoContent() {
  // Content is editable in Admin → Dev Info (stored in Firestore). The page
  // shows the built-in defaults first and swaps in the saved copy when it
  // arrives; if that can't be read it just keeps showing the defaults.
  const [info, setInfo] = useState(() => mergeDevInfo(null));

  useEffect(() => {
    let cancelled = false;
    getDoc(doc(db, "appConfig", "devInfo"))
      .then((snap) => { if (!cancelled && snap.exists()) setInfo(mergeDevInfo(snap.data())); })
      .catch((err) => console.warn("Couldn't load Dev Info content; showing defaults", err));
    return () => { cancelled = true; };
  }, []);

  const { appName, license, githubUrl, liveUrl, techStack, features, backendFunctions, supportText } = info;
  const githubOk = isHttpUrl(githubUrl) ? githubUrl : DEV_INFO_DEFAULTS.githubUrl;
  const liveOk = isHttpUrl(liveUrl) ? liveUrl : DEV_INFO_DEFAULTS.liveUrl;

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
        <InfoRow label="Name" value={appName} />
        <InfoRow label="Version" value={__APP_VERSION__} />
        <InfoRow label="License" value={license} />
        <div style={linkRow}>
          <a href={githubOk} target="_blank" rel="noopener noreferrer" style={linkBtn}>
            💻 GitHub Repo
          </a>
          <a href={liveOk} target="_blank" rel="noopener noreferrer" style={linkBtn}>
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
        {techStack.map((group) => (
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
          {features.map((f) => (
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
        {backendFunctions.map((fn, i) => (
          <div key={fn.name} style={fnRow(i === backendFunctions.length - 1)}>
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
        <p style={supportTextStyle}>
          {supportText}{" "}
          <a href={githubOk} target="_blank" rel="noopener noreferrer" style={inlineLink}>View on GitHub</a>
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
  background: "var(--color-fdf8f3)",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const pageTitle = {
  textAlign: "center",
  fontSize: "28px",
  fontWeight: "normal",
  color: "var(--color-3d2200)",
  marginBottom: "6px",
};

const pageSubtitle = {
  textAlign: "center",
  color: "var(--color-9b7040)",
  fontFamily: "sans-serif",
  fontSize: "15px",
  marginBottom: "32px",
};

const card = {
  background: "var(--color-fffdf9)",
  borderRadius: "18px",
  padding: "22px 24px 18px",
  marginBottom: "16px",
  border: "1px solid var(--color-eddfc8)",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "16px",
  paddingBottom: "12px",
  borderBottom: "1px solid var(--color-eddfc8)",
};

const cardIcon = { fontSize: "18px" };

const cardTitle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "normal",
  color: "var(--color-5c3a1e)",
};

const infoRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 0",
  borderBottom: "1px solid var(--color-f0e4d0)",
  fontFamily: "sans-serif",
};

const infoLabel = {
  fontSize: "13px",
  color: "var(--color-9b7040)",
};

const infoValue = {
  fontSize: "13px",
  color: "var(--color-3d2200)",
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
  border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fdf8f3)",
  color: "var(--color-7a4f10)",
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
  color: "var(--color-b08050)",
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
  background: "var(--color-fbeeda)",
  color: "var(--color-7a4f10)",
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
  background: "var(--color-fdf8f3)",
  border: "1px solid var(--color-f0e4d0)",
};

const featureIcon = { fontSize: "16px" };

const featureLabel = {
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "var(--color-3d2200)",
};

const fnRow = (isLast) => ({
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  padding: "10px 0",
  borderBottom: isLast ? "none" : "1px solid var(--color-f0e4d0)",
});

const fnName = {
  fontFamily: "monospace",
  fontSize: "13px",
  color: "var(--color-3d2200)",
  fontWeight: "600",
};

const fnDesc = {
  fontFamily: "sans-serif",
  fontSize: "12px",
  color: "var(--color-9b7040)",
};

const supportTextStyle = {
  fontFamily: "sans-serif",
  fontSize: "14px",
  color: "var(--color-5c3a1e)",
  lineHeight: 1.7,
  margin: 0,
};

const inlineLink = {
  color: "var(--color-c97c2e)",
  fontWeight: "600",
  textDecoration: "none",
};
