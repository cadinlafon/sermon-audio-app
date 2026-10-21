import { useEffect, useRef, useState } from "react";
import { auth, db } from "../../firebase";
import { collection, getDocs, updateDoc, deleteDoc, doc } from "firebase/firestore";
import { supabase } from "../../supabase";
import { deletePrivateAudio, uploadPrivateAudio } from "../../utils/privateAudioUpload";
import { createTranscriptionCopy } from "../../utils/transcodeForTranscription";
import { useModulePermissions } from "../../hooks/usePermissions";
import { useAdminPin } from "../../context/AdminPinContext";
import { logAdminAction } from "../../utils/adminAudit";
import { zipSync, strToU8 } from "fflate";
import { fetchTranscript, generateTranscript, buildTranscriptText, transcriptFileBase } from "../../utils/transcripts";
import { downloadText } from "../../utils/notes";

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

  // Transcript downloads
  const [txBusyId, setTxBusyId] = useState(null);
  const [txAll, setTxAll] = useState(null); // { done, total } while running

  // Transcript creation (uses AI transcription — one recording at a time)
  const [createStatus, setCreateStatus] = useState({}); // audioId -> "working" | "done" | "failed"
  const [createRun, setCreateRun] = useState(null); // { phase, index, total, title } while "Create ALL" runs
  const [createReport, setCreateReport] = useState(null); // { created, total, failed: [{ title, reason }], cancelled }
  const createCancelRef = useRef(false);
  const creating = !!createRun || Object.values(createStatus).includes("working");

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

      logAdminAction({
        category: "content_edit",
        action: "editAudio",
        targetType: "audio",
        targetId: editing.id,
        targetLabel: editTitle,
        before: { title: editing.title, speaker: editing.speaker, type: editing.type, date: editing.date },
        after: updates,
      });

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

      logAdminAction({
        category: "content_delete",
        action: "deleteAudio",
        targetType: "audio",
        targetId: audio.id,
        targetLabel: audio.title,
        before: { title: audio.title, speaker: audio.speaker, type: audio.type, date: audio.date },
        after: null,
      });

      loadAudio();
    } catch (err) {
      console.error(err);
      alert("Failed to delete.");
    }
  };

  // ── Download transcripts ────────────────────────────
  // Never generates anything: a recording with no transcript yet is just
  // reported (generating costs AI usage, so that stays a deliberate action
  // on the transcript page).
  const downloadTranscript = async (audio) => {
    if (txBusyId || txAll) return;
    setTxBusyId(audio.id);
    try {
      const data = await fetchTranscript(audio.id);
      if (!data || data.segments.length === 0) {
        alert(`"${audio.title}" doesn't have a transcript yet. Open it from the audio's Transcript page to generate one.`);
        return;
      }
      downloadText(buildTranscriptText(audio, data), `${transcriptFileBase(audio)}-transcript.txt`);
    } catch (err) {
      console.error("Transcript download failed", err);
      alert("Couldn't download that transcript. Please try again.");
    } finally {
      setTxBusyId(null);
    }
  };

  const downloadAllTranscripts = async () => {
    if (txBusyId || txAll || audioList.length === 0) return;
    const items = [...audioList].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    if (!window.confirm(`Download transcripts for all ${items.length} recordings as one .zip?\n\nThis reads one transcript per recording (${items.length} database reads). Recordings without a transcript are skipped.`)) return;

    setTxAll({ done: 0, total: items.length });
    try {
      const files = {};
      let found = 0;
      let done = 0;
      let next = 0;
      const worker = async () => {
        while (next < items.length) {
          const audio = items[next++];
          try {
            const data = await fetchTranscript(audio.id);
            if (data && data.segments.length > 0) {
              const name = `${String(audio.order ?? 0).padStart(3, "0")}-${transcriptFileBase(audio)}-transcript.txt`.slice(0, 150);
              files[files[name] ? `${audio.id}-${name}` : name] = strToU8(buildTranscriptText(audio, data));
              found++;
            }
          } catch (err) {
            console.error(`Couldn't fetch transcript for "${audio.title}"`, err);
          }
          done++;
          setTxAll({ done, total: items.length });
        }
      };
      await Promise.all([worker(), worker(), worker(), worker()]);

      if (found === 0) {
        alert("None of the recordings have a transcript yet.");
        return;
      }
      const blob = new Blob([zipSync(files)], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `transcripts-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert(`Downloaded ${found} transcript${found === 1 ? "" : "s"}${found < items.length ? ` (${items.length - found} recording${items.length - found === 1 ? " has" : "s have"} no transcript yet)` : ""}.`);
    } catch (err) {
      console.error("Download all transcripts failed", err);
      alert("Couldn't build the transcripts download. Please try again.");
    } finally {
      setTxAll(null);
    }
  };

  // ── Create transcripts ──────────────────────────────
  const createReason = (err) => (err?.message || "Unknown error").slice(0, 200);

  const createTranscript = async (audio) => {
    if (!perms.requireEdit()) return;
    if (creating || txBusyId || txAll) return;
    setCreateReport(null);
    setCreateStatus((m) => ({ ...m, [audio.id]: "working" }));
    try {
      const existing = await fetchTranscript(audio.id);
      if (existing && existing.segments.length > 0) {
        setCreateStatus((m) => ({ ...m, [audio.id]: "done" }));
        alert(`"${audio.title}" already has a transcript — use ⬇ Transcript to download it.`);
        return;
      }
      await generateTranscript(audio);
      const fresh = await fetchTranscript(audio.id);
      if (!fresh || fresh.segments.length === 0) throw new Error("The transcript was requested but nothing came back yet. Try again in a moment.");
      setCreateStatus((m) => ({ ...m, [audio.id]: "done" }));
      alert(`Transcript created for "${audio.title}".`);
    } catch (err) {
      console.error(`Create transcript failed for "${audio.title}"`, err);
      setCreateStatus((m) => ({ ...m, [audio.id]: "failed" }));
      alert(`Couldn't create the transcript for "${audio.title}":\n${createReason(err)}`);
    }
  };

  const createAllTranscripts = async () => {
    if (!perms.requireEdit()) return;
    if (creating || txBusyId || txAll || audioList.length === 0) return;
    setCreateReport(null);
    createCancelRef.current = false;

    // 1) Find which recordings already have one (one read each) so nothing is re-transcribed.
    const everything = [...audioList].sort((a, b) => (b.order ?? 0) - (a.order ?? 0));
    setCreateRun({ phase: "checking", index: 0, total: everything.length, title: "" });
    const missing = [];
    let next = 0;
    let checked = 0;
    const checker = async () => {
      while (next < everything.length) {
        const audio = everything[next++];
        try {
          const data = await fetchTranscript(audio.id);
          if (!data || data.segments.length === 0) missing.push(audio);
        } catch (err) {
          console.error(`Couldn't check transcript for "${audio.title}"`, err);
          missing.push(audio); // unknown — attempt it; the server never re-transcribes an existing one
        }
        checked++;
        setCreateRun({ phase: "checking", index: checked, total: everything.length, title: "" });
      }
    };
    await Promise.all([checker(), checker(), checker(), checker()]);
    const queue = everything.filter((a) => missing.includes(a));

    if (queue.length === 0) {
      setCreateRun(null);
      alert("Every recording already has a transcript.");
      return;
    }
    if (!window.confirm(`Create transcripts for ${queue.length} of ${everything.length} recordings?\n\nThe other ${everything.length - queue.length} already have one and are skipped. Each one uses AI transcription and can take a minute or more, so this may take a while — keep this tab open. You can stop at any time.`)) {
      setCreateRun(null);
      return;
    }

    // 2) One at a time, with a short pause between (gentle on rate limits).
    const failed = [];
    let created = 0;
    for (let i = 0; i < queue.length; i++) {
      if (createCancelRef.current) break;
      const audio = queue[i];
      setCreateRun({ phase: "creating", index: i + 1, total: queue.length, title: audio.title });
      setCreateStatus((m) => ({ ...m, [audio.id]: "working" }));
      if (i > 0) await new Promise((resolve) => setTimeout(resolve, 800));
      try {
        await generateTranscript(audio);
        const fresh = await fetchTranscript(audio.id);
        if (!fresh || fresh.segments.length === 0) throw new Error("Requested, but no transcript came back yet.");
        created++;
        setCreateStatus((m) => ({ ...m, [audio.id]: "done" }));
      } catch (err) {
        console.error(`Create transcript failed for "${audio.title}"`, err);
        failed.push({ title: audio.title || "Untitled", reason: createReason(err) });
        setCreateStatus((m) => ({ ...m, [audio.id]: "failed" }));
      }
    }

    setCreateRun(null);
    setCreateReport({ created, total: queue.length, failed, cancelled: createCancelRef.current });
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

      <div style={downloadAllRow}>
        {perms.canEdit && (
          createRun ? (
            <button onClick={() => { createCancelRef.current = true; }} style={backfillStopBtn}>Stop</button>
          ) : (
            <button onClick={createAllTranscripts} disabled={creating || !!txAll || !!txBusyId || audioList.length === 0} style={creating ? { ...createAllBtn, opacity: 0.6 } : createAllBtn}>
              ✦ Create ALL Transcriptions
            </button>
          )
        )}
        <button onClick={downloadAllTranscripts} disabled={!!txAll || !!txBusyId || audioList.length === 0} style={txAll ? { ...downloadAllBtn, opacity: 0.6 } : downloadAllBtn}>
          {txAll ? `Collecting transcripts… ${txAll.done} / ${txAll.total}` : "⬇ Download ALL Transcripts"}
        </button>
      </div>

      {createRun && (
        <div style={createStatusBox} role="status" aria-live="polite">
          {createRun.phase === "checking"
            ? `Checking which recordings already have a transcript… ${createRun.index} / ${createRun.total}`
            : `Creating transcript ${createRun.index} of ${createRun.total}: “${createRun.title}” — keep this tab open.`}
        </div>
      )}

      {createReport && (
        <div style={createReport.failed.length ? { ...createStatusBox, ...createReportBad } : { ...createStatusBox, ...createReportOk }} role="status">
          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "flex-start" }}>
            <strong>
              {createReport.cancelled ? "Stopped — " : ""}Created {createReport.created} of {createReport.total} transcription{createReport.total === 1 ? "" : "s"}
              {createReport.failed.length > 0 ? `, ${createReport.failed.length} failed` : createReport.cancelled ? "" : " ✓"}
            </strong>
            <button onClick={() => setCreateReport(null)} style={createReportClose} aria-label="Dismiss report">✕</button>
          </div>
          {createReport.cancelled && createReport.created + createReport.failed.length < createReport.total && (
            <div style={createReportLine}>{createReport.total - createReport.created - createReport.failed.length} not attempted.</div>
          )}
          {createReport.failed.length > 0 && (
            <ul style={createFailList}>
              {createReport.failed.map((f, i) => <li key={i}><strong>{f.title}</strong> — {f.reason}</li>)}
            </ul>
          )}
        </div>
      )}

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
              <button
                onClick={() => downloadTranscript(audio)}
                disabled={!!txBusyId || !!txAll}
                style={txBusyId === audio.id ? { ...transcriptBtn, opacity: 0.6 } : transcriptBtn}
                title="Download this recording's transcript"
              >
                {txBusyId === audio.id ? "…" : "⬇ Transcript"}
              </button>
              {perms.canEdit && (
                <button
                  onClick={() => createTranscript(audio)}
                  disabled={creating || !!txBusyId || !!txAll}
                  style={createStatus[audio.id] === "working" ? { ...transcriptBtn, opacity: 0.6 } : transcriptBtn}
                  title="Create this recording's transcript with AI"
                >
                  {createStatus[audio.id] === "working" ? "Creating…" : createStatus[audio.id] === "done" ? "✓ Created" : createStatus[audio.id] === "failed" ? "⚠ Retry Transcript" : "✦ Create Transcript"}
                </button>
              )}
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
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0 };

