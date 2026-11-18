import { sanitizeButtons } from "./actionButtons";
import { sanitizeStyle } from "./colors";
import { fieldsOf, inputFieldsForSave } from "../utils/noticeInputs";

////////////////////////////////////////////////////////////////
// POPUPS — messages an admin builds in Admin → Popups and that the app shows
// in different forms (popup, banner, corner alert, bottom sheet, full screen).
// A popup is opened by a link or button ("popup:ID" in any rich text, or a
// button with the "Open a popup" action), automatically (when the app opens
// or on certain pages), or both.
//
// Stored in the `popups` collection. Replies to a popup's form go to
// `popupSubmissions` (same shape as noticeSubmissions, keyed by popupId).
////////////////////////////////////////////////////////////////

export const POPUP_TYPES = [
  { id: "modal", label: "Popup", icon: "🪟", hint: "A card in the middle of the screen with a dimmed background." },
  { id: "banner", label: "Banner", icon: "🎗️", hint: "A thin bar across the top or bottom of the app." },
  { id: "corner", label: "Corner alert", icon: "💬", hint: "A small card that slides into a corner. Doesn't block anything." },
  { id: "sheet", label: "Bottom sheet", icon: "📱", hint: "Slides up from the bottom — great for forms on phones." },
  { id: "fullscreen", label: "Full screen", icon: "🖼️", hint: "Takes over the whole screen. Use sparingly." },
];
export const POPUP_TYPE_BY_ID = Object.fromEntries(POPUP_TYPES.map((t) => [t.id, t]));

export const BANNER_POSITIONS = [["top", "Top"], ["bottom", "Bottom"]];
export const CORNER_POSITIONS = [["bottom-right", "Bottom right"], ["bottom-left", "Bottom left"], ["top-right", "Top right"], ["top-left", "Top left"]];
export const MODAL_SIZES = [["sm", "Small"], ["md", "Medium"], ["lg", "Large"]];
export const ANIMATIONS = [["fade", "Fade"], ["pop", "Pop"], ["slide", "Slide"], ["none", "None"]];
export const ALIGNMENTS = [["left", "Left"], ["center", "Center"]];
export const BUTTON_LAYOUTS = [["row", "Side by side"], ["stack", "Stacked"]];

export const TRIGGER_MODES = [
  ["manual", "Only when a link or button opens it"],
  ["load", "Automatically when the app opens"],
  ["page", "Automatically on certain pages"],
];
export const FREQUENCIES = [
  ["always", "Every time it's triggered"],
  ["session", "Once per visit"],
  ["day", "Once a day"],
  ["week", "Once a week"],
  ["once", "Only once per person (until I edit it)"],
];
export const AUDIENCES = [["all", "Everyone"], ["users", "Signed-in users"], ["guests", "Guests only"], ["admins", "Admins only"]];

export const MAX_TITLE = 120;
export const MAX_BODY = 4000;

const str = (v, max, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const oneOf = (v, list, fallback) => (list.some((x) => (Array.isArray(x) ? x[0] : x) === v) ? v : fallback);
const num = (v, lo, hi, fallback) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : fallback; };
const dateStr = (v) => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "");

export function defaultPopup(type = "modal") {
  return {
    name: "",
    type,
    enabled: true,
    icon: "",
    title: "",
    body: "",
    imageUrl: "",
    style: { preset: "default" },
    align: "center",
    size: "md",
    position: type === "banner" ? "top" : "bottom-right",
    animation: type === "corner" ? "slide" : "pop",
    overlay: 55,
    dismissible: true,
    closeOnBackdrop: true,
    buttons: [],
    buttonLayout: "row",
    buttonAlign: "center",
    inputEnabled: false,
    inputMessage: "",
    inputFields: [],
    inputButtonText: "",
    successMessage: "Thanks — we got it!",
    captcha: false,
    trigger: { mode: "manual", delaySeconds: 0, paths: [], frequency: "always", autoCloseSeconds: 0 },
    audience: "all",
    startDate: "",
    endDate: "",
  };
}

