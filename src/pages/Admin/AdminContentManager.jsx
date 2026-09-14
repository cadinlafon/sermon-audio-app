import { useEffect, useRef, useState } from "react";
import { auth, db } from "../../firebase";
import { collection, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { supabase } from "../../supabase";
import { deletePrivateAudio, uploadPrivateAudio } from "../../utils/privateAudioUpload";
import { createTranscriptionCopy } from "../../utils/transcodeForTranscription";
import { useModulePermissions } from "../../hooks/usePermissions";
import { useAdminPin } from "../../context/AdminPinContext";

const speakers = ["Jonathan Mcintosh", "Rusty Olps", "Jason Farley", "Mark Thiele"];

function toDateInputValue(audio) {
  if (audio.date) return audio.date;
  if (audio.createdAt?.seconds) {
    return new Date(audio.createdAt.seconds * 1000).toISOString().slice(0, 10);
  }
  return "";
}

function formatDisplayDate(audio) {
  const value = audio.date || (audio.createdAt?.seconds ? new Date(audio.createdAt.seconds * 1000).toISOString().slice(0, 10) : null);
  if (!value) return "No date";
  const [y, m, d] = value.split("-");
  return `${m}/${d}/${y}`;
}

export default function AdminContentManager() {
  const perms = useModulePermissions("content");
  const pinCtx = useAdminPin();
  const requirePin = pinCtx?.requirePin || (async () => true);
  const [audioList, setAudioList] = useState([]);
  const [search, setSearch] = useState("");
  const [audioGroup, setAudioGroup] = useState("sermons");
  const [sortOrder, setSortOrder] = useState("desc");

  // Edit modal state
  const [editing, setEditing] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSpeaker, setEditSpeaker] = useState("");
  const [editType, setEditType] = useState("sermon");
  const [editDate, setEditDate] = useState("");
  const [editFile, setEditFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const editFileInputRef = useRef();

  // Backfill: generates transcription-optimized copies for audio
  // uploaded before that existed (see transcodeForTranscription.js).
  const [backfillRunning, setBackfillRunning] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(null);
  const [backfillSummary, setBackfillSummary] = useState(null);
  const backfillCancelRef = useRef(false);

  const loadAudio = async () => {
    const snapshot = await getDocs(collection(db, "audio"));
    setAudioList(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  useEffect(() => { loadAudio(); }, []);

  const filtered = audioList
    .filter((a) => audioGroup === "sermons" ? (a.type === "sermon" || a.type === "homily") : a.type === "sundayschool")
    .filter((a) => a.title?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => sortOrder === "desc" ? (b.order ?? 0) - (a.order ?? 0) : (a.order ?? 0) - (b.order ?? 0));

  const moveItem = async (index, direction) => {
    if (!perms.requireEdit()) return;
    const newList = [...filtered];
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    const curr = newList[index];
    const targ = newList[targetIndex];
    await updateDoc(doc(db, "audio", curr.id), { order: targ.order ?? 0 });
    await updateDoc(doc(db, "audio", targ.id), { order: curr.order ?? 0 });
    loadAudio();
  };

  // ── Edit ──────────────────────────────────────────
  const openEdit = (audio) => {
    setEditing(audio);
    setEditTitle(audio.title || "");
    setEditSpeaker(audio.speaker || "");
    setEditType(audio.type || "sermon");
    setEditDate(toDateInputValue(audio));
    setEditFile(null);
  };

  const closeEdit = () => { setEditing(null); setEditFile(null); };

  const saveEdit = async () => {
    if (!perms.requireEdit()) return;
    if (!editTitle || !editSpeaker) { alert("Title and speaker are required."); return; }
    setSaving(true);
    try {
      const updates = { title: editTitle, speaker: editSpeaker, type: editType, date: editDate };
      let previousStorageKey;

      if (editFile) {
        updates.audioStorageKey = await uploadPrivateAudio(editFile);
        previousStorageKey = editing.audioStorageKey;
      }

      await updateDoc(doc(db, "audio", editing.id), updates);
      // Preserve a playable existing recording if the Firestore update fails.
      // A failed cleanup only leaves an orphaned private file; it never breaks playback.
      if (previousStorageKey) await deletePrivateAudio(previousStorageKey);
      closeEdit();
      loadAudio();
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
    }
    setSaving(false);
  };

  // ── Delete ────────────────────────────────────────
  const handleDelete = async (audio) => {
    if (!perms.requireDelete()) return;
    if (!window.confirm(`Delete "${audio.title}"? This cannot be undone.`)) return;
    if (!(await requirePin("deleteAudio"))) return;
    try {
      await deletePrivateAudio(audio.audioStorageKey);
      await deleteDoc(doc(db, "audio", audio.id));
      loadAudio();
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  // ── Backfill AI transcription copies ────────────────
  const missingTranscribeCopy = audioList.filter((a) => a.audioStorageKey && !a.transcribeStorageKey);

  const runBackfill = async () => {
    if (!perms.requireEdit()) return;
    if (missingTranscribeCopy.length === 0) return;
    if (!(await requirePin("uploadAudio"))) return;

    backfillCancelRef.current = false;
    setBackfillSummary(null);
    setBackfillRunning(true);

    const items = missingTranscribeCopy;
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < items.length; i++) {
      if (backfillCancelRef.current) break;
      const item = items[i];
      const setStage = (stage) => setBackfillProgress({ index: i + 1, total: items.length, title: item.title, stage });

      // A brief pause between items — processing many in a row back-to-back
      // can trip Firestore's separate (stricter) REST-API rate limit for
      // other edge functions running around the same time, well before any
      // real usage limit is actually at risk.
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 800));

      try {
        setStage("Fetching original…");
        const token = await auth.currentUser.getIdToken();
        const { data: accessData, error: accessError } = await supabase.functions.invoke("audio-download-url", {
          headers: { Authorization: `Bearer ${token}` },
          body: { storageKey: item.audioStorageKey },
        });
        if (accessError || !accessData?.url) throw new Error(accessError?.message || "Couldn't get a download URL.");

        const audioResponse = await fetch(accessData.url);
        if (!audioResponse.ok) throw new Error("Couldn't download the original audio.");
        const blob = await audioResponse.blob();
        const file = new File([blob], item.title || "audio", { type: blob.type || "audio/mpeg" });

        const transcodeFile = await createTranscriptionCopy(file, (p) => setStage(`Compressing for AI… ${Math.round(p * 100)}%`));

        setStage("Uploading…");
        const transcribeStorageKey = await uploadPrivateAudio(transcodeFile, () => {});

        await updateDoc(doc(db, "audio", item.id), { transcribeStorageKey });
        setAudioList((list) => list.map((a) => (a.id === item.id ? { ...a, transcribeStorageKey } : a)));
        succeeded++;
      } catch (err) {
        console.error(`Backfill failed for "${item.title}"`, err);
        failed++;
      }
    }

    setBackfillRunning(false);
    setBackfillProgress(null);
    setBackfillSummary({ succeeded, failed, cancelled: backfillCancelRef.current });
  };

  const cancelBackfill = () => {
    backfillCancelRef.current = true;
  };

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Content Manager</h1>
        <p style={pageSubtitle}>Reorder, edit, or remove audio listeners see.</p>
      </div>

      {perms.canEdit && (missingTranscribeCopy.length > 0 || backfillRunning || backfillSummary) && (
        <div style={backfillCard}>
          <div style={backfillHeader}>
            <span style={{ fontSize: "18px" }}>🎙️</span>
            <div>
              <div style={backfillTitle}>AI Transcription Copies</div>
              <div style={backfillHint}>
                {backfillRunning
                  ? `Processing ${backfillProgress?.index ?? 0} of ${backfillProgress?.total ?? 0}: "${backfillProgress?.title ?? ""}" — ${backfillProgress?.stage ?? ""}`
                  : backfillSummary
                  ? `Done — ${backfillSummary.succeeded} generated${backfillSummary.failed ? `, ${backfillSummary.failed} failed` : ""}${backfillSummary.cancelled ? " (stopped early)" : ""}.`
                  : `${missingTranscribeCopy.length} recording${missingTranscribeCopy.length === 1 ? "" : "s"} uploaded before this feature don't have a small AI-transcription copy yet — long ones may hit Groq's 25MB cap.`}
              </div>
            </div>
          </div>

          {backfillRunning ? (
            <button onClick={cancelBackfill} style={backfillStopBtn}>Stop</button>
          ) : missingTranscribeCopy.length > 0 ? (
            <button onClick={runBackfill} style={backfillRunBtn}>Generate All</button>
          ) : null}
        </div>
      )}

      <div style={toolbar}>
        <select value={audioGroup} onChange={(e) => setAudioGroup(e.target.value)} style={select}>
          <option value="sermons">Sermons & Homilies</option>
          <option value="sunday">Sunday School</option>
        </select>

        <input
          placeholder="Search…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />

        <button onClick={() => setSortOrder(sortOrder === "desc" ? "asc" : "desc")} style={pillBtn}>
          {sortOrder === "desc" ? "Newest first" : "Oldest first"}
        </button>
      </div>

      <div style={list}>
        {filtered.map((audio, index) => (
          <div key={audio.id} style={card}>
            <div style={cardLeft}>
              <div style={orderBadge}>#{audio.order ?? "—"}</div>
              <div>
                <div style={cardTitle}>{audio.title}</div>
                <div style={cardSub}>{audio.speaker} · {formatDisplayDate(audio)}</div>
              </div>
            </div>
            <div style={actionGroup}>
              {perms.canEdit && (
                <>
                  <button onClick={() => moveItem(index, "up")} style={arrowBtn} title="Move up">▲</button>
                  <button onClick={() => moveItem(index, "down")} style={arrowBtn} title="Move down">▼</button>
                  <button onClick={() => openEdit(audio)} style={editBtn} title="Edit">Edit</button>
                </>
              )}
              {perms.canDelete && (
                <button onClick={() => handleDelete(audio)} style={deleteBtn} title="Delete">Delete</button>
              )}
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p style={empty}>No items match your search.</p>}
      </div>

      {/* EDIT MODAL */}
      {editing && (
        <div style={modalOverlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <h3 style={modalTitle}>Edit Audio</h3>
              <button onClick={closeEdit} style={closeBtn}>✕</button>
            </div>

            <div style={modalBody}>
              <Field label="Title">
                <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={input} />
              </Field>

              <Field label="Date">
                <input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} style={input} />
              </Field>

              <div style={row2}>
                <Field label="Speaker">
                  <select value={editSpeaker} onChange={(e) => setEditSpeaker(e.target.value)} style={input}>
                    <option value="">Select speaker…</option>
                    {speakers.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>

                <Field label="Type">
                  <select value={editType} onChange={(e) => setEditType(e.target.value)} style={input}>
                    <option value="sermon">Sermon</option>
                    <option value="homily">Homily</option>
                    <option value="sundayschool">Sunday School</option>
                  </select>
                </Field>
              </div>

              <Field label="Audio File">
                <button onClick={() => editFileInputRef.current.click()} style={outlineBtn}>
                  {editFile ? "Change selected file" : "Replace audio file…"}
                </button>
                <input
                  ref={editFileInputRef}
                  type="file"
                  accept="audio/mpeg,audio/mp3"
                  style={{ display: "none" }}
                  onChange={(e) => setEditFile(e.target.files[0])}
                />
                {editFile && <div style={fileNameHint}>Selected: {editFile.name}</div>}
                {!editFile && <div style={fileNameHint}>Leave blank to keep the current audio file.</div>}
              </Field>

              <button onClick={saveEdit} disabled={saving} style={saving ? { ...saveBtn, opacity: 0.6 } : saveBtn}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const page = { maxWidth: "800px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const backfillCard = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap",
  background: "#fffbee", border: "1px solid #f0d898", borderRadius: "14px",
  padding: "14px 18px", marginBottom: "18px",
};
const backfillHeader = { display: "flex", gap: "12px", alignItems: "flex-start" };
const backfillTitle = { fontSize: "14px", color: "#3d2200", fontFamily: "'Georgia', serif", marginBottom: "3px" };
const backfillHint = { fontSize: "12px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.5 };
const backfillRunBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "none", flexShrink: 0,
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};
const backfillStopBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "1px solid #f0b4b4", flexShrink: 0,
  background: "transparent", color: "#c23c3c", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
};

const toolbar = { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" };

const select = {
  padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8",
  background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200",
};

const searchInput = {
  flex: 1, padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8",
  background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none",
};

const pillBtn = {
  padding: "9px 16px", borderRadius: "10px", border: "1px solid #c8922a",
  background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
};

const list = { display: "flex", flexDirection: "column", gap: "10px" };

const card = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px",
  padding: "14px 18px", boxShadow: "0 2px 8px rgba(160,100,40,0.06)", flexWrap: "wrap", gap: "10px",
};

const cardLeft = { display: "flex", alignItems: "center", gap: "14px" };

const orderBadge = {
  width: "32px", height: "32px", borderRadius: "8px",
  background: "#f6e4b0", color: "#7a5a10", fontSize: "11px",
  fontFamily: "sans-serif", display: "flex", alignItems: "center",
  justifyContent: "center", flexShrink: 0,
};

const cardTitle = { fontSize: "15px", color: "#3d2200", fontFamily: "'Georgia', serif", marginBottom: "2px" };
const cardSub = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };

const actionGroup = { display: "flex", gap: "6px", flexWrap: "wrap" };

const arrowBtn = {
  width: "32px", height: "32px", borderRadius: "8px",
  border: "1px solid #eddfc8", background: "#fdf8f3",
  color: "#7a4f10", cursor: "pointer", fontSize: "12px",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const editBtn = {
  padding: "0 14px", height: "32px", borderRadius: "8px",
  border: "1px solid #c8922a", background: "transparent",
  color: "#7a4f10", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif",
};

const deleteBtn = {
  padding: "0 14px", height: "32px", borderRadius: "8px",
  border: "1px solid #f0b4b4", background: "transparent",
  color: "#c23c3c", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif",
};

const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "30px 0" };

// Modal
const modalOverlay = {
  position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)",
  display: "flex", justifyContent: "center", alignItems: "center",
  zIndex: 2000, padding: "20px",
};

const modal = {
  background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px",
  width: "100%", maxWidth: "440px", overflow: "hidden",
  boxShadow: "0 8px 32px rgba(40,18,0,0.25)", maxHeight: "90vh", display: "flex", flexDirection: "column",
};

const modalHeader = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "16px 20px", borderBottom: "1px solid #eddfc8", background: "#fdf8f3",
};

const modalTitle = { margin: 0, fontSize: "17px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const closeBtn = { background: "none", border: "none", fontSize: "16px", color: "#9b7040", cursor: "pointer", lineHeight: 1 };
const modalBody = { padding: "20px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };

const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };

const input = {
  padding: "10px 14px", borderRadius: "10px", border: "1px solid #eddfc8",
  background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200",
  outline: "none", width: "100%", boxSizing: "border-box",
};

const outlineBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "1px solid #c8922a",
  background: "transparent", color: "#7a4f10", fontSize: "14px",
  fontFamily: "sans-serif", cursor: "pointer", alignSelf: "flex-start",
};

const fileNameHint = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", fontStyle: "italic" };

const saveBtn = {
  padding: "11px 20px", borderRadius: "10px", border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif",
  cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};
