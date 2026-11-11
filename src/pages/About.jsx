export default function About() {
  return (
    <div style={page}>
      <div style={main}>
        <div style={card}>
          <span style={icon}>🏗️</span>
          <h1 style={title}>Coming Soon</h1>
          <p style={body}>
            This page is still being set up. Check back soon — there's more on the way.
          </p>
        </div>
      </div>

      {/* Android app download — pinned to the bottom of the page */}
      <div style={footer}>
        <a
          href="https://palouse-fellowship-audio.en.uptodown.com/android"
          title="Download Palouse Fellowship Audio"
          target="_blank"
          rel="noopener noreferrer"
          style={downloadLink}
        >
          <img
            src="https://stc.utdstc.com/img/mediakit/download-aao-big.png"
            alt="Download Palouse Fellowship Audio"
            style={downloadImg}
          />
        </a>
      </div>
    </div>
  );
}

const page = {
  background: "var(--color-fdf8f3)",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box",
  padding: "40px 20px 24px",
  fontFamily: "'Georgia', serif",
};

const main = {
  flex: 1,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const footer = {
  display: "flex",
  justifyContent: "center",
  paddingTop: "24px",
};

const card = {
  background: "var(--color-fffdf9)",
  borderRadius: "20px",
  padding: "48px 36px",
  maxWidth: "480px",
  width: "100%",
  textAlign: "center",
  border: "1px solid var(--color-eddfc8)",
  boxShadow: "0 4px 20px rgba(160,100,40,0.08)",
};

const icon = {
  fontSize: "40px",
  display: "block",
  marginBottom: "16px",
};

const title = {
  fontSize: "26px",
  fontWeight: "normal",
  color: "var(--color-3d2200)",
  marginBottom: "14px",
};

const body = {
  fontSize: "16px",
  color: "var(--color-9b7040)",
  lineHeight: 1.7,
  fontFamily: "sans-serif",
  margin: 0,
};
const downloadLink = {
  display: "inline-block",
  lineHeight: 0,
};

const downloadImg = {
  display: "block",
  width: "100%",
  maxWidth: "240px",
  height: "auto",
};
