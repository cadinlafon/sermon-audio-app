import { useState, useRef } from "react";
import { db, storage } from "../../firebase";

import {
  collection,
  addDoc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";

import {
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from "firebase/storage";

export default function UploadAudio() {
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [type, setType] = useState("sermon");
  const [file, setFile] = useState(null);

  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const [duration, setDuration] = useState(null);

  const fileInputRef = useRef();

  //////////////////////////////////////////////////
  // ✏️ SPEAKERS
  //////////////////////////////////////////////////
  const speakers = [
    "Jonathan Mcintosh",
    "Rusty Olps",
    "Jason Farley",
    "Mark Thiele",
  ];

  //////////////////////////////////////////////////
  // 🎧 DETECT DURATION
  //////////////////////////////////////////////////
  const detectDuration = (file) => {
    const audio = document.createElement("audio");
    audio.src = URL.createObjectURL(file);

    audio.addEventListener("loadedmetadata", () => {
      const seconds = Math.floor(audio.duration);
      setDuration(seconds);
    });
  };

  //////////////////////////////////////////////////
  // FILE SELECT
  //////////////////////////////////////////////////
  const handleFileSelect = (selectedFile) => {
    if (!selectedFile) return;

    setFile(selectedFile);
    detectDuration(selectedFile);
  };

  //////////////////////////////////////////////////
  // DRAG EVENTS
  //////////////////////////////////////////////////
  const handleDrop = (e) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    handleFileSelect(droppedFile);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  //////////////////////////////////////////////////
  // 🔥 GET NEXT ORDER (KEY FEATURE)
  //////////////////////////////////////////////////
  const getNextOrder = async () => {
    const snapshot = await getDocs(collection(db, "audio"));

    let maxOrder = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.order && data.order > maxOrder) {
        maxOrder = data.order;
      }
    });

    return maxOrder + 1;
  };

  //////////////////////////////////////////////////
  // 🚀 UPLOAD
  //////////////////////////////////////////////////
  const handleUpload = async () => {
    if (!file || !title || !speaker) {
      alert("Title, speaker, and file are required.");
      return;
    }

    setUploading(true);

    try {
      const storageRef = ref(
        storage,
        `audio/${Date.now()}_${file.name}`
      );

      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        "state_changed",

        (snapshot) => {
          const percent =
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100;

          setProgress(Math.round(percent));
        },

        (error) => {
          console.error("Upload error:", error);
        },

        async () => {
          const downloadURL = await getDownloadURL(
            uploadTask.snapshot.ref
          );

          //////////////////////////////////////////////////
          // 🔥 SET ORDER (NEW GOES ON TOP)
          //////////////////////////////////////////////////
          const order = await getNextOrder();

          await addDoc(collection(db, "audio"), {
            title,
            speaker,
            type,
            duration,
            audioURL: downloadURL,
            order, // 🔥 IMPORTANT
            createdAt: serverTimestamp(),
          });

          //////////////////////////////////////////////////
          // RESET
          //////////////////////////////////////////////////
          setTitle("");
          setSpeaker("");
          setType("sermon");
          setFile(null);
          setDuration(null);
          setProgress(0);

          alert("Upload successful 🎉");
          setUploading(false);
        }
      );
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed.");
      setUploading(false);
    }
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={{ maxWidth: "600px" }}>
      <h1 style={{ marginBottom: "20px" }}>Upload Audio</h1>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={inputStyle}
      />

      {/* SPEAKER */}
      <select
        value={speaker}
        onChange={(e) => setSpeaker(e.target.value)}
        style={inputStyle}
      >
        <option value="">Select Speaker</option>

        {speakers.map((sp) => (
          <option key={sp} value={sp}>
            {sp}
          </option>
        ))}
      </select>

      {/* TYPE */}
      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={inputStyle}
      >
        <option value="sermon">Sermon</option>
        <option value="homily">Homily</option>
        <option value="sundayschool">Sunday School</option>
      </select>

      {/* DROP ZONE */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current.click()}
        style={dropZoneStyle}
      >
        {file ? (
          <>
            <div>📁 {file.name}</div>

            {duration && (
              <div style={{ fontSize: "13px", color: "#666" }}>
                Duration: {Math.floor(duration / 60)}:
                {(duration % 60).toString().padStart(2, "0")}
              </div>
            )}
          </>
        ) : (
          <div>
            Drag & Drop Audio Here
            <br />
            or click to select
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="audio/mpeg,audio/mp3"
        style={{ display: "none" }}
        onChange={(e) => handleFileSelect(e.target.files[0])}
      />

      {/* PROGRESS */}
      {uploading && (
        <>
          <div style={progressContainer}>
            <div
              style={{
                ...progressBar,
                width: `${progress}%`,
              }}
            />
          </div>

          <div style={{ marginBottom: "15px" }}>
            Uploading {progress}%
          </div>
        </>
      )}

      <button
        onClick={handleUpload}
        disabled={uploading}
        style={buttonStyle}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "15px",
  borderRadius: "6px",
  border: "1px solid #ccc",
};

const dropZoneStyle = {
  border: "2px dashed #999",
  borderRadius: "8px",
  padding: "40px",
  textAlign: "center",
  marginBottom: "20px",
  cursor: "pointer",
  backgroundColor: "#fafafa",
};

const progressContainer = {
  width: "100%",
  height: "10px",
  backgroundColor: "#eee",
  borderRadius: "6px",
  marginBottom: "10px",
};

const progressBar = {
  height: "100%",
  backgroundColor: "#10b981",
  borderRadius: "6px",
};

const buttonStyle = {
  padding: "10px 18px",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "#111827",
  color: "white",
  cursor: "pointer",
};