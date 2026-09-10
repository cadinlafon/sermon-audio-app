import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "firebase/firestore";

const blankForm = { title: "", details: "", buttonEnabled: false, buttonText: "", buttonType: "url", buttonValue: "", active: true, pinned: false, audience: "all", inputEnabled: false, inputMessage: "", inputPlaceholder: "", inputButtonText: "" };

export default function AdminNotices() {
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [viewingSubmissions, setViewingSubmissions] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const loadNotices = async () => {
    const snap = await getDocs(collection(db, "notices"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (b.pinned === true) - (a.pinned === true));
    setNotices(data);
  };

  useEffect(() => { loadNotices(); }, []);

  const openCreate = () => { setEditing(null); setForm(blankForm); setShowForm(true); };
  const openEdit = (n) => { setEditing(n); setForm({ ...blankForm, ...n }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = async () => {
    if (!form.title || !form.details) return alert("Title and details are required.");
    if (editing) await updateDoc(doc(db, "notices", editing.id), { ...form });
    else await addDoc(collection(db, "notices"), { ...form, createdAt: serverTimestamp() });
    closeForm(); loadNotices();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notice?")) return;
    await deleteDoc(doc(db, "notices", id));
    const subsSnap = await getDocs(query(collection(db, "noticeSubmissions"), where("noticeId", "==", id)));
    await Promise.all(subsSnap.docs.map((d) => deleteDoc(doc(db, "noticeSubmissions", d.id))));
    loadNotices();
  };
  const toggleActive = async (n) => { await updateDoc(doc(db, "notices", n.id), { active: !n.active }); loadNotices(); };
  const togglePin = async (n) => { await updateDoc(doc(db, "notices", n.id), { pinned: !n.pinned }); loadNotices(); };

  const openSubmissions = async (n) => {
    setViewingSubmissions(n);
    setLoadingSubmissions(true);
    try {
      const snap = await getDocs(query(collection(db, "noticeSubmissions"), where("noticeId", "==", n.id)));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSubmissions(data);
    } catch (err) {
      console.error("Error loading submissions:", err);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };
  const closeSubmissions = () => { setViewingSubmissions(null); setSubmissions([]); };

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  return (
    <div style={page}>
      <div style={topRow}>
        <div>
          <h1 style={pageTitle}>Notices</h1>
          <p style={pageSubtitle}>Manage announcements shown to app users.</p>
        </div>
        <button style={addBtn} onClick={openCreate}>+ New Notice</button>
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>{editing ? "Edit Notice" : "Create Notice"}</h2>

            <Field label="Title"><input value={form.title} onChange={f("title")} style={input} placeholder="Notice title" /></Field>
            <Field label="Details"><textarea value={form.details} onChange={f("details")} style={{ ...input, height: "90px", resize: "vertical" }} placeholder="Details…" /></Field>

            <Field label="Audience">
              <select value={form.audience} onChange={f("audience")} style={input}>
                <option value="all">All</option>
                <option value="users">Signed-in users</option>
                <option value="admins">Admins only</option>
                <option value="guests">Guests only</option>
              </select>
            </Field>

            <div style={checkRow}>
              <label style={checkLabel}><input type="checkbox" checked={form.buttonEnabled} onChange={f("buttonEnabled")} /> Enable action button</label>
              <label style={checkLabel}><input type="checkbox" checked={form.active} onChange={f("active")} /> Active</label>
              <label style={checkLabel}><input type="checkbox" checked={form.pinned} onChange={f("pinned")} /> Pin to top</label>
            </div>

            {form.buttonEnabled && (
              <>
                <Field label="Button Text"><input value={form.buttonText} onChange={f("buttonText")} style={input} placeholder="e.g. Learn More" /></Field>
                <Field label="Button Type">
                  <select value={form.buttonType} onChange={f("buttonType")} style={input}>
                    <option value="url">External URL</option>
                    <option value="page">Internal Page</option>
                  </select>
                </Field>
                <Field label="URL or Path"><input value={form.buttonValue} onChange={f("buttonValue")} style={input} placeholder="https://… or /page" /></Field>
              </>
            )}

            <div style={checkRow}>
              <label style={checkLabel}><input type="checkbox" checked={form.inputEnabled} onChange={f("inputEnabled")} /> Input (collect submissions)</label>
            </div>

            {form.inputEnabled && (
              <>
                <Field label="Input Message"><textarea value={form.inputMessage} onChange={f("inputMessage")} style={{ ...input, height: "70px", resize: "vertical" }} placeholder="Submit your email to get emails when…" /></Field>
                <Field label="Input Placeholder"><input value={form.inputPlaceholder} onChange={f("inputPlaceholder")} style={input} placeholder="e.g. Email here" /></Field>
                <Field label="Submit Button Text"><input value={form.inputButtonText} onChange={f("inputButtonText")} style={input} placeholder="e.g. Submit" /></Field>
              </>
            )}

            <div style={modalActions}>
              <button style={saveBtn} onClick={handleSave}>Save</button>
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
                {n.pinned && <Badge color="#e8f0fe" text="#2a5ab5" label="Pinned" />}
                {n.active ? <Badge color="#dcfce7" text="#166534" label="Active" /> : <Badge color="#fee2e2" text="#991b1b" label="Disabled" />}
                <Badge color="#f6e4b0" text="#7a5a10" label={n.audience === "all" ? "Everyone" : n.audience === "users" ? "Users" : n.audience === "admins" ? "Admins" : "Guests"} />
              </div>
            </div>
            <p style={cardDetails}>{n.details}</p>
          </div>
          <div style={cardActions}>
            <button style={actionBtn} onClick={() => openEdit(n)}>Edit</button>
            <button style={actionBtn} onClick={() => toggleActive(n)}>{n.active ? "Disable" : "Enable"}</button>
            <button style={actionBtn} onClick={() => togglePin(n)}>{n.pinned ? "Unpin" : "Pin"}</button>
            {n.inputEnabled && <button style={actionBtn} onClick={() => openSubmissions(n)}>Submissions</button>}
            <button style={{ ...actionBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => handleDelete(n.id)}>Delete</button>
          </div>
        </div>
      ))}

      {notices.length === 0 && <p style={empty}>No notices yet. Create one above.</p>}

      {/* SUBMISSIONS MODAL */}
      {viewingSubmissions && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>Submissions — {viewingSubmissions.title}</h2>
            <p style={pageSubtitle}>Submissions ({submissions.length})</p>

            {loadingSubmissions && <p style={empty}>Loading…</p>}

            {!loadingSubmissions && submissions.length === 0 && (
              <p style={empty}>No submissions yet.</p>
            )}

            {!loadingSubmissions && submissions.map((s) => (
              <div key={s.id} style={submissionRow}>
                <span style={submissionValue}>{s.value}</span>
                <span style={submissionMeta}>
                  {s.userEmail ? `${s.userEmail} · ` : ""}
                  {s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000).toLocaleString() : "—"}
                </span>
              </div>
            ))}

            <div style={modalActions}>
              <button style={cancelBtn} onClick={closeSubmissions}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

function Badge({ color, text, label }) {
  return <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "999px", background: color, color: text, fontFamily: "sans-serif" }}>{label}</span>;
}

const page = { maxWidth: "860px" };
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const addBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)", whiteSpace: "nowrap" };

const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" };
const modal = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "90vh", overflowY: "auto" };
const modalTitle = { fontSize: "20px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0 };
const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const checkRow = { display: "flex", gap: "16px", flexWrap: "wrap" };
const checkLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", cursor: "pointer" };
const modalActions = { display: "flex", gap: "10px", marginTop: "4px" };
const saveBtn = { flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const cancelBtn = { flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "18px 20px", marginBottom: "12px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const cardBody = { marginBottom: "14px" };
const cardTitleRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px", flexWrap: "wrap" };
const cardTitle = { fontSize: "16px", color: "#3d2200", fontFamily: "'Georgia', serif" };
const badgeRow = { display: "flex", gap: "6px", flexWrap: "wrap" };
const cardDetails = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.6, margin: 0 };
const cardActions = { display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #f0e4d0", paddingTop: "12px" };
const actionBtn = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #eddfc8", background: "transparent", color: "#5c3a1e", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "40px 0" };
const submissionRow = { display: "flex", flexDirection: "column", gap: "3px", padding: "10px 0", borderBottom: "1px solid #f0e4d0" };
const submissionValue = { fontSize: "14px", color: "#3d2200", fontFamily: "sans-serif", wordBreak: "break-word" };
const submissionMeta = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif" };