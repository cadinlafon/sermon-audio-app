import { useEffect, useState } from "react";
import { SWATCHES, normalizeHex, isHex } from "../../lib/colors";
import { ui } from "./ui";

// A color picker: quick swatches, the browser's color wheel, and a hex box.
// Leaving it empty ("Auto") means "use the normal theme color".
export default function ColorField({ label, value, onChange, autoLabel = "Auto", allowClear = true, fallback = "#c97c2e" }) {
  const hex = normalizeHex(value);
  const [text, setText] = useState(value || "");
  useEffect(() => { setText(value || ""); }, [value]);

  const commit = (v) => { setText(v); if (isHex(v)) onChange(normalizeHex(v)); else if (v === "") onChange(""); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && <span style={ui.fieldLabel}>{label}</span>}
      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
        <input
          type="color"
          value={hex || fallback}
          onChange={(e) => onChange(e.target.value)}
          aria-label={label ? `${label} color` : "Color"}
          style={{ width: "36px", height: "32px", border: "1px solid var(--color-eddfc8)", borderRadius: "8px", background: "none", padding: "2px", cursor: "pointer" }}
        />
        <input
          value={text}
          onChange={(e) => commit(e.target.value)}
          placeholder={autoLabel}
          maxLength={7}
          aria-label={label ? `${label} hex` : "Hex color"}
          style={{ ...ui.input, width: "92px", padding: "7px 9px", fontFamily: "monospace", fontSize: "13px" }}
        />
        {allowClear && hex && <button type="button" style={ui.smallBtn} onClick={() => onChange("")}>{autoLabel}</button>}
      </div>
      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
        {SWATCHES.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            aria-label={`Use ${c}`}
            title={c}
            style={{ width: "22px", height: "22px", borderRadius: "50%", background: c, border: hex === c ? "2px solid var(--color-3d2200)" : "1px solid var(--color-d8c4a5)", cursor: "pointer", padding: 0 }}
          />
        ))}
      </div>
    </div>
  );
}