// A stored popup (older, partial, hand-edited) → a complete, safe one.
export function sanitizePopup(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const d = defaultPopup(oneOf(s.type, POPUP_TYPES.map((t) => t.id), "modal"));
  const t = s.trigger && typeof s.trigger === "object" ? s.trigger : {};
  return {
    ...d,
    id: s.id,
    name: str(s.name, 80),
    enabled: s.enabled !== false,
    icon: str(s.icon, 8),
    title: str(s.title, MAX_TITLE),
    body: str(s.body, MAX_BODY),
    imageUrl: typeof s.imageUrl === "string" && /^(https?:\/\/|\/)/.test(s.imageUrl) ? s.imageUrl.slice(0, 600) : "",
    style: sanitizeStyle(s.style),
    align: oneOf(s.align, ALIGNMENTS, d.align),
    size: oneOf(s.size, MODAL_SIZES, d.size),
    position: oneOf(s.position, [...BANNER_POSITIONS, ...CORNER_POSITIONS], d.position),
    animation: oneOf(s.animation, ANIMATIONS, d.animation),
    overlay: Math.round(num(s.overlay, 0, 85, d.overlay)),
    dismissible: s.dismissible !== false,
    closeOnBackdrop: s.closeOnBackdrop !== false,
    buttons: sanitizeButtons(s.buttons),
    buttonLayout: oneOf(s.buttonLayout, BUTTON_LAYOUTS, d.buttonLayout),
    buttonAlign: oneOf(s.buttonAlign, ALIGNMENTS, d.buttonAlign),
    inputEnabled: s.inputEnabled === true || (Array.isArray(s.inputFields) && s.inputFields.length > 0),
    inputMessage: str(s.inputMessage, 600),
    inputFields: Array.isArray(s.inputFields) ? s.inputFields : [],
    inputButtonText: str(s.inputButtonText, 40),
    successMessage: str(s.successMessage, 200, d.successMessage),
    captcha: s.captcha === true,
    trigger: {
      mode: oneOf(t.mode, TRIGGER_MODES, "manual"),
      delaySeconds: Math.round(num(t.delaySeconds, 0, 120, 0)),
      paths: (Array.isArray(t.paths) ? t.paths : []).filter((p) => typeof p === "string" && p.startsWith("/")).slice(0, 20),
      frequency: oneOf(t.frequency, FREQUENCIES, "always"),
      autoCloseSeconds: Math.round(num(t.autoCloseSeconds, 0, 600, 0)),
    },
    audience: oneOf(s.audience, AUDIENCES, "all"),
    startDate: dateStr(s.startDate),
    endDate: dateStr(s.endDate),
    version: s.updatedAt?.seconds || s.createdAt?.seconds || 0,
  };
}

// The Firestore document for the admin form (what gets written).
export function popupPayload(form) {
  const p = sanitizePopup(form);
  const input = inputFieldsForSave({ inputEnabled: form.inputEnabled, inputFields: form.inputFields });
  const { id, version, ...rest } = p; // eslint-disable-line no-unused-vars
  return {
    ...rest,
    inputEnabled: !!(form.inputEnabled && input.inputFields.length),
    inputFields: input.inputFields,
  };
}

export const popupHasForm = (p) => fieldsOf({ ...p, id: p.id || "x" }).length > 0 && p.inputEnabled !== false;

const todayStr = (now = new Date()) => {
  const p = (n) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
};

// Is this popup allowed to show right now to this person (any trigger)?
export function popupAvailable(popup, { user, isAdmin, now = new Date() } = {}) {
  if (!popup || popup.enabled === false) return false;
  const today = todayStr(now);
  if (popup.startDate && today < popup.startDate) return false;
  if (popup.endDate && today > popup.endDate) return false;
  const a = popup.audience || "all";
  if (a === "users" && !user) return false;
  if (a === "guests" && user) return false;
  if (a === "admins" && !isAdmin) return false;
  return true;
}

export function pathMatches(patterns, pathname) {
  return (patterns || []).some((p) => (p.endsWith("*") ? pathname.startsWith(p.slice(0, -1)) : p === pathname || (p !== "/" && pathname === `${p}/`)));
}

// ── "how often" memory (this device) ─────────────────────────────────────

const SEEN_KEY = "pf-popups-seen";
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); } catch { return {}; } };

export function markPopupSeen(popup, now = Date.now()) {
  try {
    const seen = readSeen();
    seen[popup.id] = { at: now, v: popup.version || 0 };
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch { /* private mode — it may show again next visit */ }
}

export function frequencyAllows(popup, sessionShown, now = Date.now()) {
  const freq = popup.trigger?.frequency || "always";
  if (sessionShown.has(popup.id)) return false; // never twice in one visit unless opened by a link
  if (freq === "always" || freq === "session") return true;
  const rec = readSeen()[popup.id];
  if (!rec) return true;
  if (freq === "once") return rec.v !== (popup.version || 0); // editing it counts as new
  const age = now - rec.at;
  return age > (freq === "day" ? 86400000 : 7 * 86400000);
}
