import { useEffect, useState } from "react";
import { db } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment,
} from "firebase/firestore";

export default function Sermons() {
  const [sermons, setSermons] = useState([]);

  useEffect(() => {
    async function fetchSermons() {
      try {
        const querySnapshot = await getDocs(collection(db, "audio"));

        const sermonList = querySnapshot.docs.map((docItem) => ({
          id: docItem.id,
          likes: docItem.data().likes || 0,
          liked: false, // local state only for now
          ...docItem.data(),
        }));

        setSermons(sermonList);
      } catch (error) {
        console.error("Error fetching sermons:", error);
      }
    }

    fetchSermons();
  }, []);

  const handleLike = async (id, currentLikes, currentlyLiked) => {
    try {
      const sermonRef = doc(db, "audio", id);

      // Update Firestore count
      await updateDoc(sermonRef, {
        likes: increment(currentlyLiked ? -1 : 1),
      });

      // Update UI instantly
      setSermons((prevSermons) =>
        prevSermons.map((sermon) =>
          sermon.id === id
            ? {
                ...sermon,
                liked: !currentlyLiked,
                likes: currentlyLiked
                  ? sermon.likes - 1
                  : sermon.likes + 1,
              }
            : sermon
        )
      );
    } catch (error) {
      console.error("Error updating likes:", error);
    }
  };

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ textAlign: "center", marginBottom: "40px" }}>
        Sermons
      </h1>

      {sermons.length === 0 ? (
        <p>No sermons found.</p>
      ) : (
        sermons.map((sermon) => (
          <div
            key={sermon.id}
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
              {sermon.title}
            </h3>

            <p style={{ fontWeight: "bold", color: "#555" }}>
              Pastor: {sermon.pastor}
            </p>

            <p style={{ marginBottom: "15px" }}>
              {sermon.description}
            </p>

            {sermon.audioUrl && (
              <audio controls style={{ width: "100%" }}>
                <source
                  src={sermon.audioUrl}
                  type="audio/mpeg"
                />
                Your browser does not support the audio element.
              </audio>
            )}

            <div style={{ marginTop: "10px" }}>
              <button
                onClick={() =>
                  handleLike(
                    sermon.id,
                    sermon.likes,
                    sermon.liked
                  )
                }
              >
                {sermon.liked ? "❤️ Liked" : "🤍 Like"}
              </button>

              <span style={{ marginLeft: "10px" }}>
                {sermon.likes}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}