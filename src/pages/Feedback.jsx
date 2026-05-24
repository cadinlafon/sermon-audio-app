import { useEffect } from "react";

export default function Feedback() {
  useEffect(() => {
    window.scrollTo(0, 0);

    // Load Jotform embed script
    const script = document.createElement("script");
    script.src = "https://form.jotform.com/jsform/251326863283157";
    script.type = "text/javascript";
    script.async = true;

    const formContainer = document.getElementById("jotform-container");

    if (formContainer) {
      formContainer.innerHTML = "";
      formContainer.appendChild(script);
    }

    return () => {
      if (formContainer) {
        formContainer.innerHTML = "";
      }
    };
  }, []);

  return (
    <div style={page}>
      <h1 style={pageTitle}>Share Your Feedback</h1>

      <p style={pageSubtitle}>
        We'd love to hear what you think. Your feedback helps us improve.
      </p>

      <div style={card}>
        <div id="jotform-container" />
      </div>
    </div>
  );
}

const page = {
  padding: "32px 20px 60px",
  maxWidth: "860px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
  fontFamily: "'Georgia', serif",
  textAlign: "center",
};

const pageTitle = {
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  marginBottom: "8px",
};

const pageSubtitle = {
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "15px",
  marginBottom: "28px",
};

const card = {
  background: "#fffdf9",
  borderRadius: "18px",
  border: "1px solid #eddfc8",
  boxShadow: "0 2px 14px rgba(160,100,40,0.07)",
  padding: "16px",
  overflow: "hidden",
};