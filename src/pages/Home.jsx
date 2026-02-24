import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();

  return (
    <div style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>
      
      {/* ===== MOST RECENT SERMON PLACEHOLDER ===== */}
      <div
        style={{
          height: "250px",
          backgroundColor: "#f2f2f2",
          borderRadius: "12px",
          marginBottom: "40px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "20px",
          fontWeight: "bold",
          color: "#777",
        }}
      >
        Most Recent Sermon (Coming Soon)
      </div>

      {/* ===== NAVIGATION BUTTONS ===== */}
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

      {/* ===== CONTACT CARD ===== */}
      <div
        style={{
          backgroundColor: "#ffffff",
          padding: "25px",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          textAlign: "center",
        }}
      >
        <h3 style={{ marginBottom: "10px" }}>Cadin LaFon</h3>

        <p style={{ marginBottom: "20px", color: "#555" }}>
          208-874-3729 | Cadinlafon@gmail.com
          <br />
          (Palouse Fellowship.)
        </p>

        <button style={buttonStyle}>
          Contact Form
        </button>
      </div>
    </div>
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
