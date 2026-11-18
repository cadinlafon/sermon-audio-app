import { Fragment } from "react";
import { useNavigate } from "react-router-dom";
import { parseRichText, parseInline } from "../lib/richText";
import { usePopups } from "../context/PopupContext";

////////////////////////////////////////////////////////////////
// Renders rich text (see lib/richText.js) as real React elements — never as
// raw HTML. Links can open a website, an app page, an email / phone, or a
// popup made in Admin → Popups.
//
//   <RichText text="Hello **world** — [sign up](popup:abc)" />
//
//   inline   render one line with no block spacing (titles, labels)
//   preview  links do nothing (the admin visualizer)
//   linkColor  override the link color (notices with their own colors)
//   onLink   called with the target whenever a link is activated (analytics)
////////////////////////////////////////////////////////////////

export default function RichText({ text, style, inline = false, preview = false, linkColor, onLink, className }) {
  const navigate = useNavigate();
  const { openPopup } = usePopups();

  const activate = (target, e) => {
    onLink?.(target);
    if (preview) { e.preventDefault(); return; }
    if (target.kind === "popup") { e.preventDefault(); openPopup(target.value); }
    else if (target.kind === "page") { e.preventDefault(); navigate(target.value); }
  };

  const linkStyle = { color: linkColor || "var(--color-a85e18)", textDecoration: "underline", textUnderlineOffset: "2px", fontWeight: 600, cursor: "pointer", wordBreak: "break-word" };

  const renderInline = (nodes, key = "n") => nodes.map((n, i) => {
    const k = `${key}-${i}`;
    switch (n.t) {
      case "text": return <Fragment key={k}>{n.text}</Fragment>;
      case "strong": return <strong key={k}>{renderInline(n.children, k)}</strong>;
      case "em": return <em key={k}>{renderInline(n.children, k)}</em>;
      case "u": return <span key={k} style={{ textDecoration: "underline" }}>{renderInline(n.children, k)}</span>;
      case "s": return <span key={k} style={{ textDecoration: "line-through" }}>{renderInline(n.children, k)}</span>;
      case "mark": return <mark key={k} style={{ background: "var(--color-fde8b8)", color: "inherit", padding: "0 3px", borderRadius: "3px" }}>{renderInline(n.children, k)}</mark>;
      case "code": return <code key={k} style={{ background: "var(--color-f4e7d4)", color: "var(--color-5c3a1e)", padding: "1px 5px", borderRadius: "4px", fontSize: "0.9em" }}>{n.text}</code>;
      case "color": return <span key={k} style={{ color: n.color }}>{renderInline(n.children, k)}</span>;
      case "link": {
        const t = n.target;
        const external = t.kind === "external";
        const href = t.kind === "popup" ? "#" : t.kind === "page" ? t.value : t.value;
        return (
          <a
            key={k}
            href={href}
            style={linkStyle}
            onClick={(e) => activate(t, e)}
            {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
            {...(t.kind === "popup" ? { role: "button" } : {})}
          >
            {renderInline(n.children, k)}
            {external && <span aria-hidden="true" style={{ fontSize: "0.8em", marginLeft: "2px" }}>↗</span>}
          </a>
        );
      }
      default: return null;
    }
  });

  if (inline) {
    const first = parseRichText(String(text ?? "").split("\n")[0]);
    const nodes = first[0]?.children || parseInline(String(text ?? ""));
    return <span style={style} className={className}>{renderInline(nodes)}</span>;
  }

  const blocks = parseRichText(text);
  return (
    <div style={{ lineHeight: 1.6, wordBreak: "break-word", ...style }} className={className}>
      {blocks.map((b, i) => {
        const k = `b${i}`;
        switch (b.t) {
          case "space": return <div key={k} style={{ height: "0.55em" }} />;
          case "hr": return <hr key={k} style={{ border: "none", borderTop: "1px solid currentColor", opacity: 0.25, margin: "10px 0" }} />;
          case "heading": return <div key={k} style={{ fontFamily: "'Georgia', serif", fontWeight: "bold", fontSize: b.level === 1 ? "1.3em" : b.level === 2 ? "1.15em" : "1.05em", margin: "6px 0 2px", lineHeight: 1.3 }}>{renderInline(b.children, k)}</div>;
          case "quote": return <div key={k} style={{ borderLeft: "3px solid currentColor", opacity: 0.85, paddingLeft: "10px", margin: "4px 0", fontStyle: "italic" }}>{renderInline(b.children, k)}</div>;
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return <Tag key={k} style={{ margin: "4px 0", paddingLeft: "22px" }}>{b.items.map((it, j) => <li key={j} style={{ margin: "2px 0" }}>{renderInline(it, `${k}-${j}`)}</li>)}</Tag>;
          }
          default: return <div key={k} style={{ margin: "2px 0" }}>{renderInline(b.children, k)}</div>;
        }
      })}
    </div>
  );
}
