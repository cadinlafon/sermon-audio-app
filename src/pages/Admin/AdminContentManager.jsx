import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";

export default function AdminContentManager() {
  const [audioList, setAudioList] = useState([]);
  const [search, setSearch] = useState("");
  const [audioGroup, setAudioGroup] = useState("sermons");
  const [sortOrder, setSortOrder] = useState("desc");

  const loadAudio = async () => {
    const snapshot = await getDocs(collection(db, "audio"));
    setAudioList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { loadAudio(); }, []);

  const filtered = audioList
    .filter((a) => audioGroup === "sermons" ? (a.type === "sermon" || a.type === "homily") : a.type === "sundayschool")
    .filter((a) => a.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortOrder === "desc" ? (b.order ?? 0) - (a.order ?? 0) : (a.order ?? 0) - (b.order ?? 0));

  const moveItem = async (index, direction) => {
    const newList = [...filtered];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    const curr = newList[index];
    const targ = newList[targetIndex];
    await updateDoc(doc(db, "audio", curr.id), { order: targ.order ?? 0 });
    await updateDoc(doc(db, "audio", targ.id), { order: curr.order ?? 0 });
    loadAudio();
  };

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Content Manager</h1>
        <p style={pageSubtitle}>Reorder how audio appears to listeners.</p>
      </div>

      <div style={toolbar}>
        <select value={audioGroup} onChange={(e) => setAudioGroup(e.target.value)} style={select}>
          <option value="sermons">Sermons & Homilies</option>
          <option value="sunday">Sunday School</option>
        </select>

        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} style={pillBtn}>
          {sortOrder === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      <div style={list}>
        {filtered.map((audio, index) => (
          <div key={audio.id} style={card}>
            <div style={cardLeft}>
              <div style={orderBadge}>#{audio.order ?? "—"}</div>
              <div>
                <div style={cardTitle}>{audio.title}</div>
                <div style={cardSub}>{audio.speaker}</div>
              </div>
            </div>
            <div style={arrowGroup}>
              <button onClick={() => moveItem(index, "up")} style={arrowBtn} title="Move up">▲</button>
              <button onClick={() => moveItem(index, "down")} style={arrowBtn} title="Move down">▼</button>
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p style={empty}>No items match your search.</p>}
      </div>
    </div>
  );
}

const page = { maxWidth: "800px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const toolbar = { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" };

const select = {
  padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8",
  background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200",
};

const searchInput = {
  flex: 1, padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8",
  background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none",
};

const pillBtn = {
  padding: "9px 16px", borderRadius: "10px", border: "1px solid #c8922a",
  background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
};

const list = { display: "flex", flexDirection: "column", gap: "10px" };

const card = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px",
  padding: "14px 18px", boxShadow: "0 2px 8px rgba(160,100,40,0.06)",
};

const cardLeft = { display: "flex", alignItems: "center", gap: "14px" };

const orderBadge = {
  width: "32px", height: "32px", borderRadius: "8px",
  background: "#f6e4b0", color: "#7a5a10", fontSize: "11px",
  fontFamily: "sans-serif", display: "flex", alignItems: "center",
  justifyContent: "center", flexShrink: 0,
};

const cardTitle = { fontSize: "15px", color: "#3d2200", fontFamily: "'Georgia', serif", marginBottom: "2px" };
const cardSub = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };

const arrowGroup = { display: "flex", gap: "6px" };

const arrowBtn = {
  width: "32px", height: "32px", borderRadius: "8px",
  border: "1px solid #eddfc8", background: "#fdf8f3",
  color: "#7a4f10", cursor: "pointer", fontSize: "12px",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "30px 0" };