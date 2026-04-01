import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  query,
  orderBy,
  serverTimestamp
} from "firebase/firestore";

export default function Suggest() {
  const [suggestions, setSuggestions] = useState([]);
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [expanded, setExpanded] = useState({});
  const [showForm, setShowForm] = useState(false);
  const [filter, setFilter] = useState("recent");

  const user = auth.currentUser;

  //////////////////////////////////////////////
  // FETCH
  //////////////////////////////////////////////
  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
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
  };

  //////////////////////////////////////////////
  // SUBMIT
  //////////////////////////////////////////////
  const handleSubmit = async () => {
    if (!title || !details) return;

    await addDoc(collection(db, "suggestions"), {
      title,
      details,
      userId: user?.uid || "anon",
      votes: 0,
      voters: [],
      status: "none",
      createdAt: serverTimestamp()
    });

    setTitle("");
    setDetails("");
    setShowForm(false);
    fetchData();
  };

  //////////////////////////////////////////////
  // VOTE / UNVOTE
  //////////////////////////////////////////////
  const handleVote = async (s, type) => {
    if (!user) return;

    let newVotes = s.votes || 0;
    let newVoters = s.voters || [];

    const hasVoted = newVoters.includes(user.uid);

    if (type === "vote" && !hasVoted) {
      newVotes += 1;
      newVoters.push(user.uid);
    }

    if (type === "unvote" && hasVoted) {
      newVotes -= 1;
      newVoters = newVoters.filter((id) => id !== user.uid);
    }

    await updateDoc(doc(db, "suggestions", s.id), {
      votes: newVotes,
      voters: newVoters
    });

    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === s.id
          ? { ...item, votes: newVotes, voters: newVoters }
          : item
      )
    );
  };

  //////////////////////////////////////////////
  // FILTER LOGIC
  //////////////////////////////////////////////
  let filtered = [...suggestions];

  if (filter === "votes") {
    filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  }

  if (filter === "your") {
    filtered = filtered.filter((s) =>
      s.voters?.includes(user?.uid)
    );
  }

  //////////////////////////////////////////////
  // STATUS BADGE
  //////////////////////////////////////////////
  const getStatusStyle = (status) => {
    if (status === "planned") return { background: "#dc2626", color: "#fff" };
    if (status === "in progress") return { background: "#facc15", color: "#000" };
    if (status === "complete") return { background: "#16a34a", color: "#fff" };
    return null;
  };

  //////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////
  return (
    <div style={container}>

      {/* HEADER */}
      <div style={header}>
        <h2>Suggestions</h2>

        <button style={plusBtn} onClick={() => setShowForm(true)}>
          +
        </button>
      </div>

      {/* FILTERS */}
      <div style={filters}>
        <button onClick={() => setFilter("recent")} style={filterBtn(filter==="recent")}>Recent</button>
        <button onClick={() => setFilter("votes")} style={filterBtn(filter==="votes")}>Most Votes</button>
        <button onClick={() => setFilter("your")} style={filterBtn(filter==="your")}>Your Votes</button>
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div style={overlay}>
          <div style={modal}>
            <h3>Create Suggestion</h3>

            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={input}
            />

            <textarea
              placeholder="Details"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              style={textarea}
            />

            <div style={{ display: "flex", gap: "10px" }}>
              <button style={submitBtn} onClick={handleSubmit}>
                Submit
              </button>

              <button style={cancelBtn} onClick={() => setShowForm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {filtered.map((s) => {
        const isExpanded = expanded[s.id];
        const hasVoted = s.voters?.includes(user?.uid);
        const statusStyle = getStatusStyle(s.status);

        return (
          <div key={s.id} style={card}>
            
            {/* HEADER */}
            <div style={topRow}>
              <h3 style={titleStyle}>{s.title}</h3>

              {statusStyle && (
                <div style={{ ...badge, ...statusStyle }}>
                  {s.status}
                </div>
              )}
            </div>

            {/* DETAILS */}
            <p style={detailsStyle}>
              {isExpanded
                ? s.details
                : s.details?.slice(0, 120) + "..."}
            </p>

            {/* ACTIONS */}
            <div style={bottomRow}>

              <button
                style={viewBtn}
                onClick={() =>
                  setExpanded((prev) => ({
                    ...prev,
                    [s.id]: !prev[s.id]
                  }))
                }
              >
                {isExpanded ? "Hide" : "View"}
              </button>

              {s.status !== "complete" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  {!hasVoted && (
                    <button
                      style={voteBtn}
                      onClick={() => handleVote(s, "vote")}
                    >
                      Vote ({s.votes || 0})
                    </button>
                  )}

                  {hasVoted && (
                    <button
                      style={unvoteBtn}
                      onClick={() => handleVote(s, "unvote")}
                    >
                      Unvote ({s.votes || 0})
                    </button>
                  )}
                </div>
              )}

              {s.status === "complete" && (
                <div style={finalVotes}>
                  Votes: {s.votes || 0}
                </div>
              )}

            </div>
          </div>
        );
      })}
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const container = {
  maxWidth: "800px",
  margin: "0 auto",
  padding: "30px"
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "15px"
};

const plusBtn = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  border: "none",
  background: "#111",
  color: "#fff",
  fontSize: "20px",
  cursor: "pointer"
};

const filters = {
  display: "flex",
  gap: "10px",
  marginBottom: "20px"
};

const filterBtn = (active) => ({
  padding: "6px 12px",
  borderRadius: "6px",
  border: "none",
  background: active ? "#111" : "#eee",
  color: active ? "#fff" : "#333",
  cursor: "pointer"
});

const card = {
  border: "1px solid #eee",
  borderRadius: "14px",
  padding: "16px",
  marginBottom: "16px",
  background: "#fff",
  boxShadow: "0 6px 14px rgba(0,0,0,0.05)"
};

const topRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const titleStyle = {
  fontSize: "16px",
  fontWeight: "600"
};

const badge = {
  padding: "4px 10px",
  borderRadius: "999px",
  fontSize: "12px",
  textTransform: "capitalize"
};

const detailsStyle = {
  fontSize: "14px",
  color: "#444",
  marginTop: "6px",
  wordBreak: "break-word",
  whiteSpace: "normal"
};

const bottomRow = {
  display: "flex",
  justifyContent: "space-between",
  marginTop: "10px"
};

const viewBtn = {
  border: "none",
  background: "#eee",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};

const voteBtn = {
  background: "#111",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};

const unvoteBtn = {
  background: "#16a34a",
  color: "#fff",
  border: "none",
  padding: "6px 10px",
  borderRadius: "6px",
  cursor: "pointer"
};

const finalVotes = {
  fontSize: "13px",
  color: "#555"
};

const overlay = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100%",
  height: "100%",
  background: "rgba(0,0,0,0.4)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center"
};

const modal = {
  background: "#fff",
  padding: "20px",
  borderRadius: "12px",
  width: "320px",
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const input = {
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ccc"
};

const textarea = {
  padding: "10px",
  borderRadius: "6px",
  border: "1px solid #ccc",
  minHeight: "80px"
};

const submitBtn = {
  background: "#111",
  color: "#fff",
  border: "none",
  padding: "10px",
  borderRadius: "6px",
  cursor: "pointer"
};

const cancelBtn = {
  background: "#eee",
  border: "none",
  padding: "10px",
  borderRadius: "6px",
  cursor: "pointer"
};