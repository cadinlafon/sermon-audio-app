import { useRef, useState } from "react";
import MarkdownText, { toggleChecklistLine } from "./MarkdownText";
import { NOTE_CATEGORIES, categoryOf, formatTime, notesToMarkdown, downloadText } from "../utils/notes";
import { useToast } from "../context/ToastContext";

// Notes for the playing recording: a markdown note with checklists, and a
// timeline of timestamped, categorized notes.
export default function NotesSheet({ audio, notes, getTime, onSeek, onClose, showWhilePlaying, onToggleShow, styles }) {
  const { toast } = useToast();
  const { backdrop, sheet, sheetHeader, sheetTitle, sheetCloseBtn } = styles;
  const [tab, setTab] = useState("note");
  const [preview, setPreview] = useState(false);
  const [category, setCategory] = useState("general");
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState(null); // { id, text }
  const taRef = useRef(null);

  // ---- formatting helpers for the textarea
  const wrap = (before, after = before) => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, selectionEnd: e, value } = ta;
    notes.setText(`${value.slice(0, s)}${before}${value.slice(s, e) || "text"}${after}${value.slice(e)}`);
  };
  const prefix = (marker) => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, value } = ta;
    const lineStart = value.lastIndexOf("\n", s - 1) + 1;
    notes.setText(`${value.slice(0, lineStart)}${marker}${value.slice(lineStart)}`);
  };
  const insertTime = () => {
    const ta = taRef.current; if (!ta) return;
    const { selectionStart: s, value } = ta;
    notes.setText(`${value.slice(0, s)}${formatTime(getTime())} ${value.slice(s)}`);
  };

  // ---- timeline
  const addEntry = () => {
    if (!draft.trim()) return;
    const entry = { id: Math.random().toString(36).slice(2, 10), t: Math.floor(getTime()), text: draft.trim().slice(0, 1000), category, createdAt: Date.now() };
    notes.setEntries([...notes.entries, entry].sort((a, b) => a.t - b.t));
    setDraft("");
  };
  const removeEntry = (entry) => {
    notes.setEntries(notes.entries.filter((e) => e.id !== entry.id));
    toast("Note deleted", { action: { label: "Undo", onClick: () => notes.setEntries([...notes.entries.filter((e) => e.id !== entry.id), entry].sort((a, b) => a.t - b.t)) } });
  };
  const saveEdit = () => {
    if (!editing) return;
    notes.setEntries(notes.entries.map((e) => (e.id === editing.id ? { ...e, text: editing.text.slice(0, 1000) } : e)));
    setEditing(null);
  };

  const exportMd = () => downloadText(notesToMarkdown([{ title: audio.title, speaker: audio.speaker, text: notes.text, entries: notes.entries, bookmarks: notes.bookmarks }]), `${(audio.title || "notes").replace(/[^\w-]+/g, "_")}-notes.md`, "text/markdown");

  return (
    <>
      <div style={backdrop} onClick={onClose} />
      <div style={{ ...sheet, maxHeight: "88vh", overflowY: "auto" }} className="pf-print-area">
        <div style={sheetHeader}>
          <h3 style={sheetTitle}>Notes</h3>
          {notes.status && <span style={status}>{notes.status}</span>}
        </div>

        <div style={tabs} role="tablist">
          <button role="tab" aria-selected={tab === "note"} style={tab === "note" ? { ...tabBtn, ...tabOn } : tabBtn} onClick={() => setTab("note")}>📝 Note</button>
          <button role="tab" aria-selected={tab === "timeline"} style={tab === "timeline" ? { ...tabBtn, ...tabOn } : tabBtn} onClick={() => setTab("timeline")}>⏱ Timeline ({notes.entries.length})</button>
        </div>

        {tab === "note" ? (
          <>
            <div style={toolbar}>
              <button style={tool} onClick={() => wrap("**")} title="Bold" aria-label="Bold"><strong>B</strong></button>
              <button style={tool} onClick={() => wrap("*")} title="Italic" aria-label="Italic"><em>I</em></button>
              <button style={tool} onClick={() => prefix("- ")} title="Bullet" aria-label="Bullet">•</button>
              <button style={tool} onClick={() => prefix("- [ ] ")} title="Checklist item" aria-label="Checklist item">☑</button>
              <button style={tool} onClick={insertTime} title="Insert current time" aria-label="Insert current time">⏱</button>
              <button style={preview ? { ...tool, ...toolOn } : tool} onClick={() => setPreview((v) => !v)} aria-pressed={preview}>{preview ? "Edit" : "Preview"}</button>
            </div>
            {preview ? (
              <div style={previewBox}>
                {notes.text ? <MarkdownText text={notes.text} onSeek={onSeek} onToggle={(i) => notes.setText(toggleChecklistLine(notes.text, i))} /> : <p style={muted}>Nothing yet.</p>}
              </div>
            ) : (
              <textarea ref={taRef} autoFocus value={notes.text} onChange={(e) => notes.setText(e.target.value)} placeholder={"Jot down anything that stands out…\n\nTip: start a line with “- [ ]” for a checklist. Times like 12:34 become tap-to-jump."} style={textarea} />
            )}
          </>
        ) : (
          <>
            <div style={addBox}>
              <div style={catRow}>
                {NOTE_CATEGORIES.map((c) => (
                  <button key={c.id} style={{ ...catChip, background: category === c.id ? c.color : "transparent", color: category === c.id ? c.text : "#9b7040", borderColor: category === c.id ? c.text : "#eddfc8" }} onClick={() => setCategory(c.id)} aria-pressed={category === c.id}>{c.label}</button>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input style={input} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="What stood out?" maxLength={1000} onKeyDown={(e) => e.key === "Enter" && addEntry()} aria-label="Timestamped note" />
                <button style={addBtn} onClick={addEntry} disabled={!draft.trim()}>Add at {formatTime(getTime())}</button>
              </div>
            </div>

            {notes.entries.length === 0 ? <p style={muted}>No timestamped notes yet.</p> : notes.entries.map((e) => {
              const cat = categoryOf(e.category);
              return (
                <div key={e.id} style={entryRow}>
                  <button style={timeChip} onClick={() => onSeek(e.t)} title="Jump to this moment">{formatTime(e.t)}</button>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ ...badge, background: cat.color, color: cat.text }}>{cat.label}</span>
                    {editing?.id === e.id ? (
                      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                        <input style={input} value={editing.text} onChange={(ev) => setEditing({ ...editing, text: ev.target.value })} onKeyDown={(ev) => ev.key === "Enter" && saveEdit()} autoFocus aria-label="Edit note" />
                        <button style={addBtn} onClick={saveEdit}>Save</button>
                      </div>
                    ) : (
                      <div style={{ marginTop: "4px" }}><MarkdownText text={e.text} onSeek={onSeek} /></div>
                    )}
                  </div>
                  <button style={mini} onClick={() => setEditing({ id: e.id, text: e.text })} aria-label="Edit note">✎</button>
                  <button style={mini} onClick={() => removeEntry(e)} aria-label="Delete note">✕</button>
                </div>
              );
            })}
          </>
        )}

        <label style={showRow}>
          <input type="checkbox" checked={showWhilePlaying} onChange={(e) => onToggleShow(e.target.checked)} />
          Show my notes while replaying
        </label>

        <div style={footer}>
          <button style={ghost} onClick={exportMd}>⬇ Export</button>
          <button style={ghost} onClick={() => window.print()}>🖨 Print</button>
          <button style={sheetCloseBtn} onClick={onClose}>Close</button>
        </div>
      </div>
    </>
  );
}

