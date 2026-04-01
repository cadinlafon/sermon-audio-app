import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";

export default function AdminNotices() {
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
const [user, setUser] = useState(null);
const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState({
    title: "",
    details: "",
    buttonEnabled: false,
    buttonText: "",
    buttonType: "url",
    buttonValue: "",
    active: true,
    pinned: false,
    audience: "all", // 🔥 NEW
  });

  //////////////////////////////////////////////////
  // LOAD
  //////////////////////////////////////////////////
  async function loadNotices() {
    const snap = await getDocs(collection(db, "notices"));

    const data = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    data.sort((a, b) => (b.pinned === true) - (a.pinned === true));

    setNotices(data);
  }

  useEffect(() => {
    loadNotices();
  }, []);

  //////////////////////////////////////////////////
  // SAVE / CREATE
  //////////////////////////////////////////////////
  const handleSave = async () => {
    if (!form.title || !form.details) return alert("Missing fields");

    if (editing) {
      await updateDoc(doc(db, "notices", editing.id), {
        ...form,
      });
    } else {
      await addDoc(collection(db, "notices"), {
        ...form,
        createdAt: serverTimestamp(),
      });
    }

    setShowForm(false);
    setEditing(null);
    setForm({
      title: "",
      details: "",
      buttonEnabled: false,
      buttonText: "",
      buttonType: "url",
      buttonValue: "",
      active: true,
      pinned: false,
      audience: "all",
    });

    loadNotices();
  };

  //////////////////////////////////////////////////
  // DELETE
  //////////////////////////////////////////////////
  const handleDelete = async (id) => {
    if (!window.confirm("Delete this notice?")) return;
    await deleteDoc(doc(db, "notices", id));
    loadNotices();
  };

  //////////////////////////////////////////////////
  // EDIT
  //////////////////////////////////////////////////
  const handleEdit = (n) => {
    setEditing(n);
    setForm(n);
    setShowForm(true);
  };

  //////////////////////////////////////////////////
  // TOGGLES
  //////////////////////////////////////////////////
  const toggleActive = async (n) => {
    await updateDoc(doc(db, "notices", n.id), {
      active: !n.active,
    });
    loadNotices();
  };

  const togglePin = async (n) => {
    await updateDoc(doc(db, "notices", n.id), {
      pinned: !n.pinned,
    });
    loadNotices();
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={{ padding: "30px", maxWidth: "900px", margin: "0 auto" }}>
      
      {/* HEADER */}
      <div style={header}>
        <h1>Notices</h1>

        <button style={addButton} onClick={() => setShowForm(true)}>
          +
        </button>
      </div>

      {/* FORM */}
      {showForm && (
        <div style={modal}>
          <div style={formCard}>
            <h2>{editing ? "Edit Notice" : "Create Notice"}</h2>

            <input
              placeholder="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              style={input}
            />

            <textarea
              placeholder="Details"
              value={form.details}
              onChange={(e) => setForm({ ...form, details: e.target.value })}
              style={{ ...input, height: "100px" }}
            />

            {/* BUTTON */}
            <label style={label}>
              <input
                type="checkbox"
                checked={form.buttonEnabled}
                onChange={(e) =>
                  setForm({ ...form, buttonEnabled: e.target.checked })
                }
              />
              Enable Button
            </label>

            {form.buttonEnabled && (
              <>
                <input
                  placeholder="Button Text"
                  value={form.buttonText}
                  onChange={(e) =>
                    setForm({ ...form, buttonText: e.target.value })
                  }
                  style={input}
                />

                <select
                  value={form.buttonType}
                  onChange={(e) =>
                    setForm({ ...form, buttonType: e.target.value })
                  }
                  style={input}
                >
                  <option value="url">URL</option>
                  <option value="page">Page</option>
                </select>

                <input
                  placeholder="URL or /page"
                  value={form.buttonValue}
                  onChange={(e) =>
                    setForm({ ...form, buttonValue: e.target.value })
                  }
                  style={input}
                />
              </>
            )}

            {/* AUDIENCE 🔥 */}
            <select
              value={form.audience}
              onChange={(e) =>
                setForm({ ...form, audience: e.target.value })
              }
              style={input}
            >
              <option value="all">All</option>
              <option value="users">Users (includes admins)</option>
              <option value="admins">Admins only</option>
              <option value="guests">Non-Users</option>
            </select>

            {/* ACTIVE */}
            <label style={label}>
              <input
                type="checkbox"
                checked={form.active}
                onChange={(e) =>
                  setForm({ ...form, active: e.target.checked })
                }
              />
              Active
            </label>

            {/* PIN */}
            <label style={label}>
              <input
                type="checkbox"
                checked={form.pinned}
                onChange={(e) =>
                  setForm({ ...form, pinned: e.target.checked })
                }
              />
              Pin to top
            </label>

            {/* ACTIONS */}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              <button style={saveBtn} onClick={handleSave}>
                Save
              </button>

              <button style={cancelBtn} onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {notices.map((n) => (
        <div key={n.id} style={card}>
          <div>
            <h3>{n.title}</h3>
            <p style={{ color: "#555" }}>{n.details}</p>
          </div>

          {/* BADGES */}
          <div style={badgeRow}>
            {n.pinned && <span style={pinBadge}>Pinned</span>}
            {n.active ? (
              <span style={activeBadge}>Active</span>
            ) : (
              <span style={disabledBadge}>Disabled</span>
            )}

            {/* 🔥 AUDIENCE BADGE */}
            <span style={audienceBadge}>
              {n.audience === "all" && "All"}
              {n.audience === "users" && "Users"}
              {n.audience === "admins" && "Admins"}
              {n.audience === "guests" && "Guests"}
            </span>
          </div>

          <div style={actions}>
            <button style={actionBtn} onClick={() => handleEdit(n)}>
              Edit
            </button>

            <button style={actionBtn} onClick={() => toggleActive(n)}>
              {n.active ? "Disable" : "Activate"}
            </button>

            <button style={actionBtn} onClick={() => togglePin(n)}>
              {n.pinned ? "Unpin" : "Pin"}
            </button>

            <button
              style={{ ...actionBtn, color: "red" }}
              onClick={() => handleDelete(n.id)}
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

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "20px",
};

const addButton = {
  fontSize: "26px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: "42px",
  height: "42px",
  cursor: "pointer",
};

const card = {
  background: "#fff",
  padding: "20px",
  borderRadius: "14px",
  marginBottom: "15px",
  boxShadow: "0 6px 16px rgba(0,0,0,0.08)",
};

const actions = {
  display: "flex",
  gap: "10px",
  marginTop: "15px",
  flexWrap: "wrap",
};

const actionBtn = {
  padding: "8px 12px",
  border: "1px solid #ddd",
  background: "#f7f7f7",
  borderRadius: "6px",
  cursor: "pointer",
};

const badgeRow = {
  marginTop: "10px",
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const activeBadge = {
  background: "#dcfce7",
  color: "#166534",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const disabledBadge = {
  background: "#fee2e2",
  color: "#991b1b",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const pinBadge = {
  background: "#e0f2fe",
  color: "#0369a1",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const audienceBadge = {
  background: "#f1f5f9",
  color: "#334155",
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
};

const modal = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
};

const formCard = {
  background: "#fff",
  padding: "25px",
  borderRadius: "16px",
  width: "100%",
  maxWidth: "400px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const input = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ddd",
};

const label = {
  fontSize: "13px",
  display: "flex",
  gap: "8px",
  alignItems: "center",
};

const saveBtn = {
  flex: 1,
  padding: "10px",
  background: "#111",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
};

const cancelBtn = {
  flex: 1,
  padding: "10px",
  background: "#eee",
  border: "none",
  borderRadius: "8px",
};