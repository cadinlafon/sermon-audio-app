import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
collection,
getDocs,
addDoc,
serverTimestamp,
query,
where,
orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function SundaySchool() {
const [lessons, setLessons] = useState([]);
const [user, setUser] = useState(null);

const [search, setSearch] = useState("");
const [sortOrder, setSortOrder] = useState("desc");
const [pastorFilter, setPastorFilter] = useState("all");

// ✏️ CHANGE PASTOR NAMES HERE
const pastors = [
"Jason Farley", // ✏️ change name
"Jonathan Mcintosh", // ✏️ change name
"Rusty Olps", // ✏️ change name
"Mark Theile"  // ✏️ change name
];

// Auth listener
useEffect(() => {
const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
setUser(currentUser);
});

return () => unsubscribe();
}, []);

// Fetch Sunday School lessons
useEffect(() => {
async function fetchLessons() {
try {
const q = query(
collection(db, "audio"),
where("type", "==", "sundayschool"),
orderBy("createdAt", sortOrder)
);

const querySnapshot = await getDocs(q);

const list = querySnapshot.docs.map((docItem) => ({
id: docItem.id,
...docItem.data(),
}));

setLessons(list);
} catch (error) {
console.error("Error fetching Sunday School lessons:", error);
}
}

fetchLessons();
}, [sortOrder]);

// Format Firestore date
const formatDate = (timestamp) => {
if (!timestamp) return "";
const date = timestamp.toDate();
return date.toLocaleDateString();
};

// Log usage
const logUsage = async (id) => {
if (!user) return;

try {
await addDoc(collection(db, "appUsage"), {
sermonId: id,
userId: user.uid,
createdAt: serverTimestamp(),
});
} catch (error) {
console.error("Usage log error:", error);
}
};

// Search + filter
const filtered = lessons.filter((item) => {
const matchesSearch = item.title
?.toLowerCase()
.includes(search.toLowerCase());

const matchesPastor =
pastorFilter === "all" || item.speaker === pastorFilter;

return matchesSearch && matchesPastor;
});

return (
<div style={{ padding: "40px" }}>

<h1 style={{ textAlign: "center", marginBottom: "25px" }}>
Sunday School
</h1>

{/* SEARCH / SORT / FILTER */}
<div
style={{
display: "flex",
justifyContent: "center",
alignItems: "center",
gap: "15px",
marginBottom: "35px",
}}
>

{/* SORT BUTTON */}
<button
onClick={() =>
setSortOrder(sortOrder === "desc" ? "asc" : "desc")
}
style={{
padding: "8px 16px",
borderRadius: "6px",
border: "none",
background: "#111827",
color: "white",
cursor: "pointer",
}}
>
{sortOrder === "desc" ? "New → Old" : "Old → New"}
</button>

{/* SEARCH */}
<input
type="text"
placeholder="Search lessons..."
value={search}
onChange={(e) => setSearch(e.target.value)}
style={{
padding: "10px",
width: "300px",
borderRadius: "6px",
border: "1px solid #ccc",
}}
/>

{/* PASTOR FILTER */}
<select
value={pastorFilter}
onChange={(e) => setPastorFilter(e.target.value)}
style={{
padding: "10px",
borderRadius: "6px",
border: "1px solid #ccc",
}}
>

<option value="all">All Teachers</option>

{/* Pastors / Teachers */}
{pastors.map((p) => (
<option key={p} value={p}>
{p}
</option>
))}

</select>

</div>

{/* LIST */}
{filtered.length === 0 ? (
<p style={{ textAlign: "center" }}>No lessons found.</p>
) : (
filtered.map((item) => (
<div
key={item.id}
style={{
background: "#ffffff",
padding: "20px",
borderRadius: "12px",
boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
maxWidth: "600px",
margin: "0 auto 25px auto",
}}
>

<h3>{item.title}</h3>

<p style={{ fontWeight: "bold", color: "#555" }}>
Speaker: {item.speaker || "Unknown"}
</p>

<p style={{ color: "#777", fontSize: "14px" }}>
{formatDate(item.createdAt)}
</p>

<audio
controls
style={{ width: "100%", marginTop: "10px" }}
onPlay={() => logUsage(item.id)}
>
<source src={item.audioURL} type="audio/mpeg" />
</audio>

</div>
))
)}

</div>
);
}