import { useEffect, useState, useRef } from "react";
import { db, auth } from "../firebase";
import {
collection,
getDocs,
addDoc,
setDoc,
doc,
getDoc,
serverTimestamp,
query,
where,
orderBy,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { logEvent } from "../utils/logEvent";

export default function Sermons() {

const [sermons, setSermons] = useState([]);
const [user, setUser] = useState(null);
const [progressMap, setProgressMap] = useState({});

const audioRefs = useRef({});

const [search, setSearch] = useState("");
const [sortOrder, setSortOrder] = useState("desc");
const [pastorFilter, setPastorFilter] = useState("all");

const pastors = [
"Johhathan Mcintosh",
"Rusty Olps",
"Mark Theile"
];

//////////////////////////////////////////////////
// AUTH LISTENER
//////////////////////////////////////////////////

useEffect(() => {

const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
setUser(currentUser);
});

return () => unsubscribe();

}, []);

//////////////////////////////////////////////////
// FETCH SERMONS
//////////////////////////////////////////////////

useEffect(() => {

async function fetchSermons() {

try {

const q = query(
collection(db, "audio"),
where("type", "==", "sermon"),
orderBy("createdAt", sortOrder)
);

const snapshot = await getDocs(q);

const sermonList = snapshot.docs.map((docItem) => ({
id: docItem.id,
...docItem.data(),
}));

setSermons(sermonList);

} catch (error) {
console.error("Error fetching sermons:", error);
}

}

fetchSermons();

}, [sortOrder]);

//////////////////////////////////////////////////
// LOAD LISTENING PROGRESS
//////////////////////////////////////////////////

useEffect(() => {

if (!user) return;

async function loadProgress() {

const progress = {};

for (const sermon of sermons) {

const ref = doc(db, "listeningProgress", `${user.uid}_${sermon.id}`);
const snap = await getDoc(ref);

if (snap.exists()) {
progress[sermon.id] = snap.data().time;
}

}

setProgressMap(progress);

}

loadProgress();

}, [user, sermons]);

//////////////////////////////////////////////////
// SAVE PROGRESS
//////////////////////////////////////////////////

const saveProgress = async (sermonId, time) => {

if (!user) return;

try {

await setDoc(
doc(db, "listeningProgress", `${user.uid}_${sermonId}`),
{
userId: user.uid,
sermonId,
time,
updatedAt: serverTimestamp()
}
);

} catch (err) {
console.error("Progress save failed", err);
}

};

//////////////////////////////////////////////////
// LOG PLAY
//////////////////////////////////////////////////

const logUsage = async (sermon) => {

try {

await addDoc(collection(db, "appUsage"), {
sermonId: sermon.id,
title: sermon.title,
speaker: sermon.speaker,
userId: user?.uid || null,
createdAt: serverTimestamp(),
});

await logEvent("sermon_play", {
sermonId: sermon.id,
title: sermon.title,
speaker: sermon.speaker,
});

} catch (error) {
console.error("Usage log error:", error);
}

};

//////////////////////////////////////////////////
// FORMAT DATE
//////////////////////////////////////////////////

const formatDate = (timestamp) => {

if (!timestamp) return "";

const date = timestamp.toDate();

return date.toLocaleDateString();

};

//////////////////////////////////////////////////
// SEARCH + FILTER
//////////////////////////////////////////////////

const filtered = sermons.filter((sermon) => {

const matchesSearch = sermon.title
?.toLowerCase()
.includes(search.toLowerCase());

const matchesPastor =
pastorFilter === "all" || sermon.speaker === pastorFilter;

return matchesSearch && matchesPastor;

});

//////////////////////////////////////////////////
// UI
//////////////////////////////////////////////////

return (

<div style={{ padding: "40px" }}>

<h1 style={{ textAlign: "center", marginBottom: "25px" }}>
Sermons
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
placeholder="Search sermons..."
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

<p style={{ textAlign: "center" }}>No sermons found.</p>

) : (

filtered.map((sermon) => (

<div
key={sermon.id}
style={{
background: "#ffffff",
padding: "20px",
borderRadius: "12px",
boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
maxWidth: "600px",
margin: "0 auto 25px auto",
}}
>

<h3>{sermon.title}</h3>

<p style={{ fontWeight: "bold", color: "#555" }}>
Speaker: {sermon.speaker || "Unknown"}
</p>

<p style={{ color: "#777", fontSize: "14px" }}>
{formatDate(sermon.createdAt)}
</p>

<audio
ref={(el) => (audioRefs.current[sermon.id] = el)}
controls
style={{ width: "100%", marginTop: "10px" }}

onLoadedMetadata={() => {

const savedTime = progressMap[sermon.id];

if (savedTime && audioRefs.current[sermon.id]) {
audioRefs.current[sermon.id].currentTime = savedTime;
}

}}

onPlay={() => logUsage(sermon)}

onTimeUpdate={(e) => {

const currentTime = e.target.currentTime;

if (Math.floor(currentTime) % 5 === 0) {
saveProgress(sermon.id, currentTime);
}

}}

>

<source src={sermon.audioURL} type="audio/mpeg" />

</audio>

</div>

))

)}

</div>

);

}