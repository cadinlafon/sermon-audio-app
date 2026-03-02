import { useState } from "react";
import { db, storage } from "../../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";

export default function UploadAudio() {
  const [title, setTitle] = useState("");
  const [speaker, setSpeaker] = useState("");
  const [type, setType] = useState("sermon");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file || !title) {
      alert("Title and file are required.");
      return;
    }

    setUploading(true);

    try {
      // 🔥 Upload file to Firebase Storage
      const storageRef = ref(
        storage,
        `audio/${Date.now()}_${file.name}`
      );

      await uploadBytes(storageRef, file);

      const downloadURL = await getDownloadURL(storageRef);

      // 🔥 Save metadata to Firestore
      await addDoc(collection(db, "audio"), {
        title,
        speaker,
        type,
        audioURL: downloadURL,
        createdAt: serverTimestamp(),
      });

      // Reset form
      setTitle("");
      setSpeaker("");
      setType("sermon");
      setFile(null);

      alert("Upload successful 🎉");
    } catch (error) {
      console.error("Upload error:", error);
      alert("Upload failed. Check console.");
    }

    setUploading(false);
  };

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

      <input
        type="text"
        placeholder="Speaker"
        value={speaker}
        onChange={(e) => setSpeaker(e.target.value)}
        style={inputStyle}
      />

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={inputStyle}
      >
        <option value="sermon">Sermon</option>
        <option value="homily">Homily</option>
        <option value="sundayschool">Sunday School</option>
      </select>

      <input
        type="file"
        accept="audio/mpeg,audio/mp3"
        onChange={(e) => setFile(e.target.files[0])}
        style={{ marginBottom: "20px" }}
      />

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

const inputStyle = {
  width: "100%",
  padding: "10px",
  marginBottom: "15px",
  borderRadius: "6px",
  border: "1px solid #ccc",
};

const buttonStyle = {
  padding: "10px 18px",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "#111827",
  color: "white",
  cursor: "pointer",
};