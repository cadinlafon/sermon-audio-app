import { useRef, useState } from "react";
import RichText from "../RichText";
import PopupPicker from "./PopupPicker";
import ColorField from "./ColorField";
import { APP_PAGES } from "../../lib/actionButtons";
import { buildLinkTarget, prefixLines, wrapSelection } from "../../lib/richText";
import { ui } from "./ui";

////////////////////////////////////////////////////////////////
// A text box with a formatting toolbar — bold, italic, underline, strike,
// highlight, color, headings, lists, quotes and links (including links that
// open a popup made in Admin → Popups). What it stores is the rich-text
// markup from lib/richText.js; plain text keeps working as plain text.
//
//   value / onChange   the text
//   rows               starting height
//   minimal            hide the less common tools (headings, quote, divider)
//   preview            show a live "how it will look" box under the editor
////////////////////////////////////////////////////////////////

const LINK_KINDS = [
  ["url", "Website"],
  ["page", "App page"],
  ["popup", "Popup"],
  ["mail", "Email"],
  ["tel", "Phone"],
];

export default function RichTextField({ value, onChange, rows = 4, placeholder, maxLength, minimal = false, preview = true, id, ariaLabel }) {
  const ref = useRef(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [link, setLink] = useState({ kind: "url", value: "", text: "" });
  const text = value || "";

  const sel = () => {
    const el = ref.current;
    return { start: el ? el.selectionStart : text.length, end: el ? el.selectionEnd : text.length };
  };
  const apply = (result) => {
    onChange(result.value);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(result.start, result.end);
    });
  };
  const wrap = (before, after, placeholderText) => { const { start, end } = sel(); apply(wrapSelection(text, start, end, before, after ?? before, placeholderText)); };
  const lines = (prefix, numbered) => { const { start, end } = sel(); apply(prefixLines(text, start, end, prefix, numbered)); };

  const openLink = () => {
    const { start, end } = sel();
    setLink({ kind: "url", value: "", text: text.slice(start, end) });
    setColorOpen(false);
    setLinkOpen((o) => !o);
  };
  const insertLink = () => {
    const target = buildLinkTarget(link.kind, link.value);
    if (!link.value.trim()) return;
    const { start, end } = sel();
    const label = (link.text || text.slice(start, end) || (link.kind === "popup" ? "Tap here" : link.value)).replace(/[\[\]]/g, "");
    const md = `[${label}](${target})`;
    const next = text.slice(0, start) + md + text.slice(end);
    apply({ value: next, start: start + md.length, end: start + md.length });
    setLinkOpen(false);
  };
  const applyColor = (hex) => {
    if (!hex) return;
    const { start, end } = sel();
    apply(wrapSelection(text, start, end, `{color:${hex}}`, "{/color}", "colored text"));
    setColorOpen(false);
  };

  const onKeyDown = (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    if (k === "b") { e.preventDefault(); wrap("**"); }
    else if (k === "i") { e.preventDefault(); wrap("*"); }
    else if (k === "u") { e.preventDefault(); wrap("__"); }
    else if (k === "k") { e.preventDefault(); openLink(); }
  };

  const Btn = ({ onClick, title, children, on }) => (
    <button type="button" onClick={onClick} title={title} aria-label={title} style={on ? { ...tool, ...toolOn } : tool}>{children}</button>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      <div style={bar} role="toolbar" aria-label="Text formatting">
        <Btn onClick={() => wrap("**")} title="Bold (Ctrl/⌘ B)"><b>B</b></Btn>
        <Btn onClick={() => wrap("*")} title="Italic (Ctrl/⌘ I)"><i>I</i></Btn>
        <Btn onClick={() => wrap("__")} title="Underline (Ctrl/⌘ U)"><u>U</u></Btn>
        <Btn onClick={() => wrap("~~")} title="Strikethrough"><s>S</s></Btn>
        <Btn onClick={() => wrap("==")} title="Highlight"><span style={{ background: "var(--color-fde8b8)", padding: "0 3px" }}>H</span></Btn>
        <Btn onClick={() => { setLinkOpen(false); setColorOpen((o) => !o); }} title="Text color" on={colorOpen}><span style={{ borderBottom: "3px solid var(--color-c97c2e)", lineHeight: 1 }}>A</span></Btn>
        <span style={sep} />
        {!minimal && <Btn onClick={() => lines("## ")} title="Heading">H₂</Btn>}
        <Btn onClick={() => lines("- ")} title="Bulleted list">• ≡</Btn>
        <Btn onClick={() => lines("", true)} title="Numbered list">1.</Btn>
        {!minimal && <Btn onClick={() => lines("> ")} title="Quote">❝</Btn>}
        {!minimal && <Btn onClick={() => { const { start } = sel(); apply({ value: `${text.slice(0, start)}${start && text[start - 1] !== "\n" ? "\n" : ""}---\n${text.slice(start)}`, start: start + 5, end: start + 5 }); }} title="Divider line">―</Btn>}
        <span style={sep} />
        <Btn onClick={openLink} title="Link or popup (Ctrl/⌘ K)" on={linkOpen}>🔗 Link</Btn>
        <span style={{ flex: 1 }} />
        <Btn onClick={() => setShowHelp((h) => !h)} title="Formatting help" on={showHelp}>?</Btn>
      </div>

      {colorOpen && (
        <div style={popover}>
          <ColorField label="Color for the selected text" value="" onChange={applyColor} allowClear={false} />
        </div>
      )}

      {linkOpen && (
        <div style={popover}>
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }} role="group" aria-label="Link type">
            {LINK_KINDS.map(([k, l]) => (
              <button key={k} type="button" aria-pressed={link.kind === k} onClick={() => setLink({ ...link, kind: k, value: "" })} style={link.kind === k ? { ...ui.smallBtn, background: "var(--color-fde8b8)", fontWeight: 600 } : ui.smallBtn}>{l}</button>
            ))}
          </div>
          <label style={ui.fieldLabel}>Link text</label>
          <input value={link.text} onChange={(e) => setLink({ ...link, text: e.target.value })} placeholder="What people tap" style={ui.input} />
          <label style={ui.fieldLabel}>{link.kind === "popup" ? "Which popup opens" : link.kind === "page" ? "Which page" : link.kind === "mail" ? "Email address" : link.kind === "tel" ? "Phone number" : "Website address"}</label>
          {link.kind === "popup" ? (
            <PopupPicker value={link.value} onChange={(v) => setLink({ ...link, value: v })} />
          ) : link.kind === "page" ? (
            <select value={link.value} onChange={(e) => setLink({ ...link, value: e.target.value })} style={ui.input}>
              <option value="">Choose a page…</option>
              {APP_PAGES.map(([route, name]) => <option key={route} value={route}>{name} ({route})</option>)}
            </select>
          ) : (
            <input value={link.value} onChange={(e) => setLink({ ...link, value: e.target.value })} placeholder={link.kind === "mail" ? "name@example.com" : link.kind === "tel" ? "+1 208 555 0100" : "https://example.com"} style={ui.input} />
          )}
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" style={{ ...ui.smallBtn, background: "var(--color-c97c2e)", color: "var(--color-fff8ee)", border: "none" }} onClick={insertLink} disabled={!link.value.trim()}>Insert link</button>
            <button type="button" style={ui.smallBtn} onClick={() => setLinkOpen(false)}>Cancel</button>
          </div>
        </div>
      )}

      <textarea
        id={id}
        ref={ref}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        rows={rows}
        placeholder={placeholder}
        maxLength={maxLength}
        aria-label={ariaLabel}
        style={{ ...ui.input, resize: "vertical", lineHeight: 1.5 }}
      />

      {showHelp && (
        <div style={helpBox}>
          <div><code>**bold**</code> <code>*italic*</code> <code>__underline__</code> <code>~~strike~~</code> <code>==highlight==</code></div>
          <div><code>[text](https://site.com)</code> website · <code>[text](/sermons)</code> app page · <code>[text](popup:ID)</code> popup</div>
          <div><code>- item</code> bullets · <code>1. item</code> numbers · <code>## Heading</code> · <code>&gt; quote</code> · <code>---</code> line</div>
        </div>
      )}

      {preview && text.trim() && (
        <div style={previewBox}>
          <span style={previewTag}>Preview</span>
          <RichText text={text} preview style={{ fontFamily: "sans-serif", fontSize: "14px", color: "var(--color-3d2200)" }} />
        </div>
      )}
    </div>
  );
}

