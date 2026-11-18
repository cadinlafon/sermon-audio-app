import { ACTION_BY_ID, APP_PAGES, BUTTON_ACTIONS, BUTTON_VARIANTS, MAX_BUTTONS, blankButton } from "../../lib/actionButtons";
import ColorField from "./ColorField";
import PopupPicker from "./PopupPicker";
import { Field, Segmented, ui } from "./ui";

////////////////////////////////////////////////////////////////
// Edit a list of buttons (see lib/actionButtons.js): text, what it does, how
// it looks. Any number up to MAX_BUTTONS, reorderable, each with its own colors.
//
//   allowDismiss  offer the "Close this" action (popups and banners)
//   accent        the color buttons fall back to (the notice's accent)
////////////////////////////////////////////////////////////////

export default function ButtonsEditor({ buttons, onChange, allowDismiss = false, max = MAX_BUTTONS, accent, addLabel = "+ Add a button" }) {
  const list = buttons || [];
  const set = (id, patch) => onChange(list.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const move = (id, dir) => {
    const i = list.findIndex((b) => b.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const actions = BUTTON_ACTIONS.filter((a) => allowDismiss || a.id !== "dismiss");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {list.length === 0 && <p style={ui.hint}>No buttons yet.</p>}
      {list.map((b, idx) => {
        const action = ACTION_BY_ID[b.action] || ACTION_BY_ID.url;
        return (
          <div key={b.id} style={ui.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <strong style={{ fontSize: "13px", color: "var(--color-5c3a1e)", fontFamily: "sans-serif" }}>Button {idx + 1}</strong>
              <div style={{ display: "flex", gap: "6px" }}>
                <button type="button" style={ui.smallBtn} onClick={() => move(b.id, -1)} disabled={idx === 0} aria-label={`Move button ${idx + 1} up`}>▲</button>
                <button type="button" style={ui.smallBtn} onClick={() => move(b.id, 1)} disabled={idx === list.length - 1} aria-label={`Move button ${idx + 1} down`}>▼</button>
                <button type="button" style={ui.dangerBtn} onClick={() => onChange(list.filter((x) => x.id !== b.id))} aria-label={`Remove button ${idx + 1}`}>Remove</button>
              </div>
            </div>

            <div style={ui.twoCol}>
              <Field label="Button text">
                <input value={b.text} maxLength={40} onChange={(e) => set(b.id, { text: e.target.value })} style={ui.input} placeholder="e.g. Learn more" />
              </Field>
              <Field label="When tapped">
                <select value={b.action} onChange={(e) => set(b.id, { action: e.target.value, value: "" })} style={ui.input}>
                  {actions.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.label}</option>)}
                </select>
              </Field>
            </div>

            {b.action === "popup" ? (
              <Field label="Which popup"><PopupPicker value={b.value} onChange={(v) => set(b.id, { value: v })} /></Field>
            ) : b.action === "page" ? (
              <Field label="Which page">
                <select value={APP_PAGES.some(([r]) => r === b.value) ? b.value : "__custom"} onChange={(e) => set(b.id, { value: e.target.value === "__custom" ? "/" : e.target.value })} style={ui.input}>
                  <option value="" disabled>Choose a page…</option>
                  {APP_PAGES.map(([route, name]) => <option key={route} value={route}>{name} ({route})</option>)}
                  <option value="__custom">Other path…</option>
                </select>
                {!APP_PAGES.some(([r]) => r === b.value) && b.value !== "" && (
                  <input value={b.value} onChange={(e) => set(b.id, { value: e.target.value })} style={{ ...ui.input, marginTop: "6px" }} placeholder="/page" />
                )}
              </Field>
            ) : b.action !== "dismiss" ? (
              <Field label={b.action === "email" ? "Email address" : b.action === "phone" ? "Phone number" : "Website address"}>
                <input value={b.value} onChange={(e) => set(b.id, { value: e.target.value })} style={ui.input} placeholder={action.placeholder} />
              </Field>
            ) : null}

            <Field label="Style">
              <Segmented value={b.variant || "solid"} options={BUTTON_VARIANTS} onChange={(v) => set(b.id, { variant: v })} ariaLabel="Button style" />
            </Field>
            <div style={ui.twoCol}>
              <ColorField label={b.variant === "solid" ? "Button color" : "Accent color"} value={b.bg} onChange={(v) => set(b.id, { bg: v })} fallback={accent || "#c97c2e"} />
              <ColorField label="Text color" value={b.color} onChange={(v) => set(b.id, { color: v })} fallback="#ffffff" />
            </div>
            {b.action === "url" && (
              <label style={ui.check}><input type="checkbox" checked={b.newTab !== false} onChange={(e) => set(b.id, { newTab: e.target.checked })} /> Open in a new tab</label>
            )}
          </div>
        );
      })}
      {list.length < max && <button type="button" style={ui.addBtn} onClick={() => onChange([...list, blankButton({ variant: list.length ? "outline" : "solid" })])}>{addLabel}</button>}
      {list.length >= max && <p style={ui.hint}>That's the most buttons you can add ({max}).</p>}
    </div>
  );
}
