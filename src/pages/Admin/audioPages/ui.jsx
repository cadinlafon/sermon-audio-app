import { useId } from "react";

// Small shared controls for the Audio Page Manager's settings panels.

export function Card({ title, hint, children, right }) {
  return (
    <div style={card}>
      {(title || right) && (
        <div style={cardHead}>
          <div>
            {title && <h3 style={cardTitle}>{title}</h3>}
            {hint && <p style={cardHint}>{hint}</p>}
          </div>
          {right}
        </div>
      )}
      <div style={cardBody}>{children}</div>
    </div>
  );
}

// A <label> only when the field holds a single form control; groups of
// controls (order lists, checkbox grids, pickers) get a plain wrapper so a
// click on empty space can't activate the first button inside.
const SINGLE_CONTROLS = ["input", "select", "textarea"];
export function Field({ label, hint, children }) {
  const only = Array.isArray(children) ? null : children;
  const single = only && only.type && (SINGLE_CONTROLS.includes(only.type) || only.type === TextInput || only.type === TextArea || only.type === Select);
  const Wrap = single ? "label" : "div";
  return (
    <Wrap style={field} role={single ? undefined : "group"}>
      {label && <span style={fieldLabel}>{label}</span>}
      {children}
      {hint && <span style={fieldHint}>{hint}</span>}
    </Wrap>
  );
}

export function TextInput({ value, onChange, placeholder, maxLength, disabled, type = "text", ...rest }) {
  return <input type={type} style={input} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} disabled={disabled} {...rest} />;
}

export function TextArea({ value, onChange, placeholder, maxLength, rows = 3, disabled }) {
  return <textarea style={{ ...input, resize: "vertical", minHeight: `${rows * 22}px` }} value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} disabled={disabled} />;
}

export function Select({ value, onChange, options, disabled }) {
  return (
    <select style={input} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}>
      {options.map((o) => {
        const [v, l] = Array.isArray(o) ? o : [o, o];
        return <option key={v} value={v}>{l}</option>;
      })}
    </select>
  );
}

