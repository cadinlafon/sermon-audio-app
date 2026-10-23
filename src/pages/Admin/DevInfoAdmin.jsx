import { useEffect, useMemo, useState } from "react";
import { doc, getDoc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useModulePermissions } from "../../hooks/usePermissions";
import { logAdminAction } from "../../utils/adminAudit";
import { DEV_INFO_DEFAULTS, mergeDevInfo } from "../../data/devInfoDefaults";
import { isHttpUrl } from "../../lib/resourceTypes";

const clone = (v) => JSON.parse(JSON.stringify(v));

// Drop blank rows/groups/items and trim, so what's saved is exactly what shows.
function clean(form) {
  const t = (v) => (typeof v === "string" ? v.trim() : "");
  return {
    appName: t(form.appName),
    license: t(form.license),
    githubUrl: t(form.githubUrl),
    liveUrl: t(form.liveUrl),
    techStack: form.techStack
      .map((g) => ({ group: t(g.group), items: g.items.map(t).filter(Boolean) }))
      .filter((g) => g.group && g.items.length > 0),
    features: form.features.map((f) => ({ icon: t(f.icon) || "•", label: t(f.label) })).filter((f) => f.label),
    backendFunctions: form.backendFunctions.map((f) => ({ name: t(f.name), desc: t(f.desc) })).filter((f) => f.name),
    supportText: t(form.supportText),
  };
}

function validate(c) {
  if (!c.appName) return "The app name can't be empty.";
  if (!c.license) return "The license can't be empty.";
  if (!isHttpUrl(c.githubUrl)) return "The GitHub link must be a full web address starting with https://";
  if (!isHttpUrl(c.liveUrl)) return "The live app link must be a full web address starting with https://";
  return null;
}

