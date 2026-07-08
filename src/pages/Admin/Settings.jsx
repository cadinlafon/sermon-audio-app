import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function Settings() {
  const [shutdown, setShutdown] = useState(false);
  const [message, setMessage] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const configRef = doc(db, "appConfig", "status");

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const snap = await getDoc(configRef);
        if (snap.exists()) {
          const data = snap.data();
          setShutdown(data.shutdown || false);
          setMessage(data.message || "");
          if (data.returnDate) setReturnDate(data.returnDate.toDate().toISOString().slice(0, 16));
        }
      } catch (err) { console.error("Failed to load config:", err); }
      setLoading(false);
    };
    fetchConfig();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateDoc(configRef, { shutdown, message, returnDate: returnDate ? new Date(returnDate) : null });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); alert("Error saving settings."); }
    setSaving(false);
  };

  if (loading) return <div style={loadingWrap}>Loading settings…</div>;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Settings</h1>
        <p style={pageSubtitle}>App-wide configuration options.</p>
      </div>

      <div style={card}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>🛠️</span>
          <h2 style={sectionTitle}>Maintenance Mode</h2>
        </div>

        <div style={toggleRow}>
          <div>
            <div style={toggleLabel}>Enable Maintenance Mode</div>
            <div style={toggleHint}>When on, users see a maintenance screen instead of the app.</div>
          </div>
          <button
            onClick={() => setShutdown(!shutdown)}
            style={shutdown ? { ...toggle, ...toggleOn } : toggle}
            aria-label="Toggle maintenance mode"
          >
            <div style={shutdown ? { ...toggleKnob, transform: "translateX(22px)" } : toggleKnob} />
          </button>
        </div>

        {shutdown && (
          <div style={{ ...statusBanner, background: "#fee2e2", border: "1px solid #fca5a5" }}>
            <span style={{ color: "#dc2626" }}>⚠️ Maintenance mode is ON — the app is currently unavailable to users.</span>
          </div>
        )}

        <Field label="Maintenance Message">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows="3"
            style={{ ...input, resize: "vertical" }}
            placeholder="e.g. We're doing some maintenance. We'll be back soon!"
          />
        </Field>

        <Field label="Estimated Return Date & Time">
          <input
            type="datetime-local"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            style={input}
          />
        </Field>

        <div style={saveRow}>
          <button onClick={handleSave} disabled={saving} style={saving ? { ...saveBtn, opacity: 0.6 } : saveBtn}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
          {saved && <span style={savedMsg}>✓ Saved!</span>}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

const page = { maxWidth: "600px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const loadingWrap = { padding: "40px", fontFamily: "sans-serif", color: "#9b7040" };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "18px", padding: "24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", display: "flex", flexDirection: "column", gap: "20px" };
const sectionHeader = { display: "flex", alignItems: "center", gap: "10px", paddingBottom: "16px", borderBottom: "1px solid #eddfc8" };
const sectionIcon = { fontSize: "20px" };
const sectionTitle = { margin: 0, fontSize: "18px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };

const toggleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" };
const toggleLabel = { fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", marginBottom: "3px" };
const toggleHint = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040" };
const toggle = { width: "46px", height: "26px", borderRadius: "999px", background: "#eddfc8", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" };
const toggleOn = { background: "linear-gradient(135deg, #c97c2e, #a85e18)" };
const toggleKnob = { position: "absolute", top: "3px", left: "3px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", transition: "transform 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" };
const statusBanner = { padding: "10px 14px", borderRadius: "10px", fontSize: "13px", fontFamily: "sans-serif" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const input = { padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const saveRow = { display: "flex", alignItems: "center", gap: "14px" };
const saveBtn = { padding: "12px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const savedMsg = { fontSize: "13px", fontFamily: "sans-serif", color: "#16a34a", fontWeight: "600" };