// On/off switch with a label and optional hint.
export function Toggle({ label, hint, checked, onChange, disabled }) {
  const id = useId();
  return (
    <div style={toggleRow}>
      <div style={{ minWidth: 0 }}>
        <div id={id} style={toggleLabel}>{label}</div>
        {hint && <div style={toggleHint}>{hint}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={!!checked}
        aria-labelledby={id}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        style={checked ? { ...switchTrack, ...switchOn } : switchTrack}
      >
        <span style={checked ? { ...switchKnob, transform: "translateX(20px)" } : switchKnob} />
      </button>
    </div>
  );
}

// A list of items the admin can reorder (▲▼) and switch on/off.
//   items: [{ id, label, locked? }]   order: ids in the current order
//   enabled: { [id]: bool } (omit for plain reordering)
export function OrderList({ items, order, onOrder, enabled, onEnabled, disabled }) {
  const byId = Object.fromEntries(items.map((i) => [i.id, i]));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    onOrder(next);
  };
  return (
    <div style={orderList}>
      {order.map((id, i) => {
        const item = byId[id];
        if (!item) return null;
        const on = enabled ? enabled[id] !== false : true;
        return (
          <div key={id} style={on ? orderRow : { ...orderRow, opacity: 0.55 }}>
            <span style={orderLabel}>{item.label}</span>
            {item.locked && <span style={lockedTag}>always on</span>}
            <div style={orderTools}>
              {enabled && !item.locked && (
                <button type="button" style={on ? { ...smallBtn, ...smallBtnOn } : smallBtn} onClick={() => onEnabled(id, !on)} disabled={disabled} aria-pressed={on}>{on ? "Shown" : "Hidden"}</button>
              )}
              <button type="button" style={toolBtn} onClick={() => move(i, -1)} disabled={disabled || i === 0} aria-label={`Move ${item.label} up`}>▲</button>
              <button type="button" style={toolBtn} onClick={() => move(i, 1)} disabled={disabled || i === order.length - 1} aria-label={`Move ${item.label} down`}>▼</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Checkbox list: { id, label } with a boolean map.
export function CheckGrid({ items, values, onChange, disabled }) {
  return (
    <div style={checkGrid}>
      {items.map((it) => (
        <label key={it.id} style={checkLabel}>
          <input type="checkbox" checked={values[it.id] !== false && !!values[it.id]} onChange={(e) => onChange(it.id, e.target.checked)} disabled={disabled} />
          {it.label}
        </label>
      ))}
    </div>
  );
}

export function Slider({ label, min, max, step, value, onChange, display }) {
  return (
    <label style={{ display: "block" }}>
      <div style={sliderRow}><span>{label}</span><span>{display}</span></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} style={{ width: "100%", accentColor: "var(--color-c97c2e)" }} />
    </label>
  );
}

export const Button = ({ children, onClick, disabled, kind = "default", style, ...rest }) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{ ...(kind === "primary" ? primaryBtn : kind === "danger" ? dangerBtn : kind === "dashed" ? dashedBtn : smallBtn), ...(disabled ? { opacity: 0.55, cursor: "not-allowed" } : null), ...style }} {...rest}>{children}</button>
);

export const input = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none", minWidth: 0 };

const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "14px", padding: "16px 18px", marginBottom: "14px" };
const cardHead = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" };
const cardTitle = { margin: 0, fontSize: "15px", fontWeight: "600", color: "var(--color-5c3a1e)", fontFamily: "sans-serif" };
const cardHint = { margin: "3px 0 0", fontSize: "12.5px", color: "var(--color-9b7040)", fontFamily: "sans-serif", lineHeight: 1.5 };
const cardBody = { display: "flex", flexDirection: "column", gap: "12px" };
const field = { display: "flex", flexDirection: "column", gap: "5px", fontFamily: "sans-serif" };
const fieldLabel = { fontSize: "11px", color: "var(--color-9b7040)", letterSpacing: "0.06em", textTransform: "uppercase" };
const fieldHint = { fontSize: "12px", color: "var(--color-9b7040)", lineHeight: 1.45 };
const toggleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px" };
const toggleLabel = { fontSize: "14px", color: "var(--color-3d2200)", fontFamily: "sans-serif" };
const toggleHint = { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif", marginTop: "2px", lineHeight: 1.45 };
const switchTrack = { position: "relative", flexShrink: 0, width: "44px", height: "24px", borderRadius: "999px", border: "none", background: "var(--color-d6c4a8, #d6c4a8)", cursor: "pointer", padding: 0, transition: "background 0.15s" };
const switchOn = { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))" };
const switchKnob = { position: "absolute", top: "2px", left: "2px", width: "20px", height: "20px", borderRadius: "50%", background: "var(--color-ffffff)", boxShadow: "0 1px 4px rgba(0,0,0,0.25)", transition: "transform 0.15s" };
const orderList = { display: "flex", flexDirection: "column", gap: "6px" };
const orderRow = { display: "flex", alignItems: "center", gap: "10px", padding: "8px 10px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" };
const orderLabel = { flex: 1, fontSize: "13.5px", color: "var(--color-3d2200)", fontFamily: "sans-serif" };
const lockedTag = { fontSize: "11px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const orderTools = { display: "flex", gap: "5px", alignItems: "center" };
const toolBtn = { width: "28px", height: "28px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "11px" };
const smallBtn = { padding: "7px 12px", borderRadius: "9px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", fontSize: "12.5px", fontFamily: "sans-serif", cursor: "pointer" };
const smallBtnOn = { background: "var(--color-e3f5e6)", border: "1px solid var(--color-bfe6c8)", color: "var(--color-2f8a4a)" };
const primaryBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)", color: "var(--color-fff8ee)", fontSize: "13.5px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const dangerBtn = { padding: "7px 12px", borderRadius: "9px", border: "1px solid var(--color-fca5a5)", background: "var(--color-fffdf9)", color: "var(--color-dc2626)", fontSize: "12.5px", fontFamily: "sans-serif", cursor: "pointer" };
const dashedBtn = { padding: "9px 14px", borderRadius: "999px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", alignSelf: "flex-start" };
const checkGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "8px 14px" };
const checkLabel = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "var(--color-3d2200)", fontFamily: "sans-serif", cursor: "pointer" };
const sliderRow = { display: "flex", justifyContent: "space-between", fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", letterSpacing: "0.05em", textTransform: "uppercase", marginBottom: "2px" };
