import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc
} from "firebase/firestore";
import { db } from "../../firebase";

export default function Users() {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [filterRole, setFilterRole] = useState("all");

  useEffect(() => {
    const q = query(collection(db, "users"), orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setUsers(userList);
    });

    return () => unsubscribe();
  }, []);

  const makeAdmin = async (id) => {
    await updateDoc(doc(db, "users", id), { role: "admin" });
  };

  const removeAdmin = async (id) => {
    await updateDoc(doc(db, "users", id), { role: "user" });
  };

  const deleteUser = async (id) => {
    const confirmDelete = window.confirm("Delete this user?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "users", id));
  };

  const exportCSV = () => {
    const headers = ["Display Name", "Email", "Role", "Created"];
    const rows = users.map((u) => [
      u.displayName || "",
      u.email,
      u.role,
      u.createdAt?.toDate
        ? u.createdAt.toDate().toLocaleDateString()
        : "",
    ]);

    let csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "users.csv");
    document.body.appendChild(link);
    link.click();
  };

  const filteredUsers = users
    .filter((user) => {
      const matchesSearch =
        user.displayName?.toLowerCase().includes(search.toLowerCase()) ||
        user.email?.toLowerCase().includes(search.toLowerCase());

      const matchesRole =
        filterRole === "all" || user.role === filterRole;

      return matchesSearch && matchesRole;
    });

  return (
    <div>
      <h2 style={{ marginBottom: "20px" }}>User Management</h2>

      {/* Controls */}
      <div style={{ display: "flex", gap: "15px", marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ padding: "8px", width: "250px" }}
        />

        <select
          value={filterRole}
          onChange={(e) => setFilterRole(e.target.value)}
          style={{ padding: "8px" }}
        >
          <option value="all">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>

        <button onClick={exportCSV}>Export CSV</button>
      </div>

      <div style={card}>
        {filteredUsers.length === 0 ? (
          <p style={{ padding: "20px" }}>No users found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f5f5f5" }}>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Joined</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>{user.displayName || "N/A"}</td>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: "12px",
                        fontSize: "12px",
                        background:
                          user.role === "admin"
                            ? "#000"
                            : "#eee",
                        color:
                          user.role === "admin"
                            ? "#fff"
                            : "#333",
                      }}
                    >
                      {user.role}
                    </span>
                  </td>
                  <td style={tdStyle}>
                    {user.createdAt?.toDate
                      ? user.createdAt.toDate().toLocaleDateString()
                      : "N/A"}
                  </td>
                  <td style={tdStyle}>
                    {user.role !== "admin" ? (
                      <button
                        onClick={() => makeAdmin(user.id)}
                        style={{ marginRight: "8px" }}
                      >
                        Make Admin
                      </button>
                    ) : (
                      <button
                        onClick={() => removeAdmin(user.id)}
                        style={{ marginRight: "8px" }}
                      >
                        Remove Admin
                      </button>
                    )}

                    <button
                      onClick={() => deleteUser(user.id)}
                      style={{ color: "red" }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const card = {
  background: "white",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
  overflow: "hidden",
};

const thStyle = {
  padding: "12px",
  textAlign: "left",
  fontSize: "13px",
  borderBottom: "1px solid #ddd",
};

const tdStyle = {
  padding: "12px",
  fontSize: "13px",
  borderBottom: "1px solid #eee",
};