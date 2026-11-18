////////////////////////////////////////////////////////////////
// RICH TEXT — a small, SAFE formatting language for anything an admin writes
// (notices, page notices, popups, Doctrine Campaign, messages…).
//
// Nothing here ever produces HTML: text is parsed into a tree of plain
// nodes that RichText.jsx turns into React elements, so pasted text can never
// inject markup or scripts. Existing plain text keeps rendering as before.
//
// Inline:    **bold**   *italic*   __underline__   ~~strike~~   ==highlight==
//            `code`   {color:#b45309}colored{/color}   [label](target)
//            bare https://links are linked automatically
// Block:     # Heading  ## Smaller heading  - bullet  1. numbered
//            > quote   --- divider   (blank line = spacing)
//
// Link targets:   https://… (external)   /path or page:/path (in-app page)
//                 popup:ID (opens a popup made in Admin → Popups)
//                 mailto:…   tel:…
////////////////////////////////////////////////////////////////

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isHexColor(v) {
  return typeof v === "string" && HEX.test(v.trim());
}

// What a link points at. `invalid` targets are rendered as plain text.
export function parseLinkTarget(raw) {
  const href = String(raw || "").trim();
  if (!href) return { kind: "invalid" };
  if (/^https?:\/\/[^\s]+$/i.test(href)) return { kind: "external", value: href };
  if (/^popup:[A-Za-z0-9_-]{1,80}$/.test(href)) return { kind: "popup", value: href.slice(6) };
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(href)) return { kind: "mail", value: href };
  if (/^tel:[+0-9().\-\s]{3,30}$/i.test(href)) return { kind: "tel", value: href.replace(/\s+/g, "") };
  if (/^page:\/[^\s]*$/.test(href)) return { kind: "page", value: href.slice(5) };
  if (/^\/(?!\/)[^\s]*$/.test(href)) return { kind: "page", value: href };
  return { kind: "invalid" };
}

