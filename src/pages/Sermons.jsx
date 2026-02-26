import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  increment,
  arrayUnion,
  arrayRemove,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function Sermons() {
  const [sermons, setSermons] = useState([]);
  const [user, setUser] = useState(null);

  // Track auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // Fetch sermons
  useEffect(() => {
    async function fetchSermons() {
      try {
        const querySnapshot = await getDocs(collection(db, "audio"));

        const sermonList = querySnapshot.docs.map((docItem) => {
          const data = docItem.data();

          return {
            id: docItem.id,
            ...data,
            likes: data.likes || 0,
            likedBy: data.likedBy || [],
          };
        });

        setSermons(sermonList);
      } catch (error) {
        console.error("Error fetching sermons:", error);
      }
    }

    fetchSermons();
  }, []);

  // Like / Unlike
  const handleLike = async (sermon) => {
    if (!user) {
      alert("You must be logged in to like.");
      return;
    }

    const sermonRef = doc(db, "audio", sermon.id);
    const hasLiked = sermon.likedBy.includes(user.uid);

    try {
      await updateDoc(sermonRef, {
        likes: increment(hasLiked ? -1 : 1),
        likedBy: hasLiked
          ? arrayRemove(user.uid)
          : arrayUnion(user.uid),
      });

      // Update UI immediately
      setSermons((prev) =>
        prev.map((s) =>
          s.id === sermon.id
            ? {
                ...s,
                likes: hasLiked ? s.likes - 1 : s.likes + 1,
                likedBy: hasLiked
                  ? s.likedBy.filter((uid) => uid !== user.uid)
                  : [...s.likedBy, user.uid],
              }
            : s
        )
      );
    } catch (error) {
      console.error("Error updating like:", error);
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
        sermons.map((sermon) => {
          const isLiked =
            user && sermon.likedBy.includes(user.uid);

          return (
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
              <h3>{sermon.title}</h3>

              <p style={{ fontWeight: "bold", color: "#555" }}>
                Speaker: {sermon.speaker || "Unknown"}
              </p>

              {/* 🎧 FIXED AUDIO FIELD */}
              {sermon.audioURL && (
                <audio
                  controls
                  style={{ width: "100%", marginTop: "15px" }}
                  src={sermon.audioURL}
                />
              )}

              <div
                style={{
                  marginTop: "15px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <button
                  onClick={() => handleLike(sermon)}
                  style={{
                    fontSize: "24px",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    position: "relative",
                    opacity: user ? 1 : 0.5,
                  }}
                >
                  {isLiked ? "❤️" : "🤍"}

                  {!user && (
                    <span
                      style={{
                        position: "absolute",
                        top: "-5px",
                        right: "-8px",
                        fontSize: "14px",
                      }}
                    >
                      🔒
                    </span>
                  )}
                </button>

                <span style={{ marginLeft: "8px" }}>
                  {sermon.likes}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}