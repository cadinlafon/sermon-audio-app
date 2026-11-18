import { useState } from "react";
import { dismissNotice, isDismissed, noticeButtons, noticeType } from "../utils/pageNotices";
import RichText from "./RichText";
import ActionButtons from "./ActionButtons";
import { resolveStyle } from "../lib/colors";

// Renders page notices (already filtered for this page and placement).
export default function PageNoticeList({ notices, preview = false }) {
  const [, bump] = useState(0);
  const visible = notices.filter((n) => preview || !isDismissed(n));
  if (visible.length === 0) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "14px" }}>
      {visible.map((n) => {
        const t = noticeType(n);
        const own = resolveStyle(n.style);
        const base = PALETTES[t.id] || PALETTES.info;
        const palette = {
          bg: own.bg || base.bg,
          border: own.border || base.border,
          title: own.title || base.title,
          text: own.text || base.text,
        };
        const buttons = noticeButtons(n);
        return (
          <div key={n.id} style={{ ...box, background: palette.bg, borderColor: palette.border }} role={t.id === "important" || t.id === "warning" ? "alert" : "note"}>
            <span style={icon} aria-hidden="true">{t.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <strong style={{ ...title, color: palette.title }}><RichText inline text={n.title} preview={preview} linkColor={own.accent || palette.title} /></strong>
              {n.message && <RichText text={n.message} preview={preview} linkColor={own.accent || palette.title} style={{ ...message, color: palette.text }} />}
              <ActionButtons buttons={buttons} accent={own.accent || palette.title} preview={preview} size="sm" style={{ marginTop: "8px" }} />
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
const closeBtn = { background: "none", border: "none", cursor: "pointer", fontSize: "13px", padding: "2px 4px", lineHeight: 1, opacity: 0.7, flexShrink: 0 };
