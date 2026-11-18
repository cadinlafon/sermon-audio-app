////////////////////////////////////////////////////////////////
// COLORS for admin-styled things (notices, buttons, popups).
//
// A color an admin picks is a fixed hex that looks the same in light and dark
// mode (that's the point of picking it). When no color is chosen, the normal
// theme colors apply and follow light/dark automatically.
////////////////////////////////////////////////////////////////

const HEX3 = /^#[0-9a-fA-F]{3}$/;
const HEX6 = /^#[0-9a-fA-F]{6}$/;

export const isHex = (v) => typeof v === "string" && (HEX3.test(v.trim()) || HEX6.test(v.trim()));

// "#abc" → "#aabbcc"; anything invalid → "".
export function normalizeHex(v) {
  if (typeof v !== "string") return "";
  const s = v.trim();
  if (HEX6.test(s)) return s.toLowerCase();
  if (HEX3.test(s)) return `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`.toLowerCase();
  return "";
}

function rgb(hex) {
  const h = normalizeHex(hex);
  if (!h) return null;
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

// Black or white text, whichever reads better on this background.
export function readableOn(hex) {
  const c = rgb(hex);
  if (!c) return "#ffffff";
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  const L = 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  return L > 0.42 ? "#2a1500" : "#ffffff";
}

// rgba() string from a hex and an alpha (for soft backgrounds / borders).
export function withAlpha(hex, alpha) {
  const c = rgb(hex);
  return c ? `rgba(${c[0]},${c[1]},${c[2]},${alpha})` : "";
}

// Ready-made looks for a notice / popup. `null` fields fall back to theme colors.
export const COLOR_PRESETS = [
  { id: "default", label: "Default", bg: "", border: "", title: "", text: "", accent: "" },
  { id: "amber", label: "Amber", bg: "#fffbee", border: "#f0d898", title: "#3d2600", text: "#6b4c20", accent: "#c97c2e" },
  { id: "blue", label: "Blue", bg: "#e8f0fe", border: "#b9cdf5", title: "#1f4a9a", text: "#345b91", accent: "#2a5ab5" },
  { id: "green", label: "Green", bg: "#e3f5e6", border: "#bfe6c8", title: "#1f6b37", text: "#286a31", accent: "#2f8a4a" },
  { id: "red", label: "Red", bg: "#fee2e2", border: "#fca5a5", title: "#991b1b", text: "#7f1d1d", accent: "#dc2626" },
  { id: "purple", label: "Purple", bg: "#f1ebff", border: "#d4c5f9", title: "#5b21b6", text: "#6547a5", accent: "#7c3aed" },
  { id: "rose", label: "Rose", bg: "#fdecf3", border: "#f6c5da", title: "#9d174d", text: "#a33b70", accent: "#db2777" },
  { id: "dark", label: "Dark", bg: "#2a1c0a", border: "#4a2a08", title: "#fff8ee", text: "#e8d9c0", accent: "#e0a458" },
  { id: "brand", label: "Brand", bg: "#a85e18", border: "#8a4f12", title: "#fff8ee", text: "#ffe9cc", accent: "#fff8ee" },
];

export const PRESET_BY_ID = Object.fromEntries(COLOR_PRESETS.map((p) => [p.id, p]));

export const SWATCHES = ["#c97c2e", "#a85e18", "#3d2200", "#2a5ab5", "#2f8a4a", "#dc2626", "#7c3aed", "#db2777", "#0891b2", "#111827", "#ffffff", "#fff8ee"];

// The colors a styled thing actually uses: its own picks over its preset over theme.
export function resolveStyle(style) {
  const s = style && typeof style === "object" ? style : {};
  const preset = PRESET_BY_ID[s.preset] || PRESET_BY_ID.default;
  const pick = (k) => normalizeHex(s[k]) || preset[k] || "";
  return { bg: pick("bg"), border: pick("border"), title: pick("title"), text: pick("text"), accent: pick("accent"), preset: preset.id };
}

// Clean a stored style object (unknown keys dropped, invalid colors removed).
export function sanitizeStyle(style) {
  const s = style && typeof style === "object" ? style : {};
  const out = { preset: PRESET_BY_ID[s.preset] ? s.preset : "default" };
  for (const k of ["bg", "border", "title", "text", "accent"]) {
    const h = normalizeHex(s[k]);
    if (h) out[k] = h;
  }
  return out;
}
