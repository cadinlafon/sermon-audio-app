import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { useModulePermissions } from "../../hooks/usePermissions";
import { logAdminAction } from "../../utils/adminAudit";

// All weeks live in one document (doctrineWeeks/topics) so the list order and
// the default week are always saved together, and it sits in the same
// collection the Doctrine page already reads.
const TOPICS_PATH = ["doctrineWeeks", "topics"];

const blankWeek = () => ({ label: "", topic: "", dateRange: "", memoryText: "", details: "", published: true });
const newId = () => (crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : String(Date.now()));

export default function WeeklyTopicsAdmin() {
  const perms = useModulePermissions("doctrine");
  const [weeks, setWeeks] = useState([]);
  const [defaultWeekId, setDefaultWeekId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(null); // { id | null (new), form }
  const [message, setMessage] = useState("");

  useEffect(() => {
    getDoc(doc(db, ...TOPICS_PATH))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data();
          setWeeks(Array.isArray(data.weeks) ? data.weeks : []);
          setDefaultWeekId(data.defaultWeekId || "");
        }
      })
      .catch((err) => console.error("Couldn't load weekly topics", err))
      .finally(() => setLoading(false));
  }, []);

  const flash = (text) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 2500);
  };

  const persist = async (nextWeeks, nextDefault) => {
    setBusy(true);
    try {
      await setDoc(doc(db, ...TOPICS_PATH), { weeks: nextWeeks, defaultWeekId: nextDefault || "", updatedAt: serverTimestamp() });
      setWeeks(nextWeeks);
      setDefaultWeekId(nextDefault || "");
      return true;
    } catch (err) {
      console.error("Couldn't save weekly topics", err);
      alert("Couldn't save. Please try again.");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openNew = () => {
    if (!perms.requireEdit()) return;
    setEditing({ id: null, form: { ...blankWeek(), label: `Week ${weeks.length + 1}` } });
  };
  const openEdit = (week) => {
    if (!perms.requireEdit()) return;
    setEditing({ id: week.id, form: { ...blankWeek(), ...week } });
  };

  const save = async () => {
    if (!perms.requireEdit() || !editing) return;
    const form = { ...editing.form, label: editing.form.label.trim() };
    if (!form.label) { alert("Give this week a name, like “Week 3”."); return; }

    if (editing.id) {
      const before = weeks.find((w) => w.id === editing.id);
      const next = weeks.map((w) => (w.id === editing.id ? { ...form, id: editing.id } : w));
      if (await persist(next, defaultWeekId)) {
        logAdminAction({ category: "content_edit", action: "editWeeklyTopic", targetType: "doctrineWeek", targetId: editing.id, targetLabel: form.label, before, after: form });
        setEditing(null);
        flash("Week saved.");
      }
    } else {
      const week = { ...form, id: newId() };
      // The first week you create becomes the default automatically.
      const nextDefault = defaultWeekId || week.id;
      if (await persist([...weeks, week], nextDefault)) {
        logAdminAction({ category: "content_edit", action: "createWeeklyTopic", targetType: "doctrineWeek", targetId: week.id, targetLabel: week.label, before: null, after: form });
        setEditing(null);
        flash("Week added.");
      }
    }
  };

  const remove = async (week) => {
    if (!perms.requireDelete()) return;
    if (!window.confirm(`Delete “${week.label}”? This can't be undone.`)) return;
    const next = weeks.filter((w) => w.id !== week.id);
    const nextDefault = defaultWeekId === week.id ? next[0]?.id || "" : defaultWeekId;
    if (await persist(next, nextDefault)) {
      logAdminAction({ category: "content_delete", action: "deleteWeeklyTopic", targetType: "doctrineWeek", targetId: week.id, targetLabel: week.label, before: week, after: null });
      flash("Week deleted.");
    }
  };

  const makeDefault = async (week) => {
    if (!perms.requireEdit()) return;
    if (await persist(weeks, week.id)) {
      logAdminAction({ category: "content_edit", action: "setDefaultWeeklyTopic", targetType: "doctrineWeek", targetId: week.id, targetLabel: week.label, before: { defaultWeekId }, after: { defaultWeekId: week.id } });
      flash(`${week.label} is now the week visitors see first.`);
    }
  };

  const move = async (index, dir) => {
    if (!perms.requireEdit()) return;
    const to = index + dir;
    if (to < 0 || to >= weeks.length) return;
    const next = [...weeks];
    [next[index], next[to]] = [next[to], next[index]];
    await persist(next, defaultWeekId);
  };

  const set = (k) => (e) => setEditing((s) => ({ ...s, form: { ...s.form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value } }));

  return (
    <div style={card}>
      <div style={headRow}>
        <div>
          <h2 style={title}>Weekly Topics</h2>
          <p style={hint}>Create a page of info for each week. Visitors see the default week first and can flip through the rest with the arrows.</p>
        </div>
        {perms.canEdit && <button style={primaryBtn} onClick={openNew} disabled={busy}>+ Add Week</button>}
      </div>

      {loading ? (
        <p style={hint}>Loading…</p>
      ) : weeks.length === 0 ? (
        <p style={empty}>No weeks yet. Add your first one.</p>
      ) : (
        <div style={list}>
          {weeks.map((w, i) => (
            <div key={w.id} style={row}>
              <div style={rowMain}>
                <div style={rowTitle}>
                  {w.label}
                  {w.id === defaultWeekId && <span style={defaultBadge}>★ Default</span>}
                  {w.published === false && <span style={draftBadge}>Hidden</span>}
                </div>
                <div style={rowSub}>{[w.topic, w.dateRange].filter(Boolean).join(" · ") || "No details yet"}</div>
              </div>
              {perms.canEdit && (
                <div style={rowActions}>
                  <button style={iconBtn} onClick={() => move(i, -1)} disabled={busy || i === 0} title="Move up" aria-label="Move up">↑</button>
                  <button style={iconBtn} onClick={() => move(i, 1)} disabled={busy || i === weeks.length - 1} title="Move down" aria-label="Move down">↓</button>
                  {w.id !== defaultWeekId && <button style={smallBtn} onClick={() => makeDefault(w)} disabled={busy}>Make default</button>}
                  <button style={smallBtn} onClick={() => openEdit(w)}>Edit</button>
                  {perms.canDelete && <button style={dangerBtn} onClick={() => remove(w)} disabled={busy}>Delete</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {message && <p style={okText}>{message}</p>}

      {editing && (
        <div style={modalBg}>
          <div style={modal}>
            <h3 style={modalTitle}>{editing.id ? "Edit week" : "Add a week"}</h3>

            <label style={fieldLabel}>Name (shown in the arrows)</label>
            <input style={input} value={editing.form.label} onChange={set("label")} placeholder="Week 1" maxLength={40} />

            <label style={fieldLabel}>Topic</label>
            <input style={input} value={editing.form.topic} onChange={set("topic")} placeholder="e.g. The Trinity" maxLength={120} />

            <label style={fieldLabel}>Dates</label>
            <input style={input} value={editing.form.dateRange} onChange={set("dateRange")} placeholder="e.g. Oct. 4–10" maxLength={60} />

            <label style={fieldLabel}>Memory text</label>
            <input style={input} value={editing.form.memoryText} onChange={set("memoryText")} placeholder="e.g. Deut. 6:4-5" maxLength={200} />

            <label style={fieldLabel}>Details</label>
            <textarea style={{ ...input, minHeight: "120px", resize: "vertical" }} value={editing.form.details} onChange={set("details")} placeholder="Anything visitors should know about this week…" />

            <label style={checkRow}>
              <input type="checkbox" checked={editing.form.published !== false} onChange={set("published")} />
              Visible to visitors
            </label>

            <div style={modalActions}>
              <button style={primaryBtn} onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
              <button style={cancelBtn} onClick={() => setEditing(null)} disabled={busy}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "18px", padding: "24px", marginTop: "24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const headRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "14px", flexWrap: "wrap", marginBottom: "14px" };
const title = { margin: "0 0 4px", fontSize: "19px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const hint = { margin: 0, fontSize: "13px", color: "#9b7040", fontFamily: "sans-serif", lineHeight: 1.5 };
const empty = { fontSize: "13px", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", margin: "8px 0 0" };
const okText = { fontSize: "13px", color: "#166534", fontFamily: "sans-serif", margin: "12px 0 0" };
const list = { display: "flex", flexDirection: "column", gap: "8px" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap", padding: "10px 12px", border: "1px solid #eddfc8", borderRadius: "12px", background: "#fdf8f3" };
const rowMain = { minWidth: 0, flex: "1 1 180px" };
const rowTitle = { fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" };
const rowSub = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", marginTop: "2px" };
const rowActions = { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" };
const defaultBadge = { fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "#fde8b8", color: "#8a5a10", fontWeight: "600" };
const draftBadge = { fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "#f0e9df", color: "#8a7860", fontWeight: "600" };
const smallBtn = { padding: "5px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#5c3a1e", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };
const dangerBtn = { ...smallBtn, border: "1px solid #f3c8ba", background: "#fff5f2", color: "#a33622" };
const iconBtn = { ...smallBtn, width: "28px", padding: "5px 0", textAlign: "center" };
const primaryBtn = { padding: "10px 16px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", fontWeight: "600" };
const cancelBtn = { padding: "10px 16px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" };
const modal = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "480px", display: "flex", flexDirection: "column", gap: "8px", maxHeight: "90vh", overflowY: "auto" };
const modalTitle = { margin: "0 0 6px", fontSize: "19px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: "6px" };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const checkRow = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", marginTop: "8px", cursor: "pointer" };
const modalActions = { display: "flex", gap: "10px", marginTop: "10px" };
