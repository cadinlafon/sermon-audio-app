import { useState, useRef } from "react";
import { db, storage } from "../../firebase";
import { collection, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

const speakers = ["Jonathan Mcintosh", "Rusty Olps", "Jason Farley", "Mark Thiele"];

export default function UploadAudio() {
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [type, setType] = useState("sermon");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef();

  const detectDuration = (f) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(f);
    audio.addEventListener("loadedmetadata", () => setDuration(Math.floor(audio.duration)));
  };

  const handleFileSelect = (f) => {
    if (!f) return;
    setFile(f);
    detectDuration(f);
  };

  const getNextOrder = async () => {
    const snapshot = await getDocs(collection(db, "audio"));
    let maxOrder = 0;
    snapshot.forEach((doc) => { if (doc.data().order > maxOrder) maxOrder = doc.data().order; });
    return maxOrder + 1;
  };

  const handleUpload = async () => {
    if (!file || !title || !speaker) { alert("Title, speaker, and file are required."); return; }
    setUploading(true);
    try {
      const storageRef = ref(storage, `audio/${Date.now()}_${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on("state_changed",
        (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
        (err) => console.error(err),
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          const order = await getNextOrder();
          await addDoc(collection(db, "audio"), { title, speaker, type, duration, audioURL: downloadURL, order, createdAt: serverTimestamp() });
          setTitle(""); setSpeaker(""); setType("sermon"); setFile(null); setDuration(null); setProgress(0);
          alert("Upload successful 🎉");
          setUploading(false);
        }
      );
    } catch (err) { console.error(err); alert("Upload failed."); setUploading(false); }
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Upload Audio</h1>
        <p style={pageSubtitle}>Add a new sermon, homily, or Sunday School lesson.</p>
      </div>

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
                <div style={dropHint}>or click to browse — MP3 files only</div>
              </div>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="audio/mpeg,audio/mp3" style={{ display: "none" }} onChange={(e) => handleFileSelect(e.target.files[0])} />
        </div>

        {/* PROGRESS */}
        {uploading && (
          <div style={fieldGroup}>
            <div style={progressTrack}>
              <div style={{ ...progressFill, width: `${progress}%` }} />
            </div>
            <p style={progressLabel}>Uploading… {progress}%</p>
          </div>
        )}

        <button onClick={handleUpload} disabled={uploading} style={uploading ? { ...uploadBtn, opacity: 0.6 } : uploadBtn}>
          {uploading ? "Uploading…" : "🚀 Upload"}
        </button>
      </div>
    </div>
  );
}

const page = { maxWidth: "640px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };

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
const progressFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)", borderRadius: "999px", transition: "width 0.2s" };
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