export default function DevInfoAdmin() {
  const perms = useModulePermissions("devInfo");
  const [form, setForm] = useState(() => clone(mergeDevInfo(null)));
  const [saved, setSaved] = useState(() => clone(mergeDevInfo(null)));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [hasStored, setHasStored] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null); // { type: "ok" | "error", text }
  const [newItem, setNewItem] = useState({}); // groupIndex -> text being typed

  useEffect(() => {
    getDoc(doc(db, "appConfig", "devInfo"))
      .then((snap) => {
        const merged = mergeDevInfo(snap.exists() ? snap.data() : null);
        setForm(clone(merged));
        setSaved(clone(merged));
        setHasStored(snap.exists());
      })
      .catch((err) => {
        console.error("Couldn't load Dev Info content", err);
        setLoadError("Couldn't load the saved Dev Info — showing the defaults. Saving will replace whatever is stored.");
      })
      .finally(() => setLoading(false));
  }, []);

  const dirty = useMemo(() => JSON.stringify(clean(form)) !== JSON.stringify(clean(saved)), [form, saved]);
  const canEdit = perms.canEdit;

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const update = (key, fn) => setForm((f) => ({ ...f, [key]: fn(f[key]) }));
  const move = (key, i, dir) => update(key, (list) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });
  const remove = (key, i) => update(key, (list) => list.filter((_, j) => j !== i));
  const patch = (key, i, p) => update(key, (list) => list.map((row, j) => (j === i ? { ...row, ...p } : row)));

  const addChip = (gi) => {
    const text = (newItem[gi] || "").trim();
    if (!text) return;
    update("techStack", (list) => list.map((g, j) => (j === gi ? { ...g, items: [...g.items, text] } : g)));
    setNewItem((n) => ({ ...n, [gi]: "" }));
  };

  const handleSave = async () => {
    if (!perms.requireEdit()) return;
    const content = clean(form);
    const problem = validate(content);
    if (problem) { setMessage({ type: "error", text: problem }); return; }
    setSaving(true);
    setMessage(null);
    try {
      await setDoc(doc(db, "appConfig", "devInfo"), {
        ...content,
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || "unknown",
      });
      logAdminAction({
        category: "content_edit",
        action: "editDevInfo",
        targetType: "appConfig",
        targetId: "devInfo",
        targetLabel: "Dev Info page",
        before: clean(saved),
        after: content,
      });
      setSaved(clone(content));
      setForm(clone(content));
      setHasStored(true);
      setMessage({ type: "ok", text: "Saved — the Dev Info page is updated." });
    } catch (err) {
      console.error("Saving Dev Info failed", err);
      setMessage({ type: "error", text: "Couldn't save. Please try again." });
    }
    setSaving(false);
  };

  const handleReset = async () => {
    if (!perms.requireEdit()) return;
    if (!window.confirm("Reset the Dev Info page to its built-in defaults? Everything you've edited will be lost.")) return;
    setSaving(true);
    setMessage(null);
    try {
      await deleteDoc(doc(db, "appConfig", "devInfo"));
      logAdminAction({ category: "content_edit", action: "resetDevInfo", targetType: "appConfig", targetId: "devInfo", targetLabel: "Dev Info page", before: clean(saved), after: null });
      const defaults = clone(mergeDevInfo(null));
      setForm(defaults);
      setSaved(clone(defaults));
      setHasStored(false);
      setMessage({ type: "ok", text: "Reset — the Dev Info page is showing the defaults again." });
    } catch (err) {
      console.error("Resetting Dev Info failed", err);
      setMessage({ type: "error", text: "Couldn't reset. Please try again." });
    }
    setSaving(false);
  };

  if (loading) return <div style={page}><p style={hint}>Loading…</p></div>;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Dev Info</h1>
        <p style={pageSubtitle}>Edit what the public Dev Info page shows. Changes appear as soon as you save.</p>
      </div>

      {loadError && <div style={{ ...banner, ...bannerWarn }}>{loadError}</div>}
      {!canEdit && <div style={{ ...banner, ...bannerWarn }}>You can view this page but not change it.</div>}

      {/* APP INFO */}
      <Section icon="📱" title="App Info">
        <Field label="Name"><input style={input} value={form.appName} onChange={set("appName")} disabled={!canEdit} /></Field>
        <Field label="License"><input style={input} value={form.license} onChange={set("license")} disabled={!canEdit} /></Field>
        <Field label="GitHub link"><input style={input} value={form.githubUrl} onChange={set("githubUrl")} placeholder="https://github.com/…" disabled={!canEdit} /></Field>
        <Field label="Live app link"><input style={input} value={form.liveUrl} onChange={set("liveUrl")} placeholder="https://…" disabled={!canEdit} /></Field>
        <p style={hint}>The version number is filled in automatically on every deploy, so it isn't editable here.</p>
      </Section>

      {/* TECH STACK */}
      <Section icon="🛠️" title="Tech Stack">
        {form.techStack.map((g, gi) => (
          <div key={gi} style={rowCard}>
            <div style={rowHead}>
              <input style={{ ...input, fontWeight: "600" }} value={g.group} onChange={(e) => patch("techStack", gi, { group: e.target.value })} placeholder="Group name, e.g. Frontend" aria-label={`Group ${gi + 1} name`} disabled={!canEdit} />
              {canEdit && <Tools onUp={() => move("techStack", gi, -1)} onDown={() => move("techStack", gi, 1)} onRemove={() => remove("techStack", gi)} first={gi === 0} last={gi === form.techStack.length - 1} label={`group ${gi + 1}`} />}
            </div>
            <div style={chipRow}>
              {g.items.map((item, ii) => (
                <span key={ii} style={chip}>
                  {item}
                  {canEdit && <button type="button" style={chipX} onClick={() => patch("techStack", gi, { items: g.items.filter((_, k) => k !== ii) })} aria-label={`Remove ${item}`}>✕</button>}
                </span>
              ))}
            </div>
            {canEdit && (
              <div style={addRow}>
                <input style={input} value={newItem[gi] || ""} onChange={(e) => setNewItem((n) => ({ ...n, [gi]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addChip(gi); } }} placeholder="Add an item, then press Enter" aria-label={`Add item to ${g.group || "group"}`} />
                <button type="button" style={smallBtn} onClick={() => addChip(gi)}>Add</button>
              </div>
            )}
          </div>
        ))}
        {canEdit && <button type="button" style={addBtn} onClick={() => update("techStack", (l) => [...l, { group: "", items: [] }])}>+ Add group</button>}
      </Section>

      {/* FEATURES */}
      <Section icon="🎯" title="Features">
        {form.features.map((f, i) => (
          <div key={i} style={rowLine}>
            <input style={{ ...input, width: "64px", textAlign: "center", flexShrink: 0 }} value={f.icon} onChange={(e) => patch("features", i, { icon: e.target.value })} aria-label={`Feature ${i + 1} icon`} maxLength={8} disabled={!canEdit} />
            <input style={input} value={f.label} onChange={(e) => patch("features", i, { label: e.target.value })} placeholder="Feature name" aria-label={`Feature ${i + 1} name`} disabled={!canEdit} />
            {canEdit && <Tools onUp={() => move("features", i, -1)} onDown={() => move("features", i, 1)} onRemove={() => remove("features", i)} first={i === 0} last={i === form.features.length - 1} label={`feature ${i + 1}`} />}
          </div>
        ))}
        {canEdit && <button type="button" style={addBtn} onClick={() => update("features", (l) => [...l, { icon: "✨", label: "" }])}>+ Add feature</button>}
      </Section>

      {/* BACKEND FUNCTIONS */}
      <Section icon="⚙️" title="Backend Functions">
        {form.backendFunctions.map((fn, i) => (
          <div key={i} style={rowCard}>
            <div style={rowHead}>
              <input style={{ ...input, fontFamily: "monospace" }} value={fn.name} onChange={(e) => patch("backendFunctions", i, { name: e.target.value })} placeholder="function-name" aria-label={`Function ${i + 1} name`} disabled={!canEdit} />
              {canEdit && <Tools onUp={() => move("backendFunctions", i, -1)} onDown={() => move("backendFunctions", i, 1)} onRemove={() => remove("backendFunctions", i)} first={i === 0} last={i === form.backendFunctions.length - 1} label={`function ${i + 1}`} />}
            </div>
            <input style={input} value={fn.desc} onChange={(e) => patch("backendFunctions", i, { desc: e.target.value })} placeholder="What it does" aria-label={`Function ${i + 1} description`} disabled={!canEdit} />
          </div>
        ))}
        {canEdit && <button type="button" style={addBtn} onClick={() => update("backendFunctions", (l) => [...l, { name: "", desc: "" }])}>+ Add function</button>}
      </Section>

      {/* SUPPORT */}
      <Section icon="📞" title="Support">
        <Field label="Support text">
          <textarea style={{ ...input, height: "80px", resize: "vertical" }} value={form.supportText} onChange={set("supportText")} disabled={!canEdit} />
        </Field>
        <p style={hint}>A "View on GitHub" link is added after this text automatically.</p>
      </Section>

      {message && <div style={{ ...banner, ...(message.type === "ok" ? bannerOk : bannerError) }} role="status">{message.text}</div>}

      {canEdit && (
        <div style={actions}>
          <button type="button" style={dirty && !saving ? saveBtn : { ...saveBtn, opacity: 0.55 }} onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </button>
          <a href="/dev-info" target="_blank" rel="noopener noreferrer" style={linkBtn}>View the Dev Info page ↗</a>
          {hasStored && <button type="button" style={resetBtn} onClick={handleReset} disabled={saving}>Reset to defaults</button>}
        </div>
      )}
      {canEdit && dirty && <p style={hint}>You have unsaved changes.</p>}
    </div>
  );
}

