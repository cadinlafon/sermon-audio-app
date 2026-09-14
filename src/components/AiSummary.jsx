import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { deleteField, doc, getDoc, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { supabase } from "../supabase";
import { useShutdown } from "../context/ShutdownContext";

function useRevealedText(value, enabled) {
  const [text, setText] = useState(enabled ? "" : value);

  useEffect(() => {
    if (!value) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!enabled || reduceMotion) {
      setText(value);
      return;
    }
    const words = value.split(/(\s+)/);
    let index = 0;
    setText("");
    const timer = window.setInterval(() => {
      index = Math.min(index + 5, words.length);
      setText(words.slice(0, index).join(""));
      if (index === words.length) window.clearInterval(timer);
    }, 18);
    return () => window.clearInterval(timer);
  }, [value, enabled]);

  return text;
}

const sectionDecorations = {
  "main topic": { label: "Main topic", emoji: "✨" },
  "key points": { label: "Key points", emoji: "💛" },
  "scripture references": { label: "Scripture references", emoji: "📖" },
  takeaway: { label: "Takeaway", emoji: "🌿" },
};

function cleanText(value) {
  return value
    .replace(/\*{1,3}/g, "")
    .replace(/`/g, "")
    .replace(/\s+$/g, "");
}

function SummaryText({ text }) {
  const lines = text.split("\n");
  const blocks = [];
  let paragraph = [];
  let bullets = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", text: cleanText(paragraph.join(" ")) });
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ type: "bullets", items: bullets.map(cleanText) });
    bullets = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trim();
    const normalized = cleanText(line.replace(/^#+\s*/, "")).replace(/:$/, "").trim().toLowerCase();
    const section = sectionDecorations[normalized];

    if (section) {
      flushParagraph();
      flushBullets();
      blocks.push({ type: "heading", ...section });
    } else if (/^(?:[-*•])\s+/.test(line)) {
      flushParagraph();
      bullets.push(line.replace(/^(?:[-*•])\s+/, ""));
    } else if (!line) {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  });
  flushParagraph();
  flushBullets();

  return blocks.map((block, index) => {
    if (block.type === "heading") {
      return <div className="ai-summary__section-heading" key={`heading-${index}`}><span>{block.emoji}</span>{block.label}</div>;
    }
    if (block.type === "bullets") {
      return <ul className="ai-summary__bullets" key={`bullets-${index}`}>{block.items.map((item, itemIndex) => <li key={itemIndex}>{item}</li>)}</ul>;
    }
    return <p className="ai-summary__paragraph" key={`paragraph-${index}`}>{block.text}</p>;
  });
}

export default function AiSummary({ audio, onSummarySaved }) {
  const { audioAiEnabled, audioAiAudiences } = useShutdown();
  const [user, setUser] = useState(auth.currentUser);
  const [isAdmin, setIsAdmin] = useState(false);
  // Saved summaries are deliberately not loaded when a card opens. They can
  // quickly become stale, and summaries should only be shown after a user
  // asks for one during the current visit.
  const [summary, setSummary] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const [shouldReveal, setShouldReveal] = useState(false);
  const revealedSummary = useRevealedText(summary, shouldReveal);

  useEffect(() => {
    setSummary("");
    setIsExpanded(false);
    setShouldReveal(false);
    setError("");
  }, [audio.id]);

  useEffect(() => onAuthStateChanged(auth, setUser), []);

  useEffect(() => {
    if (!user) { setIsAdmin(false); return; }
    let cancelled = false;
    getDoc(doc(db, "users", user.uid)).then((snap) => {
      if (!cancelled) setIsAdmin(snap.exists() && snap.data().role === "admin");
    });
    return () => { cancelled = true; };
  }, [user]);

  const generateSummary = async (force = false) => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Login/Signup to use this feature");
      return;
    }
    if (!audio.audioStorageKey && !audio.audioURL) {
      setError("This audio file is unavailable right now.");
      return;
    }

    setError("");
    setIsLoading(true);
    try {
      const token = await currentUser.getIdToken();
      let audioUrl = audio.audioURL;
      if (audio.audioStorageKey) {
        const { data: accessData, error: accessError } = await supabase.functions.invoke("audio-download-url", {
          headers: { Authorization: `Bearer ${token}` }, body: { storageKey: audio.audioStorageKey },
        });
        if (accessError || !accessData?.url) {
          const responseBody = await accessError?.context?.json().catch(() => null);
          throw new Error(responseBody?.error || accessError?.message || "Audio is unavailable.");
        }
        audioUrl = accessData.url;
      }
      const { data, error: invokeError } = await supabase.functions.invoke("summarize-audio", {
        headers: { Authorization: `Bearer ${token}` },
        body: { audioId: audio.id, audioUrl, audioType: audio.type, title: audio.title || "Untitled audio", force },
      });
      if (invokeError) {
        // Supabase wraps non-2xx function responses. Read the function's
        // deliberately user-safe message so the card can distinguish an audio
        // problem from a temporary Groq failure without exposing raw details.
        const responseBody = await invokeError.context?.json().catch(() => null);
        throw new Error(responseBody?.error || invokeError.message);
      }
      if (!data?.summary) throw new Error(data?.error || "No summary was returned.");

      // The Edge Function saves to Firestore before returning. Updating the
      // local list makes the finished result available immediately as well.
      setSummary(data.summary);
      setShouldReveal(true);
      setIsExpanded(true);
      onSummarySaved?.(audio.id, data.summary);
    } catch (requestError) {
      console.error("AI summary request failed", requestError);
      setError(requestError.message || "We couldn't generate the summary right now. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Keep AI usage strictly user-initiated. This rejects synthetic/programmatic
  // clicks, so loading or re-rendering a page can never start a transcription.
  const handleSummaryClick = (force = false) => (event) => {
    event.preventDefault();
    if (!event.isTrusted || isLoading) return;
    generateSummary(force);
  };

  const deleteSummary = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setError("Login/Signup to use this feature");
      return;
    }
    if (!window.confirm("Delete this AI summary? This can't be undone.")) return;

    setError("");
    setIsDeleting(true);
    try {
      await updateDoc(doc(db, "audio", audio.id), { aiSummary: deleteField() });

      setSummary("");
      setShouldReveal(false);
      setIsExpanded(false);
      onSummarySaved?.(audio.id, null);
    } catch (requestError) {
      console.error("AI summary deletion failed", requestError);
      setError(requestError.message || "We couldn't delete the summary. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteClick = (event) => {
    event.preventDefault();
    if (!event.isTrusted || isLoading || isDeleting) return;
    deleteSummary();
  };

  const audiences = audioAiAudiences && audioAiAudiences.length ? audioAiAudiences : ["guest", "user", "admin"];
  const role = !user ? "guest" : (isAdmin ? "admin" : "user");
  if (audioAiEnabled === false || !audiences.includes(role)) return null;

  return (
    <div className="ai-summary">
      <style>{styles}</style>
      {!summary || !user ? (
        <button className={`ai-summary__button ${!user ? "ai-summary__button--locked" : ""}`} type="button" onClick={handleSummaryClick()} disabled={isLoading} aria-disabled={!user || isLoading}>
          <span aria-hidden="true">{isLoading ? "◌" : "✦"}</span>
          {isLoading ? "Summarizing..." : "Summarize with AI"}
        </button>
      ) : (
        <div className="ai-summary__actions">
          <button className="ai-summary__link" type="button" onClick={() => setIsExpanded((value) => !value)} aria-expanded={isExpanded}>
            <span aria-hidden="true">✦</span> {isExpanded ? "Hide AI summary" : "Show AI summary"}
          </button>
          <button className="ai-summary__delete" type="button" onClick={handleDeleteClick} disabled={isLoading || isDeleting}>
            <span aria-hidden="true">⌫</span> {isDeleting ? "Deleting..." : "Delete summary"}
          </button>
          <button className={`ai-summary__refresh ${!user ? "ai-summary__refresh--locked" : ""}`} type="button" onClick={handleSummaryClick(true)} disabled={isLoading} aria-disabled={!user || isLoading} title={user ? "Create a fresh AI summary" : "Login/Signup to use this feature"}>
            <span className={isLoading ? "ai-summary__refresh-icon--spinning" : ""} aria-hidden="true">↻</span>
            {isLoading ? "Summarizing..." : "Re-summarize"}
          </button>
        </div>
      )}
      {error && <p className="ai-summary__error" role="alert">{error}</p>}
      <div className={`ai-summary__panel ${isExpanded ? "ai-summary__panel--open" : ""}`} aria-hidden={!isExpanded}>
        <div className="ai-summary__inner">
          <div className="ai-summary__heading"><span aria-hidden="true">✦</span> AI Summary</div>
          <div className="ai-summary__text" aria-live="polite"><SummaryText text={revealedSummary} /></div>
        </div>
      </div>
    </div>
  );
}

const styles = `
  .ai-summary { margin-top: 13px; font-family: sans-serif; }
  .ai-summary__button, .ai-summary__link { display: inline-flex; align-items: center; gap: 7px; border-radius: 999px; cursor: pointer; font: 600 13px/1 sans-serif; transition: transform .18s ease, box-shadow .18s ease; }
  .ai-summary__button { padding: 9px 14px; border: 1px solid #dfb65c; background: #fff8e5; color: #75500e; }
  .ai-summary__button:hover:not(:disabled):not(.ai-summary__button--locked) { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(160,100,40,.14); }
  .ai-summary__button:disabled { cursor: wait; opacity: .72; }
  .ai-summary__button--locked { background: #f2f0ec; border-color: #d8d3cb; color: #9a948b; cursor: not-allowed; opacity: .85; }
  .ai-summary__actions { align-items: center; display: flex; flex-wrap: wrap; gap: 12px; }
  .ai-summary__link { padding: 2px 0; border: 0; background: transparent; color: #8a5a10; }
  .ai-summary__delete { align-items: center; background: transparent; border: 0; color: #a33622; cursor: pointer; display: inline-flex; font: 600 12px/1 sans-serif; gap: 5px; padding: 3px 0; }
  .ai-summary__delete:hover:not(:disabled) { color: #7f2418; }
  .ai-summary__delete:disabled { cursor: wait; opacity: .68; }
  .ai-summary__refresh { align-items: center; background: transparent; border: 0; color: #9a6b20; cursor: pointer; display: inline-flex; font: 600 12px/1 sans-serif; gap: 5px; padding: 3px 0; }
  .ai-summary__refresh:hover:not(:disabled):not(.ai-summary__refresh--locked) { color: #70470d; }
  .ai-summary__refresh:disabled { cursor: wait; opacity: .68; }
  .ai-summary__refresh--locked { color: #aaa49b; cursor: not-allowed; }
  .ai-summary__refresh-icon--spinning { animation: ai-summary-spin .8s linear infinite; }
  .ai-summary__error { margin: 9px 0 0; color: #a33622; font-size: 13px; line-height: 1.45; }
  .ai-summary__panel { display: grid; grid-template-rows: 0fr; opacity: 0; transform: translateY(-5px); transition: grid-template-rows .35s ease, opacity .28s ease, transform .35s ease; }
  .ai-summary__panel--open { grid-template-rows: 1fr; opacity: 1; transform: translateY(0); }
  .ai-summary__inner { min-height: 0; overflow: hidden; margin-top: 0; }
  .ai-summary__panel--open .ai-summary__inner { margin-top: 14px; }
  .ai-summary__heading { color: #765111; font-size: 12px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 8px; }
  .ai-summary__text { background: linear-gradient(135deg, #fffaf0, #fff7e7); border: 1px solid #f0dfbd; border-radius: 12px; color: #5f4729; font-size: 14px; line-height: 1.62; padding: 14px 15px; }
  .ai-summary__section-heading { align-items: center; color: #79541c; display: flex; font-size: 12px; font-weight: 700; gap: 6px; letter-spacing: .035em; margin: 14px 0 5px; text-transform: uppercase; }
  .ai-summary__section-heading:first-child { margin-top: 0; }
  .ai-summary__section-heading span { font-size: 14px; }
  .ai-summary__paragraph { margin: 0 0 8px; }
  .ai-summary__paragraph:last-child { margin-bottom: 0; }
  .ai-summary__bullets { list-style: none; margin: 3px 0 9px; padding: 0; }
  .ai-summary__bullets li { margin: 5px 0; padding-left: 17px; position: relative; }
  .ai-summary__bullets li::before { color: #c58028; content: "✦"; font-size: 10px; left: 0; position: absolute; top: 3px; }
  @keyframes ai-summary-spin { to { transform: rotate(360deg); } }
  @media (prefers-reduced-motion: reduce) { .ai-summary__panel, .ai-summary__button, .ai-summary__link { transition: none; } }
`;
