// The admin sidebar's default grouping, plus the small helpers that apply an
// admin's own arrangement (collapsed sections, pinned pages, custom ordering)
// on top of it. Section items are admin module keys (see adminModules.js);
// Dashboard sits above all sections and is not part of one.
export const NAV_SECTIONS = [
  { id: "audio", title: "Audio Management", items: ["upload", "content"] },
  // "@analyticsPages" expands to the external dashboards set up in Admin → Advanced.
  { id: "analytics", title: "Analytics", items: ["analytics", "@analyticsPages", "audioStats", "referrals", "logs"] },
  { id: "notifications", title: "Notifications", items: ["notifications", "sendNotifications", "notices"] },
  { id: "info", title: "Info", items: ["doctrine", "devInfo", "resources"] },
  { id: "pages", title: "Page Management", items: ["pageManager", "audioPages"] },
  { id: "feedback", title: "User Feedback", items: ["reports", "suggestions"] },
  { id: "other", title: "Other", items: ["users", "settings", "security", "agents"] },
];

export const TOP_LEVEL = ["dashboard"];
export const extId = (id) => `ext:${id}`;

// Sections with their item ids resolved: external analytics pages expanded and
// any module not mentioned above (e.g. one added later) appended to "Other".
export function defaultSections(modules, externalPages) {
  const known = new Set(modules.map((m) => m.key));
  const placed = new Set(TOP_LEVEL);
  const sections = NAV_SECTIONS.map((s) => ({
    id: s.id,
    title: s.title,
    items: s.items.flatMap((i) => (i === "@analyticsPages" ? externalPages.map((p) => extId(p.id)) : known.has(i) ? [i] : [])),
  }));
  sections.forEach((s) => s.items.forEach((i) => placed.add(i)));
  const leftovers = modules.map((m) => m.key).filter((k) => !placed.has(k));
  if (leftovers.length) sections.find((s) => s.id === "other").items.push(...leftovers);
  return sections;
}

// Saved order first (dropping ids that no longer exist), then anything new in default order.
export function applyOrder(saved, defaults) {
  const have = new Set(defaults);
  const out = [];
  (Array.isArray(saved) ? saved : []).forEach((id) => { if (have.has(id) && !out.includes(id)) out.push(id); });
  defaults.forEach((id) => { if (!out.includes(id)) out.push(id); });
  return out;
}

// Move `id` next to `targetId` (before or after it) in a list.
export function moveNextTo(list, id, targetId, after) {
  if (id === targetId) return list;
  const without = list.filter((x) => x !== id);
  const at = without.indexOf(targetId);
  if (at < 0 || !list.includes(id)) return list;
  without.splice(after ? at + 1 : at, 0, id);
  return without;
}

export const emptyLayout = () => ({ collapsed: {}, sectionOrder: [], itemOrder: {}, pinned: [] });

export function sanitizeLayout(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const strs = (a) => (Array.isArray(a) ? a.filter((x) => typeof x === "string").slice(0, 100) : []);
  const collapsed = {};
  if (r.collapsed && typeof r.collapsed === "object") for (const [k, v] of Object.entries(r.collapsed)) if (v === true) collapsed[k] = true;
  const itemOrder = {};
  if (r.itemOrder && typeof r.itemOrder === "object") for (const [k, v] of Object.entries(r.itemOrder)) itemOrder[k] = strs(v);
  return { collapsed, sectionOrder: strs(r.sectionOrder), itemOrder, pinned: [...new Set(strs(r.pinned))] };
}
