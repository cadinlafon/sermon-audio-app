import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function HelpCenter() {

const navigate = useNavigate();

/* Load Jotform AI Agent */

useEffect(() => {

const script = document.createElement("script");


script.async = true;

document.body.appendChild(script);

/* CLEANUP WHEN LEAVING PAGE */

return () => {

document.body.removeChild(script);

/* also close agent if open */
if (window.Agent) {
window.Agent.close();
}

};

}, []);

return (

<div style={page}>

<h2 style={{ marginBottom: "20px" }}>Help Center</h2>

{/* SEARCH */}

<input
placeholder="Search help..."
style={search}
/>

{/* TROUBLESHOOTING */}

<h3 style={{ marginTop: "30px" }}>Troubleshooting</h3>

<div style={cardContainer}>

<div style={card}>
<h4>Can't Log In</h4>
<p>
Check your email and password. If it still fails, reset your password or contact support.
</p>
</div>

<div style={card}>
<h4>Audio Not Playing</h4>
<p>
Make sure your internet connection is active and try refreshing the page.
</p>
</div>

<div style={card}>
<h4>Notifications Not Working</h4>
<p>
Open Settings → Notifications and make sure notifications are enabled.
</p>
</div>

<div style={card}>
<h4>App Running Slow</h4>
<p>
Refresh the page or restart your browser. Make sure your internet connection is stable.
</p>
</div>

</div>



{/* CONTACT SUPPORT */}

<h3 style={{ marginTop: "40px" }}>Contact Support</h3>

<button
style={contactButton}
onClick={() => navigate("/feedback")}
>
Go To Feedback Page
</button>

</div>

);

}

/* STYLES */

const page = {
padding: "40px",
maxWidth: "900px"
};

const search = {
padding: "12px",
width: "100%",
maxWidth: "400px",
borderRadius: "8px",
border: "1px solid #ccc"
};

const cardContainer = {
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
gap: "20px",
marginTop: "20px"
};

const card = {
background: "#f3f4f6",
padding: "20px",
borderRadius: "10px",
cursor: "pointer"
};

const aiButton = {
padding: "12px 18px",
background: "#2563eb",
color: "white",
border: "none",
borderRadius: "8px",
cursor: "pointer",
marginTop: "10px"
};

const contactButton = {
padding: "12px 18px",
background: "#16a34a",
color: "white",
border: "none",
borderRadius: "8px",
cursor: "pointer",
marginTop: "10px"
};