// Build a link target string from the editor's link dialog.
export function buildLinkTarget(kind, value) {
  const v = String(value || "").trim();
  if (kind === "popup") return `popup:${v}`;
  if (kind === "page") return v.startsWith("/") ? v : `/${v}`;
  if (kind === "mail") return v.startsWith("mailto:") ? v : `mailto:${v}`;
  if (kind === "tel") return v.startsWith("tel:") ? v : `tel:${v}`;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

// ── inline ────────────────────────────────────────────────────────────────

// Earliest-match scanner. No lookbehind (older iPhones can't parse it): patterns
// that need a boundary capture the leading character (`lead`) and a `valid`
// check rejects things like "** not bold **" or snake_case_words.
const noTrailSpace = (inner) => !/\s$/.test(inner);
const PATTERNS = [
  { type: "code", re: /`([^`\n]+)`/g, inner: 1 },
  { type: "link", re: /\[([^\]\n]+)\]\(([^)\s]+)\)/g, inner: 1 },
  { type: "color", re: /\{color:(#[0-9a-fA-F]{3}|#[0-9a-fA-F]{6})\}([\s\S]+?)\{\/color\}/g, inner: 2 },
  { type: "strong", re: /\*\*(?=\S)([\s\S]+?)\*\*/g, inner: 1, valid: noTrailSpace },
  { type: "u", re: /__(?=\S)([\s\S]+?)__/g, inner: 1, valid: noTrailSpace },
  { type: "s", re: /~~(?=\S)([\s\S]+?)~~/g, inner: 1, valid: noTrailSpace },
  { type: "mark", re: /==(?=\S)([\s\S]+?)==/g, inner: 1, valid: noTrailSpace },
  { type: "em", re: /(^|[^*\w])\*(?![*\s])([^*\n]+?)\*(?![*\w])/g, inner: 2, lead: true, valid: noTrailSpace },
  { type: "em", re: /(^|[^_\w])_(?![_\s])([^_\n]+?)_(?![_\w])/g, inner: 2, lead: true, valid: noTrailSpace },
  { type: "autolink", re: /(https?:\/\/[^\s<>()\[\]]+[^\s<>()\[\].,;:!?'")\]])/g, inner: 1 },
];

function findMatch(p, str) {
  p.re.lastIndex = 0;
  let m;
  while ((m = p.re.exec(str))) {
    if (!p.valid || p.valid(m[p.inner])) {
      const lead = p.lead ? m[1].length : 0;
      return { index: m.index + lead, length: m[0].length - lead, m };
    }
    p.re.lastIndex = m.index + 1; // rejected — keep looking just past it
  }
  return null;
}

export function parseInline(text) {
  const src = String(text ?? "");
  const nodes = [];
  let rest = src;
  while (rest.length) {
    let best = null;
    for (const p of PATTERNS) {
      const f = findMatch(p, rest);
      if (f && (best === null || f.index < best.f.index)) best = { p, f };
    }
    if (!best) { nodes.push({ t: "text", text: rest }); break; }
    const { p, f } = best;
    const m = f.m;
    if (f.index > 0) nodes.push({ t: "text", text: rest.slice(0, f.index) });
    if (p.type === "code") nodes.push({ t: "code", text: m[1] });
    else if (p.type === "autolink") nodes.push({ t: "link", href: m[1], target: parseLinkTarget(m[1]), children: [{ t: "text", text: m[1] }] });
    else if (p.type === "link") {
      const target = parseLinkTarget(m[2]);
      if (target.kind === "invalid") nodes.push({ t: "text", text: rest.slice(f.index, f.index + f.length) });
      else nodes.push({ t: "link", href: m[2], target, children: parseInline(m[1]) });
    } else if (p.type === "color") nodes.push({ t: "color", color: m[1], children: parseInline(m[2]) });
    else nodes.push({ t: p.type, children: parseInline(m[p.inner]) });
    rest = rest.slice(f.index + f.length);
  }
  return nodes;
}

// ── blocks ────────────────────────────────────────────────────────────────

export function parseRichText(text) {
  const lines = String(text ?? "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let list = null;
  const flush = () => { list = null; };
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, "");
    if (!line.trim()) { flush(); blocks.push({ t: "space" }); continue; }
    let m;
    if ((m = /^(#{1,3})\s+(.*)$/.exec(line))) { flush(); blocks.push({ t: "heading", level: m[1].length, children: parseInline(m[2]) }); continue; }
    if (/^\s*(?:---+|\*\*\*+)\s*$/.test(line)) { flush(); blocks.push({ t: "hr" }); continue; }
    if ((m = /^>\s?(.*)$/.exec(line))) { flush(); blocks.push({ t: "quote", children: parseInline(m[1]) }); continue; }
    if ((m = /^\s*[-*•]\s+(.*)$/.exec(line))) {
      if (!list || list.ordered) { list = { t: "list", ordered: false, items: [] }; blocks.push(list); }
      list.items.push(parseInline(m[1]));
      continue;
    }
    if ((m = /^\s*\d+[.)]\s+(.*)$/.exec(line))) {
      if (!list || !list.ordered) { list = { t: "list", ordered: true, items: [] }; blocks.push(list); }
      list.items.push(parseInline(m[1]));
      continue;
    }
    flush();
    blocks.push({ t: "para", children: parseInline(line) });
  }
  // Trim leading/trailing spacing.
  while (blocks.length && blocks[0].t === "space") blocks.shift();
  while (blocks.length && blocks[blocks.length - 1].t === "space") blocks.pop();
  return blocks;
}

// Plain text (formatting removed) — admin list previews, aria labels, search.
export function stripRichText(text) {
  const inline = (nodes) => nodes.map((n) => (n.children ? inline(n.children) : n.text || "")).join("");
  return parseRichText(text).map((b) => {
    if (b.t === "list") return b.items.map((it, i) => `${b.ordered ? `${i + 1}.` : "•"} ${inline(it)}`).join("\n");
    if (b.t === "space") return "";
    if (b.t === "hr") return "";
    return inline(b.children || []);
  }).join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

// Every popup referenced by a piece of text (so the admin can see/clean up links).
export function popupIdsIn(text) {
  const ids = new Set();
  const walk = (nodes) => nodes.forEach((n) => { if (n.t === "link" && n.target.kind === "popup") ids.add(n.target.value); if (n.children) walk(n.children); });
  parseRichText(text).forEach((b) => { if (b.children) walk(b.children); if (b.items) b.items.forEach(walk); });
  return [...ids];
}

// ── editor helpers (operate on a string + selection) ──────────────────────

// Wrap the selection in before/after markers (or unwrap when already wrapped).
export function wrapSelection(value, start, end, before, after = before, placeholder = "text") {
  const sel = value.slice(start, end);
  const hasWrap = sel.startsWith(before) && sel.endsWith(after) && sel.length >= before.length + after.length;
  if (hasWrap) {
    const inner = sel.slice(before.length, sel.length - after.length);
    return { value: value.slice(0, start) + inner + value.slice(end), start, end: start + inner.length };
  }
  // Already wrapped just outside the selection → unwrap that.
  if (value.slice(start - before.length, start) === before && value.slice(end, end + after.length) === after && sel) {
    return { value: value.slice(0, start - before.length) + sel + value.slice(end + after.length), start: start - before.length, end: end - before.length };
  }
  const inner = sel || placeholder;
  const next = value.slice(0, start) + before + inner + after + value.slice(end);
  return { value: next, start: start + before.length, end: start + before.length + inner.length };
}

// Prefix every line touched by the selection (toggle off when all already have it).
export function prefixLines(value, start, end, prefix, numbered = false) {
  const lineStart = value.lastIndexOf("\n", start - 1) + 1;
  let lineEnd = value.indexOf("\n", end);
  if (lineEnd < 0) lineEnd = value.length;
  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");
  const marker = (i) => (numbered ? `${i + 1}. ` : prefix);
  const strip = (l) => l.replace(numbered ? /^\s*\d+[.)]\s+/ : new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`), "");
  const allHave = lines.every((l) => (numbered ? /^\s*\d+[.)]\s+/.test(l) : l.startsWith(prefix)));
  const next = lines.map((l, i) => (allHave ? strip(l) : `${marker(i)}${strip(l)}`)).join("\n");
  return { value: value.slice(0, lineStart) + next + value.slice(lineEnd), start: lineStart, end: lineStart + next.length };
}
