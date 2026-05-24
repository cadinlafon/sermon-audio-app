import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";

const verses = [
  { text: "I have gone astray like a lost sheep; seek out your servant.", ref: "Psalm 119:176" },
  { text: "For the Son of Man came to seek and to save the lost.", ref: "Luke 19:10" },
  { text: "What man of you, having a hundred sheep, if he has lost one of them, does not leave the ninety-nine in the open country, and go after the one that is lost?", ref: "Luke 15:4" },
];

export default function NotFound() {
  const navigate = useNavigate();
  const [verse] = useState(() => verses[Math.floor(Math.random() * verses.length)]);
  const [dots, setDots] = useState(".");

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "." : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={page}>

      <div style={numberRow}>
        <span style={fourLeft}>4</span>
        <span style={zeroMiddle}>🐑</span>
        <span style={fourRight}>4</span>
      </div>

      <h1 style={title}>Page not found{dots}</h1>

      <p style={subtitle}>
        Looks like this page wandered off. Even the best paths take a wrong turn sometimes.
      </p>

      <div style={verseCard}>
        <p style={verseText}>"{verse.text}"</p>
        <p style={verseRef}>— {verse.ref}</p>
      </div>

      <div style={buttonRow}>
        <button onClick={() => navigate("/")} style={homeButton}>
          ← Take me home
        </button>
        <button
          onClick={() => (window.location.href = "mailto:Cadinlafon@gmail.com?subject=Dead Link Report&body=I found a broken link at: " + window.location.href)}
          style={reportButton}
        >
          Report this link
        </button>
      </div>

    </div>
  );
}

const page = {
  background: "#fdf8f3",
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px 24px",
  fontFamily: "'Georgia', serif",
  textAlign: "center",
};

const numberRow = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  marginBottom: "12px",
  lineHeight: 1,
};

const sharedFour = {
  fontSize: "clamp(72px, 18vw, 120px)",
  color: "#c97c2e",
  fontWeight: "normal",
  lineHeight: 1,
};

const fourLeft = { ...sharedFour };
const fourRight = { ...sharedFour };

const zeroMiddle = {
  fontSize: "clamp(56px, 14vw, 96px)",
  lineHeight: 1,
  animation: "wobble 2.4s ease-in-out infinite",
  display: "inline-block",
};

const title = {
  fontSize: "clamp(18px, 4vw, 26px)",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "10px",
  minWidth: "260px",
};

const subtitle = {
  fontSize: "15px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  maxWidth: "380px",
  lineHeight: 1.6,
  marginBottom: "28px",
};

const verseCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "22px 26px",
  maxWidth: "440px",
  marginBottom: "32px",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const verseText = {
  fontSize: "15px",
  color: "#5c3a1e",
  lineHeight: 1.7,
  fontStyle: "italic",
  margin: "0 0 10px",
};

const verseRef = {
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
  letterSpacing: "0.06em",
  margin: 0,
};

const buttonRow = {
  display: "flex",
  gap: "12px",
  flexWrap: "wrap",
  justifyContent: "center",
};

const homeButton = {
  padding: "12px 24px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 12px rgba(160,80,20,0.28)",
};

const reportButton = {
  padding: "12px 24px",
  borderRadius: "999px",
  border: "1px solid #c8922a",
  background: "transparent",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "sans-serif",
};