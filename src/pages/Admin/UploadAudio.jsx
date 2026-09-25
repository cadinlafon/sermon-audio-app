import { useState, useRef } from "react";
import { db } from "../../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { uploadPrivateAudio } from "../../utils/privateAudioUpload";
import { getNextAudioOrder } from "../../utils/audioOrder";
import { createTranscriptionCopy } from "../../utils/transcodeForTranscription";
import BulkUploadAudio from "./BulkUploadAudio";
import UploadProgress from "../../components/UploadProgress";
import { useModulePermissions } from "../../hooks/usePermissions";
import { useAdminPin } from "../../context/AdminPinContext";

const speakers = ["Jonathan Mcintosh", "Rusty Olps", "Jason Farley", "Mark Thiele"];

export default function UploadAudio() {
  const perms = useModulePermissions("upload");
  const pinCtx = useAdminPin();
  const requirePin = pinCtx?.requirePin || (async () => true);
  const [mode, setMode] = useState("single");
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [type, setType] = useState("sermon");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [duration, setDuration] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [transcodeStatus, setTranscodeStatus] = useState("");
  const fileInputRef = useRef();

  const detectDuration = (f) => {
    const audio = document.createElement("audio");
    const objectUrl = URL.createObjectURL(f);
    audio.src = objectUrl;
    audio.addEventListener("loadedmetadata", () => {
      setDuration(Number.isFinite(audio.duration) ? Math.floor(audio.duration) : null);
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
    audio.addEventListener("error", () => {
      setDuration(null);
      URL.revokeObjectURL(objectUrl);
    }, { once: true });
  };

  const handleFileSelect = (f) => {
    if (!f) return;
    if (!f.type.startsWith("audio/")) {
      alert("Please choose an audio file.");
      return;
    }
    setFile(f);
    detectDuration(f);
  };

  const handleUpload = async () => {
    if (!perms.requireEdit()) return;
    if (!file || !title || !speaker) { alert("Title, speaker, and file are required."); return; }
    if (!(await requirePin("uploadAudio"))) return;
    setUploading(true);
    setProgress(null);
    try {
      const audioStorageKey = await uploadPrivateAudio(file, setProgress);

      setProgress(100);

      // A smaller, speech-optimized copy for AI summaries — keeps long
      // sermons under Groq's 25MB transcription cap. Best-effort: if
      // this fails for any reason, the upload still succeeds and AI
      // summaries just fall back to the original file (same as before
      // this existed).
      let transcribeStorageKey = null;
      try {
        setTranscodeStatus("Preparing AI transcription copy…");
        const transcodeFile = await createTranscriptionCopy(file, (p) => {
          setTranscodeStatus(`Preparing AI transcription copy… ${Math.round(p * 100)}%`);
        });
        transcribeStorageKey = await uploadPrivateAudio(transcodeFile, () => {});
      } catch (transcodeErr) {
        console.warn("Couldn't create a transcription-optimized copy; AI summaries will use the original file", transcodeErr);
      }
      setTranscodeStatus("");

      const order = await getNextAudioOrder();
      await addDoc(collection(db, "audio"), {
        title,
        speaker,
        type,
        duration,
        audioStorageKey,
        ...(transcribeStorageKey ? { transcribeStorageKey } : {}),
        order,
        createdAt: serverTimestamp(),
      });

      setTitle(""); setSpeaker(""); setType("sermon"); setFile(null); setDuration(null);
      alert("Upload successful 🎉");
    } catch (err) {
      console.error(err);
      alert("Upload failed.");
    }
    setUploading(false);
    setProgress(null);
    setTranscodeStatus("");
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Upload Audio</h1>
        <p style={pageSubtitle}>Add a new sermon, homily, or Sunday School lesson.</p>
      </div>

      <div style={modeRow}>
        <button
          style={mode === "single" ? { ...modeBtn, ...modeBtnActive } : modeBtn}
          onClick={() => setMode("single")}
        >
          Single Upload
        </button>
        <button
          style={mode === "bulk" ? { ...modeBtn, ...modeBtnActive } : modeBtn}
          onClick={() => setMode("bulk")}
        >
          Bulk Upload
        </button>
      </div>

      {mode === "bulk" && <BulkUploadAudio speakers={speakers} />}

      {mode === "single" && (
      <div style={card}>
        <div style={fieldGroup}>
          <label style={fieldLabel}>Title</label>
          <input
            placeholder="e.g. The Good Shepherd"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={input}
          />
        </div>

        <div style={row2}>
          <div style={fieldGroup}>
            <label style={fieldLabel}>Speaker</label>
            <select value={speaker} onChange={(e) => setSpeaker(e.target.value)} style={input}>
              <option value="">Select speaker…</option>
              {speakers.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div style={fieldGroup}>
            <label style={fieldLabel}>Type</label>
            <select value={type} onChange={(e) => setType(e.target.value)} style={input}>
              <option value="sermon">Sermon</option>
              <option value="homily">Homily</option>
              <option value="sundayschool">Sunday School</option>
            </select>
          </div>
        </div>

        {/* DROP ZONE */}
        <div style={fieldGroup}>
          <label style={fieldLabel}>Audio File</label>
          <div
            onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileSelect(e.dataTransfer.files[0]); }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current.click()}
            style={{ ...dropZone, ...(dragOver ? dropZoneActive : {}) }}
          >
            {file ? (
              <div style={{ textAlign: "center" }}>
                <div style={dropIcon}>🎵</div>
                <div style={dropFileName}>{file.name}</div>
                {duration && <div style={dropDuration}>Duration: {fmt(duration)}</div>}
              </div>
            ) : (
              <div style={{ textAlign: "center" }}>
                <div style={dropIcon}>📁</div>
                <div style={dropText}>Drag & drop your audio file here</div>
                <div style={dropHint}>or click to browse — MP3, M4A, WAV, or OGG</div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => handleFileSelect(e.target.files[0])} />
        </div>

        {/* UPLOADING STATE */}
        {uploading && (
          <div style={fieldGroup}>
            <UploadProgress
              percent={transcodeStatus ? null : progress}
              totalBytes={file?.size}
              label={transcodeStatus ? transcodeStatus : progress === null ? "Preparing upload…" : progress < 100 ? `Uploading… ${progress}%` : "Finishing up…"}
            />
          </div>
        )}

        <button onClick={handleUpload} disabled={uploading || !perms.canEdit} style={uploading || !perms.canEdit ? { ...uploadBtn, opacity: 0.6 } : uploadBtn}>
          {uploading ? "Uploading…" : "🚀 Upload"}
        </button>
      </div>
      )}
    </div>
  );
}

const page = { maxWidth: "640px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

const modeRow = { display: "flex", gap: "8px", marginBottom: "20px" };
const modeBtn = { padding: "8px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const modeBtnActive = { background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", border: "none" };

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "18px",
  padding: "28px",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

const fieldGroup = { display: "flex", flexDirection: "column", gap: "6px" };
const fieldLabel = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };

const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };

const input = {
  padding: "10px 14px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  fontSize: "14px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const dropZone = {
  border: "2px dashed #eddfc8",
  borderRadius: "14px",
  padding: "36px 20px",
  cursor: "pointer",
  background: "#fdf8f3",
  transition: "border-color 0.2s",
};

const dropZoneActive = { borderColor: "#c97c2e", background: "#fef3e2" };
const dropIcon = { fontSize: "32px", marginBottom: "8px" };
const dropFileName = { fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", marginBottom: "4px" };
const dropDuration = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040" };
const dropText = { fontSize: "14px", fontFamily: "sans-serif", color: "#5c3a1e", marginBottom: "4px" };
const dropHint = { fontSize: "12px", fontFamily: "sans-serif", color: "#b08050" };

const progressTrack = { height: "8px", background: "#eddfc8", borderRadius: "999px", overflow: "hidden" };
const progressFillIndeterminate = {
  height: "100%",
  width: "40%",
  background: "linear-gradient(to right, #e08930, #c97c2e)",
  borderRadius: "999px",
  animation: "uploadSlide 1.1s ease-in-out infinite",
};
const progressFillDeterminate = {
  height: "100%",
  background: "linear-gradient(to right, #e08930, #c97c2e)",
  borderRadius: "999px",
  transition: "width 0.2s ease-out",
};
const progressLabel = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", margin: "6px 0 0", textAlign: "center" };

const uploadBtn = {
  padding: "13px",
  borderRadius: "12px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  fontSize: "15px",
  fontFamily: "sans-serif",
  cursor: "pointer",
  boxShadow: "0 3px 12px rgba(160,80,20,0.28)",
};