const status = { fontSize: "12px", color: "#166534", fontFamily: "sans-serif" };
const tabs = { display: "flex", gap: "8px", marginBottom: "10px" };
const tabBtn = { flex: 1, padding: "9px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const tabOn = { background: "#fde8b8", borderColor: "#e5c27a", fontWeight: "600" };
const toolbar = { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" };
const tool = { minWidth: "38px", height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#5c3a1e", fontSize: "14px", cursor: "pointer", fontFamily: "sans-serif" };
const toolOn = { background: "#fde8b8" };
const textarea = { width: "100%", boxSizing: "border-box", minHeight: "200px", padding: "12px", borderRadius: "12px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", resize: "vertical", outline: "none" };
const previewBox = { minHeight: "120px", padding: "12px", borderRadius: "12px", border: "1px solid #eddfc8", background: "#fdf8f3" };
const muted = { margin: "8px 0", fontSize: "13px", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic" };
const addBox = { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" };
const catRow = { display: "flex", gap: "6px", flexWrap: "wrap" };
const catChip = { padding: "5px 10px", borderRadius: "999px", border: "1px solid", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const input = { flex: 1, minWidth: 0, padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200" };
const addBtn = { padding: "10px 14px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const entryRow = { display: "flex", gap: "8px", alignItems: "flex-start", padding: "10px 0", borderTop: "1px solid #f0e4d0" };
const timeChip = { padding: "6px 10px", borderRadius: "999px", border: "none", background: "#fde8b8", color: "#7a4f10", fontSize: "12px", fontWeight: "600", cursor: "pointer", fontFamily: "sans-serif", flexShrink: 0 };
const badge = { display: "inline-block", padding: "2px 8px", borderRadius: "999px", fontSize: "10px", fontFamily: "sans-serif", fontWeight: "600" };
const mini = { width: "30px", height: "30px", borderRadius: "50%", border: "none", background: "#f4e7d4", color: "#7a4f10", cursor: "pointer", fontSize: "12px", flexShrink: 0 };
const showRow = { display: "flex", alignItems: "center", gap: "8px", margin: "14px 0 10px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", cursor: "pointer" };
const footer = { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" };
const ghost = { padding: "10px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
