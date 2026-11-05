import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { dismissNotice, isDismissed, noticeLink, noticeType } from "../utils/pageNotices";

// Renders page notices (already filtered for this page and placement).
export default function PageNoticeList({ notices, preview = false }) {
  const navigate = useNavigate();
  const [, bump] = useState(0);
  const visible = notices.filter((n) => preview || !isDismissed(n));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
      {visible.map((n) => {
        const t = noticeType(n);
        const link = noticeLink(n);
        const palette = PALETTES[t.id] || PALETTES.info;
        return (
          <div key={n.id} style={{ ...box, background: palette.bg, borderColor: palette.border }} role={t.id === "important" || t.id === "warning" ? "alert" : "note"}>
            <span style={icon} aria-hidden="true">{t.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ ...title, color: palette.title }}>{n.title}</strong>
              {n.message && <p style={{ ...message, color: palette.text }}>{n.message}</p>}
              {link && (
                link.external ? (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ ...linkStyle, color: palette.title }}>{link.text} ↗</a>
                ) : (
                  <button type="button" onClick={() => !preview && navigate(link.href)} style={{ ...linkStyle, color: palette.title, background: "none", border: "none", padding: 0, cursor: "pointer" }}>{link.text} →</button>
                )
              )}
            </div>
            {n.dismissible === true && (
              <button
                type="button"
                style={{ ...closeBtn, color: palette.text }}
                onClick={() => { if (!preview) { dismissNotice(n); bump((x) => x + 1); } }}
                aria-label="Dismiss notice"
                title="Dismiss"
              >✕</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

const PALETTES = {
  info: { bg: "var(--color-e8f0fe)", border: "rgba(42,90,181,0.28)", title: "var(--color-2a5ab5)", text: "var(--color-345b91)" },
  warning: { bg: "var(--color-fffbee)", border: "var(--color-f0d898)", title: "var(--color-3d2200)", text: "var(--color-7a5530)" },
  announcement: { bg: "var(--color-e3f5e6)", border: "var(--color-bfe6c8)", title: "var(--color-2f8a4a)", text: "var(--color-286a31)" },
  important: { bg: "var(--color-fee2e2)", border: "var(--color-fca5a5)", title: "var(--color-991b1b)", text: "var(--color-3a120a)" },
};

const box = { display: "flex", gap: "12px", alignItems: "flex-start", border: "1px solid", borderRadius: "14px", padding: "14px 16px" };
const icon = { fontSize: "18px", lineHeight: 1.3, flexShrink: 0 };
const title = { fontSize: "15px", fontFamily: "'Georgia', serif" };
const message = { fontSize: "13px", fontFamily: "sans-serif", lineHeight: 1.6, margin: "4px 0 0" };
const linkStyle = { display: "inline-block", marginTop: "8px", fontSize: "13px", fontWeight: "600", fontFamily: "sans-serif", textDecoration: "none" };
const closeBtn = { background: "none", border: "none", cursor: "pointer", fontSize: "13px", padding: "2px 4px", lineHeight: 1, opacity: 0.7, flexShrink: 0 };
