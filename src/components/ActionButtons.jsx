import { useNavigate } from "react-router-dom";
import { actionTarget } from "../lib/actionButtons";
import { normalizeHex, readableOn, withAlpha } from "../lib/colors";
import { usePopups } from "../context/PopupContext";

////////////////////////////////////////////////////////////////
// The buttons an admin made (see lib/actionButtons.js), rendered anywhere:
// notices, page notices, popups, Doctrine Campaign.
//
//   buttons   the list
//   accent    fallback color when a button has none (e.g. the notice's accent)
//   onAction  called with (button) when pressed — for analytics
//   onDismiss what the "Close" action does (popups / banners)
//   preview   buttons do nothing (the admin visualizer)
//   layout    "row" (wraps) or "stack" (full width);  align  "left" | "center"
//   size      "sm" | "md"
////////////////////////////////////////////////////////////////

export default function ActionButtons({ buttons, accent, onAction, onDismiss, preview = false, layout = "row", align = "left", size = "md", style }) {
  const navigate = useNavigate();
  const { openPopup } = usePopups();
  const list = (buttons || []).filter(Boolean);
  if (list.length === 0) return null;

  const run = (b) => {
    onAction?.(b);
    if (preview) return;
    const t = actionTarget(b);
    if (t.kind === "dismiss") onDismiss?.();
    else if (t.kind === "popup") openPopup(t.value);
    else if (t.kind === "page") navigate(t.value);
    else if (t.kind === "external") { if (b.newTab === false) window.location.href = t.value; else window.open(t.value, "_blank", "noopener,noreferrer"); }
    else if (t.kind === "mail" || t.kind === "tel") window.location.href = t.value;
  };

  const pad = size === "sm" ? "6px 12px" : "9px 18px";
  const font = size === "sm" ? "12px" : "14px";
  return (
    <div style={{ display: "flex", flexWrap: layout === "stack" ? "nowrap" : "wrap", flexDirection: layout === "stack" ? "column" : "row", gap: "8px", justifyContent: align === "center" ? "center" : "flex-start", alignItems: layout === "stack" ? "stretch" : "center", ...style }}>
      {list.map((b) => {
        const base = normalizeHex(b.bg) || normalizeHex(accent) || "";
        const textOverride = normalizeHex(b.color);
        let s;
        if (b.variant === "outline") {
          const c = textOverride || base || "var(--color-8a5f10)";
          s = { background: "transparent", color: c, border: `1px solid ${base || "var(--color-c8922a)"}` };
        } else if (b.variant === "soft") {
          s = base
            ? { background: withAlpha(base, 0.16), color: textOverride || base, border: `1px solid ${withAlpha(base, 0.3)}` }
            : { background: "var(--color-f4e7d4)", color: textOverride || "var(--color-7a4f10)", border: "1px solid var(--color-eddfc8)" };
        } else if (b.variant === "link") {
          s = { background: "transparent", color: textOverride || base || "var(--color-a85e18)", border: "none", textDecoration: "underline", padding: "4px 2px" };
        } else {
          s = base
            ? { background: base, color: textOverride || readableOn(base), border: `1px solid ${base}` }
            : { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: textOverride || "var(--color-fff8ee)", border: "none" };
        }
        return (
          <button
            key={b.id}
            type="button"
            onClick={() => run(b)}
            style={{ padding: b.variant === "link" ? s.padding : pad, borderRadius: "999px", fontSize: font, fontFamily: "sans-serif", fontWeight: 600, cursor: "pointer", lineHeight: 1.2, ...s, ...(b.variant === "link" ? { padding: "4px 2px" } : null) }}
          >
            {b.text}{b.action === "url" && b.variant !== "link" ? " ↗" : ""}
          </button>
        );
      })}
    </div>
  );
}
