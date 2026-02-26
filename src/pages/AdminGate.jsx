import { useState } from "react";
import { db, storage } from "../firebase";import {
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
    <div style={{ padding: "40px", maxWidth: "500px" }}>
      <h2>Upload Audio</h2>

      <input
        type="text"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <input
        type="text"
        placeholder="Speaker"
        value={speaker}
        onChange={(e) => setSpeaker(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      />

      <select
        value={type}
        onChange={(e) => setType(e.target.value)}
        style={{ width: "100%", marginBottom: "10px" }}
      >
        <option value="sermon">Sermon</option>
        <option value="homily">Homily</option>
        <option value="sundayschool">Sunday School</option>
      </select>

      <input
        type="file"
        accept="audio/*"
        onChange={(e) => setFile(e.target.files[0])}
        style={{ marginBottom: "15px" }}
      />

      <button
        onClick={handleUpload}
        disabled={uploading}
        style={{ padding: "8px 14px" }}
      >
        {uploading ? "Uploading..." : "Upload"}
      </button>
    </div>
  );
}