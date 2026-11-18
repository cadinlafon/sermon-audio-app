import { useState } from "react";

// A "how will it look" frame for the admin editors. Light/dark switch (an
// admin's chosen colors stay put; theme colors flip) and phone/tablet/desktop
// widths. Nothing inside is live — editors pass `preview` to what they draw.
//
//   fill     the frame is a fixed-height stage (popups draw over it)
//   chips    extra controls to show in the bar
const WIDTHS = [["phone", "Phone", 380], ["tablet", "Tablet", 600], ["desktop", "Desktop", 820]];

export default function PreviewFrame({ title = "Live preview", children, fill = false, height = 540, note, defaultSize = "phone", chips }) {
  const [size, setSize] = useState(defaultSize);
  const [theme, setTheme] = useState("light");
  const width = WIDTHS.find((w) => w[0] === size)[2];
  return (
    <div style={wrap}>
      <div style={bar}>
        <span style={barTitle}>{title}</span>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          <div style={seg} role="group" aria-label="Theme">
            {[["light", "☀️ Light"], ["dark", "🌙 Dark"]].map(([v, l]) => (
              <button key={v} type="button" aria-pressed={theme === v} onClick={() => setTheme(v)} style={theme === v ? { ...segBtn, ...segOn } : segBtn}>{l}</button>
            ))}
          </div>
          <div style={seg} role="group" aria-label="Device width">
            {WIDTHS.map(([v, l]) => (
              <button key={v} type="button" aria-pressed={size === v} onClick={() => setSize(v)} style={size === v ? { ...segBtn, ...segOn } : segBtn}>{l}</button>
            ))}
          </div>
          {chips}
        </div>
      </div>
      <div style={scroller}>
        <div
          className={theme === "dark" ? "pf-theme-dark" : "pf-theme-light"}
          style={{
            width: `${width}px`, maxWidth: "100%", margin: "0 auto", background: "var(--color-fdf8f3)", color: "var(--color-3d2200)",
            borderRadius: "10px", border: "1px solid var(--color-eddfc8)", position: "relative", overflow: fill ? "hidden" : "visible",
            ...(fill ? { height: `${height}px` } : { padding: "20px 16px" }),
          }}
        >
          {children}
        </div>
      </div>
      {note && <p style={noteStyle}>{note}</p>}
    </div>
  );
}

const wrap = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "14px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", minWidth: 0 };
const bar = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const barTitle = { fontSize: "13px", fontWeight: 600, color: "var(--color-5c3a1e)", fontFamily: "sans-serif" };
const seg = { display: "inline-flex", border: "1px solid var(--color-eddfc8)", borderRadius: "999px", overflow: "hidden", background: "var(--color-fffdf9)" };
const segBtn = { padding: "5px 10px", border: "none", background: "transparent", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const segOn = { background: "var(--color-f6e4b0)", fontWeight: 600 };
const scroller = { overflow: "auto", maxHeight: "calc(100vh - 230px)", minHeight: "200px", borderRadius: "10px", background: "var(--color-f4e7d4)", padding: "10px" };
const noteStyle = { margin: 0, fontSize: "11.5px", color: "var(--color-9b7040)", fontFamily: "sans-serif", lineHeight: 1.5 };
