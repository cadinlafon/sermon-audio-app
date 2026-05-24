import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  getDocs
} from "firebase/firestore";

import { db } from "../../firebase";

export default function Logs() {
  const [sessions, setSessions] = useState({});
  const [userMap, setUserMap] = useState({});

  //////////////////////////////////////////////////
  // LOAD USERS (UID → NAME)
  //////////////////////////////////////////////////
  useEffect(() => {
    const fetchUsers = async () => {
      const usersSnap = await getDocs(collection(db, "users"));

      const map = {};

      usersSnap.docs.forEach((doc) => {
        const data = doc.data();

        map[doc.id] =
          data.name ||
          data.fullName ||
          data.email ||
          doc.id;
      });

      setUserMap(map);
    };

    fetchUsers();
  }, []);

  //////////////////////////////////////////////////
  // LOAD + GROUP LOGS INTO SESSIONS
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, "logs"),
      (snapshot) => {
        const grouped = {};

        snapshot.docs.forEach((doc) => {
          const data = doc.data();

          const sessionId = data.sessionId || "unknown";

          if (!grouped[sessionId]) {
            grouped[sessionId] = [];
          }

          grouped[sessionId].push({
            id: doc.id,
            ...data,
          });
        });

        // sort each session by time
        Object.keys(grouped).forEach((id) => {
          grouped[id].sort((a, b) => {
            const ta = a.createdAt?.seconds || 0;
            const tb = b.createdAt?.seconds || 0;
            return ta - tb;
          });
        });

        setSessions(grouped);
      }
    );

    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // FORMAT TIME
  //////////////////////////////////////////////////
  const formatTime = (timestamp) => {
    if (!timestamp?.seconds) return "";

    return new Date(timestamp.seconds * 1000).toLocaleString();
  };

  //////////////////////////////////////////////////
  // USER NAME
  //////////////////////////////////////////////////
  const getUserName = (event) => {
  if (event.fullName) return event.fullName;

  if (event.userId && userMap[event.userId]) {
    return userMap[event.userId];
  }

  if (event.email) return event.email;

  return "Guest";
};

  //////////////////////////////////////////////////
  // CALCULATE SESSION DATA
  //////////////////////////////////////////////////
  const getSessionInfo = (events) => {
    const start = events.find((e) => e.event === "session_start");
    const end = events.find((e) => e.event === "session_end");

    const duration = end?.duration
      ? `${end.duration}s`
      : "Active";

    const user = getUserName(events[0]);

    return {
      start,
      end,
      duration,
      user,
      count: events.length,
    };
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <div style={container}>
      <h2 style={title}>User Sessions</h2>

      {Object.entries(sessions).map(([sessionId, events]) => {
        const info = getSessionInfo(events);

        return (
          <div key={sessionId} style={card}>
            <div style={cardHeader}>
              <div>
                <strong>User:</strong> {info.user}
              </div>

              <div>
                <strong>Events:</strong> {info.count}
              </div>

              <div>
                <strong>Duration:</strong> {info.duration}
              </div>

              <div>
                <strong>Start:</strong>{" "}
                {formatTime(info.start?.createdAt)}
              </div>
            </div>

            <details>
              <summary style={summary}>
                View Session Activity
              </summary>

              <div style={eventsContainer}>
                {events.map((e) => (
                  <div key={e.id} style={eventRow}>
                    <div style={time}>
                      {formatTime(e.createdAt)}
                    </div>

                    <div style={eventType}>
                      {e.event}
                    </div>

                    <div style={details}>
                      {e.page ||
                        e.message ||
                        e.mode ||
                        "-"}
                    </div>
                  </div>
                ))}
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const container = {
  padding: "30px",
  maxWidth: "900px",
  margin: "0 auto",
};

const title = {
  marginBottom: "25px",
};

const card = {
  background: "#fff",
  borderRadius: "12px",
  padding: "18px",
  marginBottom: "20px",
  boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
  border: "1px solid #eee",
};

const cardHeader = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "10px",
  marginBottom: "10px",
  fontSize: "13px",
};

const summary = {
  cursor: "pointer",
  fontWeight: "600",
  marginTop: "10px",
};

const eventsContainer = {
  marginTop: "12px",
  borderTop: "1px solid #eee",
};

const eventRow = {
  display: "grid",
  gridTemplateColumns: "180px 180px 1fr",
  padding: "8px 0",
  borderBottom: "1px solid #f1f1f1",
  fontSize: "13px",
};

const time = {
  color: "#666",
};

const eventType = {
  fontWeight: "500",
};

const details = {
  color: "#444",
  wordBreak: "break-word",
};