const backfillCard = {
  display: "flex", justifyContent: "space-between", alignItems: "center", gap: "14px", flexWrap: "wrap",
  background: "var(--color-fffbee)", border: "1px solid var(--color-f0d898)", borderRadius: "14px",
  padding: "14px 18px", marginBottom: "18px",
};
const backfillHeader = { display: "flex", gap: "12px", alignItems: "flex-start" };
const backfillTitle = { fontSize: "14px", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif", marginBottom: "3px" };
const backfillHint = { fontSize: "12px", color: "var(--color-7a5530)", fontFamily: "sans-serif", lineHeight: 1.5 };
const backfillRunBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "none", flexShrink: 0,
  background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)",
  color: "var(--color-fff8ee)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};
const backfillStopBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--color-f0b4b4)", flexShrink: 0,
  background: "transparent", color: "var(--color-c23c3c)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
};

const downloadAllRow = { display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "18px" };
const createAllBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--color-c97c2e)",
  background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
};
const createStatusBox = { padding: "12px 16px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-3d2200)", fontSize: "13px", fontFamily: "sans-serif", lineHeight: 1.5, marginBottom: "18px" };
const createReportOk = { background: "var(--color-e3f5e6)", borderColor: "var(--color-bfe6c8)", color: "var(--color-2f8a4a)" };
const createReportBad = { background: "var(--color-fffbee)", borderColor: "var(--color-f0d898)" };
const createReportClose = { background: "none", border: "none", cursor: "pointer", color: "inherit", fontSize: "14px", lineHeight: 1 };
const createReportLine = { marginTop: "4px" };
const createFailList = { margin: "8px 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "var(--color-5c3a1e)" };
const downloadAllBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "none",
  background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)",
  color: "var(--color-fff8ee)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};
