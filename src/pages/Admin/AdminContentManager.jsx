import { useEffect, useState } from "react";
import { db } from "../../firebase";

import {
  collection,
  getDocs,
  updateDoc,
  doc
} from "firebase/firestore";

export default function AdminContentManager() {
  const [audioList, setAudioList] = useState([]);
  const [search, setSearch] = useState("");
  const [audioGroup, setAudioGroup] = useState("sermons");
  const [sortOrder, setSortOrder] = useState("desc");

  //////////////////////////////////////////////////
  // LOAD AUDIO
  //////////////////////////////////////////////////
  const loadAudio = async () => {
    const snapshot = await getDocs(collection(db, "audio"));

    const data = snapshot.docs.map((docSnap) => ({
      id: docSnap.id,
      ...docSnap.data()
    }));

    setAudioList(data);
  };

  useEffect(() => {
    loadAudio();
  }, []);

  //////////////////////////////////////////////////
  // FILTER + SORT (BY ORDER FIELD)
  //////////////////////////////////////////////////
  const filtered = audioList
    .filter((a) => {
      if (audioGroup === "sermons") {
        return a.type === "sermon" || a.type === "homily";
      }
      return a.type === "sundayschool";
    })
    .filter((a) =>
      a.title?.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const orderA = a.order ?? 0;
      const orderB = b.order ?? 0;

      return sortOrder === "desc"
        ? orderB - orderA
        : orderA - orderB;
    });

  //////////////////////////////////////////////////
  // 🔥 MOVE ITEM
  //////////////////////////////////////////////////
  const moveItem = async (index, direction) => {
    const newList = [...filtered];

    const targetIndex = direction === "up"
      ? index - 1
      : index + 1;

    if (targetIndex < 0 || targetIndex >= newList.length) return;

    const current = newList[index];
    const target = newList[targetIndex];

    // swap order values
    const currentOrder = current.order ?? 0;
    const targetOrder = target.order ?? 0;

    await updateDoc(doc(db, "audio", current.id), {
      order: targetOrder
    });

    await updateDoc(doc(db, "audio", target.id), {
      order: currentOrder
    });

    loadAudio();
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={pageStyle}>
      <h1>Content Manager</h1>

      {/* TYPE */}
      <select
        value={audioGroup}
        onChange={(e) => setAudioGroup(e.target.value)}
        style={select}
      >
        <option value="sermons">Sermons & Homilies</option>
        <option value="sunday">Sunday School</option>
      </select>

      {/* SEARCH */}
      <input
        placeholder="Search..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={input}
      />

      {/* SORT TOGGLE */}
      <button
        onClick={() =>
          setSortOrder(sortOrder === "desc" ? "asc" : "desc")
        }
        style={button}
      >
        {sortOrder === "desc" ? "Newest First" : "Oldest First"}
      </button>

      {/* LIST */}
      {filtered.map((audio, index) => (
        <div key={audio.id} style={card}>
          <div>
            <strong>{audio.title}</strong>
            <div style={{ fontSize: "13px", color: "#666" }}>
              {audio.speaker}
            </div>
          </div>

          {/* 🔥 ARROWS */}
          <div style={arrowGroup}>
            <button
              onClick={() => moveItem(index, "up")}
              style={arrowBtn}
            >
              ⬆️
            </button>

            <button
              onClick={() => moveItem(index, "down")}
              style={arrowBtn}
            >
              ⬇️
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

const pageStyle = {
  padding: "30px",
  maxWidth: "800px",
  margin: "0 auto"
};

const select = {
  padding: "10px",
  marginBottom: "10px",
  borderRadius: "6px"
};

const input = {
  padding: "10px",
  marginBottom: "10px",
  display: "block",
  width: "100%",
  borderRadius: "6px",
  border: "1px solid #ccc"
};

const button = {
  padding: "10px 16px",
  marginBottom: "20px",
  border: "none",
  background: "#111",
  color: "#fff",
  borderRadius: "8px",
  cursor: "pointer"
};

const card = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#fff",
  padding: "16px",
  marginBottom: "12px",
  borderRadius: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.06)"
};

const arrowGroup = {
  display: "flex",
  gap: "8px"
};

const arrowBtn = {
  background: "#f3f4f6",
  border: "none",
  padding: "8px 10px",
  borderRadius: "8px",
  cursor: "pointer",
  fontSize: "16px"
};