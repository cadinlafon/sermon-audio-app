import UploadProgress from "../../components/UploadProgress";
import { useRef, useState } from "react";
import { db } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { uploadPrivateAudio } from "../../utils/privateAudioUpload";
import { getNextAudioOrder } from "../../utils/audioOrder";
import { createTranscriptionCopy } from "../../utils/transcodeForTranscription";
import {
  expandToAudioFiles,
  filesFromDataTransferItems,
  guessTitleFromFileName,
  detectAudioDuration,
} from "../../utils/bulkAudioIntake";
import { useModulePermissions } from "../../hooks/usePermissions";
import { useAdminPin } from "../../context/AdminPinContext";

const fmt = (s) => (s == null ? "—" : `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`);

export default function BulkUploadAudio({ speakers }) {
  const perms = useModulePermissions("upload");
  const pinCtx = useAdminPin();
  const requirePin = pinCtx?.requirePin || (async () => true);
  const [items, setItems] = useState([]);
  const [defaultSpeaker, setDefaultSpeaker] = useState("");
  const [defaultType, setDefaultType] = useState("sermon");
  const [dragOver, setDragOver] = useState(false);
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState(null);

  const filesInputRef = useRef();
  const folderInputRef = useRef();

  //////////////////////////////////////////////////
  // ADD FILES
  //////////////////////////////////////////////////
  const addFiles = async (rawFiles) => {
    if (!rawFiles || rawFiles.length === 0) return;

    const audioFiles = await expandToAudioFiles(rawFiles);
    if (audioFiles.length === 0) {
      alert("No audio files (MP3, M4A, WAV, OGG, AAC, FLAC) were found in what you selected.");
      return;
    }

    const newItems = audioFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      fileName: file.name,
      title: guessTitleFromFileName(file.name),
      speaker: defaultSpeaker,
      type: defaultType,
      duration: null,
      status: "pending", // pending | uploading | done | error
      progress: null,
      error: null,
    }));

    setItems((prev) => [...prev, ...newItems]);
    setSummary(null);

    newItems.forEach((item) => {
      detectAudioDuration(item.file).then((duration) => {
        updateItem(item.id, { duration });
      });
    });
  };

  const updateItem = (id, patch) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const removeItem = (id) => setItems((prev) => prev.filter((it) => it.id !== id));

  const clearCompleted = () => setItems((prev) => prev.filter((it) => it.status !== "done"));
  const clearAll = () => {
    if (items.some((it) => it.status === "uploading")) return;
    if (!window.confirm("Remove all files from this batch?")) return;
    setItems([]);
    setSummary(null);
  };

  //////////////////////////////////////////////////
  // DROP ZONE
  //////////////////////////////////////////////////
  const handleDrop = async (e) => {
    e.preventDefault();
    setDragOver(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      const expanded = await filesFromDataTransferItems(e.dataTransfer.items);
      if (expanded.length > 0) {
        await addFiles(expanded);
        return;
      }
    }

    await addFiles(Array.from(e.dataTransfer.files || []));
  };

  //////////////////////////////////////////////////
  // BULK-APPLY CONTROLS
  //////////////////////////////////////////////////
  const applySpeakerToAll = () => {
    if (!defaultSpeaker) return;
    setItems((prev) => prev.map((it) => (it.status === "pending" ? { ...it, speaker: defaultSpeaker } : it)));
  };

  const applyTypeToAll = () => {
    setItems((prev) => prev.map((it) => (it.status === "pending" ? { ...it, type: defaultType } : it)));
  };

  const resetTitlesFromFilenames = () => {
    setItems((prev) =>
      prev.map((it) => (it.status === "pending" ? { ...it, title: guessTitleFromFileName(it.fileName) } : it))
    );
  };

  //////////////////////////////////////////////////
  // UPLOAD ALL
  //////////////////////////////////////////////////
  const uploadAll = async () => {
    if (!perms.requireEdit()) return;
    const toUpload = items.filter((it) => it.status === "pending" || it.status === "error");
    if (toUpload.length === 0) return;

    const missing = toUpload.filter((it) => !it.title.trim() || !it.speaker);
    if (missing.length > 0) {
      alert(`${missing.length} file(s) are missing a title or speaker. Please fill those in before uploading.`);
      return;
    }
    if (!(await requirePin("uploadAudio"))) return;

    setRunning(true);
    setSummary(null);

    let nextOrder = await getNextAudioOrder();
    let succeeded = 0;
    let failed = 0;

    for (const item of toUpload) {
      updateItem(item.id, { status: "uploading", progress: null, error: null });

      try {
        const audioStorageKey = await uploadPrivateAudio(item.file, (pct) => updateItem(item.id, { progress: pct }));

        // A smaller, speech-optimized copy for AI summaries — same
        // best-effort approach as the single-file uploader: never lets
        // a transcode failure fail the actual upload.
        let transcribeStorageKey = null;
        try {
          const transcodeFile = await createTranscriptionCopy(item.file);
          transcribeStorageKey = await uploadPrivateAudio(transcodeFile, () => {});
        } catch (transcodeErr) {
          console.warn(`Couldn't create a transcription-optimized copy for ${item.fileName}`, transcodeErr);
        }

        await addDoc(collection(db, "audio"), {
          title: item.title.trim(),
          speaker: item.speaker,
          type: item.type,
          duration: item.duration,
          audioStorageKey,
          ...(transcribeStorageKey ? { transcribeStorageKey } : {}),
          order: nextOrder++,
          createdAt: serverTimestamp(),
        });

        updateItem(item.id, { status: "done", progress: 100 });
        succeeded++;
      } catch (err) {
        console.error(`Bulk upload failed for ${item.fileName}:`, err);
        updateItem(item.id, { status: "error", error: err.message || "Upload failed." });
        failed++;
      }
    }

    setRunning(false);
    setSummary({ succeeded, failed });
  };

  const pendingCount = items.filter((it) => it.status === "pending" || it.status === "error").length;
  const doneCount = items.filter((it) => it.status === "done").length;

  return (
    <div style={card}>
      {/* DROP ZONE */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        style={{ ...dropZone, ...(dragOver ? dropZoneActive : {}) }}
      >
        <div style={dropIcon}>🗂️</div>
        <div style={dropText}>Drag & drop a .zip, a folder, or several audio files here</div>
        <div style={dropHint}>MP3, M4A, WAV, OGG, AAC, or FLAC</div>

        <div style={browseRow}>
          <button style={browseBtn} onClick={() => filesInputRef.current.click()}>Choose Files</button>
          <button style={browseBtn} onClick={() => folderInputRef.current.click()}>Choose Folder</button>
        </div>

        <input
          ref={filesInputRef}
          type="file"
          multiple
          accept="audio/*,.zip"
          style={{ display: "none" }}
          onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          webkitdirectory=""
          directory=""
          style={{ display: "none" }}
          onChange={(e) => { addFiles(Array.from(e.target.files || [])); e.target.value = ""; }}
        />
      </div>

      {items.length > 0 && (
        <>
          {/* BULK-APPLY BAR */}
          <div style={bulkApplyBar}>
            <div style={bulkApplyGroup}>
              <select value={defaultSpeaker} onChange={(e) => setDefaultSpeaker(e.target.value)} style={selectSm}>
                <option value="">Speaker…</option>
                {speakers.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button style={applyBtn} onClick={applySpeakerToAll} disabled={!defaultSpeaker}>Apply to all</button>
            </div>

            <div style={bulkApplyGroup}>
              <select value={defaultType} onChange={(e) => setDefaultType(e.target.value)} style={selectSm}>
                <option value="sermon">Sermon</option>
                <option value="homily">Homily</option>
                <option value="sundayschool">Sunday School</option>
              </select>
              <button style={applyBtn} onClick={applyTypeToAll}>Apply to all</button>
            </div>

            <button style={applyBtn} onClick={resetTitlesFromFilenames}>Reset titles from filenames</button>
          </div>

          {/* TABLE */}
          <div style={tableWrap}>
            {items.map((item) => (
              <div key={item.id} style={row}>
                <div style={rowMain}>
                  <input
                    value={item.title}
                    onChange={(e) => updateItem(item.id, { title: e.target.value })}
                    disabled={item.status === "uploading" || item.status === "done"}
                    style={rowInput}
                    placeholder="Title"
                  />

                  <select
                    value={item.speaker}
                    onChange={(e) => updateItem(item.id, { speaker: e.target.value })}
                    disabled={item.status === "uploading" || item.status === "done"}
                    style={rowSelect}
                  >
                    <option value="">Speaker…</option>
                    {speakers.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>

                  <select
                    value={item.type}
                    onChange={(e) => updateItem(item.id, { type: e.target.value })}
                    disabled={item.status === "uploading" || item.status === "done"}
                    style={rowSelect}
                  >
                    <option value="sermon">Sermon</option>
                    <option value="homily">Homily</option>
                    <option value="sundayschool">Sunday School</option>
                  </select>

                  <span style={rowDuration}>{fmt(item.duration)}</span>

                  <StatusPill item={item} />

                  {item.status !== "uploading" && item.status !== "done" && (
                    <button style={rowRemoveBtn} onClick={() => removeItem(item.id)} title="Remove">✕</button>
                  )}
                </div>

                <div style={rowFileName}>{item.fileName}</div>

                {item.status === "uploading" && (
                  <div style={{ marginTop: "8px" }}>
                    <UploadProgress percent={item.progress} totalBytes={item.file?.size} compact label={item.fileName} />
                  </div>
                )}

                {item.status === "error" && <div style={rowErrorText}>{item.error}</div>}
              </div>
            ))}
          </div>

          {/* FOOTER */}
          <div style={footerRow}>
            <div style={footerCounts}>
              {doneCount > 0 && <span style={doneCountText}>{doneCount} uploaded</span>}
              <span>{pendingCount} ready</span>
              {doneCount > 0 && <button style={ghostBtn} onClick={clearCompleted}>Clear completed</button>}
              <button style={ghostBtn} onClick={clearAll} disabled={running}>Clear all</button>
            </div>

            <button
              onClick={uploadAll}
              disabled={running || pendingCount === 0 || !perms.canEdit}
              style={running || pendingCount === 0 || !perms.canEdit ? { ...uploadAllBtn, opacity: 0.5 } : uploadAllBtn}
            >
              {running ? "Uploading…" : `🚀 Upload ${pendingCount || ""} File${pendingCount === 1 ? "" : "s"}`}
            </button>
          </div>

          {summary && (
            <p style={summaryText}>
              {summary.succeeded} uploaded successfully
              {summary.failed > 0 ? `, ${summary.failed} failed — fix and retry below.` : "."}
            </p>
          )}
        </>
      )}
    </div>
  );
}

function StatusPill({ item }) {
  if (item.status === "done") return <span style={{ ...statusPill, background: "#dcfce7", color: "#166534" }}>Done</span>;
  if (item.status === "uploading") return <span style={{ ...statusPill, background: "#e8f0fe", color: "#2a5ab5" }}>{item.progress ?? 0}%</span>;
  if (item.status === "error") return <span style={{ ...statusPill, background: "#fee2e2", color: "#991b1b" }}>Failed</span>;
  return <span style={{ ...statusPill, background: "#f6e4b0", color: "#7a5a10" }}>Ready</span>;
}

////////////////////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////////////////////

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
};

const dropZone = {
  border: "2px dashed #eddfc8",
  borderRadius: "14px",
  padding: "32px 20px",
  background: "#fdf8f3",
  transition: "border-color 0.2s",
  textAlign: "center",
};

const dropZoneActive = { borderColor: "#c97c2e", background: "#fef3e2" };
const dropIcon = { fontSize: "30px", marginBottom: "8px" };
const dropText = { fontSize: "14px", fontFamily: "sans-serif", color: "#5c3a1e", marginBottom: "4px" };
const dropHint = { fontSize: "12px", fontFamily: "sans-serif", color: "#b08050", marginBottom: "16px" };

const browseRow = { display: "flex", gap: "10px", justifyContent: "center" };
const browseBtn = { padding: "9px 16px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };

const bulkApplyBar = { display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center", borderTop: "1px solid #eddfc8", borderBottom: "1px solid #eddfc8", padding: "14px 0" };
const bulkApplyGroup = { display: "flex", gap: "6px" };
const selectSm = { padding: "7px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "12px", fontFamily: "sans-serif", color: "#3d2200" };
const applyBtn = { padding: "7px 12px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };

const tableWrap = { display: "flex", flexDirection: "column", gap: "10px", maxHeight: "480px", overflowY: "auto" };

const row = { border: "1px solid #eddfc8", borderRadius: "12px", padding: "12px 14px", background: "#fdf8f3" };
const rowMain = { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" };
const rowInput = { flex: "2 1 180px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };
const rowSelect = { flex: "1 1 130px", padding: "8px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "12px", fontFamily: "sans-serif", color: "#3d2200" };
const rowDuration = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", minWidth: "40px" };
const rowRemoveBtn = { border: "none", background: "transparent", color: "#b3432c", fontSize: "13px", cursor: "pointer", padding: "4px 6px" };
const rowFileName = { fontSize: "11px", fontFamily: "sans-serif", color: "#b08050", marginTop: "6px" };

const statusPill = { fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", fontFamily: "sans-serif", whiteSpace: "nowrap" };

const rowProgressTrack = { height: "5px", background: "#eddfc8", borderRadius: "999px", overflow: "hidden", marginTop: "8px" };
const rowProgressFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)", borderRadius: "999px", transition: "width 0.2s ease-out" };
const rowErrorText = { fontSize: "11px", fontFamily: "sans-serif", color: "#b3432c", marginTop: "6px" };

const footerRow = { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" };
const footerCounts = { display: "flex", gap: "12px", alignItems: "center", fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040" };
const doneCountText = { color: "#166534", fontWeight: "600" };
const ghostBtn = { padding: "6px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };

const uploadAllBtn = { padding: "13px 22px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)", color: "#fff8ee", fontSize: "15px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 12px rgba(160,80,20,0.28)" };

const summaryText = { fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", textAlign: "center", margin: 0 };
