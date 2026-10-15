import { useEffect, useState } from "react";
import { collection, doc, getDocs, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../firebase";
import { supabase } from "../supabase";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { pickRelated, rankBySimilarity } from "../utils/relatedContent";

const SUMMARIZABLE_TYPES = ["sermon", "homily", "sundayschool"];
const TYPE_LABEL = { sundayschool: "Sunday School", homily: "Homily", sermon: "Sermon" };

// How many of the closest summaries are handed to the AI to re-rank.
const AI_CANDIDATE_LIMIT = 30;
const AI_TIMEOUT_MS = 15000;

// Asks the AI service which of the already-closest candidates are
// thematically related. Returns the picked items, or null if the call
// failed / timed out — the caller then keeps the local summary match.
async function askAiForRelated(current, summary, ranked) {
  const user = auth.currentUser;
  if (!user) return null;

  try {
    const token = await user.getIdToken();
    const call = supabase.functions.invoke("related-audio", {
      headers: { Authorization: `Bearer ${token}` },
      body: {
        currentTitle: current.title,
        currentSummary: summary,
        candidates: ranked
          .slice(0, AI_CANDIDATE_LIMIT)
          .map(({ item }) => ({ id: item.id, title: item.title, summary: item.aiSummary })),
      },
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), AI_TIMEOUT_MS));
    const { data, error } = await Promise.race([call, timeout]);

    if (error || !Array.isArray(data?.relatedIds)) return null;

    const byId = new Map(ranked.map(({ item }) => [item.id, item]));
    return data.relatedIds.map((id) => byId.get(id)).filter(Boolean);
  } catch (err) {
    console.warn("AI related-content lookup failed; using summary matching instead", err);
    return null;
  }
}

// "Related" section on the player page: finds other recordings whose AI
// summaries are close to this one's.
//
// How it works:
//   1. Compare this recording's summary against every other
//      recording's summary (TF-IDF similarity — utils/relatedContent.js).
//      That alone always works: no sign-in and no network call beyond
//      reading the audio list.
//   2. If signed in, the closest candidates are also sent to the AI
//      service, whose thematic picks win when it answers with any.
//
// Every outcome renders something — results, "No results found", a
// reason there's nothing to compare, or an error with Retry.
export default function RelatedAudio({ current }) {
  const { playSermon } = useAudioPlayer();

  // Doctrine tracks and resource audio live outside the `audio`
  // collection (and have no AI summary) — everything else is fair game.
  const supported =
    !!current &&
    (!current.collection || current.collection === "audio") &&
    (!current.type || SUMMARIZABLE_TYPES.includes(current.type));
  const [summary, setSummary] = useState(current?.aiSummary || "");
  const [result, setResult] = useState(null); // { key, status: "ready" | "error", items }
  const [attempt, setAttempt] = useState(0);

  // The track object can predate its summary (auto-generated in the
  // background after playback starts), so watch the document itself
  // instead of trusting what was passed to playSermon().
  useEffect(() => {
    if (!current?.id || !supported) {
      setSummary("");
      return undefined;
    }
    if (current.aiSummary) {
      setSummary(current.aiSummary);
      return undefined;
    }

    setSummary("");
    return onSnapshot(
      doc(db, "audio", current.id),
      (snap) => {
        const found = snap.data()?.aiSummary;
        if (typeof found === "string" && found.trim()) setSummary(found);
      },
      () => {}
    );
  }, [current?.id, current?.aiSummary, supported]);

  const key = `${current?.id}:${summary}:${attempt}`;

  useEffect(() => {
    if (!current?.id || !supported || !summary) return undefined;

    let cancelled = false;

    async function run() {
      try {
        const snap = await getDocs(query(collection(db, "audio"), where("type", "in", SUMMARIZABLE_TYPES)));
        const candidates = snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((a) => a.id !== current.id && typeof a.aiSummary === "string" && a.aiSummary.trim());

        const ranked = rankBySimilarity({ title: current.title, summary }, candidates);
        let items = pickRelated(ranked);

        if (ranked.length > 0) {
          const aiItems = await askAiForRelated(current, summary, ranked);
          if (aiItems && aiItems.length > 0) items = aiItems;
        }

        if (!cancelled) setResult({ key, status: "ready", items });
      } catch (err) {
        console.error("Unable to load related audio", err);
        if (!cancelled) setResult({ key, status: "error", items: [] });
      }
    }

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, supported]);

  if (!current) return null;

  let body;

  if (!supported) {
    body = <p style={hint}>Related content isn't available for this kind of recording.</p>;
  } else if (!summary) {
    body = (
      <p style={hint}>
        This recording doesn't have a summary yet, so there's nothing to compare. Related content will show up here
        once one is generated.
      </p>
    );
  } else if (!result || result.key !== key) {
    body = <p style={hint}>Finding related content…</p>;
  } else if (result.status === "error") {
    body = (
      <div>
        <p style={hint}>We couldn't load related content.</p>
        <button type="button" style={retryBtn} onClick={() => setAttempt((n) => n + 1)}>
          Try again
        </button>
      </div>
    );
  } else if (result.items.length === 0) {
    body = (
      <div>
        <p style={emptyTitle}>No results found.</p>
        <p style={hint}>
          Nothing else has a summary that's a close match yet. Only recordings with a summary can be compared.
        </p>
      </div>
    );
  } else {
    body = (
      <div style={list}>
        {result.items.map((item) => (
          <button key={item.id} type="button" style={itemBtn} onClick={() => playSermon(item)}>
            <span style={itemTag}>{TYPE_LABEL[item.type] || "Sermon"}</span>
            <span style={itemTitle}>{item.title}</span>
            <span style={itemSpeaker}>{item.speaker}</span>
          </button>
        ))}
      </div>
    );
  }

  return (
    <div style={wrap} aria-live="polite">
      {body}
    </div>
  );
}

const wrap = {
  width: "100%",
  maxWidth: "480px",
};

const hint = {
  fontSize: "13px",
  lineHeight: 1.6,
  color: "var(--color-b08050)",
  fontStyle: "italic",
  fontFamily: "sans-serif",
  margin: 0,
};

const emptyTitle = {
  fontSize: "14px",
  color: "var(--color-5c3a1e)",
  fontFamily: "sans-serif",
  fontWeight: "600",
  margin: "0 0 4px",
};

const retryBtn = {
  marginTop: "10px",
  padding: "8px 16px",
  borderRadius: "999px",
  border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fdf8f3)",
  color: "var(--color-7a4f10)",
  fontSize: "13px",
  fontFamily: "sans-serif",
  cursor: "pointer",
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
  border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fffdf9)",
  cursor: "pointer",
  width: "100%",
  boxSizing: "border-box",
};

const itemTag = {
  fontSize: "10px",
  padding: "2px 8px",
  borderRadius: "999px",
  background: "var(--color-f6e4b0)",
  color: "var(--color-7a5a10)",
  fontFamily: "sans-serif",
  letterSpacing: "0.04em",
};

const itemTitle = {
  fontSize: "14px",
  color: "var(--color-3d2200)",
  fontFamily: "sans-serif",
  fontWeight: "600",
};

const itemSpeaker = {
  fontSize: "12px",
  color: "var(--color-9b7040)",
  fontFamily: "sans-serif",
};
