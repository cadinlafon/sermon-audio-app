import { PAGE_REGISTRY } from "../pageRegistry";
import { normalizeHex } from "./colors";
import { parseLinkTarget } from "./richText";

////////////////////////////////////////////////////////////////
// ACTION BUTTONS — the buttons an admin makes (on notices, page notices,
// popups, the Doctrine Campaign…). One shape everywhere:
//
//   { id, text, action: "url"|"page"|"popup"|"email"|"phone"|"dismiss",
//     value, variant: "solid"|"outline"|"soft"|"link",
//     bg, color, newTab }
//
// `bg` / `color` are optional hex colors; leave them empty for the theme look.
// Older notices stored ONE button as buttonEnabled/buttonText/buttonType/
// buttonValue (and Doctrine had docsLink) — buttonsOf() reads those as buttons,
// so nothing needs migrating.
////////////////////////////////////////////////////////////////

export const MAX_BUTTONS = 6;
export const MAX_BUTTON_TEXT = 40;

export const BUTTON_ACTIONS = [
  { id: "url", label: "Open a website", icon: "🌐", placeholder: "https://example.com" },
  { id: "page", label: "Go to a page in the app", icon: "📄", placeholder: "/sermons" },
  { id: "popup", label: "Open a popup", icon: "🪟", placeholder: "" },
  { id: "email", label: "Send an email", icon: "✉️", placeholder: "name@example.com" },
  { id: "phone", label: "Call a number", icon: "📞", placeholder: "+1 208 555 0100" },
  { id: "dismiss", label: "Close this (popups & banners)", icon: "✖️", placeholder: "" },
];
export const ACTION_BY_ID = Object.fromEntries(BUTTON_ACTIONS.map((a) => [a.id, a]));

export const BUTTON_VARIANTS = [
  ["solid", "Solid"],
  ["outline", "Outline"],
  ["soft", "Soft"],
  ["link", "Text link"],
];

// Pages a button can send people to (from the Page Manager registry).
export const APP_PAGES = [
  ...PAGE_REGISTRY.map((p) => [p.route, p.defaultName]),
  ["/audio-app", "Audio App info"],
];

const newId = () => Math.random().toString(36).slice(2, 9);

export function blankButton(patch = {}) {
  return { id: newId(), text: "", action: "url", value: "", variant: "solid", bg: "", color: "", newTab: true, ...patch };
}

// Buttons for something that may still have the old single-button fields.
export function buttonsOf(entity) {
  if (!entity) return [];
  if (Array.isArray(entity.buttons)) return entity.buttons.filter((b) => b && typeof b === "object");
  const out = [];
  if (entity.buttonEnabled && entity.buttonValue) {
    out.push(blankButton({
      id: "legacy",
      text: entity.buttonText || "Learn More",
      action: entity.buttonType === "page" ? "page" : "url",
      value: entity.buttonValue,
      variant: "outline",
    }));
  }
  if (entity.docsLink) out.push(blankButton({ id: "docs", text: "Open Docs", action: "url", value: entity.docsLink, variant: "solid" }));
  return out;
}

// What the admin form edits: the button list (migrated from old fields).
export function buttonsForForm(entity) {
  return buttonsOf(entity).map((b) => ({ ...blankButton(), ...b }));
}

// Clean a button list for saving. Buttons with no text (or no target, where one
// is needed) are dropped.
export function sanitizeButtons(list) {
  const out = [];
  for (const b of Array.isArray(list) ? list : []) {
    if (!b || typeof b !== "object") continue;
    const action = ACTION_BY_ID[b.action] ? b.action : "url";
    const text = String(b.text || "").trim().slice(0, MAX_BUTTON_TEXT);
    const value = String(b.value || "").trim().slice(0, 500);
    if (!text) continue;
    if (action !== "dismiss" && !value) continue;
    out.push({
      id: String(b.id || newId()).slice(0, 20),
      text,
      action,
      value: action === "dismiss" ? "" : value,
      variant: ["solid", "outline", "soft", "link"].includes(b.variant) ? b.variant : "solid",
      bg: normalizeHex(b.bg),
      color: normalizeHex(b.color),
      newTab: b.newTab !== false,
    });
    if (out.length >= MAX_BUTTONS) break;
  }
  return out;
}

// Problems to show the admin before saving (or null).
export function validateButtons(list) {
  for (let i = 0; i < (list || []).length; i++) {
    const b = list[i];
    const n = `Button ${i + 1}`;
    if (!String(b.text || "").trim()) return `${n} needs text.`;
    if (b.action === "dismiss") continue;
    const v = String(b.value || "").trim();
    if (!v) return `${n} needs somewhere to go (${ACTION_BY_ID[b.action]?.label.toLowerCase() || "a target"}).`;
    if (b.action === "url" && !/^https?:\/\/\S+$/i.test(v)) return `${n}: a website address must start with https://`;
    if (b.action === "page" && !/^\/(?!\/)\S*$/.test(v)) return `${n}: a page path must start with / (for example /sermons).`;
    if (b.action === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `${n}: enter a valid email address.`;
    if (b.action === "phone" && !/^[+0-9().\-\s]{3,30}$/.test(v)) return `${n}: enter a valid phone number.`;
  }
  return null;
}

// A button as a link target string (so RichText and buttons share one resolver).
export function actionTarget(b) {
  switch (b.action) {
    case "popup": return parseLinkTarget(`popup:${b.value}`);
    case "page": return parseLinkTarget(b.value);
    case "email": return parseLinkTarget(`mailto:${b.value}`);
    case "phone": return parseLinkTarget(`tel:${b.value}`);
    case "dismiss": return { kind: "dismiss" };
    default: return parseLinkTarget(b.value);
  }
}
