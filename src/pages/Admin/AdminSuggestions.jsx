import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy
} from "firebase/firestore";

export default function AdminSuggestions() {
  const [suggestions, setSuggestions] = useState([]);

  //////////////////////////////////////////////
  // FETCH
  //////////////////////////////////////////////
  useEffect(() => {
    async function fetchData() {
      const q = query(
        collection(db, "suggestions"),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const list = snap.docs.map((d) => ({
        id: d.id,
        ...d.data()
      }));

      setSuggestions(list);
    }

    fetchData();
  }, []);

  //////////////////////////////////////////////
  // UPDATE STATUS
  //////////////////////////////////////////////
  const updateStatus = async (id, status) => {
    await updateDoc(doc(db, "suggestions", id), { status });

    setSuggestions((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status } : s
      )
    );
  };

  //////////////////////////////////////////////
  // DELETE
  //////////////////////////////////////////////
  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Delete this suggestion?");
    if (!confirmDelete) return;

    await deleteDoc(doc(db, "suggestions", id));

    setSuggestions((prev) =>
      prev.filter((s) => s.id !== id)
    );
  };

  //////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////
  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
      <h2 style={{ marginBottom: "20px" }}>Admin Suggestions</h2>

      {suggestions.map((s) => (
        <div key={s.id} style={card}>

          {/* TOP ROW */}
          <div style={topRow}>
            <h3 style={title}>{s.title}</h3>

            <div style={votesBox}>
              <div>👍 {s.votes || 0}</div>
              <div style={{ color: "#777", fontSize: "12px" }}>
                voters: {s.voters?.length || 0}
              </div>
            </div>
          </div>

          {/* DETAILS */}
          <p style={details}>{s.details}</p>

          {/* USER */}
          <p style={user}>
            User: {s.userId || "Unknown"}
          </p>

          {/* STATUS ROW */}
          <div style={statusRow}>
            
            <button
              style={{
                ...statusBtn,
                background: s.status === "none" ? "#111" : "#eee",
                color: s.status === "none" ? "#fff" : "#333"
              }}
              onClick={() => updateStatus(s.id, "none")}
            >
              No Status
            </button>

            <button
              style={{
                ...statusBtn,
                background: s.status === "planned" ? "#2563eb" : "#eee",
                color: s.status === "planned" ? "#fff" : "#333"
              }}
              onClick={() => updateStatus(s.id, "planned")}
            >
              Planned
            </button>

            <button
              style={{
                ...statusBtn,
                background: s.status === "in progress" ? "#f59e0b" : "#eee",
                color: s.status === "in progress" ? "#fff" : "#333"
              }}
              onClick={() => updateStatus(s.id, "in progress")}
            >
              In Progress
            </button>

            <button
              style={{
                ...statusBtn,
                background: s.status === "complete" ? "#16a34a" : "#eee",
                color: s.status === "complete" ? "#fff" : "#333"
              }}
              onClick={() => updateStatus(s.id, "complete")}
            >
              Complete
            </button>

            {/* DELETE */}
            <button
              style={deleteBtn}
              onClick={() => handleDelete(s.id)}
            >
              Delete
            </button>

          </div>
        </div>
      ))}
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const card = {
  background: "#fff",
  border: "1px solid #eee",
  borderRadius: "14px",
  padding: "18px",
  marginBottom: "18px",
  boxShadow: "0 6px 16px rgba(0,0,0,0.06)",
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const title = {
  fontSize: "17px",
  fontWeight: "600"
};

const votesBox = {
  textAlign: "right",
  fontSize: "14px"
};

const details = {
  fontSize: "14px",
  color: "#444"
};

const user = {
  fontSize: "12px",
  color: "#777"
};

const statusRow = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
  marginTop: "10px"
};

const statusBtn = {
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px"
};

const deleteBtn = {
  marginLeft: "auto",
  background: "#dc2626",
  color: "#fff",
  border: "none",
  padding: "6px 12px",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "12px"
};