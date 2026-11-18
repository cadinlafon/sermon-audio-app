import { usePopups } from "../../context/PopupContext";
import { POPUP_TYPE_BY_ID } from "../../lib/popups";
import { ui } from "./ui";

// Choose one of the popups made in Admin → Popups.
export default function PopupPicker({ value, onChange, style }) {
  const { popups, loading } = usePopups();
  const list = [...popups].sort((a, b) => (a.name || a.title || "").localeCompare(b.name || b.title || ""));
  const missing = value && !list.some((p) => p.id === value);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px", ...style }}>
      <select value={value || ""} onChange={(e) => onChange(e.target.value)} style={ui.input} aria-label="Popup">
        <option value="">{loading ? "Loading popups…" : list.length ? "Choose a popup…" : "No popups yet"}</option>
        {list.map((p) => (
          <option key={p.id} value={p.id}>
            {POPUP_TYPE_BY_ID[p.type]?.icon} {p.name || p.title || "Untitled popup"}{p.enabled === false ? " (off)" : ""}
          </option>
        ))}
        {missing && <option value={value}>⚠ Deleted popup ({value})</option>}
      </select>
      {list.length === 0 && !loading && <span style={ui.hint}>Create one in Admin → Popups first.</span>}
      {missing && <span style={{ ...ui.hint, color: "var(--color-b3432c)" }}>This popup no longer exists, so the link does nothing.</span>}
    </div>
  );
}
