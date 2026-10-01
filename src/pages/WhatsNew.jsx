import { useState } from "react";
import { WHATS_NEW } from "../data/whatsNew";

const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

function formatDate(iso) {
  const [year, month, day] = iso.split("-").map(Number);
  return { month: MONTHS[month - 1], day, year };
}

function UpdateCard({ entry }) {
  const [expanded, setExpanded] = useState(false);
  const { month, day } = formatDate(entry.date);
  const hasMinor = entry.minor && entry.minor.length > 0;

  return (
    <div style={card}>
      <div style={dateCol}>
        <span style={dateMonth}>{month}</span>
        <span style={dateDay}>{day}</span>
      </div>

      <div style={contentCol}>
        <h2 style={title}>{entry.title}</h2>
        <p style={details}>{entry.details}</p>

        {hasMinor && (
          <div style={minorWrap}>
            <button
              style={minorToggle}
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
            >
              <span style={minorChevron(expanded)}>▾</span>
              {expanded ? "Hide smaller updates" : `${entry.minor.length} smaller update${entry.minor.length === 1 ? "" : "s"} included`}
            </button>

            {expanded && (
              <ul style={minorList}>
                {entry.minor.map((item, i) => (
                  <li key={i} style={minorItem}>
                    <span style={minorBullet}>•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function WhatsNew() {
  return (
    <div style={page}>
      <h1 style={pageTitle}>What's New</h1>
      <p style={pageSubtitle}>Updates and improvements to the app, newest first.</p>

      <div style={list}>
        {WHATS_NEW.map((entry) => (
          <UpdateCard key={entry.id} entry={entry} />
        ))}
      </div>
    </div>
  );
}

////////////////////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////////////////////

const page = {
  padding: "32px 20px 60px",
  maxWidth: "720px",
  margin: "0 auto",
  background: "var(--color-fdf8f3)",
  minHeight: "100vh",
};

const pageTitle = {
  textAlign: "center",
  marginBottom: "6px",
  fontFamily: "'Georgia', serif",
  fontWeight: "normal",
  fontSize: "28px",
  color: "var(--color-3d2200)",
};

const pageSubtitle = {
  textAlign: "center",
  color: "var(--color-9b7040)",
  fontFamily: "sans-serif",
  fontSize: "14px",
  marginBottom: "32px",
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};

const card = {
  display: "flex",
  gap: "18px",
  background: "var(--color-fffdf9)",
  border: "1px solid var(--color-eddfc8)",
  borderRadius: "18px",
  padding: "20px 22px",
  boxShadow: "0 2px 10px rgba(160,100,40,0.06)",
};

const dateCol = {
  flexShrink: 0,
  width: "52px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  paddingTop: "2px",
};

const dateMonth = {
  fontSize: "11px",
  fontFamily: "sans-serif",
  fontWeight: "700",
  letterSpacing: "0.06em",
  color: "var(--color-c97c2e)",
};

const dateDay = {
  fontSize: "24px",
  fontFamily: "'Georgia', serif",
  color: "var(--color-3d2200)",
  lineHeight: 1.15,
};

const contentCol = {
  flex: 1,
  minWidth: 0,
};

const title = {
  margin: "0 0 8px",
  fontSize: "18px",
  fontWeight: "normal",
  fontFamily: "'Georgia', serif",
  color: "var(--color-3d2200)",
};

const details = {
  margin: 0,
  fontSize: "14px",
  color: "var(--color-5c3a1e)",
  fontFamily: "sans-serif",
  lineHeight: 1.7,
};

const minorWrap = {
  marginTop: "14px",
};

const minorToggle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  border: "none",
  background: "none",
  padding: 0,
  cursor: "pointer",
  fontSize: "12.5px",
  fontFamily: "sans-serif",
  color: "var(--color-a85e18)",
  fontWeight: "600",
};

const minorChevron = (expanded) => ({
  display: "inline-block",
  transition: "transform 0.15s",
  transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
  fontSize: "11px",
});

const minorList = {
  margin: "10px 0 0",
  padding: "12px 16px",
  background: "var(--color-fdf1de)",
  borderRadius: "10px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  listStyle: "none",
};

const minorItem = {
  display: "flex",
  gap: "8px",
  fontSize: "13px",
  color: "var(--color-6b4c20)",
  fontFamily: "sans-serif",
  lineHeight: 1.6,
};

const minorBullet = {
  flexShrink: 0,
  color: "var(--color-c97c2e)",
};
