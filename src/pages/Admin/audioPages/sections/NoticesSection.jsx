import { useState } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase";
import { Card, Field, Select, TextInput, TextArea, Toggle, Button, CheckGrid, input } from "../ui";
import { NOTICE_TYPES, NOTICE_PLACEMENTS, DEFAULT_CATEGORIES } from "../../../../data/audioPageDefaults";
import { noticePlacement, noticeStatus, noticeType, noticeLink } from "../../../../utils/pageNotices";

// Notices — what used to be the separate "Page Notices" admin page. Several
// notices, scheduled, typed, dismissible, with an optional link, per page and
// category, in four possible places. Notices save the moment you save the
// notice itself (they are not part of the settings Save button).
const PAGE_CHOICES = [["sermons", "Sermons & Homilies"], ["sundayschool", "Sunday School"], ["all", "Both pages"]];
const blank = { title: "", message: "", type: "info", page: "sermons", placement: "aboveList", startDate: "", endDate: "", linkUrl: "", linkText: "", dismissible: false, categories: [], enabled: true };

const STATUS_STYLE = {
  active: { label: "Showing now", bg: "var(--color-e3f5e6)", color: "var(--color-2f8a4a)" },
  scheduled: { label: "Scheduled", bg: "var(--color-e8f0fe)", color: "var(--color-2a5ab5)" },
  expired: { label: "Ended", bg: "var(--color-f0e4d0)", color: "var(--color-7a5530)" },
  disabled: { label: "Off", bg: "var(--color-fee2e2)", color: "var(--color-991b1b)" },
};

