import { Fragment } from "react";
import { formatTime } from "../utils/notes";

// Small, safe markdown renderer for notes: headings, bold/italic/code,
// bullet lists, checklists ("- [ ]" / "- [x]", tappable when `onToggle`
// is given), and timestamps like 12:34 turned into jump chips.
const TIME_RE = /\b(\d{1,2}:\d{2}(?::\d{2})?)\b/g;
const parseTime = (s) => s.split(":").reduce((acc, p) => acc * 60 + Number(p), 0);

function inline(text, onSeek, keyBase) {
  const nodes = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\b\d{1,2}:\d{2}(?::\d{2})?\b)/g;
  let last = 0; let m; let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyBase}-${i++}`;
    if (tok.startsWith("**")) nodes.push(<strong key={key}>{tok.slice(2, -2)}</strong>);
    else if (tok.startsWith("`")) nodes.push(<code key={key} style={code}>{tok.slice(1, -1)}</code>);
    else if (tok.startsWith("*")) nodes.push(<em key={key}>{tok.slice(1, -1)}</em>);
    else if (onSeek) nodes.push(<button key={key} style={chip} onClick={() => onSeek(parseTime(tok))} title="Jump to this moment">{tok}</button>);
    else nodes.push(<span key={key} style={chipStatic}>{tok}</span>);
    last = m.index + tok.length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export default function MarkdownText({ text, onSeek, onToggle }) {
  const lines = (text || "").split("\n");
  return (
    <div style={{ fontFamily: "sans-serif", fontSize: "14px", lineHeight: 1.6, color: "#3d2200" }}>
      {lines.map((line, idx) => {
        const key = `l${idx}`;
        const check = line.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/);
        if (check) {
          const done = check[1].toLowerCase() === "x";
          return (
            <label key={key} style={{ display: "flex", gap: "8px", alignItems: "flex-start", margin: "3px 0", cursor: onToggle ? "pointer" : "default" }}>
              <input type="checkbox" checked={done} disabled={!onToggle} onChange={() => onToggle?.(idx)} style={{ marginTop: "5px" }} />
              <span style={{ textDecoration: done ? "line-through" : "none", color: done ? "#9b7040" : "inherit" }}>{inline(check[2], onSeek, key)}</span>
            </label>
          );
        }
        const bullet = line.match(/^\s*[-*]\s+(.*)$/);
        if (bullet) return <div key={key} style={{ display: "flex", gap: "8px", margin: "3px 0" }}><span aria-hidden="true">•</span><span>{inline(bullet[1], onSeek, key)}</span></div>;
        const h = line.match(/^(#{1,3})\s+(.*)$/);
        if (h) return <div key={key} style={{ fontFamily: "'Georgia', serif", fontSize: h[1].length === 1 ? "18px" : "16px", margin: "10px 0 4px", color: "#3d2200" }}>{inline(h[2], onSeek, key)}</div>;
        if (!line.trim()) return <div key={key} style={{ height: "8px" }} />;
        return <Fragment key={key}><div style={{ margin: "2px 0" }}>{inline(line, onSeek, key)}</div></Fragment>;
      })}
    </div>
  );
}

// Flip the checkbox on one line of markdown.
export function toggleChecklistLine(text, lineIndex) {
  const lines = text.split("\n");
  lines[lineIndex] = lines[lineIndex].replace(/\[( |x|X)\]/, (_, c) => (c === " " ? "[x]" : "[ ]"));
  return lines.join("\n");
}

export { TIME_RE, formatTime };

const chip = { display: "inline-block", padding: "1px 8px", margin: "0 2px", borderRadius: "999px", border: "none", background: "#fde8b8", color: "#7a4f10", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "sans-serif" };
const chipStatic = { ...chip, cursor: "default" };
const code = { background: "#f4e7d4", padding: "1px 5px", borderRadius: "4px", fontSize: "12px" };
