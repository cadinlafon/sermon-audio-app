import { useNavigate } from "react-router-dom";

export default function NotFound() {

const navigate = useNavigate();

return (
<div
style={{
display: "flex",
flexDirection: "column",
justifyContent: "center",
alignItems: "center",
height: "80vh",
textAlign: "center",
}}
>

<h1 style={{ fontSize: "60px", marginBottom: "10px" }}>
404
</h1>

<h2 style={{ marginBottom: "25px" }}>
Page Not Found
</h2>

<button
onClick={() => navigate("/feedback")}
style={{
padding: "12px 20px",
fontSize: "16px",
borderRadius: "8px",
border: "none",
backgroundColor: "#111827",
color: "white",
cursor: "pointer",
}}
>
Report Dead Link
</button>

</div>
);
}