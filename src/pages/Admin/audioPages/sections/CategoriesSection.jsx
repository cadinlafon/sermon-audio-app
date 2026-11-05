import { Card, Field, Select, TextInput, TextArea, Toggle, Button } from "../ui";
import { SORT_OPTIONS } from "../../../../data/audioPageDefaults";

const ICONS = ["", "🎙️", "📖", "🙏", "✝️", "🕊️", "⛪", "🎓", "📚", "👨‍👩‍👧", "🎶", "⭐"];

// Category Manager: the audio categories (Sermon, Homily, Sunday School) —
// order, visibility, names, descriptions, icons, default sort, featured one.
export default function CategoriesSection({ categories, featuredCategory, setCategories, setFeatured, canEdit }) {
  const patch = (id, p) => setCategories((list) => list.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const move = (i, dir) => setCategories((list) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  return (
    <>
      <p style={intro}>These are the audio categories. Their order here is the order they appear in filters and groups; a hidden category's recordings don't show on the audio pages. These settings apply to both pages.</p>
      {categories.map((c, i) => (
        <Card
          key={c.id}
          title={`${c.icon ? `${c.icon} ` : ""}${c.name}${featuredCategory === c.id ? "  ⭐ Featured" : ""}`}
          right={
            <div style={tools}>
              <button type="button" style={toolBtn} onClick={() => move(i, -1)} disabled={!canEdit || i === 0} aria-label={`Move ${c.name} up`}>▲</button>
              <button type="button" style={toolBtn} onClick={() => move(i, 1)} disabled={!canEdit || i === categories.length - 1} aria-label={`Move ${c.name} down`}>▼</button>
            </div>
          }
        >
          <Toggle label="Show this category" hint="Off: its recordings are hidden from the audio pages." checked={c.visible} onChange={(v) => patch(c.id, { visible: v })} disabled={!canEdit} />
          <div style={two}>
            <Field label="Name (singular)" hint="Shown on cards."><TextInput value={c.name} onChange={(v) => patch(c.id, { name: v })} maxLength={40} disabled={!canEdit} /></Field>
            <Field label="Name (plural)" hint="Shown in filters and headings."><TextInput value={c.plural} onChange={(v) => patch(c.id, { plural: v })} maxLength={40} disabled={!canEdit} /></Field>
          </div>
          <Field label="Icon">
            <div style={iconRow}>
              {ICONS.map((ic) => (
                <button key={ic || "none"} type="button" onClick={() => patch(c.id, { icon: ic })} disabled={!canEdit} aria-pressed={c.icon === ic} style={c.icon === ic ? { ...iconBtn, ...iconBtnOn } : iconBtn}>{ic || "none"}</button>
              ))}
              <input style={iconInput} value={ICONS.includes(c.icon) ? "" : c.icon} onChange={(e) => patch(c.id, { icon: e.target.value.slice(0, 4) })} placeholder="or type one" disabled={!canEdit} aria-label="Custom icon" />
            </div>
          </Field>
          <Field label="Description" hint="Shown under the page title or the group heading (see Appearance)."><TextArea value={c.description} onChange={(v) => patch(c.id, { description: v })} maxLength={300} rows={2} disabled={!canEdit} /></Field>
          <Field label="Default sort for this category" hint="Used when the page opens on this category. Blank = the page's own default."><Select value={c.defaultSort} onChange={(v) => patch(c.id, { defaultSort: v })} options={[["", "Use the page default"], ...SORT_OPTIONS]} disabled={!canEdit} /></Field>
          <div>
            {featuredCategory === c.id
              ? <Button onClick={() => setFeatured("")} disabled={!canEdit}>⭐ Featured — click to unset</Button>
              : <Button onClick={() => setFeatured(c.id)} disabled={!canEdit || !c.visible}>Make this the featured category</Button>}
          </div>
        </Card>
      ))}
    </>
  );
}
const intro = { margin: "0 0 14px", fontSize: "13px", color: "var(--color-7a5530)", fontFamily: "sans-serif", lineHeight: 1.55 };
const tools = { display: "flex", gap: "5px" };
const toolBtn = { width: "28px", height: "28px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "11px" };
const two = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const iconRow = { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" };
const iconBtn = { minWidth: "36px", height: "34px", padding: "0 8px", borderRadius: "9px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "16px", cursor: "pointer", color: "var(--color-7a4f10)", fontFamily: "sans-serif" };
const iconBtnOn = { background: "var(--color-f6e4b0)", border: "1px solid var(--color-c97c2e)" };
const iconInput = { width: "110px", padding: "7px 10px", borderRadius: "9px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)" };