const transcriptBtn = {
  padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer",
};

const toolbar = { display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap" };

const select = {
  padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fffdf9)", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-3d2200)",
};

const searchInput = {
  flex: 1, padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fffdf9)", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none",
};

const pillBtn = {
  padding: "9px 16px", borderRadius: "10px", border: "1px solid var(--color-c8922a)",
  background: "transparent", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer",
};

const list = { display: "flex", flexDirection: "column", gap: "10px" };

const card = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "14px",
  padding: "14px 18px", boxShadow: "0 2px 8px rgba(160,100,40,0.06)", flexWrap: "wrap", gap: "10px",
};

const cardLeft = { display: "flex", alignItems: "center", gap: "14px" };

const orderBadge = {
  width: "32px", height: "32px", borderRadius: "8px",
  background: "var(--color-f6e4b0)", color: "var(--color-7a5a10)", fontSize: "11px",
  fontFamily: "sans-serif", display: "flex", alignItems: "center",
  justifyContent: "center", flexShrink: 0,
};

const cardTitle = { fontSize: "15px", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif", marginBottom: "2px" };
const cardSub = { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };

const actionGroup = { display: "flex", gap: "6px", flexWrap: "wrap" };

const arrowBtn = {
  width: "32px", height: "32px", borderRadius: "8px",
  border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)",
  color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "12px",
  display: "flex", alignItems: "center", justifyContent: "center",
};