export default function NoticesSection({ notices, reload, perms }) {
  const [form, setForm] = useState(null); // null = list, object = editing/creating
  const [editingId, setEditingId] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k) => (v) => setForm((f) => ({ ...f, [k]: v }));

  const open = (n) => {
    setError("");
    if (!n) { setForm({ ...blank }); setEditingId(null); return; }
    setEditingId(n.id);
    setForm({ ...blank, ...n, placement: noticePlacement(n), categories: Array.isArray(n.categories) ? n.categories : [], page: n.page === "homilies" ? "sermons" : n.page || "sermons" });
  };

  const save = async () => {
    if (!perms.requireEdit()) return;
    const title = form.title.trim();
    const message = form.message.trim();
    if (!title || !message) return setError("A title and a message are required.");
    if (form.startDate && form.endDate && form.endDate < form.startDate) return setError("The end date can't be before the start date.");
    if (form.linkUrl.trim() && !noticeLink({ linkUrl: form.linkUrl, linkText: form.linkText })) return setError("The link must start with https:// (or be a path inside the app, like /doctrine).");
    setBusy(true);
    setError("");
    try {
      const payload = {
        title, message,
        type: form.type, page: form.page, placement: form.placement,
        // Older code (and the unused Homilies page) read `position`.
        position: form.placement === "belowList" ? "bottom" : "top",
        startDate: form.startDate || "", endDate: form.endDate || "",
        linkUrl: form.linkUrl.trim(), linkText: form.linkText.trim(),
        dismissible: !!form.dismissible,
        categories: form.categories,
        enabled: !!form.enabled,
        updatedAt: serverTimestamp(),
      };
      if (editingId) await updateDoc(doc(db, "pageNotices", editingId), payload);
      else await addDoc(collection(db, "pageNotices"), { ...payload, createdAt: serverTimestamp() });
      setForm(null);
      await reload();
    } catch (err) {
      console.error("Couldn't save the notice", err);
      setError("Couldn't save the notice. Please try again.");
    }
    setBusy(false);
  };

  const toggleEnabled = async (n) => {
    if (!perms.requireEdit()) return;
    await updateDoc(doc(db, "pageNotices", n.id), { enabled: !n.enabled });
    reload();
  };
  const remove = async (n) => {
    if (!perms.requireDelete()) return;
    if (!window.confirm(`Delete the notice “${n.title}”?`)) return;
    await deleteDoc(doc(db, "pageNotices", n.id));
    reload();
  };

  if (form) {
    const categoryItems = DEFAULT_CATEGORIES.map((c) => ({ id: c.id, label: c.plural }));
    return (
      <Card title={editingId ? "Edit notice" : "New notice"}>
        <Field label="Title"><TextInput value={form.title} onChange={set("title")} placeholder="e.g. New series starts Sunday" maxLength={120} /></Field>
        <Field label="Message"><TextArea value={form.message} onChange={set("message")} placeholder="What do you want listeners to know?" maxLength={600} rows={3} /></Field>
        <div style={two}>
          <Field label="Type"><Select value={form.type} onChange={set("type")} options={NOTICE_TYPES.map((t) => [t.id, `${t.icon} ${t.label}`])} /></Field>
          <Field label="Show on"><Select value={form.page} onChange={set("page")} options={PAGE_CHOICES} /></Field>
        </div>
        <Field label="Placement"><Select value={form.placement} onChange={set("placement")} options={NOTICE_PLACEMENTS} /></Field>
        <div style={two}>
          <Field label="Start showing" hint="Optional — blank = right away."><input type="date" style={input} value={form.startDate} onChange={(e) => set("startDate")(e.target.value)} /></Field>
          <Field label="Stop showing after" hint="Optional — blank = until you turn it off."><input type="date" style={input} value={form.endDate} onChange={(e) => set("endDate")(e.target.value)} /></Field>
        </div>
        <div style={two}>
          <Field label="Link (optional)" hint="https://… or an app path like /doctrine"><TextInput value={form.linkUrl} onChange={set("linkUrl")} placeholder="https://" maxLength={500} /></Field>
          <Field label="Link button text"><TextInput value={form.linkText} onChange={set("linkText")} placeholder="Learn more" maxLength={40} disabled={!form.linkUrl.trim()} /></Field>
        </div>
        <Field label="Show for these categories" hint="None ticked = every category. Otherwise it only shows while the page is showing one of them.">
          <CheckGrid items={categoryItems} values={Object.fromEntries(categoryItems.map((c) => [c.id, form.categories.includes(c.id)]))} onChange={(id, on) => set("categories")(on ? [...form.categories, id] : form.categories.filter((x) => x !== id))} />
        </Field>
        <Toggle label="Visitors can dismiss it" hint="Adds a ✕. It stays closed on that device until you edit the notice." checked={form.dismissible} onChange={set("dismissible")} />
        <Toggle label="Enabled" checked={form.enabled} onChange={set("enabled")} />
        {error && <p style={err} role="alert">{error}</p>}
        <div style={{ display: "flex", gap: "8px" }}>
          <Button kind="primary" onClick={save} disabled={busy}>{busy ? "Saving…" : editingId ? "Update notice" : "Create notice"}</Button>
          <Button onClick={() => setForm(null)} disabled={busy}>Cancel</Button>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title="Page notices"
      hint="Messages shown on the audio pages. They save immediately and the preview updates right away."
      right={perms.canEdit && <Button kind="primary" onClick={() => open(null)}>+ New notice</Button>}
    >
      {notices.length === 0 && <p style={muted}>No notices yet.</p>}
      {notices.map((n) => {
        const status = noticeStatus(n);
        const st = STATUS_STYLE[status];
        const t = noticeType(n);
        const cats = Array.isArray(n.categories) && n.categories.length ? n.categories.map((c) => DEFAULT_CATEGORIES.find((d) => d.id === c)?.plural || c).join(", ") : "All categories";
        return (
          <div key={n.id} style={item}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={itemTitle}>{t.icon} {n.title}</div>
              <div style={itemMsg}>{n.message}</div>
              <div style={meta}>
                <span style={{ ...badge, background: st.bg, color: st.color }}>{st.label}</span>
                <span style={badge2}>{PAGE_CHOICES.find((p) => p[0] === (n.page === "homilies" ? "sermons" : n.page))?.[1] || n.page}</span>
                <span style={badge2}>{NOTICE_PLACEMENTS.find((p) => p[0] === noticePlacement(n))?.[1]}</span>
                <span style={badge2}>{cats}</span>
                {(n.startDate || n.endDate) && <span style={badge2}>{n.startDate || "…"} → {n.endDate || "…"}</span>}
                {n.dismissible && <span style={badge2}>dismissible</span>}
                {noticeLink(n) && <span style={badge2}>has link</span>}
              </div>
            </div>
            {perms.canEdit && (
              <div style={actions}>
                <Button onClick={() => toggleEnabled(n)}>{n.enabled ? "Turn off" : "Turn on"}</Button>
                <Button onClick={() => open(n)}>Edit</Button>
                {perms.canDelete && <Button kind="danger" onClick={() => remove(n)}>Delete</Button>}
              </div>
            )}
          </div>
        );
      })}
    </Card>
  );
}
const two = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const muted = { margin: 0, fontSize: "13px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const err = { margin: 0, fontSize: "13px", color: "var(--color-b3432c)", fontFamily: "sans-serif" };
const item = { display: "flex", gap: "12px", alignItems: "flex-start", flexWrap: "wrap", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" };
const itemTitle = { fontSize: "14.5px", fontWeight: "600", color: "var(--color-3d2200)", fontFamily: "sans-serif" };
const itemMsg = { fontSize: "13px", color: "var(--color-7a5530)", fontFamily: "sans-serif", margin: "3px 0 8px", lineHeight: 1.5 };
const meta = { display: "flex", flexWrap: "wrap", gap: "6px" };
const badge = { fontSize: "11px", fontWeight: "600", padding: "2px 9px", borderRadius: "999px", fontFamily: "sans-serif" };
const badge2 = { fontSize: "11px", padding: "2px 9px", borderRadius: "999px", fontFamily: "sans-serif", background: "var(--color-f6e4b0)", color: "var(--color-7a5a10)" };
const actions = { display: "flex", gap: "6px", flexWrap: "wrap" };