const bar = { display: "flex", flexWrap: "wrap", gap: "4px", alignItems: "center", padding: "5px", border: "1px solid var(--color-eddfc8)", borderRadius: "10px", background: "var(--color-fffdf9)" };
const tool = { minWidth: "30px", height: "30px", padding: "0 8px", border: "1px solid transparent", borderRadius: "7px", background: "transparent", color: "var(--color-5c3a1e)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const toolOn = { background: "var(--color-fde8b8)", border: "1px solid var(--color-e5c27a)" };
const sep = { width: "1px", height: "20px", background: "var(--color-eddfc8)", margin: "0 3px" };
const popover = { display: "flex", flexDirection: "column", gap: "8px", padding: "12px", border: "1px solid var(--color-eddfc8)", borderRadius: "12px", background: "var(--color-fdf8f3)" };
const helpBox = { display: "flex", flexDirection: "column", gap: "5px", fontSize: "12px", fontFamily: "sans-serif", color: "var(--color-7a5530)", padding: "10px 12px", borderRadius: "10px", background: "var(--color-fdf8f3)", border: "1px dashed var(--color-d8c4a5)", lineHeight: 1.6 };
const previewBox = { position: "relative", padding: "12px 14px 10px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)" };
const previewTag = { position: "absolute", top: "-8px", left: "10px", padding: "0 6px", fontSize: "10px", letterSpacing: "0.06em", textTransform: "uppercase", background: "var(--color-fffdf9)", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
