import { useState, useEffect } from "react";
import { auth, db } from "../../firebase";
import {
  updateEmail, updatePassword, deleteUser, signOut,
  EmailAuthProvider, reauthenticateWithCredential,
} from "firebase/auth";
import { doc, getDoc, updateDoc, deleteDoc } from "firebase/firestore";

export default function Account() {
  const user = auth.currentUser;

  const [fullName, setFullName] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verified, setVerified] = useState(false);
  const [verifyPassword, setVerifyPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [confirmEmail, setConfirmEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [lastLogin, setLastLogin] = useState("");

  useEffect(() => {
    if (!user) return;
    async function loadUser() {
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
          const data = snap.data();
          setFullName(data.fullName || data.name || "");
        }
        setCreatedAt(new Date(user.metadata.creationTime).toLocaleString());
        setLastLogin(new Date(user.metadata.lastSignInTime).toLocaleString());
      } catch (err) { console.error(err); }
    }
    loadUser();
  }, [user]);

  const verifyIdentity = async () => {
    const credential = EmailAuthProvider.credential(user.email, verifyPassword);
    await reauthenticateWithCredential(user, credential);
    setVerified(true);
  };

  const verifyDeleteIdentity = async () => {
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
  };

  const saveName = async () => {
    try {
      await updateDoc(doc(db, "users", user.uid), { fullName });
      alert("Name updated");
    } catch (error) { console.error(error); alert("Failed to update name"); }
  };

  const changeEmail = async () => {
    if (!newEmail) return alert("Enter an email");
    if (newEmail !== confirmEmail) return alert("Email addresses do not match");
    try {
      await updateEmail(user, newEmail);
      setNewEmail(""); setConfirmEmail(""); setVerifyPassword(""); setVerified(false); setShowEmailModal(false);
      alert("Email updated successfully");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") return alert("Incorrect password");
      alert("Failed to update email");
    }
  };

  const changePassword = async () => {
    if (!newPassword) return alert("Enter a new password");
    if (newPassword !== confirmPassword) return alert("Passwords do not match");
    if (newPassword.length < 6) return alert("Password must be at least 6 characters");
    try {
      await updatePassword(user, newPassword);
      setNewPassword(""); setConfirmPassword(""); setVerifyPassword(""); setVerified(false); setShowPasswordModal(false);
      alert("Password updated successfully");
    } catch (error) {
      console.error(error);
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") return alert("Incorrect password");
      alert("Password update failed");
    }
  };

  const logout = async () => { await signOut(auth); };

  const deleteAccount = async () => {
    if (!window.confirm("Delete your account permanently? This cannot be undone.")) return;
    if (!currentPassword) return alert("Enter your password before deleting your account.");
    try {
      await verifyDeleteIdentity();
      await deleteDoc(doc(db, "users", user.uid));
      await deleteUser(user);
    } catch (error) {
      console.error(error);
      if (error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") return alert("Incorrect password");
      alert("Delete failed");
    }
  };

  const openEmailModal    = () => { setVerified(false); setVerifyPassword(""); setShowEmailModal(true); };
  const openPasswordModal = () => { setVerified(false); setVerifyPassword(""); setShowPasswordModal(true); };

  return (
    <div style={container}>

      {/* PROFILE */}
      <Section icon="👤" title="Profile">
        <Field label="Display Name">
          <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your full name" style={input} />
        </Field>
        <button onClick={saveName} style={saveBtn}>Save Name</button>
      </Section>

      {/* EMAIL */}
      <Section icon="✉️" title="Email Address">
        <div style={infoRow}>
          <span style={infoLabel}>Current email</span>
          <span style={infoValue}>{user?.email}</span>
        </div>
        <button onClick={openEmailModal} style={outlineBtn}>Change Email →</button>
      </Section>

      {/* PASSWORD */}
      <Section icon="🔒" title="Password">
        <p style={sectionHint}>Update your password. You'll need to verify your current password first.</p>
        <button onClick={openPasswordModal} style={outlineBtn}>Change Password →</button>
      </Section>

      {/* ACCOUNT INFO */}
      <Section icon="📋" title="Account Information">
        <div style={infoRow}>
          <span style={infoLabel}>Account created</span>
          <span style={infoValue}>{createdAt}</span>
        </div>
        <div style={{ height: "1px", background: "#f0e4d0" }} />
        <div style={infoRow}>
          <span style={infoLabel}>Last sign in</span>
          <span style={infoValue}>{lastLogin}</span>
        </div>
      </Section>

      {/* DANGER ZONE */}
      <Section icon="⚠️" title="Danger Zone" danger>
        <p style={dangerHint}>Deleting your account is permanent and cannot be undone.</p>
        <Field label="Confirm with your password">
          <input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} style={input} />
        </Field>
        <button onClick={deleteAccount} style={deleteBtn}>Delete My Account</button>
      </Section>

      {/* EMAIL MODAL */}
      {showEmailModal && (
        <Modal title="Change Email" onClose={() => setShowEmailModal(false)}>
          {!verified ? (
            <>
              <p style={modalHint}>Signed in as</p>
              <div style={emailBox}>{user?.email}</div>
              <button onClick={logout} style={ghostBtn}>Not you? Sign out</button>
              <Field label="Current Password">
                <input type="password" placeholder="Enter your password" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} style={input} />
              </Field>
              <button onClick={verifyIdentity} style={saveBtn}>Continue →</button>
            </>
          ) : (
            <>
              <Field label="New Email">
                <input placeholder="new@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} style={input} />
              </Field>
              <Field label="Confirm New Email">
                <input placeholder="Confirm email" value={confirmEmail} onChange={(e) => setConfirmEmail(e.target.value)} style={input} />
              </Field>
              <button onClick={changeEmail} style={saveBtn}>Update Email</button>
            </>
          )}
        </Modal>
      )}

      {/* PASSWORD MODAL */}
      {showPasswordModal && (
        <Modal title="Change Password" onClose={() => setShowPasswordModal(false)}>
          {!verified ? (
            <>
              <p style={modalHint}>Signed in as</p>
              <div style={emailBox}>{user?.email}</div>
              <button onClick={logout} style={ghostBtn}>Not you? Sign out</button>
              <Field label="Current Password">
                <input type="password" placeholder="Enter your password" value={verifyPassword} onChange={(e) => setVerifyPassword(e.target.value)} style={input} />
              </Field>
              <button onClick={verifyIdentity} style={saveBtn}>Continue →</button>
            </>
          ) : (
            <>
              <Field label="New Password">
                <input type="password" placeholder="At least 6 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} style={input} />
              </Field>
              <Field label="Confirm New Password">
                <input type="password" placeholder="Repeat new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} style={input} />
              </Field>
              <button onClick={changePassword} style={saveBtn}>Update Password</button>
            </>
          )}
        </Modal>
      )}

    </div>
  );
}

