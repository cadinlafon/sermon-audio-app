import { useEffect } from "react";

export default function AudioAppLanding() {
  useEffect(() => {
    document.title = "Palouse Fellowship Audio App | Sermons, Homilies & Teachings";

    const meta = document.querySelector("meta[name='description']");
    if (meta) {
      meta.setAttribute(
        "content",
        "Listen to Palouse Fellowship sermons, homilies, and Sunday School teachings anytime. The official Palouse Fellowship audio app."
      );
    }
  }, []);

  return (
    <div style={page}>

      {/* HERO BAND */}
      <div style={heroBand}>
        <p style={heroEyebrow}>Palouse Fellowship</p>
        <h1 style={heroTitle}>Audio App</h1>
        <p style={heroSub}>
          Sermons, homilies, and Sunday School teachings — anytime, anywhere.
        </p>
        <a href="/" style={heroButton}>Open the App →</a>
      </div>

      <div style={body}>

        <Section icon="🎙️" title="Sermons, anytime">
          Weekly messages rooted in Scripture, added regularly so you can stay
          connected and keep learning throughout the week — whether you're at
          home, in the car, or on the go.
        </Section>

        <Section icon="📜" title="Homilies & biblical teaching">
          Deeper recordings that unpack Scripture and apply it to everyday life,
          available alongside the weekly sermons in one easy-to-browse library.
        </Section>

        <Section icon="📖" title="Sunday School audio">
          Revisit lessons or catch up on anything you missed. Easy playback,
          organized and ready when you are.
        </Section>

        <div style={reasonsCard}>
          <h2 style={reasonsTitle}>Why use the app?</h2>
          {[
            "Clean, simple audio player",
            "Mobile-friendly on any device",
            "All content in one place",
            "New messages added regularly",
          ].map((r) => (
            <div key={r} style={reasonRow}>
              <span style={checkmark}>✓</span>
              <span style={reasonText}>{r}</span>
            </div>
          ))}
        </div>

        <div style={closingCard}>
          <p style={closingText}>
            Palouse Fellowship Church is committed to faithful Bible teaching
            and helping people grow in their walk with God.
          </p>
          <a href="/" style={closingButton}>Start Listening →</a>
        </div>

      </div>
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div style={sectionCard}>
      <div style={sectionHeader}>
        <span style={sectionIcon}>{icon}</span>
        <h2 style={sectionTitle}>{title}</h2>
      </div>
      <p style={sectionBody}>{children}</p>
    </div>
  );
}

const page = {
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const heroBand = {
  background: "linear-gradient(135deg, #6b3a10 0%, #3d2200 100%)",
  padding: "52px 24px 48px",
  textAlign: "center",
};

const heroEyebrow = {
  margin: "0 0 6px",
  fontSize: "13px",
  letterSpacing: "0.14em",
  textTransform: "uppercase",
  color: "rgba(255,235,190,0.7)",
  fontFamily: "sans-serif",
};

const heroTitle = {
  margin: "0 0 10px",
  fontSize: "clamp(28px, 6vw, 44px)",
  fontWeight: "normal",
  color: "#fff8ee",
  lineHeight: 1.1,
};

const heroSub = {
  margin: "0 0 28px",
  fontSize: "16px",
  color: "rgba(255,235,190,0.8)",
  fontFamily: "sans-serif",
  maxWidth: "480px",
  marginLeft: "auto",
  marginRight: "auto",
  lineHeight: 1.6,
};

const heroButton = {
  display: "inline-block",
  padding: "13px 28px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #e08930 0%, #c97c2e 100%)",
  color: "#fff8ee",
  textDecoration: "none",
  fontSize: "15px",
  fontFamily: "sans-serif",
  boxShadow: "0 4px 18px rgba(0,0,0,0.3)",
  letterSpacing: "0.02em",
};

const body = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
};

const sectionCard = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 24px",
  marginBottom: "16px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.06)",
};

const sectionHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  marginBottom: "10px",
};

const sectionIcon = {
  fontSize: "20px",
};

const sectionTitle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "normal",
  color: "#5c3a1e",
};

const sectionBody = {
  margin: 0,
  fontSize: "15px",
  color: "#7a5530",
  fontFamily: "sans-serif",
  lineHeight: 1.7,
};

const reasonsCard = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "22px 24px",
  marginBottom: "16px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.06)",
};

const reasonsTitle = {
  margin: "0 0 16px",
  fontSize: "17px",
  fontWeight: "normal",
  color: "#5c3a1e",
};

const reasonRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  marginBottom: "10px",
};

const checkmark = {
  width: "22px",
  height: "22px",
  borderRadius: "50%",
  background: "#f6e4b0",
  color: "#7a5a10",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "12px",
  flexShrink: 0,
};

const reasonText = {
  fontFamily: "sans-serif",
  fontSize: "14px",
  color: "#5c3a1e",
};

const closingCard = {
  background: "linear-gradient(135deg, #6b3a10 0%, #3d2200 100%)",
  borderRadius: "18px",
  padding: "28px 24px",
  textAlign: "center",
  marginTop: "8px",
};

const closingText = {
  margin: "0 0 20px",
  color: "rgba(255,235,190,0.85)",
  fontFamily: "sans-serif",
  fontSize: "15px",
  lineHeight: 1.7,
};

const closingButton = {
  display: "inline-block",
  padding: "12px 26px",
  borderRadius: "999px",
  background: "linear-gradient(135deg, #e08930 0%, #c97c2e 100%)",
  color: "#fff8ee",
  textDecoration: "none",
  fontSize: "15px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 14px rgba(0,0,0,0.3)",
};