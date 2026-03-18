export default function About() {
  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "40px 20px",
        background: "linear-gradient(to bottom, #f5f7fa, #ffffff)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          maxWidth: "800px",
          background: "white",
          padding: "40px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <h1
          style={{
            marginBottom: "20px",
            fontSize: "32px",
          }}
        >
          Not Yet Set Up
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: "1.7",
            marginBottom: "20px",
            color: "#444",
          }}
        >
        </p>
No Data Recieved
        <p
          style={{
            fontSize: "18px",
            lineHeight: "1.7",
            color: "#444",
          }}
        >
          No Data Recived
        </p>
      </div>
    </div>
  );
}
