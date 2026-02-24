import { useEffect, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";

export default function SundaySchool() {
  const [lessons, setLessons] = useState([]);

  useEffect(() => {
    async function fetchLessons() {
      try {
        const q = query(
          collection(db, "audio"),
          where("type", "==", "sundayschool")
        );

        const querySnapshot = await getDocs(q);

        const lessonList = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setLessons(lessonList);
      } catch (error) {
        console.error("Error fetching Sunday School lessons:", error);
      }
    }

    fetchLessons();
  }, []);

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ textAlign: "center", marginBottom: "40px" }}>
        Sunday School
      </h1>

      {lessons.length === 0 ? (
        <p>No Sunday School lessons found.</p>
      ) : (
        lessons.map((lesson) => (
          <div
            key={lesson.id}
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
              {lesson.title}
            </h3>

            <p style={{ fontWeight: "bold", color: "#555" }}>
              Pastor: {lesson.pastor}
            </p>

            {lesson.audioUrl && (
              <audio controls style={{ width: "100%", marginTop: "15px" }}>
                <source src={lesson.audioUrl} type="audio/mpeg" />
                Your browser does not support the audio element.
              </audio>
            )}
          </div>
        ))
      )}
    </div>
  );
}
