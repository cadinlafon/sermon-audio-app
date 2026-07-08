import { useEffect, useState } from "react";
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

export default function AdminInAppNotifications() {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [link, setLink] = useState("");
  const [targetType, setTargetType] = useState("all");
  const [targetUser, setTargetUser] = useState("");
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const loadUsers = async () => {
      const snap = await getDocs(collection(db, "users"));
      const list = snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
      list.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
      setUsers(list);
    };
    loadUsers();
  }, []);

  useEffect(() => {
    const loadHistory = async () => {
      const snap = await getDocs(query(collection(db, "notifications"), orderBy("createdAt", "desc")));
      setHistory(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    };
    loadHistory();
  }, []);

  const sendNotification = async () => {
    if (!title || !content) { alert("Title and content required."); return; }
    setSending(true);
    await addDoc(collection(db, "notifications"), { title, content, link: link || null, targetType, targetUser: targetType === "user" ? targetUser : null, active: true, createdAt: serverTimestamp() });
    setTitle(""); setContent(""); setLink("");
    setSending(false);
    alert("Notification sent!");
  };

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>In-App Notifications</h1>
        <p style={pageSubtitle}>Send messages that appear inside the app.</p>
      </div>

      <div style={card}>
        <h2 style={cardTitle}>New Notification</h2>
        <Field label="Title"><input value={title} onChange={(e) => setTitle(e.target.value)} style={input} placeholder="Notification title" /></Field>
        <Field label="Content"><textarea value={content} onChange={(e) => setContent(e.target.value)} style={{ ...input, height: "80px", resize: "vertical" }} placeholder="Message body…" /></Field>
        <Field label="Link (optional)"><input value={link} onChange={(e) => setLink(e.target.value)} style={input} placeholder="https://… or /page" /></Field>
        <Field label="Target">
          <select value={targetType} onChange={(e) => setTargetType(e.target.value)} style={input}>
            <option value="all">All Users</option>
            <option value="user">Specific User</option>
          </select>
        </Field>
        {targetType === "user" && (
          <Field label="Select User">
            <select value={targetUser} onChange={(e) => setTargetUser(e.target.value)} style={input}>
              <option value="">Choose…</option>
              {users.map((u) => <option key={u.uid} value={u.uid}>{u.fullName || u.email}</option>)}
            </select>
          </Field>
        )}
        <button onClick={sendNotification} disabled={sending} style={sending ? { ...sendBtn, opacity: 0.6 } : sendBtn}>
          {sending ? "Sending…" : "🔔 Send Notification"}
        </button>
      </div>

      {history.length > 0 && (
        <div style={historySection}>
          <h2 style={historyTitle}>History</h2>
          {history.map((n) => (
            <div key={n.id} style={historyCard}>
              <div style={historyCardTitle}>{n.title}</div>
              <div style={historyCardBody}>{n.content}</div>
              {n.targetType === "user" && <div style={historyMeta}>→ Specific user</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

const page = { maxWidth: "640px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "18px", padding: "24px", marginBottom: "24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", display: "flex", flexDirection: "column", gap: "16px" };
const cardTitle = { fontSize: "18px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0 };
const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const sendBtn = { padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };

const historySection = {};
const historyTitle = { fontSize: "18px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: "0 0 14px" };
const historyCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "12px", padding: "14px 16px", marginBottom: "10px" };
const historyCardTitle = { fontSize: "14px", color: "#3d2200", fontFamily: "'Georgia', serif", marginBottom: "4px" };
const historyCardBody = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.5 };
const historyMeta = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif", marginTop: "6px" };