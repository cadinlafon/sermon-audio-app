import { useState } from "react";
import { db } from "../../firebase";
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from "firebase/firestore";

// Generic admin CRUD list for a simple {name, order} Firestore
// collection — used for both resource Categories and resource
// Sections ("rows" like Featured, but admin-defined).
export default function CategoryManager({
  collectionName,
  title,
  addPlaceholder,
  deleteWarning,
  items,
  onChanged,
  onClose,
}) {
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [busy, setBusy] = useState(false);

  const nextOrder = () => items.reduce((max, c) => Math.max(max, c.order ?? 0), 0) + 1;

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await addDoc(collection(db, collectionName), {
        name,
        order: nextOrder(),
        createdAt: serverTimestamp(),
      });
      setNewName("");
      onChanged();
    } catch (err) {
      console.error(err);
      alert(`Couldn't create "${name}".`);
    }
    setBusy(false);
  };

  const startEdit = (c) => {
    setEditingId(c.id);
    setEditingName(c.name);
  };

  const saveEdit = async () => {
    const name = editingName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await updateDoc(doc(db, collectionName, editingId), { name });
      setEditingId(null);
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Couldn't rename.");
    }
    setBusy(false);
  };

  const handleDelete = async (c) => {
    if (!window.confirm(`Delete "${c.name}"? ${deleteWarning || ""}`)) return;
    setBusy(true);
    try {
      await deleteDoc(doc(db, collectionName, c.id));
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Couldn't delete.");
    }
    setBusy(false);
  };

  const move = async (index, direction) => {
    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= sorted.length) return;

    setBusy(true);
    try {
      [sorted[index], sorted[swapWith]] = [sorted[swapWith], sorted[index]];
      await Promise.all(sorted.map((c, i) => updateDoc(doc(db, collectionName, c.id), { order: i })));
      onChanged();
    } catch (err) {
      console.error(err);
      alert("Couldn't reorder.");
    }
    setBusy(false);
  };

  const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div style={modalBg} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h2 style={modalTitle}>{title}</h2>
          <button style={closeX} onClick={onClose}>✕</button>
        </div>

        <div style={addRow}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={addPlaceholder}
            style={input}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <button style={addBtn} onClick={handleAdd} disabled={busy || !newName.trim()}>+ Add</button>
        </div>

        <div style={list}>
          {sorted.map((c, i) => (
            <div key={c.id} style={row}>
              {editingId === c.id ? (
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  style={{ ...input, flex: 1 }}
                  onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                  autoFocus
                />
              ) : (
                <span style={name}>{c.name}</span>
              )}

              <div style={actions}>
                <button style={moveBtn} disabled={busy || i === 0} onClick={() => move(i, -1)}>▲</button>
                <button style={moveBtn} disabled={busy || i === sorted.length - 1} onClick={() => move(i, 1)}>▼</button>
                {editingId === c.id ? (
                  <button style={actionBtn} onClick={saveEdit} disabled={busy}>Save</button>
                ) : (
                  <button style={actionBtn} onClick={() => startEdit(c)} disabled={busy}>Rename</button>
                )}
                <button style={{ ...actionBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => handleDelete(c)} disabled={busy}>Delete</button>
              </div>
            </div>
          ))}

          {sorted.length === 0 && <p style={empty}>None yet. Add one above.</p>}
        </div>
      </div>
    </div>
  );
}

const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3200, padding: "20px" };
const modal = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "440px", maxHeight: "85vh", display: "flex", flexDirection: "column", gap: "16px" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const modalTitle = { fontSize: "18px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0 };
const closeX = { border: "none", background: "transparent", color: "#9b7040", fontSize: "16px", cursor: "pointer" };

const addRow = { display: "flex", gap: "8px" };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", flex: 1 };
const addBtn = { padding: "9px 14px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", whiteSpace: "nowrap" };

const list = { display: "flex", flexDirection: "column", gap: "8px", overflowY: "auto" };
const row = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", padding: "9px 12px", border: "1px solid #eddfc8", borderRadius: "10px", background: "#fdf8f3", flexWrap: "wrap" };
const name = { fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", flex: 1 };
const actions = { display: "flex", gap: "4px", flexShrink: 0 };
const moveBtn = { width: "22px", height: "22px", padding: 0, borderRadius: "6px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "9px", cursor: "pointer" };
const actionBtn = { padding: "5px 9px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#5c3a1e", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "20px 0" };
