import { useEffect, useState } from "react";
import { db, auth } from "../firebase";
import {
  collection,
  getDocs,
  query,
  where,
  orderBy
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function YourListens() {
  const [user, setUser] = useState(null);
  const [listens, setListens] = useState([]);

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsub();
  }, []);

  //////////////////////////////////////////////////
  // FETCH + GROUP LISTENS
  //////////////////////////////////////////////////

  useEffect(() => {
    if (!user) return;

    async function fetchListens() {
      try {
        const q = query(
          collection(db, "listens"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(q);

        // 🔥 GROUP BY SERMON
        const map = {};

        snapshot.docs.forEach((doc) => {
          const data = doc.data();

          if (!map[data.sermonId]) {
            map[data.sermonId] = {
              ...data,
              count: 1
            };
          } else {
            map[data.sermonId].count += 1;
          }
        });

        const grouped = Object.values(map);

        setListens(grouped);
      } catch (err) {
        console.error("Fetch listens error:", err);
      }
    }

    fetchListens();
  }, [user]);

  //////////////////////////////////////////////////
  // FORMAT DATE
  //////////////////////////////////////////////////

  const formatDate = (timestamp) => {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleString();
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>
        Your Listens
      </h1>

      {listens.length === 0 ? (
        <p style={{ textAlign: "center" }}>
          No listens yet.
        </p>
      ) : (
        listens.map((item) => (
          <div
            key={item.sermonId}
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              maxWidth: "600px",
              margin: "0 auto 20px auto",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}
          >
            <div>
              <h3 style={{ marginBottom: "6px" }}>
                {item.title}
              </h3>

              <p style={{ fontSize: "14px", color: "#555" }}>
                {item.speaker}
              </p>

              <p style={{ fontSize: "12px", color: "#888" }}>
                Last listened: {formatDate(item.createdAt)}
              </p>

              <p style={{ fontSize: "12px", color: "#888" }}>
                Plays: {item.count}
              </p>
            </div>

            <button
              style={{
                background: "#111",
                color: "#fff",
                border: "none",
                padding: "10px 14px",
                borderRadius: "6px",
                cursor: "pointer"
              }}
              onClick={() => {
                window.location.href = `/sermons`;
              }}
            >
              Resume
            </button>
          </div>
        ))
      )}
    </div>
  );
}