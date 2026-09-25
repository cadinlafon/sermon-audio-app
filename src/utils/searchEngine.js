import { findReferences, parseReferenceQuery, sameChapter } from "./scripture";
import { getTypeMeta } from "../lib/resourceTypes";

// Client-side search over everything in the app. Items are built once per
// session (see hooks/useSearchIndex); queries are fast in-memory scans.
export const KINDS = [
  ["sermon", "🎧", "Sermons & Audio"],
  ["doctrine", "📖", "Doctrine"],
  ["resource", "📚", "Resources"],
  ["video", "🎥", "Videos"],
  ["document", "📄", "Documents"],
  ["note", "📝", "My Notes"],
  ["transcript", "📜", "Transcripts"],
];

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const TYPE_LABEL = { sermon: "Sermon", homily: "Homily", sundayschool: "Sunday School" };

const norm = (s) => (s || "").toString().toLowerCase();

function dateText(a) {
  const iso = a.date && /^\d{4}-\d{2}-\d{2}/.test(a.date) ? a.date : a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toISOString().slice(0, 10) : "";
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${iso} ${MONTHS[Number(m) - 1]} ${MONTHS[Number(m) - 1].slice(0, 3)} ${Number(d)} ${y}`;
}

export function buildIndex({ audio = [], resources = [], categories = [], doctrine = null, topics = [], schedule = [], notes = [], transcripts = [] }) {
  const items = [];
  const catName = new Map(categories.map((c) => [c.id, c.name]));

  for (const a of audio) {
    items.push({
      kind: "sermon", id: a.id, url: `/listen/${a.id}`, title: a.title || "Untitled", subtitle: [a.speaker, TYPE_LABEL[a.type]].filter(Boolean).join(" · "),
      fields: [[a.title, 5], [a.speaker, 3], [TYPE_LABEL[a.type], 2], [dateText(a), 2], [a.aiSummary, 1]],
      refText: `${a.title || ""} ${a.aiSummary || ""}`,
    });
  }

  for (const r of resources) {
    if (r.published === false) continue;
    const meta = getTypeMeta(r.type);
    const kind = r.type === "youtube" ? "video" : ["document", "presentation", "download"].includes(r.type) ? "document" : "resource";
    items.push({
      kind, id: r.id, url: `/resources/${r.id}`, title: r.title || "Untitled", subtitle: [meta.label, r.author, catName.get(r.categoryId)].filter(Boolean).join(" · "),
      icon: meta.icon,
      fields: [[r.title, 5], [r.author, 3], [meta.label, 2], [catName.get(r.categoryId), 2], [r.publisher, 2], [r.date, 2], [r.description, 1], [r.scriptureReference, 3]],
      refText: `${r.title || ""} ${r.description || ""} ${r.scriptureReference || ""}`,
    });
  }

  if (doctrine) {
    items.push({
      kind: "doctrine", id: "campaign", url: "/doctrine", title: doctrine.title || "Doctrine Campaign", subtitle: doctrine.speaker ? `Speaker: ${doctrine.speaker}` : "Featured campaign",
      fields: [[doctrine.title, 5], [doctrine.speaker, 3], [doctrine.memorization, 2], [doctrine.details, 1], [doctrine.notes, 1], [(doctrine.questions || []).join(" "), 1]],
      refText: `${doctrine.details || ""} ${doctrine.memorization || ""} ${doctrine.notes || ""}`,
    });
  }
  for (const w of topics) {
    items.push({
      kind: "doctrine", id: `week-${w.id}`, url: "/doctrine", title: `${w.label}${w.topic ? ` — ${w.topic}` : ""}`, subtitle: w.dateRange || "Weekly topic",
      fields: [[w.label, 4], [w.topic, 5], [w.dateRange, 2], [w.memoryText, 3], [w.details, 1]], refText: `${w.memoryText || ""} ${w.details || ""}`,
    });
  }
  for (const row of schedule) {
    if (row.break) continue;
    items.push({
      kind: "doctrine", id: `sched-${row.week}`, url: "/doctrine", title: `Week ${row.week} — ${row.topic}`, subtitle: row.date || "Schedule",
      fields: [[row.topic, 4], [row.date, 2], [row.memoryText, 3]], refText: `${row.topic || ""} ${row.memoryText || ""}`,
    });
  }

  for (const n of notes) {
    const bits = [n.text, ...n.entries.map((e) => e.text), ...n.bookmarks.map((b) => b.label)].filter(Boolean);
    if (!bits.length) continue;
    items.push({
      kind: "note", id: n.id, url: "/notes", title: n.title || "My note", subtitle: "Your notes",
      fields: [[n.title, 3], [bits.join(" "), 2]], refText: bits.join(" "), snippetSource: bits.join(" · "),
    });
  }

  for (const t of transcripts) {
    items.push({
      kind: "transcript", id: t.audioId, url: `/transcripts/${t.audioId}`, title: t.title || "Transcript", subtitle: "Transcript",
      fields: [[t.title, 3], [t.text, 1]], refText: t.text, snippetSource: t.text, segments: t.segments,
    });
  }
  return items;
}

const tokens = (q) => norm(q).split(/[^a-z0-9:'-]+/).filter((w) => w.length > 0);

function snippet(source, terms, span = 70) {
  if (!source) return "";
  const lower = source.toLowerCase();
  let at = -1;
  for (const t of terms) { const i = lower.indexOf(t); if (i >= 0 && (at < 0 || i < at)) at = i; }
  if (at < 0) return "";
  const start = Math.max(0, at - span / 2);
  return `${start > 0 ? "…" : ""}${source.slice(start, start + span * 1.6).replace(/\s+/g, " ")}${start + span * 1.6 < source.length ? "…" : ""}`;
}

// Time (seconds) of the first transcript segment containing all terms.
function transcriptHit(item, terms) {
  if (!item.segments) return null;
  for (const s of item.segments) {
    const t = norm(s.text);
    if (terms.every((w) => t.includes(w))) return { at: Math.floor(s.start), text: s.text };
  }
  return null;
}

export function search(items, query) {
  const q = query.trim();
  if (!q) return [];
  const terms = tokens(q);
  const ref = parseReferenceQuery(q);
  const out = [];

  for (const item of items) {
    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      let best = 0;
      for (const [value, weight] of item.fields) {
        if (value && norm(value).includes(term)) best = Math.max(best, weight);
      }
      if (!best) { matchedAll = false; break; }
      score += best;
    }

    // Scripture: "Romans 8" also finds "Romans 8:28" wherever it appears.
    let refHit = null;
    if (ref) {
      refHit = findReferences(item.refText || "").find((r) => sameChapter(r, ref)) || null;
      if (refHit) { matchedAll = true; score = Math.max(score, 6) + (refHit.verse && ref.verse && refHit.verse === ref.verse ? 2 : 0); }
    }
    if (!matchedAll) continue;
    if (norm(item.title) === norm(q)) score += 5;
    else if (norm(item.title).startsWith(norm(q))) score += 2;

    const hit = item.kind === "transcript" ? transcriptHit(item, terms) : null;
    out.push({
      ...item,
      score,
      snippet: hit?.text || (refHit ? snippet(item.refText, [norm(refHit.raw)]) : snippet(item.snippetSource || item.fields.filter((f) => f[1] === 1).map((f) => f[0]).filter(Boolean).join(" · "), terms)),
      at: hit?.at,
      segments: undefined,
    });
  }
  return out.sort((a, b) => b.score - a.score);
}
