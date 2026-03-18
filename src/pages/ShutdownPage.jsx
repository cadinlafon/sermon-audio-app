import { useState } from "react";
import { useNavigate } from "react-router-dom";

function ShutdownPage({ message, returnDate }) {

  const navigate = useNavigate();
  const [clickCount, setClickCount] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);

  const handleLogoClick = () => {
    const now = Date.now();

    if (now - lastClickTime < 2000) {
      const newCount = clickCount + 1;
      setClickCount(newCount);

      if (newCount >= 5) {
        navigate("/admin-access");
      }

    } else {
      // reset counter if too slow
      setClickCount(1);
    }

    setLastClickTime(now);
  };

  // Convert Firestore timestamp safely
  let formattedDate = "Soon";

  if (returnDate && returnDate.seconds) {
    formattedDate = new Date(returnDate.seconds * 1000).toLocaleString();
  }

  return (
    <div
      style={{
        textAlign: "center",
        padding: "60px",
        fontFamily: "sans-serif"
      }}
    >

      <img
        src="/icons/icon-192.png"
        alt="App Logo"
        onClick={handleLogoClick}
        style={{
          width: "120px",
          cursor: "pointer",
          marginBottom: "20px"
        }}
      />

      <h1>🔧 App Under Maintenance</h1>

      {message && <p>{message}</p>}

      <p>Expected Return: {formattedDate}</p>

    </div>
  );
}

export default ShutdownPage;