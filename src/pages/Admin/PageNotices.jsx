import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { useModulePermissions } from "../../hooks/usePermissions";

const blankForm = { title: "", message: "", position: "top", page: "sermons" };

const PAGE_LABELS = { sermons: "Sermons", homilies: "Homilies", sundayschool: "Sunday School", all: "All Pages" };
const POS_LABELS  = { top: "Above list", bottom: "Below list" };

export default function PageNotices() {
  const perms = useModulePermissions("pageNotices");
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState(blankForm);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const fetchNotices = async () => {
    const snap = await getDocs(collection(db, "pageNotices"));
    setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchNotices(); }, []);

  const openCreate = () => { setForm(blankForm); setEditingId(null); setShowForm(true); };
  const openEdit   = (n)  => { setForm(n);       setEditingId(n.id); setShowForm(true); };
  const closeForm  = ()   => { setShowForm(false); setEditingId(null); };

  const handleSave = async () => {
    if (!perms.requireEdit()) return;
    if (!form.title || !form.message) return alert("Title and message are required.");
    if (editingId) {
      await updateDoc(doc(db, "pageNotices", editingId), form);
    } else {
      await addDoc(collection(db, "pageNotices"), { ...form, enabled: true });
    }
    closeForm();
    fetchNotices();
  };

  const handleDelete = async (id) => {
    if (!perms.requireDelete()) return;
    if (!window.confirm("Delete this notice?")) return;
    await deleteDoc(doc(db, "pageNotices", id));
    fetchNotices();
  };

  const toggleEnabled = async (n) => {
    if (!perms.requireEdit()) return;
    await updateDoc(doc(db, "pageNotices", n.id), { enabled: !n.enabled });
    fetchNotices();
  };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  return (
    <div style={page}>
      {/* HEADER */}
      <div style={topRow}>
        <div>
          <h1 style={pageTitle}>Page Notices</h1>
          <p style={pageSubtitle}>Show contextual messages above or below audio lists.</p>
        </div>
        {perms.canEdit && <button style={addBtn} onClick={openCreate}>+ New Notice</button>}
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>{editingId ? "Edit Notice" : "Create Notice"}</h2>

            <Field label="Title">
              <input value={form.title} onChange={f("title")} style={input} placeholder="e.g. Series starting soon" />
            </Field>

            <Field label="Message">
              <textarea value={form.message} onChange={f("message")} style={{ ...input, height: "88px", resize: "vertical" }} placeholder="What do you want listeners to know?" />
            </Field>

            <div style={row2}>
              <Field label="Show on page">
                <select value={form.page} onChange={f("page")} style={input}>
                  <option value="sermons">Sermons</option>
                  <option value="homilies">Homilies</option>
                  <option value="sundayschool">Sunday School</option>
                  <option value="all">All Pages</option>
                </select>
              </Field>

              <Field label="Position">
                <select value={form.position} onChange={f("position")} style={input}>
                  <option value="top">Above list</option>
                  <option value="bottom">Below list</option>
                </select>
              </Field>
            </div>

            <div style={modalActions}>
              <button style={saveBtn} onClick={handleSave}>
                {editingId ? "Update" : "Create"}
              </button>
              <button style={cancelBtn} onClick={closeForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {notices.map((n) => (
        <div key={n.id} style={card}>
          <div style={cardBody}>
            <div style={cardTitleRow}>
              <span style={cardTitle}>{n.title}</span>
              <div style={badgeRow}>
                <Badge label={PAGE_LABELS[n.page] || n.page} bg="#e8f0fe" color="#2a5ab5" />
                <Badge label={POS_LABELS[n.position] || n.position} bg="#f6e4b0" color="#7a5a10" />
                {n.enabled
                  ? <Badge label="Active"   bg="#dcfce7" color="#166534" />
                  : <Badge label="Disabled" bg="#fee2e2" color="#991b1b" />}
              </div>
            </div>
            <p style={cardMsg}>{n.message}</p>
          </div>

          <div style={cardActions}>
            {perms.canEdit && (
              <>
                <button style={actionBtn} onClick={() => openEdit(n)}>Edit</button>
                <button style={actionBtn} onClick={() => toggleEnabled(n)}>
                  {n.enabled ? "Disable" : "Enable"}
                </button>
              </>
            )}
            {perms.canDelete && (
              <button style={{ ...actionBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => handleDelete(n.id)}>
                Delete
              </button>
            )}
          </div>
        </div>
      ))}

      {notices.length === 0 && (
        <p style={empty}>No page notices yet. Create one above.</p>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function Badge({ label, bg, color }) {
  return (
    <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "999px", background: bg, color, fontFamily: "sans-serif" }}>
      {label}
    </span>
  );
}

// ── Styles ──────────────────────────────────────────────

const page        = { maxWidth: "760px" };
const topRow      = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" };
const pageTitle   = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const addBtn      = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)", whiteSpace: "nowrap" };

const modalBg     = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" };
const modal       = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: "16px", maxHeight: "90vh", overflowY: "auto" };
const modalTitle  = { fontSize: "20px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0 };
const fieldLabel  = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const input       = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const row2        = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const modalActions = { display: "flex", gap: "10px", marginTop: "4px" };
const saveBtn     = { flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const cancelBtn   = { flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };

const card        = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "18px 20px", marginBottom: "12px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const cardBody    = { marginBottom: "14px" };
const cardTitleRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px", flexWrap: "wrap" };
const cardTitle   = { fontSize: "16px", color: "#3d2200", fontFamily: "'Georgia', serif" };
const badgeRow    = { display: "flex", gap: "6px", flexWrap: "wrap" };
const cardMsg     = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.6, margin: 0 };
const cardActions = { display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #f0e4d0", paddingTop: "12px" };
const actionBtn   = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #eddfc8", background: "transparent", color: "#5c3a1e", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const empty       = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "40px 0" };