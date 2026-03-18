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

export default function Homilys() {
const [homilys, setHomilys] = useState([]);
const [user, setUser] = useState(null);

const [search, setSearch] = useState("");
const [sortOrder, setSortOrder] = useState("desc");
const [pastorFilter, setPastorFilter] = useState("all");

// ✏️ CHANGE PASTOR NAMES HERE
const pastors = [
"Jonathan Mcintosh", // ✏️ change name
"Rusty Olps", // ✏️ change name
"Jason Farley"  // ✏️ change name
];

// Auth listener
useEffect(() => {
const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
setUser(currentUser);
});

return () => unsubscribe();
}, []);

// Fetch homilys
useEffect(() => {
async function fetchHomilys() {
try {
const q = query(
collection(db, "audio"),
where("type", "==", "homily"),
orderBy("createdAt", sortOrder)
);

const querySnapshot = await getDocs(q);

const list = querySnapshot.docs.map((docItem) => ({
id: docItem.id,
...docItem.data(),
}));

setHomilys(list);
} catch (error) {
console.error("Error fetching homilys:", error);
}
}

fetchHomilys();
}, [sortOrder]);

const formatDate = (timestamp) => {
if (!timestamp) return "";
const date = timestamp.toDate();
return date.toLocaleDateString();
};

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

const filtered = homilys.filter((item) => {
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
Homilies
</h1>

<div
style={{
display: "flex",
justifyContent: "center",
alignItems: "center",
gap: "15px",
marginBottom: "35px",
}}
>

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

<input
type="text"
placeholder="Search homilys..."
value={search}
onChange={(e) => setSearch(e.target.value)}
style={{
padding: "10px",
width: "300px",
borderRadius: "6px",
border: "1px solid #ccc",
}}
/>

<select
value={pastorFilter}
onChange={(e) => setPastorFilter(e.target.value)}
style={{
padding: "10px",
borderRadius: "6px",
border: "1px solid #ccc",
}}
>
<option value="all">All Pastors</option>

{pastors.map((p) => (
<option key={p} value={p}>
{p}
</option>
))}
</select>

</div>

{filtered.length === 0 ? (
<p style={{ textAlign: "center" }}>No homilys found.</p>
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