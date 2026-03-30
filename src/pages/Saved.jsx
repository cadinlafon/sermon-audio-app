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

export default function Saved() {
  const [user, setUser] = useState(null);
  const [saved, setSaved] = useState([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!user) return;

    async function fetchSaved() {
      const q = query(
        collection(db, "saved"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const snap = await getDocs(q);

      const list = snap.docs.map(doc => doc.data());

      setSaved(list);
    }

    fetchSaved();
  }, [user]);

  return (
    <div style={{ padding: "40px" }}>
      <h1 style={{ textAlign: "center", marginBottom: "30px" }}>
        Saved Sermons
      </h1>

      {saved.length === 0 ? (
        <p style={{ textAlign: "center" }}>No saved sermons.</p>
      ) : (
        saved.map((item, i) => (
          <div
            key={i}
            style={{
              background: "#fff",
              padding: "20px",
              borderRadius: "12px",
              boxShadow: "0 4px 10px rgba(0,0,0,0.1)",
              maxWidth: "600px",
              margin: "0 auto 20px auto"
            }}
          >
            <h3>{item.title}</h3>
            <p style={{ color: "#555" }}>{item.speaker}</p>
          </div>
        ))
      )}
    </div>
  );
}