// ── Sub-components ────────────────────────────────────

function Section({ icon, title, danger, children }) {
  return (
    <div style={{ ...card, ...(danger ? dangerCard : {}) }}>
      <div style={cardHeader}>
        <span style={cardIcon}>{icon}</span>
        <h3 style={{ ...cardTitle, ...(danger ? { color: "#dc2626" } : {}) }}>{title}</h3>
      </div>
      <div style={cardBody}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={fieldLabel}>{label}</label>
      {children}
    </div>
  );
}

function Modal({ title, onClose, children }) {
  return (
    <div style={modalOverlay}>
      <div style={modal}>
        <div style={modalHeader}>
          <h3 style={modalTitle}>{title}</h3>
          <button onClick={onClose} style={closeBtn}>✕</button>
        </div>
        <div style={modalBody}>{children}</div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────

const container = {
  maxWidth: "580px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  fontFamily: "'Georgia', serif",
};

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "18px",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
  overflow: "hidden",
};

const dangerCard = {
  border: "1px solid #fca5a5",
  background: "#fff8f8",
};

const cardHeader = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "16px 20px",
  borderBottom: "1px solid #eddfc8",
  background: "#fdf8f3",
};

const cardIcon  = { fontSize: "18px" };
const cardTitle = { margin: 0, fontSize: "16px", fontWeight: "normal", color: "#3d2200" };
const cardBody  = { padding: "18px 20px", display: "flex", flexDirection: "column", gap: "14px" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };

const input = {
  padding: "10px 14px",
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

const infoRow   = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap" };
const infoLabel = { fontSize: "13px", fontFamily: "sans-serif", color: "#9b7040" };
const infoValue = { fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };

const sectionHint = { fontSize: "13px", fontFamily: "sans-serif", color: "#9b7040", margin: 0, lineHeight: 1.6 };
const dangerHint  = { fontSize: "13px", fontFamily: "sans-serif", color: "#b45555", margin: 0, lineHeight: 1.6 };

const saveBtn = {
  padding: "11px 20px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};

const outlineBtn = {
  padding: "10px 18px",
  borderRadius: "10px",
  border: "1px solid #c8922a",
  background: "transparent",
  color: "#7a4f10",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
  alignSelf: "flex-start",
};

const deleteBtn = {
  padding: "11px 20px",
  borderRadius: "10px",
  border: "none",
  background: "#dc2626",
  color: "#fff",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
  boxShadow: "0 3px 10px rgba(220,38,38,0.25)",
};

// Modal
const modalOverlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.5)",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 2000,
  padding: "20px",
};

const modal = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "20px",
  width: "100%",
  maxWidth: "400px",
  overflow: "hidden",
  boxShadow: "0 8px 32px rgba(40,18,0,0.25)",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "16px 20px",
  borderBottom: "1px solid #eddfc8",
  background: "#fdf8f3",
};

const modalTitle = { margin: 0, fontSize: "17px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const closeBtn   = { background: "none", border: "none", fontSize: "16px", color: "#9b7040", cursor: "pointer", lineHeight: 1 };
const modalBody  = { padding: "20px", display: "flex", flexDirection: "column", gap: "14px" };
const modalHint  = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", margin: 0, textTransform: "uppercase", letterSpacing: "0.06em" };

const emailBox = {
  padding: "10px 14px",
  background: "#fdf8f3",
  border: "1px solid #eddfc8",
  borderRadius: "10px",
  fontSize: "14px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  fontWeight: "600",
};

const ghostBtn = {
  background: "none",
  border: "none",
  color: "#c97c2e",
  cursor: "pointer",
  padding: 0,
  fontSize: "13px",
  fontFamily: "sans-serif",
  textAlign: "left",
};