const editBtn = {
  padding: "0 14px", height: "32px", borderRadius: "8px",
  border: "1px solid var(--color-c8922a)", background: "transparent",
  color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif",
};

const deleteBtn = {
  padding: "0 14px", height: "32px", borderRadius: "8px",
  border: "1px solid var(--color-f0b4b4)", background: "transparent",
  color: "var(--color-c23c3c)", cursor: "pointer", fontSize: "12px", fontFamily: "sans-serif",
};

const empty = { textAlign: "center", color: "var(--color-b08050)", fontFamily: "sans-serif", fontStyle: "italic", padding: "30px 0" };

// Modal
const modalOverlay = {
  position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)",
  display: "flex", justifyContent: "center", alignItems: "center",
  zIndex: 2000, padding: "20px",
};

const modal = {
  background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "20px",
  width: "100%", maxWidth: "440px", overflow: "hidden",
  boxShadow: "0 8px 32px rgba(40,18,0,0.25)", maxHeight: "90vh", display: "flex", flexDirection: "column",
};

const modalHeader = {
  display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "16px 20px", borderBottom: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)",
};

const modalTitle = { margin: 0, fontSize: "17px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" };
const closeBtn = { background: "none", border: "none", fontSize: "16px", color: "var(--color-9b7040)", cursor: "pointer", lineHeight: 1 };
const modalBody = { padding: "20px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", letterSpacing: "0.06em", textTransform: "uppercase" };

const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };

const input = {
  padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)",
  background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)",
  outline: "none", width: "100%", boxSizing: "border-box",
};

const outlineBtn = {
  padding: "10px 18px", borderRadius: "10px", border: "1px solid var(--color-c8922a)",
  background: "transparent", color: "var(--color-7a4f10)", fontSize: "14px",
  fontFamily: "sans-serif", cursor: "pointer", alignSelf: "flex-start",
};

const fileNameHint = { fontSize: "12px", fontFamily: "sans-serif", color: "var(--color-9b7040)", fontStyle: "italic" };

const saveBtn = {
  padding: "11px 20px", borderRadius: "10px", border: "none",
  background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)",
  color: "var(--color-fff8ee)", fontSize: "14px", fontFamily: "sans-serif",
  cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};
