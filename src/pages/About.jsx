export default function About() {
  return (
    <div style={page}>
      <div style={card}>
        <span style={icon}>🏗️</span>
        <h1 style={title}>Coming Soon</h1>
        <p style={body}>
          This page is still being set up. Check back soon — there's more on the way.
        </p>
      </div>
    </div>
  );
}

const page = {
  background: "var(--color-fdf8f3)",
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 20px",
  fontFamily: "'Georgia', serif",
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