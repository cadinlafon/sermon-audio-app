import { collection, doc, getDoc, getDocs, query, setDoc, serverTimestamp, where } from "firebase/firestore";
import { db } from "../firebase";

// One doc per user + recording: notes/{uid}_{audioId}
//   text       general note (markdown; "- [ ]" makes a checklist)
//   entries    timestamped notes  [{ id, t, text, category, createdAt }]
//   bookmarks  saved moments      [{ id, t, label, createdAt }]
//   title/speaker  copied in so the Notes and Bookmarks pages can list them
function noteRef(userId, audioId) {
  return doc(db, "notes", `${userId}_${audioId}`);
}

export const NOTE_CATEGORIES = [
  { id: "general", label: "General", color: "#f4e7d4", text: "#7a4f10" },
  { id: "scripture", label: "Scripture", color: "#e8f0fe", text: "#2a5ab5" },
  { id: "application", label: "Application", color: "#dcfce7", text: "#166534" },
  { id: "question", label: "Question", color: "#fef3c7", text: "#92400e" },
  { id: "quote", label: "Quote", color: "#f3e8ff", text: "#6d28d9" },
  { id: "prayer", label: "Prayer", color: "#fde8d8", text: "#a3551f" },
];
export const categoryOf = (id) => NOTE_CATEGORIES.find((c) => c.id === id) || NOTE_CATEGORIES[0];

const metaOf = (audio) => (audio ? { title: audio.title || "", speaker: audio.speaker || "" } : {});

export async function fetchNoteDoc(userId, audioId) {
  const empty = { text: "", entries: [], bookmarks: [] };
  if (!userId || !audioId) return empty;
  try {
    const snap = await getDoc(noteRef(userId, audioId));
    if (!snap.exists()) return empty;
    const d = snap.data();
    return { text: d.text || "", entries: Array.isArray(d.entries) ? d.entries : [], bookmarks: Array.isArray(d.bookmarks) ? d.bookmarks : [] };
  } catch (error) {
    console.error("Unable to load notes", error);
    return empty;
  }
}

async function patch(userId, audioId, data, audio) {
  if (!userId || !audioId) return;
  try {
    await setDoc(noteRef(userId, audioId), { userId, audioId, ...metaOf(audio), ...data, updatedAt: serverTimestamp() }, { merge: true });
  } catch (error) {
    console.error("Unable to save notes", error);
  }
}

export const fetchNote = async (userId, audioId) => (await fetchNoteDoc(userId, audioId)).text;
export const fetchBookmarks = async (userId, audioId) => (await fetchNoteDoc(userId, audioId)).bookmarks;
export const saveNote = (userId, audioId, text, audio) => patch(userId, audioId, { text }, audio);
export const saveBookmarks = (userId, audioId, bookmarks, audio) => patch(userId, audioId, { bookmarks }, audio);
export const saveEntries = (userId, audioId, entries, audio) => patch(userId, audioId, { entries }, audio);

// Every note doc for this user (Notes and Bookmarks pages).
export async function fetchAllNotes(userId) {
  if (!userId) return [];
  const snap = await getDocs(query(collection(db, "notes"), where("userId", "==", userId)));
  return snap.docs.map((d) => {
    const x = d.data();
    return { id: d.id, audioId: x.audioId, title: x.title || "", speaker: x.speaker || "", text: x.text || "", entries: Array.isArray(x.entries) ? x.entries : [], bookmarks: Array.isArray(x.bookmarks) ? x.bookmarks : [] };
  });
}

////////////////////////////////////////////////////////////////
// EXPORT
////////////////////////////////////////////////////////////////
export const formatTime = (t) => {
  const s = Math.max(0, Math.floor(Number(t) || 0));
  const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};

export function notesToMarkdown(docs) {
  const out = ["# My Notes", ""];
  for (const d of docs) {
    if (!d.text && d.entries.length === 0 && d.bookmarks.length === 0) continue;
    out.push(`## ${d.title || "Recording"}${d.speaker ? ` — ${d.speaker}` : ""}`, "");
    if (d.text) out.push(d.text.trim(), "");
    if (d.entries.length) {
      out.push("### Timestamped notes", "");
      for (const e of [...d.entries].sort((a, b) => a.t - b.t)) out.push(`- **${formatTime(e.t)}** [${categoryOf(e.category).label}] ${e.text}`);
      out.push("");
    }
    if (d.bookmarks.length) {
      out.push("### Bookmarks", "");
      for (const b of [...d.bookmarks].sort((a, c) => a.t - c.t)) out.push(`- 🔖 **${formatTime(b.t)}**${b.label ? ` — ${b.label}` : ""}`);
      out.push("");
    }
  }
  return out.join("\n");
}

export function downloadText(text, filename, type = "text/plain") {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}
