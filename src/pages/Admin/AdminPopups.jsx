import { useEffect, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../../firebase";
import { useModulePermissions } from "../../hooks/usePermissions";
import { usePopups } from "../../context/PopupContext";
import RichTextField from "../../components/Admin/RichTextField";
import ButtonsEditor from "../../components/Admin/ButtonsEditor";
import StyleEditor from "../../components/Admin/StyleEditor";
import InputFieldsEditor from "../../components/Admin/InputFieldsEditor";
import PopupPreview from "../../components/Admin/PopupPreview";
import { Field, Segmented, Toggle, ui } from "../../components/Admin/ui";
import { APP_PAGES, validateButtons } from "../../lib/actionButtons";
import { stripRichText } from "../../lib/richText";
import { validateInputConfig, formFromNotice, blankField } from "../../utils/noticeInputs";
import {
  ALIGNMENTS, ANIMATIONS, AUDIENCES, BANNER_POSITIONS, BUTTON_LAYOUTS, CORNER_POSITIONS, FREQUENCIES, MODAL_SIZES,
  POPUP_TYPES, POPUP_TYPE_BY_ID, TRIGGER_MODES, defaultPopup, popupPayload, sanitizePopup,
} from "../../lib/popups";

////////////////////////////////////////////////////////////////
// Admin → Popups. Build popups, banners, corner alerts, bottom sheets and
// full-screen takeovers; give them rich text, buttons, colors, a form and a
// security check; choose when they show. Open one from anywhere with a rich-text
// link [text](popup:ID) or a button's "Open a popup" action.
////////////////////////////////////////////////////////////////

const blank = (type = "modal") => ({ ...defaultPopup(type), inputFields: [blankField("text")] });

export default function AdminPopups() {
  const perms = useModulePermissions("popups");
  const { openPopup, reload } = usePopups();
  const [popups, setPopups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // popup doc or {} for new
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [replies, setReplies] = useState(null);
  const [replyRows, setReplyRows] = useState([]);
  const [copied, setCopied] = useState("");

  const load = async () => {
    const snap = await getDocs(collection(db, "popups"));
    const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    setPopups(list);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const openCreate = (type = "modal") => { setEditing({}); setForm(blank(type)); };
  const openEdit = (p) => {
    const clean = sanitizePopup(p);
    setEditing(p);
    setForm({ ...clean, ...formFromNotice({ ...p, id: p.id }), inputEnabled: clean.inputEnabled && (p.inputFields || []).length > 0 });
  };
  const close = () => { setEditing(null); setForm(null); };

  const set = (patch) => setForm((cur) => ({ ...cur, ...patch }));
  const setTrigger = (patch) => setForm((cur) => ({ ...cur, trigger: { ...cur.trigger, ...patch } }));

  const changeType = (type) => setForm((cur) => {
    const d = defaultPopup(type);
    return { ...cur, type, position: type === "banner" ? (BANNER_POSITIONS.some(([v]) => v === cur.position) ? cur.position : "top") : type === "corner" ? (CORNER_POSITIONS.some(([v]) => v === cur.position) ? cur.position : "bottom-right") : cur.position, animation: d.animation, align: type === "banner" ? "left" : cur.align };
  });

  const save = async () => {
    if (!perms.requireEdit()) return;
    if (!form.name.trim() && !form.title.trim()) return alert("Give the popup a name (only you see it) or a title.");
    if (!form.title.trim() && !form.body.trim() && !form.inputEnabled && form.buttons.length === 0) return alert("A popup needs a title, some text, a form or a button.");
    const buttonError = validateButtons(form.buttons);
    if (buttonError) return alert(buttonError);
    const inputError = validateInputConfig(form);
    if (inputError) return alert(inputError);
    setSaving(true);
    try {
      const payload = popupPayload(form);
      if (editing?.id) await updateDoc(doc(db, "popups", editing.id), { ...payload, updatedAt: serverTimestamp() });
      else await addDoc(collection(db, "popups"), { ...payload, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
      close();
      await load();
      reload();
    } catch (err) {
      console.error("Couldn't save popup", err);
      alert("Couldn't save the popup. Please try again.");
    }
    setSaving(false);
  };

  const remove = async (p) => {
    if (!perms.requireDelete()) return;
    if (!window.confirm(`Delete “${p.name || p.title || "this popup"}”? Links that open it will stop working, and its replies are deleted too.`)) return;
    await deleteDoc(doc(db, "popups", p.id));
    const subs = await getDocs(query(collection(db, "popupSubmissions"), where("popupId", "==", p.id))).catch(() => null);
    if (subs) await Promise.all(subs.docs.map((d) => deleteDoc(doc(db, "popupSubmissions", d.id))));
    await load();
    reload();
  };

  const toggle = async (p) => { if (!perms.requireEdit()) return; await updateDoc(doc(db, "popups", p.id), { enabled: p.enabled === false }); await load(); reload(); };

  const duplicate = async (p) => {
    if (!perms.requireEdit()) return;
    const { id, createdAt, updatedAt, ...rest } = p; // eslint-disable-line no-unused-vars
    await addDoc(collection(db, "popups"), { ...rest, name: `${p.name || p.title || "Popup"} (copy)`, enabled: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
    await load();
    reload();
  };

  const copyLink = async (p) => {
    const text = `[Tap here](popup:${p.id})`;
    try { await navigator.clipboard.writeText(text); setCopied(p.id); setTimeout(() => setCopied(""), 1800); } catch { window.prompt("Copy this link code:", text); }
  };

  const openReplies = async (p) => {
    setReplies(p);
    setReplyRows([]);
    try {
      const snap = await getDocs(query(collection(db, "popupSubmissions"), where("popupId", "==", p.id)));
      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setReplyRows(rows);
    } catch (err) { console.error(err); }
  };

  const statusOf = (p) => {
    if (p.enabled === false) return ["Off", "var(--color-fee2e2)", "var(--color-991b1b)"];
    const today = new Date().toISOString().slice(0, 10);
    if (p.startDate && today < p.startDate) return ["Scheduled", "var(--color-e8f0fe)", "var(--color-2a5ab5)"];
    if (p.endDate && today > p.endDate) return ["Ended", "var(--color-e9e4d9)", "var(--color-4b5563)"];
    return ["On", "var(--color-dcfce7)", "var(--color-166534)"];
  };

  const triggerText = (p) => {
    const t = p.trigger || {};
    if (t.mode === "load") return `Shows when the app opens${t.delaySeconds ? ` after ${t.delaySeconds}s` : ""}`;
    if (t.mode === "page") return `Shows on ${(t.paths || []).length || 0} page${(t.paths || []).length === 1 ? "" : "s"}`;
    return "Opens from a link or button";
  };

  return (
    <div style={page}>
      <div style={topRow}>
        <div>
          <h1 style={pageTitle}>Popups</h1>
          <p style={pageSubtitle}>Banners, popups, corner alerts and more — open them from a link or button, or show them automatically.</p>
        </div>
        {perms.canEdit && <button style={primaryBtn} onClick={() => openCreate()}>+ New Popup</button>}
      </div>

      {loading && <p style={empty}>Loading…</p>}
      {!loading && popups.length === 0 && (
        <div style={emptyCard}>
          <div style={{ fontSize: "36px" }}>🪟</div>
          <p style={{ margin: "6px 0 14px", color: "var(--color-7a5530)", fontFamily: "sans-serif" }}>No popups yet. Pick a style to start:</p>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "center" }}>
            {perms.canEdit && POPUP_TYPES.map((t) => <button key={t.id} style={ui.smallBtn} onClick={() => openCreate(t.id)}>{t.icon} {t.label}</button>)}
          </div>
        </div>
      )}

      {popups.map((p) => {
        const clean = sanitizePopup(p);
        const [label, bg, fg] = statusOf(p);
        const type = POPUP_TYPE_BY_ID[clean.type];
        return (
          <div key={p.id} style={card}>
            <div style={cardTop}>
              <span style={cardTitle}>{type?.icon} {p.name || p.title || "Untitled popup"}</span>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                <span style={{ ...badge, background: bg, color: fg }}>{label}</span>
                <span style={{ ...badge, background: "var(--color-f6e4b0)", color: "var(--color-7a5a10)" }}>{type?.label}</span>
                {clean.inputFields.length > 0 && clean.inputEnabled && <span style={{ ...badge, background: "var(--color-e3f5e6)", color: "var(--color-2f8a4a)" }}>Form</span>}
                {clean.captcha && <span style={{ ...badge, background: "var(--color-e8f0fe)", color: "var(--color-2a5ab5)" }}>Security check</span>}
              </div>
            </div>
            {(p.title || p.body) && <p style={cardText}>{p.title ? `${p.title} — ` : ""}{stripRichText(p.body).slice(0, 140)}</p>}
            <p style={cardMeta}>{triggerText(clean)} · {clean.buttons.length} button{clean.buttons.length === 1 ? "" : "s"}</p>
            <div style={cardActions}>
              {perms.canEdit && <button style={ui.smallBtn} onClick={() => openEdit(p)}>Edit</button>}
              <button style={ui.smallBtn} onClick={() => openPopup(p.id)} title="Opens it in the real app so you can try it">Try it</button>
              <button style={ui.smallBtn} onClick={() => copyLink(p)} title="Paste this into any rich text to make a link that opens this popup">{copied === p.id ? "✓ Copied" : "Copy link code"}</button>
              {perms.canEdit && <button style={ui.smallBtn} onClick={() => toggle(p)}>{p.enabled === false ? "Turn on" : "Turn off"}</button>}
              {perms.canEdit && <button style={ui.smallBtn} onClick={() => duplicate(p)}>Duplicate</button>}
              {clean.inputFields.length > 0 && clean.inputEnabled && <button style={ui.smallBtn} onClick={() => openReplies(p)}>Replies</button>}
              {perms.canDelete && <button style={ui.dangerBtn} onClick={() => remove(p)}>Delete</button>}
            </div>
          </div>
        );
      })}

      {/* EDITOR */}
      {form && (
        <div style={modalBg}>
          <div style={wideModal}>
            <div style={wideHead}>
              <h2 style={modalTitle}>{editing?.id ? "Edit Popup" : "New Popup"}</h2>
              <div style={{ display: "flex", gap: "10px" }}>
                <button style={cancelBtn} onClick={close}>Cancel</button>
                <button style={saveBtn} onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
              </div>
            </div>

            <style>{`@media (max-width: 1000px){ .pf-editor-grid{ grid-template-columns: minmax(0,1fr) !important; } .pf-editor-preview{ position: static !important; } }`}</style>
            <div className="pf-editor-grid" style={editorGrid}>
              <div style={editorCol}>
                {/* TYPE */}
                <div style={ui.section}>
                  <h3 style={ui.sectionTitle}>Style</h3>
                  <div style={typeGrid} role="group" aria-label="Popup style">
                    {POPUP_TYPES.map((t) => (
                      <button key={t.id} type="button" aria-pressed={form.type === t.id} onClick={() => changeType(t.id)} style={form.type === t.id ? { ...typeCard, ...typeOn } : typeCard}>
                        <span style={{ fontSize: "22px" }}>{t.icon}</span>
                        <span style={{ fontSize: "13px", fontWeight: 600 }}>{t.label}</span>
                        <span style={{ fontSize: "11px", color: "var(--color-9b7040)", lineHeight: 1.3 }}>{t.hint}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* CONTENT */}
                <div style={ui.section}>
                  <h3 style={ui.sectionTitle}>What it says</h3>
                  <Field label="Name (only you see this)"><input value={form.name} onChange={(e) => set({ name: e.target.value })} style={ui.input} placeholder="e.g. Picnic sign-up" maxLength={80} /></Field>
                  <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", gap: "10px" }}>
                    <Field label="Icon"><input value={form.icon} onChange={(e) => set({ icon: e.target.value })} style={{ ...ui.input, textAlign: "center", fontSize: "18px" }} placeholder="🎉" maxLength={8} /></Field>
                    <Field label="Title"><input value={form.title} onChange={(e) => set({ title: e.target.value })} style={ui.input} placeholder="Heading people see" maxLength={120} /></Field>
                  </div>
                  <Field label="Text"><RichTextField value={form.body} onChange={(v) => set({ body: v })} rows={5} placeholder="Say something… use the toolbar for bold, italics, lists and links" preview={false} /></Field>
                  <Field label="Picture (optional)" hint="A web address (https://…) of an image to show at the top.">
                    <input value={form.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} style={ui.input} placeholder="https://…" />
                  </Field>
                </div>

                {/* LOOK */}
                <div style={ui.section}>
                  <h3 style={ui.sectionTitle}>How it looks</h3>
                  {form.type === "modal" && <Field label="Size"><Segmented value={form.size} options={MODAL_SIZES} onChange={(v) => set({ size: v })} ariaLabel="Size" /></Field>}
                  {form.type === "banner" && <Field label="Where"><Segmented value={form.position} options={BANNER_POSITIONS} onChange={(v) => set({ position: v })} ariaLabel="Banner position" /></Field>}
                  {form.type === "corner" && <Field label="Which corner"><Segmented value={form.position} options={CORNER_POSITIONS} onChange={(v) => set({ position: v })} ariaLabel="Corner" /></Field>}
                  <div style={ui.twoCol}>
                    <Field label="Entrance"><Segmented value={form.animation} options={ANIMATIONS} onChange={(v) => set({ animation: v })} ariaLabel="Animation" /></Field>
                    {form.type !== "banner" && <Field label="Text alignment"><Segmented value={form.align} options={ALIGNMENTS} onChange={(v) => set({ align: v })} ariaLabel="Alignment" /></Field>}
                  </div>
                  {(form.type === "modal" || form.type === "sheet") && (
                    <Field label={`Background dimming: ${form.overlay}%`}>
                      <input type="range" min={0} max={85} value={form.overlay} onChange={(e) => set({ overlay: Number(e.target.value) })} />
                    </Field>
                  )}
                  <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <Toggle checked={form.dismissible} onChange={(v) => set({ dismissible: v })}>Show a close ✕</Toggle>
                    {(form.type === "modal" || form.type === "sheet") && <Toggle checked={form.closeOnBackdrop} onChange={(v) => set({ closeOnBackdrop: v })}>Close when tapping outside</Toggle>}
                  </div>
                  <StyleEditor value={form.style} onChange={(style) => set({ style })} />
                </div>

                {/* BUTTONS */}
                <div style={ui.section}>
                  <h3 style={ui.sectionTitle}>Buttons</h3>
                  <ButtonsEditor allowDismiss buttons={form.buttons} onChange={(buttons) => set({ buttons })} accent={form.style?.accent} />
                  {form.buttons.length > 1 && (
                    <div style={ui.twoCol}>
                      <Field label="Layout"><Segmented value={form.buttonLayout} options={BUTTON_LAYOUTS} onChange={(v) => set({ buttonLayout: v })} ariaLabel="Button layout" /></Field>
                      <Field label="Align"><Segmented value={form.buttonAlign} options={ALIGNMENTS} onChange={(v) => set({ buttonAlign: v })} ariaLabel="Button alignment" /></Field>
                    </div>
                  )}
                </div>

                {/* FORM */}
                <div style={ui.section}>
                  <h3 style={ui.sectionTitle}>Form & replies</h3>
                  <InputFieldsEditor form={form} setForm={setForm} toggleLabel="Add a form (collect replies)" />
                  {form.inputEnabled && (
                    <>
                      <Field label="Thank-you message"><input value={form.successMessage} onChange={(e) => set({ successMessage: e.target.value })} style={ui.input} maxLength={200} /></Field>
                      <Toggle checked={form.captcha} onChange={(v) => set({ captcha: v })}>Require a security check before sending (stops bots)</Toggle>
                    </>
                  )}
                </div>

                {/* WHEN */}
                <div style={ui.section}>
                  <h3 style={ui.sectionTitle}>When it shows</h3>
                  <Field label="How it opens">
                    <select value={form.trigger.mode} onChange={(e) => setTrigger({ mode: e.target.value })} style={ui.input}>
                      {TRIGGER_MODES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                    </select>
                  </Field>
                  {form.trigger.mode !== "manual" && (
                    <>
                      {form.trigger.mode === "page" && (
                        <Field label="Pages" hint="One per line, e.g. /sermons. End with * to include everything under it (/sermons*).">
                          <textarea
                            value={(form.trigger.paths || []).join("\n")}
                            onChange={(e) => setTrigger({ paths: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
                            rows={3}
                            style={{ ...ui.input, fontFamily: "monospace", fontSize: "13px" }}
                            placeholder="/sermons"
                          />
                          <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                            {APP_PAGES.slice(0, 8).map(([route, name]) => (
                              <button key={route} type="button" style={ui.smallBtn} onClick={() => setTrigger({ paths: [...new Set([...(form.trigger.paths || []), route])] })}>+ {name}</button>
                            ))}
                          </div>
                        </Field>
                      )}
                      <div style={ui.twoCol}>
                        <Field label="Wait before showing (seconds)"><input type="number" min={0} max={120} value={form.trigger.delaySeconds} onChange={(e) => setTrigger({ delaySeconds: e.target.value })} style={ui.input} /></Field>
                        <Field label="Close by itself after (seconds, 0 = never)"><input type="number" min={0} max={600} value={form.trigger.autoCloseSeconds} onChange={(e) => setTrigger({ autoCloseSeconds: e.target.value })} style={ui.input} /></Field>
                      </div>
                      <Field label="How often">
                        <select value={form.trigger.frequency} onChange={(e) => setTrigger({ frequency: e.target.value })} style={ui.input}>
                          {FREQUENCIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </Field>
                    </>
                  )}
                  <div style={ui.twoCol}>
                    <Field label="Who sees it"><select value={form.audience} onChange={(e) => set({ audience: e.target.value })} style={ui.input}>{AUDIENCES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></Field>
                    <Field label="Status"><Toggle checked={form.enabled} onChange={(v) => set({ enabled: v })}>On</Toggle></Field>
                  </div>
                  <div style={ui.twoCol}>
                    <Field label="Start date (optional)"><input type="date" value={form.startDate} onChange={(e) => set({ startDate: e.target.value })} style={ui.input} /></Field>
                    <Field label="End date (optional)"><input type="date" value={form.endDate} onChange={(e) => set({ endDate: e.target.value })} style={ui.input} /></Field>
                  </div>
                  {editing?.id && <p style={ui.hint}>Link code for this popup: <code>[Tap here](popup:{editing.id})</code></p>}
                </div>
              </div>

              <div className="pf-editor-preview" style={previewCol}>
                <PopupPreview popup={form} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* REPLIES */}
      {replies && (
        <div style={modalBg}>
          <div style={{ ...wideModal, maxWidth: "560px" }}>
            <h2 style={modalTitle}>Replies — {replies.name || replies.title}</h2>
            <p style={ui.hint}>{replyRows.length} {replyRows.length === 1 ? "reply" : "replies"}</p>
            {replyRows.length === 0 && <p style={empty}>No replies yet.</p>}
            {replyRows.map((r) => (
              <div key={r.id} style={replyRow}>
                {Array.isArray(r.answers) && r.answers.length > 1
                  ? r.answers.map((a) => <div key={a.id} style={{ fontSize: "14px" }}><span style={{ color: "var(--color-9b7040)" }}>{a.label || "Answer"}:</span> {a.value}</div>)
                  : <div style={{ fontSize: "14px" }}>{r.value}</div>}
                <div style={{ fontSize: "11px", color: "var(--color-9b7040)" }}>{r.userEmail ? `${r.userEmail} · ` : "Guest · "}{r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleString() : "—"}</div>
              </div>
            ))}
            <button style={cancelBtn} onClick={() => setReplies(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

const page = { maxWidth: "900px" };
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", marginBottom: "22px", flexWrap: "wrap" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0, maxWidth: "560px" };
const primaryBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "16px", padding: "16px 18px", marginBottom: "12px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const cardTop = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", flexWrap: "wrap", marginBottom: "6px" };
const cardTitle = { fontSize: "16px", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" };
const cardText = { margin: "0 0 4px", fontSize: "13px", color: "var(--color-7a5530)", fontFamily: "sans-serif", lineHeight: 1.5 };
const cardMeta = { margin: "0 0 12px", fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const cardActions = { display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid var(--color-f0e4d0)", paddingTop: "12px" };
const badge = { fontSize: "11px", padding: "3px 8px", borderRadius: "999px", fontFamily: "sans-serif" };
const empty = { textAlign: "center", color: "var(--color-b08050)", fontFamily: "sans-serif", fontStyle: "italic", padding: "30px 0" };
const emptyCard = { textAlign: "center", padding: "36px 20px", border: "1px dashed var(--color-d8c4a5)", borderRadius: "16px", background: "var(--color-fdf8f3)" };
const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" };
const wideModal = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "20px", padding: "22px 24px", width: "100%", maxWidth: "1240px", maxHeight: "92vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px" };
const wideHead = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" };
const modalTitle = { fontSize: "20px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif", margin: 0 };
const editorGrid = { display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: "22px", alignItems: "start" };
const editorCol = { display: "flex", flexDirection: "column", gap: "14px", minWidth: 0 };
const previewCol = { position: "sticky", top: 0, minWidth: 0 };
const typeGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "8px" };
const typeCard = { display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-start", padding: "10px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-3d2200)", textAlign: "left", fontFamily: "sans-serif", cursor: "pointer" };
const typeOn = { border: "2px solid var(--color-c97c2e)", background: "var(--color-fdf1de)" };
const saveBtn = { padding: "9px 22px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const cancelBtn = { padding: "9px 18px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "transparent", color: "var(--color-7a4f10)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const replyRow = { display: "flex", flexDirection: "column", gap: "3px", padding: "10px 0", borderBottom: "1px solid var(--color-f0e4d0)", fontFamily: "sans-serif", color: "var(--color-3d2200)" };
