import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import useSearchIndex from "../hooks/useSearchIndex";
import { KINDS, search } from "../utils/searchEngine";
import { parseReferenceQuery, referenceLabel } from "../utils/scripture";
import { formatTime } from "../utils/notes";

const RECENT_KEY = "recentSearches:v1";
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; } };
const SUGGESTIONS = ["Romans 8", "grace", "prayer", "2026", "Sunday School"];

function Highlight({ text, terms }) {
  if (!text) return null;
  const clean = terms.filter((t) => t.length > 1).map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (!clean.length) return text;
  const parts = text.split(new RegExp(`(${clean.join("|")})`, "gi"));
  return parts.map((p, i) => (i % 2 ? <mark key={i} style={mark}>{p}</mark> : p));
}

export default function Search() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const urlQ = params.get("q") || "";
  const [q, setQ] = useState(urlQ);
  const [kind, setKind] = useState("all");
  const [recent, setRecent] = useState(readRecent);
  const { items, loading, transcriptsLoaded, loadingTranscripts, loadTranscripts } = useSearchIndex();
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => { setQ(urlQ); }, [urlQ]);

  // Keep the URL shareable as you type.
  useEffect(() => {
    const id = setTimeout(() => setParams(q.trim() ? { q: q.trim() } : {}, { replace: true }), 250);
    return () => clearTimeout(id);
  }, [q, setParams]);

  const results = useMemo(() => search(items, q), [items, q]);
  const counts = useMemo(() => Object.fromEntries(KINDS.map(([k]) => [k, results.filter((r) => r.kind === k).length])), [results]);
  const shown = kind === "all" ? results : results.filter((r) => r.kind === kind);
  const terms = q.toLowerCase().split(/[^a-z0-9:'-]+/).filter(Boolean);
  const ref = parseReferenceQuery(q);

  const remember = () => {
    const v = q.trim();
    if (!v) return;
    const next = [v, ...readRecent().filter((r) => r !== v)].slice(0, 6);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    setRecent(next);
  };

  const open = (r) => {
    remember();
    navigate(r.kind === "transcript" && r.at != null ? `${r.url}?t=${r.at}` : r.kind === "sermon" && r.at != null ? `${r.url}?t=${r.at}` : r.url);
  };

  return (
    <div style={page}>
      <h1 style={title}>Search</h1>
      <div style={searchBox}>
        <input ref={inputRef} type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && remember()} placeholder="Sermons, speakers, Scripture, topics, notes…" style={input} aria-label="Search everything" />
        {q && <button style={clear} onClick={() => setQ("")} aria-label="Clear search">✕</button>}
      </div>

      {!q.trim() ? (
        <div style={hintBox}>
          <p style={muted}>Search titles, speakers, dates, topics, Scripture (try “Romans 8”), resources, Doctrine, and your own notes.</p>
          {recent.length > 0 && (<><div style={label}>Recent</div><div style={chips}>{recent.map((r) => <button key={r} style={chip} onClick={() => setQ(r)}>🕘 {r}</button>)}</div></>)}
          <div style={label}>Try</div>
          <div style={chips}>{SUGGESTIONS.map((s) => <button key={s} style={chip} onClick={() => setQ(s)}>{s}</button>)}</div>
        </div>
      ) : (
        <>
          <div style={summary} role="status" aria-live="polite">
            {loading ? "Searching…" : `${results.length} result${results.length === 1 ? "" : "s"}${ref ? ` · Scripture: ${referenceLabel(ref)}` : ""}`}
          </div>

          <div style={chips} role="tablist">
            <button role="tab" aria-selected={kind === "all"} style={kind === "all" ? { ...chip, ...chipOn } : chip} onClick={() => setKind("all")}>All ({results.length})</button>
            {KINDS.filter(([k]) => counts[k] > 0).map(([k, icon, name]) => (
              <button key={k} role="tab" aria-selected={kind === k} style={kind === k ? { ...chip, ...chipOn } : chip} onClick={() => setKind(k)}>{icon} {name} ({counts[k]})</button>
            ))}
          </div>

          {!transcriptsLoaded && (
            <div style={transBar}>
              <span>Full transcripts aren't searched until you ask — they're large.</span>
              <button style={chip} onClick={loadTranscripts} disabled={loadingTranscripts}>{loadingTranscripts ? "Loading…" : "📜 Search transcripts too"}</button>
            </div>
          )}

          {(kind === "all" ? KINDS : KINDS.filter(([k]) => k === kind)).map(([k, icon, name]) => {
            const group = shown.filter((r) => r.kind === k).slice(0, kind === "all" ? 6 : 100);
            if (!group.length) return null;
            return (
              <section key={k} style={{ marginBottom: "18px" }}>
                <h2 style={h2}>{icon} {name} <span style={count}>{counts[k]}</span></h2>
                {group.map((r) => (
                  <button key={`${r.kind}-${r.id}`} style={row} onClick={() => open(r)}>
                    <span style={rowIcon}>{r.icon || icon}</span>
                    <span style={{ minWidth: 0, textAlign: "left", flex: 1 }}>
                      <span style={rowTitle}><Highlight text={r.title} terms={terms} /></span>
                      <span style={rowSub}>{r.subtitle}{r.at != null ? ` · at ${formatTime(r.at)}` : ""}</span>
                      {r.snippet && <span style={rowSnippet}><Highlight text={r.snippet} terms={terms} /></span>}
                    </span>
                  </button>
                ))}
                {kind === "all" && counts[k] > 6 && <button style={more} onClick={() => setKind(k)}>Show all {counts[k]} →</button>}
              </section>
            );
          })}

          {!loading && results.length === 0 && (
            <div style={empty}>
              <div style={{ fontSize: "34px" }}>🔍</div>
              <h3 style={emptyTitle}>No results for “{q.trim()}”</h3>
              <p style={muted}>Try a shorter word, check the spelling, or search a Scripture like “John 3”.</p>
              <div style={chips}>{SUGGESTIONS.map((s) => <button key={s} style={chip} onClick={() => setQ(s)}>{s}</button>)}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const page = { padding: "32px 20px 60px", maxWidth: "760px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh", fontFamily: "'Georgia', serif" };
const title = { textAlign: "center", margin: "0 0 16px", fontSize: "28px", fontWeight: "normal", color: "#3d2200" };
const searchBox = { position: "relative", marginBottom: "14px" };
const input = { width: "100%", boxSizing: "border-box", padding: "14px 44px 14px 18px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "16px", fontFamily: "sans-serif", color: "#3d2200", outline: "none" };
const clear = { position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", width: "30px", height: "30px", borderRadius: "50%", border: "none", background: "#f0e4d0", color: "#7a4f10", cursor: "pointer" };
const hintBox = { padding: "10px 0" };
const muted = { margin: "0 0 12px", fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", lineHeight: 1.55 };
const label = { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.05em", color: "#9b7040", fontFamily: "sans-serif", margin: "14px 0 8px" };
const chips = { display: "flex", flexWrap: "wrap", gap: "8px", marginBottom: "12px" };
const chip = { padding: "8px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const chipOn = { background: "#fde8b8", borderColor: "#e5c27a", fontWeight: "600" };
const summary = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", margin: "0 0 10px", textAlign: "center" };
const transBar = { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "8px", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", background: "#fdf1de", borderRadius: "12px", padding: "8px 12px", marginBottom: "16px" };
const h2 = { margin: "0 0 8px", fontSize: "16px", fontWeight: "600", color: "#3d2200", fontFamily: "sans-serif" };
const count = { fontSize: "12px", color: "#9b7040", fontWeight: "normal", marginLeft: "4px" };
const row = { width: "100%", display: "flex", gap: "12px", alignItems: "flex-start", background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "12px", marginBottom: "8px", cursor: "pointer" };
const rowIcon = { fontSize: "20px", lineHeight: 1.2 };
const rowTitle = { display: "block", fontSize: "15px", color: "#3d2200" };
const rowSub = { display: "block", fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", marginTop: "2px" };
const rowSnippet = { display: "block", fontSize: "12px", color: "#7a5530", fontFamily: "sans-serif", marginTop: "6px", lineHeight: 1.5 };
const more = { background: "none", border: "none", color: "#a85e18", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", padding: "4px 0" };
const mark = { background: "#fde8b8", color: "inherit", borderRadius: "3px", padding: "0 1px" };
const empty = { textAlign: "center", padding: "30px 10px" };
const emptyTitle = { margin: "8px 0 4px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
