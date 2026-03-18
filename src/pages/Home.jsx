import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
collection,
query,
orderBy,
limit,
getDocs,
} from "firebase/firestore";

export default function Home() {

const navigate = useNavigate();

const [latestSermon, setLatestSermon] = useState(null);
const [continueListening, setContinueListening] = useState(null);

/* LOAD MOST RECENT SERMON */

useEffect(() => {

async function fetchLatestSermon() {

try {

const q = query(
collection(db, "audio"),
orderBy("createdAt", "desc"),
limit(1)
);

const snapshot = await getDocs(q);

if (!snapshot.empty) {
setLatestSermon(snapshot.docs[0].data());
}

} catch (error) {
console.error("Error loading sermon:", error);
}

}

fetchLatestSermon();

/* LOAD CONTINUE LISTENING */

const saved = localStorage.getItem("continueListening");

if (saved) {
setContinueListening(JSON.parse(saved));
}

}, []);

return (
<>

{/* HERO IMAGE */}

<div
style={{
width: "100%",
height: "30vh",
backgroundImage: `url("/hero.jpg")`,
backgroundSize: "cover",
backgroundPosition: "center",
backgroundRepeat: "no-repeat",
}}
/>

{/* MAIN CONTENT */}

<div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>

{/* MOST RECENT SERMON */}

<div
style={{
backgroundColor: "#ffffff",
borderRadius: "12px",
padding: "25px",
marginBottom: "40px",
boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
textAlign: "center",
}}
>

<h2 style={{ marginBottom: "10px" }}>
Latest Sermon
</h2>

{latestSermon ? (
<>

<h3 style={{ marginBottom: "10px" }}>
{latestSermon.title}
</h3>

<p style={{ color: "#666", marginBottom: "15px" }}>
{latestSermon.speaker}
</p>

<audio controls style={{ width: "100%" }}>
<source src={latestSermon.audioURL} />
</audio>

</>
) : (

<p style={{ color: "#777" }}>
No sermons uploaded yet
</p>

)}

</div>

{/* CONTINUE LISTENING */}

{continueListening && (

<div
style={{
backgroundColor: "#ffffff",
borderRadius: "12px",
padding: "25px",
marginBottom: "40px",
boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
textAlign: "center",
}}
>

<h2 style={{ marginBottom: "10px" }}>
Continue Listening
</h2>

<h3 style={{ marginBottom: "10px" }}>
{continueListening.title}
</h3>

<p style={{ color: "#666", marginBottom: "10px" }}>
{continueListening.speaker}
</p>

<p style={{ fontSize: "14px", color: "#888", marginBottom: "15px" }}>
Resume at {Math.floor(continueListening.time / 60)}:
{String(Math.floor(continueListening.time % 60)).padStart(2,"0")}
</p>

<audio controls style={{ width: "100%" }}>
<source src={continueListening.audioURL} />
</audio>

</div>

)}

{/* NAV BUTTONS */}

<div
style={{
display: "flex",
flexDirection: "column",
gap: "15px",
marginBottom: "50px",
}}
>

<button
onClick={() => navigate("/sermons")}
style={buttonStyle}
>
Sermons
</button>

<button
onClick={() => navigate("/sundayschool")}
style={buttonStyle}
>
Sunday School
</button>

<button
onClick={() => navigate("/homilies")}
style={buttonStyle}
>
Homilies
</button>

</div>

{/* CONTACT CARD */}

<div
style={{
backgroundColor: "#ffffff",
padding: "25px",
borderRadius: "12px",
boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
textAlign: "center",
}}
>

<h3 style={{ marginBottom: "10px" }}>
Cadin LaFon
</h3>

<p style={{ marginBottom: "20px", color: "#555" }}>
208-874-3729 | Cadinlafon@gmail.com
<br />
(Palouse Fellowship.)
</p>

<button
style={buttonStyle}
onClick={() => navigate("/feedback")}
>
Contact Form
</button>

</div>

</div>
</>
);
}

const buttonStyle = {
padding: "15px",
fontSize: "16px",
borderRadius: "8px",
border: "none",
backgroundColor: "#2c3e50",
color: "white",
cursor: "pointer",
};