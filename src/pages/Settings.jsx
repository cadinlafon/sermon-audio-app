import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import {
  signOut,
  updatePassword,
  updateEmail,
  deleteUser
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const user = auth.currentUser;
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [notifications, setNotifications] = useState(true);
  const [message, setMessage] = useState("");

  // 🔹 Load user profile data
  useEffect(() => {
    const loadUserData = async () => {
      if (!user) return;

      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const data = docSnap.data();
        setDisplayName(data.displayName || "");
        setNotifications(data.notifications ?? true);
      }
    };

    loadUserData();
  }, [user]);

  // 🔹 Save Profile (Name + Notifications)
  const handleSaveProfile = async () => {
    if (!user) return;

    await setDoc(doc(db, "users", user.uid), {
      displayName,
      notifications,
      email: user.email,
      updatedAt: new Date(),
    });

    setMessage("Profile updated successfully!");
  };

  // 🔹 Change Email
  const handleChangeEmail = async () => {
    if (!newEmail) {
      setMessage("Enter a new email.");
      return;
    }

    try {
      await updateEmail(user, newEmail);
      setMessage("Email updated successfully!");
      setNewEmail("");
    } catch (error) {
      setMessage("Please log in again before changing email.");
    }
  };

  // 🔹 Change Password
  const handleChangePassword = async () => {
    if (!newPassword) {
      setMessage("Enter a new password.");
      return;
    }

    try {
      await updatePassword(user, newPassword);
      setMessage("Password updated successfully!");
      setNewPassword("");
    } catch (error) {
      setMessage("Please log in again before changing password.");
    }
  };

  // 🔹 Logout
  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  // 🔹 Delete Account
  const handleDeleteAccount = async () => {
    const confirmDelete = window.confirm(
      "Are you sure? This permanently deletes your account."
    );
    if (!confirmDelete) return;

    try {
      await deleteUser(user);
      navigate("/");
    } catch (error) {
      setMessage("Please log in again before deleting account.");
    }
  };

  if (!user) {
    return (
      <div style={{ padding: "60px", textAlign: "center" }}>
        <h2>Please log in to access settings.</h2>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2>Account Settings</h2>

        <div style={styles.section}>
          <label>Display Name (Optional)</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            style={styles.input}
          />
        </div>

        <div style={styles.section}>
          <label>Current Email</label>
          <p style={{ margin: "5px 0" }}>{user.email}</p>
          <input
            placeholder="New Email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            style={styles.input}
          />
          <button style={styles.button} onClick={handleChangeEmail}>
            Change Email
          </button>
        </div>

        <div style={styles.section}>
          <label>New Password</label>
          <input
            type="password"
            placeholder="New Password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={styles.input}
          />
          <button style={styles.button} onClick={handleChangePassword}>
            Update Password
          </button>
        </div>

        <div style={styles.section}>
          <label>
            <input
              type="checkbox"
              checked={notifications}
              onChange={() => setNotifications(!notifications)}
            />
            Enable Notifications
          </label>
        </div>

        <button style={styles.saveButton} onClick={handleSaveProfile}>
          Save Profile
        </button>

        <hr style={{ margin: "30px 0" }} />

        <button style={styles.logoutButton} onClick={handleLogout}>
          Logout
        </button>

        <button style={styles.deleteButton} onClick={handleDeleteAccount}>
          Delete Account
        </button>
<label>
  <input
    type="checkbox"
    checked={prefs.sermon}
    onChange={() => togglePreference("sermon")}
  />
  Sermons
</label>

<label>
  <input
    type="checkbox"
    checked={prefs.announcement}
    onChange={() => togglePreference("announcement")}
  />
  Announcements
</label>

<label>
  <input
    type="checkbox"
    checked={prefs.homily}
    onChange={() => togglePreference("homily")}
  />
  Homilies
</label>
        {message && <p style={styles.message}>{message}</p>}
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    justifyContent: "center",
    padding: "60px 20px",
    background: "#f5f6fa",
    minHeight: "100vh",
  },
  card: {
    background: "#fff",
    padding: "40px",
    borderRadius: "12px",
    width: "100%",
    maxWidth: "500px",
    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
  },
  section: {
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
  },
  input: {
    padding: "10px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    marginTop: "5px",
  },
  button: {
    marginTop: "10px",
    padding: "8px 12px",
    borderRadius: "6px",
    border: "none",
    background: "#222",
    color: "#fff",
    cursor: "pointer",
  },
  saveButton: {
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    background: "#4CAF50",
    color: "#fff",
    cursor: "pointer",
    width: "100%",
  },
  logoutButton: {
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    background: "#555",
    color: "#fff",
    cursor: "pointer",
    width: "100%",
    marginBottom: "10px",
  },
  deleteButton: {
    padding: "10px",
    borderRadius: "6px",
    border: "none",
    background: "#e53935",
    color: "#fff",
    cursor: "pointer",
    width: "100%",
  },
  message: {
    marginTop: "20px",
    color: "#333",
  },
};
