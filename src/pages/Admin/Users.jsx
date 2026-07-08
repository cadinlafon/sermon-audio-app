import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({ fullName: "", email: "" });

  const fetchUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));
    setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { fetchUsers(); }, []);

  const getLoginMethod = (u) => {
    if (u.provider === "google" || u.provider === "google.com") return "Google";
    if (u.provider === "password") return "Email";
    return "Other";
  };

  const startEdit = (u) => { setEditingId(u.id); setEditData({ fullName: u.fullName || u.name || "", email: u.email || "" }); };
  const cancelEdit = () => { setEditingId(null); };
  const saveEdit = async (id) => {
    await updateDoc(doc(db, "users", id), { fullName: editData.fullName, name: editData.fullName, email: editData.email });
    setEditingId(null); fetchUsers();
  };
  const makeAdmin = async (id) => { await updateDoc(doc(db, "users", id), { role: "admin" }); fetchUsers(); };
  const removeAdmin = async (id) => { await updateDoc(doc(db, "users", id), { role: "user" }); fetchUsers(); };
  const deleteUser = async (id) => { if (!window.confirm("Delete this user?")) return; await deleteDoc(doc(db, "users", id)); fetchUsers(); };

  const filtered = users.filter((u) => {
    const name = (u.fullName || u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    return name.includes(search.toLowerCase()) || email.includes(search.toLowerCase());
  });

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Users</h1>
        <p style={pageSubtitle}>{users.length} registered user{users.length !== 1 ? "s" : ""}</p>
      </div>

      <div style={toolbar}>
        <input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} style={searchInput} />
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {["Name", "Email", "Login", "Role", "Actions"].map((h) => (
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((user) => {
              const isEditing = editingId === user.id;
              const isAdmin = user.role === "admin";
              return (
                <tr key={user.id} style={tr}>
                  <td style={td}>
                    {isEditing
                      ? <input value={editData.fullName} onChange={(e) => setEditData({ ...editData, fullName: e.target.value })} style={inlineInput} />
                      : <span style={nameText}>{user.fullName || user.name || "—"}</span>}
                  </td>
                  <td style={td}>
                    {isEditing
                      ? <input value={editData.email} onChange={(e) => setEditData({ ...editData, email: e.target.value })} style={inlineInput} />
                      : <span style={emailText}>{user.email || "—"}</span>}
                  </td>
                  <td style={td}>
                    <span style={methodBadge}>{getLoginMethod(user)}</span>
                  </td>
                  <td style={td}>
                    <span style={isAdmin ? adminBadge : userBadge}>{isAdmin ? "Admin" : "User"}</span>
                  </td>
                  <td style={td}>
                    {isEditing ? (
                      <div style={actionRow}>
                        <button onClick={() => saveEdit(user.id)} style={saveBtn}>Save</button>
                        <button onClick={cancelEdit} style={cancelBtn}>Cancel</button>
                      </div>
                    ) : (
                      <select defaultValue="" onChange={(e) => {
                        const a = e.target.value; e.target.value = "";
                        if (a === "edit") startEdit(user);
                        if (a === "delete") deleteUser(user.id);
                        if (a === "makeAdmin") makeAdmin(user.id);
                        if (a === "removeAdmin") removeAdmin(user.id);
                      }} style={actionSelect}>
                        <option value="" disabled>Actions</option>
                        {isAdmin ? <option value="removeAdmin">Remove Admin</option> : <option value="makeAdmin">Make Admin</option>}
                        <option value="edit">Edit</option>
                        <option value="delete">Delete</option>
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <p style={empty}>No users found.</p>}
      </div>
    </div>
  );
}

const page = { maxWidth: "1000px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const toolbar = { marginBottom: "16px" };
const searchInput = { padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "300px" };
const tableWrap = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const table = { width: "100%", borderCollapse: "collapse" };
const th = { padding: "12px 16px", textAlign: "left", fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #eddfc8", background: "#fdf8f3" };
const tr = { borderBottom: "1px solid #f0e4d0" };
const td = { padding: "12px 16px", verticalAlign: "middle" };
const nameText = { fontSize: "14px", fontFamily: "'Georgia', serif", color: "#3d2200" };
const emailText = { fontSize: "13px", fontFamily: "sans-serif", color: "#7a5530" };
const methodBadge = { fontSize: "11px", padding: "3px 8px", borderRadius: "999px", background: "#e8f0fe", color: "#2a5ab5", fontFamily: "sans-serif" };
const adminBadge = { fontSize: "11px", padding: "3px 8px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontFamily: "sans-serif" };
const userBadge = { fontSize: "11px", padding: "3px 8px", borderRadius: "999px", background: "#f6e4b0", color: "#7a5a10", fontFamily: "sans-serif" };
const actionRow = { display: "flex", gap: "6px" };
const saveBtn = { padding: "5px 10px", borderRadius: "6px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const cancelBtn = { padding: "5px 10px", borderRadius: "6px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const actionSelect = { padding: "6px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "12px", fontFamily: "sans-serif", color: "#3d2200", cursor: "pointer" };
const inlineInput = { padding: "5px 8px", borderRadius: "6px", border: "1px solid #eddfc8", fontSize: "13px", fontFamily: "sans-serif", background: "#fdf8f3", width: "100%" };
const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "30px" };