import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function SuggestFeature() {
  const [user, setUser] = useState(null);
  const [suggestions, setSuggestions] = useState([]);

  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // FETCH SUGGESTIONS
  //////////////////////////////////////////////////
  const fetchSuggestions = async () => {
    const snap = await getDocs(collection(db, "featureSuggestions"));

    const list = snap.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    }));

    // sort by votes
    list.sort((a, b) => (b.votes || 0) - (a.votes || 0));

    setSuggestions(list);
  };

  useEffect(() => {
    fetchSuggestions();
  }, []);

  //////////////////////////////////////////////////
  // ADD SUGGESTION
  //////////////////////////////////////////////////
  const handleSubmit = async () => {
    if (!title.trim()) return;

    await addDoc(collection(db, "featureSuggestions"), {
      title,
      details,
      votes: 0,
      voters: [],
      createdBy: user?.uid || null,
      createdAt: serverTimestamp(),
    });

    setTitle("");
    setDetails("");

    fetchSuggestions();
  };

  //////////////////////////////////////////////////
  // VOTE (ONLY ONCE)
  //////////////////////////////////////////////////
  const handleVote = async (suggestion) => {
    if (!user) return;

    const alreadyVoted = suggestion.voters?.includes(user.uid);
    if (alreadyVoted) return;

    const ref = doc(db, "featureSuggestions", suggestion.id);

    await updateDoc(ref, {
      votes: (suggestion.votes || 0) + 1,
      voters: [...(suggestion.voters || []), user.uid],
    });

    fetchSuggestions();
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={{ padding: "30px", maxWidth: "800px", margin: "0 auto" }}>
      
      <h1 style={{ textAlign: "center", marginBottom: "25px" }}>
        Suggest a Feature
      </h1>

      {/* FORM */}
      {user && (
        <div style={formCard}>
          <input
            placeholder="Feature name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={input}
          />

          <textarea
            placeholder="Describe your idea..."
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            style={textarea}
          />

          <button onClick={handleSubmit} style={submitBtn}>
            Submit
          </button>
        </div>
      )}

      {/* LIST */}
      <div style={{ marginTop: "30px" }}>
        {suggestions.map((s) => {
          const voted = s.voters?.includes(user?.uid);

          return (
            <div key={s.id} style={card}>
              
              <div style={{ flex: 1 }}>
                <h3 style={{ marginBottom: "5px" }}>{s.title}</h3>
                <p style={{ color: "#666", fontSize: "13px" }}>
                  {s.details}
                </p>
              </div>

              <div style={voteBox}>
                <button
                  onClick={() => handleVote(s)}
                  disabled={voted}
                  style={{
                    ...voteBtn,
                    background: voted ? "#ddd" : "#111",
                    cursor: voted ? "not-allowed" : "pointer",
                  }}
                >
                  ▲
                </button>

                <div style={{ fontWeight: "600" }}>
                  {s.votes || 0}
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const formCard = {
  background: "#fff",
  padding: "20px",
  borderRadius: "14px",
  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const input = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
};

const textarea = {
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #ccc",
  minHeight: "80px",
};

const submitBtn = {
  background: "#111",
  color: "#fff",
  border: "none",
  padding: "10px",
  borderRadius: "8px",
  cursor: "pointer",
};

const card = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#fff",
  padding: "15px",
  borderRadius: "12px",
  marginBottom: "12px",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const voteBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "5px",
};

const voteBtn = {
  border: "none",
  color: "#fff",
  width: "30px",
  height: "30px",
  borderRadius: "6px",
};