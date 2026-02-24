import { useState } from "react";
import { db, storage } from "../../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function UploadAudio() {
  const [type, setType] = useState("sermon");
  const [pastor, setPastor] = useState("");
  const [title, setTitle] = useState("");
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!file) return alert("Please select an audio file.");

    setLoading(true);

    try {
      // Upload file to Firebase Storage
      const storageRef = ref(storage, `audio/${Date.now()}-${file.name}`);
      await uploadBytes(storageRef, file);

      const downloadURL = await getDownloadURL(storageRef);

      // Save metadata to Firestore
      await addDoc(collection(db, "audio"), {
  title: title,
  pastor: pastor,
  type: type,
  audioUrl: downloadURL,
  createdAt: serverTimestamp()
});


      alert("Upload successful!");

      setPastor("");
      setTitle("");
      setFile(null);
    } catch (error) {
      console.error(error);
      alert("Upload failed.");
    }

    setLoading(false);
  };

  return (
    <div>
      <h1>Upload Audio</h1>

      <form onSubmit={handleSubmit} style={{ maxWidth: "500px" }}>
        <label>Audio Type</label>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          style={{ width: "100%", marginBottom: "10px" }}
        >
          <option value="sermon">Sermon</option>
          <option value="sundayschool">Sunday School</option>
          <option value="homily">Homily</option>
        </select>

        <label>Pastor Name</label>
        <input
          type="text"
          value={pastor}
          onChange={(e) => setPastor(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <label>Title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <label>Upload Audio File</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setFile(e.target.files[0])}
          required
          style={{ width: "100%", marginBottom: "10px" }}
        />

        <button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
