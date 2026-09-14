import { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { supabase } from "../supabase";
import { useAudioPlayer } from "../context/AudioPlayerContext";

const MAX_CANDIDATES = 50;

const TYPE_LABEL = { sundayschool: "Sunday School", homily: "Homily", sermon: "Sermon" };

// Shown on the player page — asks the same Groq model already used for
// AI summaries to pick related content by comparing summaries, rather
// than a plain keyword match. Requires the current track to already
// have an AI summary (and requires sign-in, since it calls an
// authenticated edge function) — otherwise this renders nothing.
export default function RelatedAudio({ current }) {
  const { playSermon } = useAudioPlayer();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems([]);

    if (!current?.aiSummary || !auth.currentUser) return undefined;

    async function run() {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "audio"), where("type", "in", ["sermon", "homily", "sundayschool"])));
        const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const candidates = all
          .filter((a) => a.id !== current.id && typeof a.aiSummary === "string" && a.aiSummary.trim())
          .slice(0, MAX_CANDIDATES);

        if (candidates.length === 0) {
          if (!cancelled) setItems([]);
          return;
        }

        const token = await auth.currentUser.getIdToken();
        const { data, error } = await supabase.functions.invoke("related-audio", {
          headers: { Authorization: `Bearer ${token}` },
          body: {
            currentTitle: current.title,
            currentSummary: current.aiSummary,
            candidates: candidates.map((c) => ({ id: c.id, title: c.title, summary: c.aiSummary })),
          },
        });
        if (cancelled) return;
        if (error || !data?.relatedIds) {
          setItems([]);
          return;
        }

        const byId = new Map(candidates.map((c) => [c.id, c]));
        setItems(data.relatedIds.map((id) => byId.get(id)).filter(Boolean));
      } catch (err) {
        console.error("Unable to load related audio", err);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => { cancelled = true; };
  }, [current?.id, current?.aiSummary]);

  if (!current?.aiSummary || !auth.currentUser) return null;
  if (!loading && items.length === 0) return null;

  return (
    <div style={wrap}>
      <h3 style={heading}>Related</h3>

      {loading ? (
        <p style={hint}>Finding related content…</p>
      ) : (
        <div style={list}>
          {items.map((item) => (
            <button key={item.id} style={itemBtn} onClick={() => playSermon(item)}>
              <span style={itemTag}>{TYPE_LABEL[item.type] || "Sermon"}</span>
              <span style={itemTitle}>{item.title}</span>
              <span style={itemSpeaker}>{item.speaker}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const wrap = {
  width: "100%",
  maxWidth: "480px",
  marginTop: "20px",
};

const heading = {
  fontSize: "15px",
  fontWeight: "normal",
  color: "#5c3a1e",
  fontFamily: "'Georgia', serif",
  margin: "0 0 10px",
};

const hint = {
  fontSize: "13px",
  color: "#b08050",
  fontStyle: "italic",
  fontFamily: "sans-serif",
  margin: 0,
};

const list = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const itemBtn = {
  display: "flex",
  flexDirection: "column",
  alignItems: "flex-start",
  gap: "3px",
  textAlign: "left",
  padding: "12px 14px",
  borderRadius: "14px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
};

const itemTag = {
  fontSize: "10px",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "#f6e4b0",
  color: "#7a5a10",
  fontFamily: "sans-serif",
  letterSpacing: "0.04em",
};

const itemTitle = {
  fontSize: "14px",
  color: "#3d2200",
  fontFamily: "sans-serif",
  fontWeight: "600",
};

const itemSpeaker = {
  fontSize: "12px",
  color: "#9b7040",
  fontFamily: "sans-serif",
};
