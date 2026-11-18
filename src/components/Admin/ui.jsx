// Small shared pieces for the admin editors (rich text, buttons, colors,
// popups, notices). The look matches the existing admin forms.

export function Field({ label, hint, children, style }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", ...style }}>
      {label && <label style={ui.fieldLabel}>{label}</label>}
      {children}
      {hint && <span style={ui.hint}>{hint}</span>}
    </div>
  );
}

export function Segmented({ value, options, onChange, ariaLabel }) {
  return (
    <div style={ui.segment} role="group" aria-label={ariaLabel}>
      {options.map(([v, l]) => (
        <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)} style={value === v ? { ...ui.segBtn, ...ui.segOn } : ui.segBtn}>{l}</button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, children }) {
  return (
    <label style={ui.check}>
      <input type="checkbox" checked={!!checked} onChange={(e) => onChange(e.target.checked)} /> {children}
    </label>
  );
}

export const ui = {
  fieldLabel: { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", letterSpacing: "0.06em", textTransform: "uppercase" },
  hint: { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif", lineHeight: 1.45 },
  input: { padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none", width: "100%", boxSizing: "border-box" },
  check: { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-5c3a1e)", cursor: "pointer" },
  smallBtn: { padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-5c3a1e)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" },
  dangerBtn: { padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--color-fca5a5)", background: "var(--color-fdf8f3)", color: "var(--color-dc2626)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" },
  addBtn: { padding: "9px 16px", borderRadius: "12px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" },
  card: { display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)" },
  segment: { display: "inline-flex", border: "1px solid var(--color-eddfc8)", borderRadius: "999px", overflow: "hidden", background: "var(--color-fffdf9)", alignSelf: "flex-start", flexWrap: "wrap" },
  segBtn: { padding: "7px 13px", border: "none", background: "transparent", color: "var(--color-7a4f10)", fontSize: "12.5px", fontFamily: "sans-serif", cursor: "pointer" },
  segOn: { background: "var(--color-fde8b8)", fontWeight: 600 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  section: { display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "14px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" },
  sectionTitle: { margin: 0, fontSize: "14px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" },
};
