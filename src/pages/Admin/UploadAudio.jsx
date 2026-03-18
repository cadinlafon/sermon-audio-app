import { useState, useRef } from "react";
import { db, storage } from "../../firebase";

import {
collection,
addDoc,
serverTimestamp,
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

// ✏️ CHANGE SPEAKER NAMES HERE
const speakers = [
"Jonathan Mcintosh", // ✏️ change name
"Rusty Olps", // ✏️ change name
"Jason Farley",  // ✏️ change name
"Mark Thiele"  // ✏️ change name

];

// Detect duration automatically
const detectDuration = (file) => {

const audio = document.createElement("audio");

audio.src = URL.createObjectURL(file);

audio.addEventListener("loadedmetadata", () => {

const seconds = Math.floor(audio.duration);

setDuration(seconds);
});
};

// File selected
const handleFileSelect = (selectedFile) => {

if (!selectedFile) return;

setFile(selectedFile);

detectDuration(selectedFile);
};

// Drag events
const handleDrop = (e) => {
e.preventDefault();

const droppedFile = e.dataTransfer.files[0];

handleFileSelect(droppedFile);
};

const handleDragOver = (e) => {
e.preventDefault();
};

// Upload
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

const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

await addDoc(collection(db, "audio"), {
title,
speaker,
type,
duration,
audioURL: downloadURL,
createdAt: serverTimestamp(),
});

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

{/* SPEAKER DROPDOWN */}

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

<select
value={type}
onChange={(e) => setType(e.target.value)}
style={inputStyle}
>
<option value="sermon">Sermon</option>
<option value="homily">Homily</option>
<option value="sundayschool">Sunday School</option>
</select>

{/* Drag & Drop Area */}

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
Drag & Drop Audio Here<br />
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

{/* Progress Bar */}

{uploading && (
<div style={progressContainer}>
<div
style={{
...progressBar,
width: `${progress}%`
}}
/>
</div>
)}

{uploading && (
<div style={{ marginBottom: "15px" }}>
Uploading {progress}%
</div>
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