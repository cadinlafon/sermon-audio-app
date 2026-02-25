import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";

export default function Users() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    // Real-time listener
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

  return (
    <div>
      <h2 style={{ marginBottom: "25px" }}>Registered Users</h2>

      <div
        style={{
          background: "white",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
          overflow: "hidden",
        }}
      >
        {users.length === 0 ? (
          <p style={{ padding: "20px" }}>No users found.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead style={{ background: "#f5f5f5" }}>
              <tr>
                <th style={thStyle}>Email</th>
                <th style={thStyle}>User ID</th>
                <th style={thStyle}>Joined</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td style={tdStyle}>{user.email}</td>
                  <td style={tdStyle}>{user.uid}</td>
                  <td style={tdStyle}>
                    {user.createdAt?.toDate
                      ? user.createdAt.toDate().toLocaleDateString()
                      : "N/A"}
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