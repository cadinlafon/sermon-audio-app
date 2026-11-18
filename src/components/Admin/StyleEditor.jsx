import { COLOR_PRESETS, PRESET_BY_ID, resolveStyle } from "../../lib/colors";
import ColorField from "./ColorField";
import { ui } from "./ui";

// Pick a look (preset) and fine-tune the colors of a notice / popup.
// `value` is the stored style object: { preset, bg, border, title, text, accent }.
export default function StyleEditor({ value, onChange, fields = ["bg", "border", "title", "text", "accent"] }) {
  const style = value && typeof value === "object" ? value : { preset: "default" };
  const resolved = resolveStyle(style);
  const set = (patch) => onChange({ ...style, ...patch });
  const usePreset = (id) => {
    // Choosing a preset clears the hand-picked colors so the preset shows through.
    onChange({ preset: id });
  };
  const labels = { bg: "Background", border: "Border", title: "Title color", text: "Text color", accent: "Buttons & links" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }} role="group" aria-label="Color presets">
        {COLOR_PRESETS.map((p) => {
          const on = (style.preset || "default") === p.id;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => usePreset(p.id)}
              title={p.label}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "6px", borderRadius: "12px", border: on ? "2px solid var(--color-c97c2e)" : "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", cursor: "pointer", minWidth: "64px" }}
            >
              <span style={{ width: "46px", height: "28px", borderRadius: "8px", background: p.bg || "var(--color-fffdf9)", border: `1px solid ${p.border || "var(--color-eddfc8)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ width: "18px", height: "6px", borderRadius: "3px", background: p.accent || "var(--color-c97c2e)" }} />
              </span>
              <span style={{ fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-5c3a1e)" }}>{p.label}</span>
            </button>
          );
        })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
        {fields.map((k) => (
          <ColorField
            key={k}
            label={labels[k]}
            value={style[k] || ""}
            onChange={(v) => set({ [k]: v })}
            autoLabel={PRESET_BY_ID[style.preset || "default"]?.[k] ? "Preset" : "Auto"}
            fallback={resolved[k] || "#c97c2e"}
          />
        ))}
      </div>
      <p style={ui.hint}>Colors you pick stay the same in light and dark mode. Choose “Default” and clear the colors to follow the app's theme.</p>
    </div>
  );
}
