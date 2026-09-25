import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useToast } from "../context/ToastContext";
import { fetchTranscript, generateTranscript, saveTranscriptEdits, toParagraphs, detectTopics, transcriptToText, transcriptToSrt } from "../utils/transcripts";
import { findReferences, referenceLabel } from "../utils/scripture";
import { downloadText, formatTime } from "../utils/notes";

export default function Transcript() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const { current, currentTime, isPlaying, seekTo, audioRef, playSermon } = useAudioPlayer();
  const { toast } = useToast();

  const [audio, setAudio] = useState(null);
  const [data, setData] = useState(undefined); // undefined = loading, null = none yet
  const [generating, setGenerating] = useState(false);
  const [q, setQ] = useState("");
  const [hit, setHit] = useState(0);
  const [autoScroll, setAutoScroll] = useState(true);
  const [editing, setEditing] = useState(null); // { index, text, label }
  const paraRefs = useRef({});

  useEffect(() => {
    getDoc(doc(db, "audio", id)).then((s) => s.exists() && setAudio({ id: s.id, ...s.data() })).catch(() => {});
    fetchTranscript(id).then(setData).catch(() => setData(null));
  }, [id]);

  const paragraphs = useMemo(() => (data ? toParagraphs(data.segments) : []), [data]);
  const textOf = (p) => data.edits[p.index] ?? p.segments.map((s) => s.text).join(" ");
  const labelOf = (p) => data.speakerLabels[p.index] ?? audio?.speaker ?? "";

  const isCurrent = current?.id === id;
  const activeSegment = isCurrent && data ? data.segments.findIndex((s, i) => currentTime >= s.start && (currentTime < s.end || currentTime < (data.segments[i + 1]?.start ?? Infinity))) : -1;
  const activePara = activeSegment >= 0 ? paragraphs.findIndex((p) => p.segments.some((s) => s.i === activeSegment)) : -1;

  // Follow the audio.
  useEffect(() => {
    if (!autoScroll || !isPlaying || activePara < 0) return;
    paraRefs.current[activePara]?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [activePara, autoScroll, isPlaying]);

  // Search inside the transcript.
  const term = q.trim().toLowerCase();
  const matches = useMemo(() => (term && data ? paragraphs.map((p, i) => ({ i, p })).filter(({ p }) => textOf(p).toLowerCase().includes(term)).map(({ i }) => i) : []), [term, paragraphs, data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setHit(0); }, [term]);
  useEffect(() => { if (matches.length) paraRefs.current[matches[hit % matches.length]]?.scrollIntoView({ block: "center", behavior: "smooth" }); }, [hit, matches]);

  // ?t=123 from search results.
  const startAt = Number(params.get("t")) || 0;
  useEffect(() => {
    if (!startAt || !paragraphs.length) return;
    const i = paragraphs.findIndex((p) => p.end >= startAt);
    if (i >= 0) setTimeout(() => paraRefs.current[i]?.scrollIntoView({ block: "center" }), 250);
  }, [startAt, paragraphs.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const jump = (t) => {
    if (isCurrent) { seekTo(t); if (audioRef.current?.paused) audioRef.current.play().catch(() => {}); }
    else playSermon(audio || { id }, t > 0 ? { resumeAt: t } : {}); // plays in the background; you stay on this page
  };

  const generate = async () => {
    if (!audio) return;
    setGenerating(true);
    try {
      await generateTranscript(audio);
      const fresh = await fetchTranscript(id);
      setData(fresh);
      toast(fresh ? "Transcript ready" : "Transcript requested", { type: fresh ? "success" : "info" });
    } catch (e) {
      toast(e.message || "Couldn't generate the transcript.", { type: "error" });
    }
    setGenerating(false);
  };

  const regenSections = async () => {
    setGenerating(true);
    try { await generateTranscript(audio || { id }, { mode: "sections" }); setData(await fetchTranscript(id)); toast("Sections updated", { type: "success" }); }
    catch (e) { toast(e.message || "Couldn't update sections.", { type: "error" }); }
    setGenerating(false);
  };

  const copy = async (text, msg = "Copied") => { try { await navigator.clipboard.writeText(text); toast(msg, { type: "success" }); } catch { toast("Couldn't copy.", { type: "error" }); } };

  const saveEdit = async () => {
    const next = { edits: { ...data.edits, [editing.index]: editing.text }, speakerLabels: { ...data.speakerLabels, [editing.index]: editing.label } };
    await saveTranscriptEdits(id, next).then(() => { setData((d) => ({ ...d, ...next })); setEditing(null); toast("Correction saved", { type: "success" }); }).catch(() => toast("Couldn't save — admin access required.", { type: "error" }));
  };
  const revert = async (p) => {
    const edits = { ...data.edits }; delete edits[p.index];
    const next = { edits, speakerLabels: data.speakerLabels };
    await saveTranscriptEdits(id, next).then(() => setData((d) => ({ ...d, edits }))).catch(() => toast("Couldn't revert.", { type: "error" }));
  };

  ////////////////////////////////////////////////
  if (data === undefined) return <Shell><p style={muted}>Loading…</p></Shell>;

  const title = audio?.title || "Transcript";
  const topics = data?.topics?.length ? data.topics.map((t) => ({ word: t })) : data ? detectTopics(data.segments) : [];
  const refs = data ? countRefs(paragraphs.map(textOf.bind(null)).join(" ")) : [];

  return (
    <Shell>
      <button style={back} onClick={() => navigate(-1)} className="pf-no-print">← Back</button>
      <h1 style={h1}>{title}</h1>
      <p style={sub}>{audio?.speaker ? `${audio.speaker} · ` : ""}Transcript</p>

      {!data || data.segments.length === 0 ? (
        <div style={empty}>
          <div style={{ fontSize: "36px" }}>📜</div>
          <h3 style={emptyTitle}>No transcript yet</h3>
          <p style={muted}>Transcripts are created automatically with AI. It takes a minute or two for a long recording, and only needs to happen once.</p>
          <button style={primary} onClick={generate} disabled={generating || !audio}>{generating ? "Transcribing…" : "✨ Generate transcript"}</button>
          <p style={{ ...muted, marginTop: "12px" }}>Requires a signed-in account. Summaries and transcripts share one transcription, so an AI summary will appear too.</p>
        </div>
      ) : (
        <>
          <div style={toolbar} className="pf-no-print">
            <div style={searchWrap}>
              <input type="search" style={searchInput} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search this transcript…" aria-label="Search transcript" />
              {term && (
                <span style={hitCount}>
                  {matches.length ? `${(hit % matches.length) + 1}/${matches.length}` : "0"}
                  <button style={miniBtn} onClick={() => setHit((h) => (h - 1 + matches.length) % Math.max(1, matches.length))} disabled={!matches.length} aria-label="Previous match">↑</button>
                  <button style={miniBtn} onClick={() => setHit((h) => h + 1)} disabled={!matches.length} aria-label="Next match">↓</button>
                </span>
              )}
            </div>
            <label style={toggle}><input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} /> Auto-scroll</label>
            <button style={ghost} onClick={() => downloadText(transcriptToText(title, audio?.speaker, paragraphs, textOf, labelOf), `${title.replace(/[^\w-]+/g, "_")}-transcript.txt`)}>⬇ Text</button>
            <button style={ghost} onClick={() => downloadText(transcriptToSrt(data.segments), `${title.replace(/[^\w-]+/g, "_")}.srt`)}>⬇ Captions (.srt)</button>
            <button style={ghost} onClick={() => window.print()}>🖨 Print</button>
          </div>

          {(data.sections.length > 0 || topics.length > 0 || refs.length > 0) && (
            <div style={card} className="pf-no-print">
              {data.sections.length > 0 && (
                <>
                  <div style={label}>Sections</div>
                  <div style={chips}>{data.sections.map((s, i) => <button key={i} style={secChip} onClick={() => jump(s.start)}><span style={secTime}>{formatTime(s.start)}</span> {s.title}</button>)}</div>
                </>
              )}
              {topics.length > 0 && (
                <>
                  <div style={label}>{data.topics.length ? "Topics" : "Frequent words"}</div>
                  <div style={chips}>{topics.map((t) => <button key={t.word} style={chip} onClick={() => setQ(t.word)}>{t.word}{t.count ? ` ×${t.count}` : ""}</button>)}</div>
                </>
              )}
              {refs.length > 0 && (
                <>
                  <div style={label}>Scripture mentioned</div>
                  <div style={chips}>{refs.map((r) => <button key={r.label} style={{ ...chip, background: "#e8f0fe", color: "#2a5ab5", borderColor: "#c9d8f5" }} onClick={() => navigate(`/search?q=${encodeURIComponent(r.label)}`)}>{r.label}{r.count > 1 ? ` ×${r.count}` : ""}</button>)}</div>
                </>
              )}
              {isAdmin && <button style={linkBtn} onClick={regenSections} disabled={generating}>{generating ? "Working…" : "↻ Regenerate AI sections"}</button>}
            </div>
          )}

          <div className="pf-print-area">
            {paragraphs.map((p, pi) => {
              const text = textOf(p);
              const isActive = pi === activePara;
              const isHit = matches.length > 0 && matches[hit % matches.length] === pi;
              const edited = data.edits[p.index] !== undefined;
              return (
                <div key={p.index} ref={(el) => { paraRefs.current[pi] = el; }} style={{ ...para, background: isActive ? "#fff1d6" : isHit ? "#fef9c3" : "transparent", borderLeft: isActive ? "3px solid #c97c2e" : "3px solid transparent" }}>
                  <div style={paraHead}>
                    <button style={time} onClick={() => jump(p.start)} title="Play from here" className="pf-no-print">{formatTime(p.start)}</button>
                    <span className="pf-print-only" style={{ display: "none" }}>[{formatTime(p.start)}]</span>
                    {labelOf(p) && <span style={speakerLabel}>{labelOf(p)}</span>}
                    {edited && <span style={editedTag}>corrected</span>}
                    <span style={{ flex: 1 }} />
                    <button style={miniBtn} onClick={() => copy(text, "Section copied")} aria-label="Copy this section" title="Copy section" className="pf-no-print">⧉</button>
                    {isAdmin && <button style={miniBtn} onClick={() => setEditing({ index: p.index, text, label: data.speakerLabels[p.index] ?? audio?.speaker ?? "" })} aria-label="Correct this section" title="Correct" className="pf-no-print">✎</button>}
                  </div>

                  {editing?.index === p.index ? (
                    <div>
                      <input style={labelInput} value={editing.label} onChange={(e) => setEditing({ ...editing, label: e.target.value })} placeholder="Speaker label" aria-label="Speaker label" />
                      <textarea style={editArea} value={editing.text} onChange={(e) => setEditing({ ...editing, text: e.target.value })} aria-label="Corrected text" />
                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                        <button style={primary} onClick={saveEdit}>Save correction</button>
                        <button style={ghost} onClick={() => setEditing(null)}>Cancel</button>
                        {edited && <button style={ghost} onClick={() => { revert(p); setEditing(null); }}>Restore original</button>}
                      </div>
                    </div>
                  ) : (
                    <p style={paraText}>
                      {edited || activePara !== pi ? <Marked text={text} term={term} /> : p.segments.map((s) => <span key={s.i} style={s.i === activeSegment ? activeSeg : undefined}><Marked text={s.text + " "} term={term} /></span>)}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Shell>
  );
}

function countRefs(text) {
  const map = new Map();
  for (const r of findReferences(text)) { const label = referenceLabel({ ...r, verse: null, endVerse: null }); map.set(label, (map.get(label) || 0) + 1); }
  return [...map.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count).slice(0, 14);
}

function Marked({ text, term }) {
  if (!term) return text;
  const safe = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.split(new RegExp(`(${safe})`, "gi")).map((p, i) => (i % 2 ? <mark key={i} style={mark}>{p}</mark> : p));
}

function Shell({ children }) { return <div style={page}>{children}</div>; }

const page = { padding: "24px 20px 80px", maxWidth: "760px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const back = { background: "none", border: "none", color: "#9b7040", fontFamily: "sans-serif", fontSize: "14px", cursor: "pointer", padding: "4px 0", marginBottom: "10px" };
const h1 = { margin: "0 0 4px", fontSize: "24px", fontWeight: "normal", color: "#3d2200" };
const sub = { margin: "0 0 16px", fontSize: "13px", color: "#9b7040", fontFamily: "sans-serif" };
const muted = { fontSize: "13px", color: "#9b7040", fontFamily: "sans-serif", lineHeight: 1.55 };
const empty = { textAlign: "center", padding: "40px 10px" };
const emptyTitle = { margin: "8px 0 6px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
const toolbar = { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "12px" };
const searchWrap = { position: "relative", flex: "1 1 220px" };
const searchInput = { width: "100%", boxSizing: "border-box", padding: "10px 96px 10px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "14px", fontFamily: "sans-serif" };
const hitCount = { position: "absolute", right: "6px", top: "50%", transform: "translateY(-50%)", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif" };
const miniBtn = { width: "28px", height: "28px", borderRadius: "50%", border: "none", background: "#f4e7d4", color: "#7a4f10", cursor: "pointer", fontSize: "12px" };
const toggle = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e" };
const ghost = { padding: "9px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const primary = { padding: "10px 18px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", fontWeight: "600", cursor: "pointer" };
const linkBtn = { background: "none", border: "none", color: "#a85e18", fontSize: "12px", cursor: "pointer", textDecoration: "underline", padding: 0, marginTop: "8px", fontFamily: "sans-serif" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "14px", marginBottom: "16px" };
const label = { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9b7040", fontFamily: "sans-serif", margin: "4px 0 8px" };
const chips = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "10px" };
const chip = { padding: "6px 12px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const secChip = { ...chip, textAlign: "left" };
const secTime = { fontWeight: "600", color: "#a85e18", marginRight: "4px" };
const para = { padding: "10px 12px", borderRadius: "10px", marginBottom: "4px", transition: "background 0.2s" };
const paraHead = { display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" };
const time = { padding: "3px 10px", borderRadius: "999px", border: "none", background: "#fde8b8", color: "#7a4f10", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "sans-serif" };
const speakerLabel = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", fontWeight: "600" };
const editedTag = { fontSize: "10px", padding: "1px 8px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontFamily: "sans-serif" };
const paraText = { margin: 0, fontSize: "16px", lineHeight: 1.75, color: "#3d2200" };
const activeSeg = { background: "#fde8b8", borderRadius: "4px" };
const mark = { background: "#fde047", color: "inherit", borderRadius: "3px" };
const labelInput = { width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "13px", fontFamily: "sans-serif", marginBottom: "8px" };
const editArea = { width: "100%", boxSizing: "border-box", minHeight: "120px", padding: "10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "15px", fontFamily: "'Georgia', serif", lineHeight: 1.6, marginBottom: "8px" };
