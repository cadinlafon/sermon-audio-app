import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function Sermons() {
  const [sermons, setSermons] = useState([]);
  const [user, setUser] = useState(null);

  // 🔥 Listen for auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });

    return () => unsubscribe();
  }, []);

  // 🔥 Fetch sermons
  useEffect(() => {
    async function fetchSermons() {
      try {
        const querySnapshot = await getDocs(collection(db, "audio"));

        const sermonList = querySnapshot.docs
          .map((docItem) => ({
            id: docItem.id,
            ...docItem.data(),
          }))
          .filter((item) => item.type === "sermon");

        setSermons(sermonList);
      } catch (error) {
        console.error("Error fetching sermons:", error);
      }
    }

    fetchSermons();
  }, []);

  // 🔥 Log usage when audio starts playing
  const logUsage = async (sermonId) => {
    if (!user) {
      console.log("No user logged in");
      return;
    }

    try {
      await addDoc(collection(db, "appUsage"), {
        sermonId,
        userId: user.uid,
        createdAt: serverTimestamp(),
      });

      console.log("Usage logged!");
    } catch (error) {
      console.error("Usage log error:", error);
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

            <audio
              controls
              style={{ width: "100%", marginTop: "10px" }}
              onPlay={() => logUsage(sermon.id)}
            >
              <source src={sermon.audioURL} type="audio/mpeg" />
              Your browser does not support the audio element.
            </audio>
          </div>
        ))
      )}
    </div>
  );
}