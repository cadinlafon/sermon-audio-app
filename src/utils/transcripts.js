import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { supabase } from "../supabase";
import { formatTime } from "./notes";

export async function fetchTranscript(audioId) {
  const snap = await getDoc(doc(db, "transcripts", audioId));
  if (!snap.exists()) return null;
  const d = snap.data();
  return {
    segments: Array.isArray(d.segments) ? d.segments : [],
    sections: Array.isArray(d.sections) ? d.sections : [],
    topics: Array.isArray(d.topics) ? d.topics : [],
    edits: d.edits && typeof d.edits === "object" ? d.edits : {},
    speakerLabels: d.speakerLabels && typeof d.speakerLabels === "object" ? d.speakerLabels : {},
  };
}

// Asks the edge function to transcribe (once — it never re-transcribes) and
// generate sections. Same audio-URL handling as AI summaries.
export async function generateTranscript(audio, { mode = "transcript", force = false } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Sign in to generate a transcript.");
  const token = await user.getIdToken();
  let audioUrl = audio.audioURL;
  const key = audio.transcribeStorageKey || audio.audioStorageKey;
  if (mode !== "sections" && key) {
    const { data, error } = await supabase.functions.invoke("audio-download-url", { headers: { Authorization: `Bearer ${token}` }, body: { storageKey: key } });
    if (error || !data?.url) throw new Error((await error?.context?.json().catch(() => null))?.error || "Audio is unavailable.");
    audioUrl = data.url;
  }
  const { data, error } = await supabase.functions.invoke("summarize-audio", {
    headers: { Authorization: `Bearer ${token}` },
    body: { audioId: audio.id, audioUrl, audioType: audio.type, title: audio.title || "Untitled audio", mode, force },
  });
  if (error) throw new Error((await error.context?.json().catch(() => null))?.error || error.message);
  if (data?.pending) throw new Error(data.error || "This transcript is being generated — check back in a moment.");
  return data;
}

// Admin corrections: original segments are never overwritten — edits are
// stored beside them, keyed by the paragraph's first segment index.
export async function saveTranscriptEdits(audioId, { edits, speakerLabels }) {
  await setDoc(doc(db, "transcripts", audioId), { edits, speakerLabels, editedAt: serverTimestamp() }, { merge: true });
}

////////////////////////////////////////////////////////////////
// STRUCTURE
////////////////////////////////////////////////////////////////

// Group Whisper's short segments into readable paragraphs: break at long
// pauses, or at a sentence end once a paragraph has some length.
export function toParagraphs(segments) {
  const paragraphs = [];
  let cur = null;
  segments.forEach((seg, i) => {
    const gap = cur ? seg.start - cur.end : 0;
    const endsSentence = cur && /[.!?]["')\]]*$/.test(cur.segments[cur.segments.length - 1].text.trim());
    const tooLong = cur && (cur.end - cur.start > 50 || cur.chars > 420);
    if (!cur || gap > 2.5 || (endsSentence && tooLong)) {
      cur = { index: i, start: seg.start, end: seg.end, chars: 0, segments: [] };
      paragraphs.push(cur);
    }
    cur.segments.push({ ...seg, i });
    cur.end = seg.end;
    cur.chars += seg.text.length;
  });
  return paragraphs;
}

const STOP = new Set("the a an and or but if then so of to in on at for with as by from is are was were be been being it its this that these those i you he she we they them his her our your my me not no yes do does did have has had will would can could should just about into over out up down there here what which who whom when where why how all any some more most very than too also like one two really because want know going get got say said see make come back only even still well much many way thing things lord god".split(" "));

// Most frequent meaningful words — a quick, offline "what's this about".
export function detectTopics(segments, limit = 8) {
  const counts = new Map();
  for (const seg of segments) {
    for (const w of seg.text.toLowerCase().match(/[a-z']{4,}/g) || []) {
      if (!STOP.has(w)) counts.set(w, (counts.get(w) || 0) + 1);
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 3).sort((a, b) => b[1] - a[1]).slice(0, limit).map(([w, n]) => ({ word: w, count: n }));
}

////////////////////////////////////////////////////////////////
// EXPORT
////////////////////////////////////////////////////////////////
export function transcriptToText(title, speaker, paragraphs, textOf, labelOf) {
  return [`${title}${speaker ? ` — ${speaker}` : ""}`, "", ...paragraphs.map((p) => `[${formatTime(p.start)}] ${labelOf(p) ? `${labelOf(p)}: ` : ""}${textOf(p)}`)].join("\n\n");
}

const srtTime = (t) => {
  const ms = Math.round((t % 1) * 1000); const s = Math.floor(t);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)},${p(ms, 3)}`;
};
export const transcriptToSrt = (segments) => segments.map((s, i) => `${i + 1}\n${srtTime(s.start)} --> ${srtTime(s.end)}\n${s.text}\n`).join("\n");
