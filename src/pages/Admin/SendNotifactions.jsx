import { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { auth, db, functions } from "../../firebase";
import { useModulePermissions } from "../../hooks/usePermissions";

const pushTypes = [
  { value: "general", label: "General Push" },
  { value: "event", label: "Event Push" },
  { value: "feature", label: "New Feature Request Push" },
];

const eventOptions = [
  {
    value: "new-user",
    label: "New User",
    title: "New User Joined",
    body: "A new user has signed up for the app.",
  },
  {
    value: "new-audio",
    label: "New Audio",
    title: "New Audio Added",
    body: "New audio has been added to the app.",
  },
  {
    value: "new-feature-request",
    label: "New Feature Request",
    title: "New Feature Request",
    body: "A user submitted a new feature request.",
  },
  {
    value: "new-feedback",
    label: "New Feedback",
    title: "New Feedback Received",
    body: "A user submitted new feedback.",
  },
  {
    value: "new-notice",
    label: "New Notice",
    title: "New Notice Posted",
    body: "A new app notice has been created.",
  },
  {
    value: "maintenance",
    label: "Maintenance Mode",
    title: "Maintenance Mode Changed",
    body: "The app maintenance setting has been updated.",
  },
];

export default function SendNotifactions() {
  const perms = useModulePermissions("sendNotifications");
  const [pushType, setPushType] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetUserId, setTargetUserId] = useState("all");
  const [eventType, setEventType] = useState("new-user");
  const [eventTitle, setEventTitle] = useState("");
  const [eventDetails, setEventDetails] = useState("");
  const [featureTitle, setFeatureTitle] = useState("");
  const [featureRequester, setFeatureRequester] = useState("");
  const [users, setUsers] = useState([]);
  const [history, setHistory] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, "users"));
        const list = snap.docs.map((doc) => ({
          uid: doc.id,
          ...doc.data(),
        }));

        list.sort((a, b) =>
          (a.fullName || a.name || a.email || "").localeCompare(
            b.fullName || b.name || b.email || ""
          )
        );

        setUsers(list);
      } catch (error) {
        console.error("Failed to load users:", error);
        setStatus("Could not load users.");
      } finally {
        setLoadingUsers(false);
      }
    }

    loadUsers();
  }, []);

  useEffect(() => {
    async function loadHistory() {
      try {
        const snap = await getDocs(
          query(collection(db, "notifications"), orderBy("createdAt", "desc"))
        );

        setHistory(
          snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
        );
      } catch (error) {
        console.error("Failed to load notification history:", error);
      }
    }

    loadHistory();
  }, []);

  const cadinAdmin = users.find((user) => {
    const displayName = `${user.fullName || user.name || ""}`.toLowerCase();
    const email = `${user.email || ""}`.toLowerCase();

    return (
      displayName === "cadin lafon" ||
      email.includes("cadin")
    );
  });

  const fallbackAdmin = users.find((user) => user.role === "admin");
  const adminTargetUserId =
    cadinAdmin?.uid ||
    fallbackAdmin?.uid ||
    auth.currentUser?.uid ||
    "";

  const adminTargetName =
    cadinAdmin?.fullName ||
    cadinAdmin?.name ||
    cadinAdmin?.email ||
    fallbackAdmin?.fullName ||
    fallbackAdmin?.name ||
    fallbackAdmin?.email ||
    auth.currentUser?.email ||
    "admin";

  const selectedEvent = eventOptions.find((event) => event.value === eventType);

  const buildNotification = () => {
    if (pushType === "general") {
      return {
        title: title.trim(),
        body: body.trim(),
        targetUserId,
      };
    }

    if (pushType === "event") {
      const detailText = eventDetails.trim();

      return {
        title: eventTitle.trim() || selectedEvent.title,
        body: detailText
          ? `${selectedEvent.body} ${detailText}`
          : selectedEvent.body,
        targetUserId: adminTargetUserId,
      };
    }

    const requesterText = featureRequester.trim()
      ? ` from ${featureRequester.trim()}`
      : "";

    return {
      title: "New Feature Request",
      body: `A new user has requested${requesterText}: ${featureTitle.trim()}`,
      targetUserId: adminTargetUserId,
    };
  };

  const sendNotification = async () => {
    if (!perms.requireEdit()) return;
    const notification = buildNotification();

    if (!notification.title || !notification.body) {
      setStatus("Title and message are required.");
      return;
    }

    if (!notification.targetUserId) {
      setStatus("Could not find Cadin LaFon or an admin user to notify.");
      return;
    }

    if (pushType === "feature" && !featureTitle.trim()) {
      setStatus("Feature request title is required.");
      return;
    }

    setSending(true);
    setStatus("");

    try {
      const sendPushNotification = httpsCallable(
        functions,
        "sendPushNotification"
      );

      await sendPushNotification(notification);

      setHistory((current) => [
        {
          id: `local-${Date.now()}`,
          ...notification,
          createdAt: null,
        },
        ...current,
      ]);

      setTitle("");
      setBody("");
      setTargetUserId("all");
      setEventTitle("");
      setEventDetails("");
      setFeatureTitle("");
      setFeatureRequester("");
      setStatus("Notification sent.");
    } catch (error) {
      console.error("Failed to send notification:", error);
      setStatus(error.message || "Notification failed.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Send Notifications</h1>
        <p style={pageSubtitle}>
          Send Firebase push notifications through the app function.
        </p>
      </div>

      <div style={card}>
        <h2 style={cardTitle}>New Push Notification</h2>

        <div style={typeGrid}>
          {pushTypes.map((type) => (
            <button
              key={type.value}
              type="button"
              onClick={() => setPushType(type.value)}
              style={
                pushType === type.value
                  ? { ...typeBtn, ...typeBtnActive }
                  : typeBtn
              }
            >
              {type.label}
            </button>
          ))}
        </div>

        {pushType === "general" && (
          <>
            <Field label="Title">
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Notification title"
                style={input}
              />
            </Field>

            <Field label="Message">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Notification message"
                style={textarea}
              />
            </Field>

            <Field label="Target">
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                disabled={loadingUsers}
                style={input}
              >
                <option value="all">All users</option>
                {users.map((user) => (
                  <option key={user.uid} value={user.uid}>
                    {user.fullName || user.name || user.email || user.uid}
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        {pushType === "event" && (
          <>
            <div style={adminTargetBox}>
              Event pushes will be sent to {adminTargetName}.
            </div>

            <Field label="Event">
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                style={input}
              >
                {eventOptions.map((event) => (
                  <option key={event.value} value={event.value}>
                    {event.label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Notification Title">
              <input
                value={eventTitle}
                onChange={(e) => setEventTitle(e.target.value)}
                placeholder={selectedEvent.title}
                style={input}
              />
            </Field>

            <Field label="Extra Details">
              <textarea
                value={eventDetails}
                onChange={(e) => setEventDetails(e.target.value)}
                placeholder="Optional context to include in the alert"
                style={textarea}
              />
            </Field>
          </>
        )}

        {pushType === "feature" && (
          <>
            <div style={adminTargetBox}>
              Feature request pushes will be sent to {adminTargetName}.
            </div>

            <Field label="Request Title">
              <input
                value={featureTitle}
                onChange={(e) => setFeatureTitle(e.target.value)}
                placeholder="Feature request title"
                style={input}
              />
            </Field>

            <Field label="Requested By">
              <input
                value={featureRequester}
                onChange={(e) => setFeatureRequester(e.target.value)}
                placeholder="Optional user name"
                style={input}
              />
            </Field>

            <div style={previewBox}>
              A new user has requested
              {featureRequester.trim() ? ` from ${featureRequester.trim()}` : ""}:{" "}
              {featureTitle.trim() || "Feature request title"}
            </div>
          </>
        )}

        {status && <div style={statusBox}>{status}</div>}

        <button
          type="button"
          onClick={sendNotification}
          disabled={sending || !perms.canEdit}
          style={sending || !perms.canEdit ? { ...sendBtn, opacity: 0.65 } : sendBtn}
        >
          {sending ? "Sending..." : "Send Notification"}
        </button>
      </div>

      <div style={historySection}>
        <h2 style={historyTitle}>Recent Notifications</h2>

        {history.length === 0 ? (
          <div style={emptyState}>No notifications sent yet.</div>
        ) : (
          history.map((notification) => (
            <div key={notification.id} style={historyCard}>
              <div style={historyCardTitle}>{notification.title}</div>
              <div style={historyCardBody}>
                {notification.body || notification.content}
              </div>
              <div style={historyMeta}>
                Target:{" "}
                {notification.targetUserId === "all"
                  ? "All users"
                  : notification.targetUserId || "In-app notification"}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={field}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

const page = { maxWidth: "680px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = {
  fontSize: "26px",
  fontWeight: "normal",
  color: "#3d2200",
  margin: "0 0 4px",
  fontFamily: "'Georgia', serif",
};
const pageSubtitle = {
  fontSize: "14px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  margin: 0,
};

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "18px",
  padding: "24px",
  marginBottom: "24px",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
};
const cardTitle = {
  fontSize: "18px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: 0,
};
const typeGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
  gap: "8px",
};
const typeBtn = {
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#7a5530",
  fontSize: "13px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};
const typeBtnActive = {
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  border: "1px solid #c97c2e",
  color: "#fff8ee",
  boxShadow: "0 3px 10px rgba(160,80,20,0.18)",
};
const field = { display: "flex", flexDirection: "column", gap: "6px" };
const fieldLabel = {
  fontSize: "11px",
  fontFamily: "sans-serif",
  color: "#9b7040",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};
const input = {
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  fontSize: "14px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};
const textarea = {
  ...input,
  minHeight: "96px",
  resize: "vertical",
  lineHeight: 1.5,
};
const adminTargetBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  background: "#f7ead7",
  border: "1px solid #eddfc8",
  color: "#6b421c",
  fontSize: "13px",
  fontFamily: "sans-serif",
};
const previewBox = {
  padding: "12px",
  borderRadius: "10px",
  background: "#fff8ee",
  border: "1px dashed #d8b98c",
  color: "#6b421c",
  fontSize: "13px",
  fontFamily: "sans-serif",
  lineHeight: 1.5,
};
const statusBox = {
  padding: "10px 12px",
  borderRadius: "10px",
  background: "#fdf8f3",
  border: "1px solid #eddfc8",
  color: "#7a5530",
  fontSize: "13px",
  fontFamily: "sans-serif",
};
const sendBtn = {
  padding: "12px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff8ee",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};

const historySection = {};
const historyTitle = {
  fontSize: "18px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: "0 0 14px",
};
const emptyState = {
  background: "#fffdf9",
  border: "1px dashed #eddfc8",
  borderRadius: "12px",
  padding: "16px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "13px",
};
const historyCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "12px",
  padding: "14px 16px",
  marginBottom: "10px",
};
const historyCardTitle = {
  fontSize: "14px",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  marginBottom: "4px",
};
const historyCardBody = {
  fontSize: "13px",
  color: "#7a5530",
  fontFamily: "sans-serif",
  lineHeight: 1.5,
};
const historyMeta = {
  fontSize: "11px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  marginTop: "6px",
};
