import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function Homilies() {
  const [homilies, setHomilies] = useState([]);

  useEffect(() => {
    async function fetchHomilies() {
      try {
        const q = query(
          collection(db, "audio"),
          where("type", "==", "homily")
        );

        const querySnapshot = await getDocs(q);

        const homilyList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setHomilies(homilyList);
      } catch (error) {
        console.error("Error fetching homilies:", error);
      }
    }

    fetchHomilies();
  }, []);

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ textAlign: "center", marginBottom: "40px" }}>
        Seasonal Homilies
      </h1>

      {homilies.length === 0 ? (
        <p>No homilies found.</p>
      ) : (
        homilies.map((homily) => (
          <div
            key={homily.id}
            style={{
              background: "#ffffff",
              padding: "20px",
              marginBottom: "25px",
              borderRadius: "12px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              maxWidth: "600px",
              margin: "0 auto 25px auto",
            }}
          >
            <h3 style={{ marginBottom: "5px" }}>
              {homily.title}
            </h3>

            <p style={{ fontWeight: "bold", color: "#555" }}>
              Pastor: {homily.pastor}
            </p>

            {homily.audioUrl && (
              <audio controls style={{ width: "100%", marginTop: "15px" }}>
                <source src={homily.audioUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        ))
      )}
    </div>
  );
}