function Section({ icon, title, children }) {
  return (
    <div style={card}>
      <div style={cardHeader}><span style={{ fontSize: "20px" }}>{icon}</span><h2 style={cardTitle}>{title}</h2></div>
      <div style={cardBody}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

function Tools({ onUp, onDown, onRemove, first, last, label }) {
  return (
    <div style={tools}>
      <button type="button" style={toolBtn} onClick={onUp} disabled={first} aria-label={`Move ${label} up`}>▲</button>
      <button type="button" style={toolBtn} onClick={onDown} disabled={last} aria-label={`Move ${label} down`}>▼</button>
      <button type="button" style={{ ...toolBtn, color: "var(--color-dc2626)", borderColor: "var(--color-fca5a5)" }} onClick={onRemove} aria-label={`Remove ${label}`}>✕</button>
    </div>
  );
}

const page = { maxWidth: "720px" };
const pageHeader = { marginBottom: "22px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0 };
const hint = { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: "4px 0 0", lineHeight: 1.5 };

const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "16px", padding: "20px 22px", marginBottom: "18px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const cardHeader = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" };
const cardTitle = { fontSize: "17px", fontWeight: "normal", color: "var(--color-5c3a1e)", fontFamily: "'Georgia', serif", margin: 0 };
const cardBody = { display: "flex", flexDirection: "column", gap: "12px" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", letterSpacing: "0.06em", textTransform: "uppercase" };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none", width: "100%", boxSizing: "border-box", minWidth: 0 };

const rowCard = { display: "flex", flexDirection: "column", gap: "10px", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" };
const rowHead = { display: "flex", gap: "8px", alignItems: "center" };
const rowLine = { display: "flex", gap: "8px", alignItems: "center" };
const tools = { display: "flex", gap: "5px", flexShrink: 0 };
const toolBtn = { width: "30px", height: "30px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "12px" };

const chipRow = { display: "flex", flexWrap: "wrap", gap: "6px" };
const chip = { display: "inline-flex", alignItems: "center", gap: "6px", padding: "5px 6px 5px 12px", borderRadius: "999px", background: "var(--color-f6e4b0)", color: "var(--color-7a5a10)", fontSize: "12.5px", fontFamily: "sans-serif" };
const chipX = { border: "none", background: "none", cursor: "pointer", color: "var(--color-7a5a10)", fontSize: "11px", padding: "0 4px", lineHeight: 1 };
const addRow = { display: "flex", gap: "8px" };
const smallBtn = { padding: "9px 16px", borderRadius: "10px", border: "1px solid var(--color-c97c2e)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", flexShrink: 0 };
const addBtn = { alignSelf: "flex-start", padding: "9px 16px", borderRadius: "999px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };

const banner = { padding: "12px 16px", borderRadius: "12px", fontSize: "13px", fontFamily: "sans-serif", lineHeight: 1.5, marginBottom: "16px", border: "1px solid var(--color-eddfc8)" };
const bannerOk = { background: "var(--color-e3f5e6)", borderColor: "var(--color-bfe6c8)", color: "var(--color-2f8a4a)" };
const bannerError = { background: "var(--color-fee2e2)", borderColor: "var(--color-fca5a5)", color: "var(--color-991b1b)" };
const bannerWarn = { background: "var(--color-fffbee)", borderColor: "var(--color-f0d898)", color: "var(--color-7a5530)" };

const actions = { display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap", marginTop: "6px" };
const saveBtn = { padding: "12px 24px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)", color: "var(--color-fff8ee)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 12px rgba(160,80,20,0.28)" };
const linkBtn = { fontSize: "13px", color: "var(--color-a85e18)", fontFamily: "sans-serif", fontWeight: "600", textDecoration: "none" };
const resetBtn = { marginLeft: "auto", padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--color-fca5a5)", background: "none", color: "var(--color-dc2626)", fontSize: "12.5px", fontFamily: "sans-serif", cursor: "pointer" };
