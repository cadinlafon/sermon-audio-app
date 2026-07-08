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
  serverTimestamp,
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
    const q = query(collection(db, "suggestions"), orderBy("createdAt", "desc"));
    const snap = await getDocs(q);
    setSuggestions(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      createdAt: serverTimestamp(),
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
    await updateDoc(doc(db, "suggestions", s.id), { votes: newVotes, voters: newVoters });
    setSuggestions((prev) =>
      prev.map((item) =>
        item.id === s.id ? { ...item, votes: newVotes, voters: newVoters } : item
      )
    );
  };

  //////////////////////////////////////////////
  // FILTER
  //////////////////////////////////////////////
  let filtered = [...suggestions];
  if (filter === "votes") filtered.sort((a, b) => (b.votes || 0) - (a.votes || 0));
  if (filter === "your") filtered = filtered.filter((s) => s.voters?.includes(user?.uid));

  //////////////////////////////////////////////
  // STATUS
  //////////////////////////////////////////////
  const statusConfig = {
    planned:     { label: "Planned",     bg: "#fce8e8", color: "#a32d2d" },
    "in progress": { label: "In Progress", bg: "#fffbee", color: "#7a5a10" },
    complete:    { label: "Complete",    bg: "#eaf3de", color: "#3b6d11" },
  };

  //////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////
  return (
    <div style={page}>
      <h1 style={pageTitle}>Feature Suggestions</h1>
      <p style={pageSubtitle}>
        Vote on ideas or submit your own — your feedback shapes the app.
      </p>

      {/* CONTROLS ROW */}
      <div style={controlsRow}>
        <div style={filterPills}>
          {["recent", "votes", "your"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={filter === f ? { ...filterBtn, ...filterBtnActive } : filterBtn}
            >
              {f === "recent" ? "Recent" : f === "votes" ? "Most Votes" : "Your Votes"}
            </button>
          ))}
        </div>
        <button style={addButton} onClick={() => setShowForm(true)}>
          + Suggest
        </button>
      </div>

      {/* FORM MODAL */}
      {showForm && (
        <div style={overlayWrapper}>
          <div style={modal}>
            <h3 style={modalTitle}>New Suggestion</h3>
            <p style={modalSubtitle}>What feature would make the app better?</p>

            <input
              placeholder="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={inputStyle}
            />

            <textarea
              placeholder="Describe your idea in a bit more detail…"
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              style={textareaStyle}
            />

            <div style={modalButtons}>
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

      {/* EMPTY STATE */}
      {filtered.length === 0 && (
        <div style={emptyCard}>
          <span style={emptyIcon}>💡</span>
          <p style={emptyText}>No suggestions here yet. Be the first!</p>
        </div>
      )}

      {/* LIST */}
      {filtered.map((s) => {
        const isExpanded = expanded[s.id];
        const hasVoted = s.voters?.includes(user?.uid);
        const status = statusConfig[s.status];

        return (
          <div key={s.id} style={card}>
            {/* TOP ROW */}
            <div style={cardTopRow}>
              <h3 style={cardTitle}>{s.title}</h3>
              {status && (
                <span style={{ ...statusBadge, background: status.bg, color: status.color }}>
                  {status.label}
                </span>
              )}
            </div>

            {/* DETAILS */}
            <p style={detailsText}>
              {isExpanded ? s.details : s.details?.slice(0, 120) + (s.details?.length > 120 ? "…" : "")}
            </p>

            {/* ACTIONS */}
            <div style={actionsRow}>
              <button
                style={viewBtn}
                onClick={() =>
                  setExpanded((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                }
              >
                {isExpanded ? "Hide" : "Read more"}
              </button>

              {s.status !== "complete" ? (
                hasVoted ? (
                  <button style={unvoteBtn} onClick={() => handleVote(s, "unvote")}>
                    ✓ Voted ({s.votes || 0})
                  </button>
                ) : (
                  <button style={voteBtn} onClick={() => handleVote(s, "vote")}>
                    ▲ Vote ({s.votes || 0})
                  </button>
                )
              ) : (
                <span style={finalVoteCount}>{s.votes || 0} votes</span>
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

const page = {
  padding: "32px 20px 60px",
  maxWidth: "680px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
};

const pageTitle = {
  textAlign: "center",
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "6px",
};

const pageSubtitle = {
  textAlign: "center",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "15px",
  marginBottom: "28px",
};

const controlsRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  marginBottom: "24px",
  flexWrap: "wrap",
};

const filterPills = {
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const filterBtn = {
  padding: "8px 16px",
  borderRadius: "999px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
};

const filterBtnActive = {
  background: "linear-gradient(135deg, #6b3a10 0%, #3d2200 100%)",
  border: "1px solid transparent",
  color: "#fff8ee",
};

const addButton = {
  padding: "9px 20px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
  flexShrink: 0,
};

const overlayWrapper = {
  position: "fixed",
  inset: 0,
  background: "rgba(61,34,0,0.45)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 1000,
  padding: "20px",
};

const modal = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "20px",
  padding: "28px 24px",
  width: "100%",
  maxWidth: "400px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxShadow: "0 8px 32px rgba(61,34,0,0.18)",
};

const modalTitle = {
  margin: 0,
  fontSize: "20px",
  fontWeight: "normal",
  color: "#3d2200",
};

const modalSubtitle = {
  margin: 0,
  fontSize: "14px",
  color: "#9b7040",
  fontFamily: "sans-serif",
};

const inputStyle = {
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  fontSize: "14px",
  fontFamily: "sans-serif",
  background: "#fdf8f3",
  color: "#3d2200",
  outline: "none",
};

const textareaStyle = {
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  fontSize: "14px",
  fontFamily: "sans-serif",
  background: "#fdf8f3",
  color: "#3d2200",
  outline: "none",
  minHeight: "90px",
  resize: "vertical",
};

const modalButtons = {
  display: "flex",
  gap: "10px",
};

const submitBtn = {
  flex: 1,
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "sans-serif",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};

const cancelBtn = {
  flex: 1,
  padding: "12px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "14px",
  fontFamily: "sans-serif",
};

const emptyCard = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "40px 24px",
  textAlign: "center",
  border: "1px solid #eddfc8",
};

const emptyIcon = {
  fontSize: "32px",
  display: "block",
  marginBottom: "10px",
};

const emptyText = {
  color: "#b08050",
  fontFamily: "sans-serif",
  fontSize: "14px",
  margin: 0,
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  padding: "20px 22px 16px",
  marginBottom: "14px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const cardTopRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "10px",
  marginBottom: "8px",
};

const cardTitle = {
  margin: 0,
  fontSize: "16px",
  fontWeight: "normal",
  color: "#3d2200",
  flex: 1,
};

const statusBadge = {
  fontSize: "11px",
  padding: "3px 10px",
  borderRadius: "999px",
  fontFamily: "sans-serif",
  flexShrink: 0,
  letterSpacing: "0.03em",
};

const detailsText = {
  fontSize: "14px",
  color: "#7a5530",
  lineHeight: 1.65,
  fontFamily: "sans-serif",
  margin: "0 0 14px",
  wordBreak: "break-word",
};

const actionsRow = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "10px",
};

const viewBtn = {
  padding: "7px 14px",
  borderRadius: "8px",
  border: "1px solid #eddfc8",
  background: "transparent",
  color: "#9b7040",
  cursor: "pointer",
  fontSize: "12px",
  fontFamily: "sans-serif",
};

const voteBtn = {
  padding: "7px 16px",
  borderRadius: "999px",
  border: "1px solid #c8922a",
  background: "transparent",
  color: "#7a4f10",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
};

const unvoteBtn = {
  padding: "7px 16px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  cursor: "pointer",
  fontSize: "13px",
  fontFamily: "sans-serif",
  boxShadow: "0 2px 8px rgba(160,80,20,0.22)",
};

const finalVoteCount = {
  fontSize: "12px",
  color: "#b08050",
  fontFamily: "sans-serif",
};