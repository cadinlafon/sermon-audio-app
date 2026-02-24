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
          About This App
        </h1>

        <p
          style={{
            fontSize: "18px",
            lineHeight: "1.7",
            marginBottom: "20px",
            color: "#444",
          }}
        >
          This Sermon Audio App was created to make it easier for our church
          community to access sermons, homilies, and Sunday School content
          anytime, anywhere. Built with simplicity and accessibility in mind,
          the app allows users to listen to sermins and stay connected.
        </p>

        <p
          style={{
            fontSize: "18px",
            lineHeight: "1.7",
            color: "#444",
          }}
        >
          The app was designed and developed by Cadin LaFon
        </p>
      </div>
    </div>
  );
}
