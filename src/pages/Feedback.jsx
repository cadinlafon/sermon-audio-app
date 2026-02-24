import { useEffect } from "react";

export default function Feedback() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div
      style={{
        padding: "40px",
        maxWidth: "900px",
        margin: "0 auto",
        textAlign: "center",
      }}
    >
      <h1 style={{ marginBottom: "10px" }}>Feedback</h1>

      <p style={{ color: "#555", marginBottom: "30px" }}>
        We'd love to hear from you. Please fill out the form below.
      </p>

      <div
        style={{
          background: "#ffffff",
          borderRadius: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
          padding: "20px",
        }}
      >
        <iframe
          id="JotFormIFrame-251326863283157"
          title="Feedback Form"
          allow="geolocation; microphone; camera; fullscreen; payment"
          src="https://form.jotform.com/251326863283157"
          style={{
            width: "100%",
            height: "750px",
            border: "none",
            borderRadius: "8px",
          }}
        />
      </div>
    </div>
  );
}
