import { useEffect, useState } from "react";
import { db, storage } from "../../firebase";

import {
collection,
getDocs,
deleteDoc,
doc,
updateDoc
} from "firebase/firestore";

import {
ref,
deleteObject,
uploadBytes,
getDownloadURL
} from "firebase/storage";

export default function AdminContentManager() {

const [audioList, setAudioList] = useState([]);
const [editing, setEditing] = useState(null);

const [editTitle, setEditTitle] = useState("");
const [editSpeaker, setEditSpeaker] = useState("");
const [editDate, setEditDate] = useState("");
const [newFile, setNewFile] = useState(null);

const [search, setSearch] = useState("");
const [audioType, setAudioType] = useState("sermon"); // NEW

const loadAudio = async () => {

const snapshot = await getDocs(collection(db, "audio"));

const data = snapshot.docs.map((docSnap) => ({
id: docSnap.id,
...docSnap.data()
 }));

setAudioList(data);
};

useEffect(() => {
loadAudio();
}, []);

const getStoragePathFromUrl = (url) => {

if (!url) return null;

const start = url.indexOf("/o/") + 3;
const end = url.indexOf("?");

const encodedPath = url.substring(start, end);

return decodeURIComponent(encodedPath);
};

const startEdit = (audio) => {

setEditing(audio.id);

setEditTitle(audio.title || "");
setEditSpeaker(audio.speaker || "");

if (audio.createdAt?.toDate) {
const date = audio.createdAt.toDate().toISOString().split("T")[0];
setEditDate(date);
}

setNewFile(null);
};

const saveEdit = async (audio) => {

try {

let updatedData = {
title: editTitle,
speaker: editSpeaker
};

if (editDate) {
updatedData.createdAt = new Date(editDate);
}

if (newFile) {

const oldPath = getStoragePathFromUrl(audio.audioURL);

if (oldPath) {
const oldRef = ref(storage, oldPath);
await deleteObject(oldRef);
}

const newPath = `audio/${Date.now()}_${newFile.name}`;

const newRef = ref(storage, newPath);

await uploadBytes(newRef, newFile);

const url = await getDownloadURL(newRef);

updatedData.audioURL = url;
}

await updateDoc(doc(db, "audio", audio.id), updatedData);

setEditing(null);
loadAudio();

} catch (error) {
console.error("Edit failed:", error);
}
};

const deleteAudio = async (audio) => {

try {

const path = getStoragePathFromUrl(audio.audioURL);

if (path) {
const storageRef = ref(storage, path);
await deleteObject(storageRef);
}

await deleteDoc(doc(db, "audio", audio.id));

setAudioList(prev => prev.filter(a => a.id !== audio.id));

} catch (error) {
console.error("Delete failed:", error);
}
};

/* FILTER AUDIO */

const filtered = audioList
.filter(a => a.type === audioType)
.filter(a =>
a.title?.toLowerCase().includes(search.toLowerCase())
);

return (

<div style={pageStyle}>

<h1 style={{ marginBottom: "20px" }}>Content Manager</h1>

{/* AUDIO TYPE DROPDOWN */}

<select
value={audioType}
onChange={(e) => setAudioType(e.target.value)}
style={typeSelect}
>
<option value="sermon">Sermons</option>
<option value="homily">Homilys</option>
<option value="sundayschool">Sunday School</option>
</select>

{/* SEARCH */}

<input
placeholder="Search..."
value={search}
onChange={(e) => setSearch(e.target.value)}
style={searchInput}
/>

{filtered.map((audio) => {

const fileName = audio.audioURL
?.split("/")
.pop()
.split("?")[0];

return (

<div key={audio.id} style={cardStyle}>

{editing === audio.id ? (

<div style={editGrid}>

<input
value={editTitle}
onChange={(e) => setEditTitle(e.target.value)}
placeholder="Title"
style={inputStyle}
/>

<input
value={editSpeaker}
onChange={(e) => setEditSpeaker(e.target.value)}
placeholder="Speaker"
style={inputStyle}
/>

<input
type="date"
value={editDate}
onChange={(e) => setEditDate(e.target.value)}
style={inputStyle}
/>

<div style={{ fontSize: "13px" }}>
Current File: {fileName}
</div>

<audio controls src={audio.audioURL} />

<input
type="file"
accept="audio/*"
onChange={(e) => setNewFile(e.target.files[0])}
/>

<div style={{ display: "flex", gap: "10px" }}>
<button onClick={() => saveEdit(audio)} style={saveBtn}>
Save
</button>

<button onClick={() => setEditing(null)} style={cancelBtn}>
Cancel
</button>
</div>

</div>

) : (

<div style={rowStyle}>

<div style={infoStyle}>
<strong>{audio.title}</strong>
<div style={{ fontSize: "13px", color: "#555" }}>
{audio.speaker}
</div>
<div style={{ fontSize: "12px", color: "#888" }}>
{fileName}
</div>
</div>

<audio controls src={audio.audioURL} style={{ width: "250px" }} />

<div style={buttonGroup}>

<button
onClick={() => startEdit(audio)}
style={editBtn}
>
Edit
</button>

<button
onClick={() => deleteAudio(audio)}
style={deleteBtn}
>
Delete
</button>

</div>

</div>

)}

</div>

);
})}

</div>
);
}

const pageStyle = {
padding: "40px",
background: "#f3f4f6",
minHeight: "100vh"
};

const typeSelect = {
padding: "10px",
borderRadius: "6px",
border: "1px solid #ccc",
marginBottom: "15px"
};

const searchInput = {
padding: "10px",
width: "300px",
marginBottom: "25px",
borderRadius: "6px",
border: "1px solid #ccc"
};

const cardStyle = {
background: "white",
padding: "15px",
borderRadius: "10px",
marginBottom: "15px",
boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
};

const rowStyle = {
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: "20px"
};

const infoStyle = {
minWidth: "220px"
};

const buttonGroup = {
display: "flex",
gap: "10px"
};

const editGrid = {
display: "grid",
gap: "10px"
};

const inputStyle = {
padding: "8px",
borderRadius: "6px",
border: "1px solid #ccc"
};

const editBtn = {
padding: "6px 12px",
border: "none",
background: "#2563eb",
color: "white",
borderRadius: "6px",
cursor: "pointer"
};

const deleteBtn = {
padding: "6px 12px",
border: "none",
background: "#dc2626",
color: "white",
borderRadius: "6px",
cursor: "pointer"
};

const saveBtn = {
padding: "6px 12px",
border: "none",
background: "#16a34a",
color: "white",
borderRadius: "6px"
};

const cancelBtn = {
padding: "6px 12px",
border: "none",
background: "#6b7280",
color: "white",
borderRadius: "6px"
};