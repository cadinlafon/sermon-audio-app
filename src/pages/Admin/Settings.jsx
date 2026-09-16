import { useEffect, useState } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useModulePermissions } from "../../hooks/usePermissions";
import { useAdminPin } from "../../context/AdminPinContext";
import { logAdminAction } from "../../utils/adminAudit";

const AUDIENCE_OPTIONS = [
  { value: "guest", label: "Guests" },
  { value: "user", label: "Users" },
  { value: "admin", label: "Admins" },
];

export default function Settings() {
  const perms = useModulePermissions("settings");
  const pinCtx = useAdminPin();
  const requirePin = pinCtx?.requirePin || (async () => true);
  const [shutdown, setShutdown] = useState(false);
  const [message, setMessage] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [audioAiEnabled, setAudioAiEnabled] = useState(true);
  const [audioAiAudiences, setAudioAiAudiences] = useState(["guest", "user", "admin"]);
  const [registrationEnabled, setRegistrationEnabled] = useState(true);
  const [maxDailyRegistrations, setMaxDailyRegistrations] = useState("");
  const [todayRegistrationCount, setTodayRegistrationCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(null);

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
          if (data.audioAiEnabled !== undefined) setAudioAiEnabled(data.audioAiEnabled);
          if (data.audioAiAudiences !== undefined) setAudioAiAudiences(data.audioAiAudiences);
          if (data.registrationEnabled !== undefined) setRegistrationEnabled(data.registrationEnabled);
          if (data.maxDailyRegistrations) setMaxDailyRegistrations(String(data.maxDailyRegistrations));
          setOriginalConfig({
            shutdown: data.shutdown || false,
            message: data.message || "",
            audioAiEnabled: data.audioAiEnabled !== undefined ? data.audioAiEnabled : true,
            audioAiAudiences: data.audioAiAudiences || ["guest", "user", "admin"],
            registrationEnabled: data.registrationEnabled !== undefined ? data.registrationEnabled : true,
            maxDailyRegistrations: data.maxDailyRegistrations || 0,
          });
        }
      } catch (err) { console.error("Failed to load config:", err); }
      setLoading(false);
    };
    fetchConfig();

    const todayKey = new Date().toISOString().slice(0, 10);
    getDoc(doc(db, "registrationCounts", todayKey))
      .then((snap) => setTodayRegistrationCount(snap.exists() ? snap.data().count || 0 : 0))
      .catch(() => setTodayRegistrationCount(0));
  }, []);

  const toggleShutdown = async () => {
    if (!(await requirePin("appShutdown"))) return;
    setShutdown((v) => !v);
  };

  const toggleAudience = (value) => {
    setAudioAiAudiences((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  };

  const handleSave = async () => {
    if (!perms.requireEdit()) return;
    setSaving(true);
    try {
      const after = {
        shutdown, message,
        audioAiEnabled, audioAiAudiences,
        registrationEnabled, maxDailyRegistrations: Number(maxDailyRegistrations) || 0,
      };

      await updateDoc(configRef, {
        ...after,
        returnDate: returnDate ? new Date(returnDate) : null,
      });

      logAdminAction({
        category: "settings_change",
        action: "saveAppConfig",
        targetType: "appConfig",
        targetId: "status",
        targetLabel: "App Settings",
        before: originalConfig,
        after,
      });

      setOriginalConfig(after);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) { console.error(err); alert("Error saving settings."); }
    setSaving(false);
  };

  if (loading) return <div style={loadingWrap}>Loading settings…</div>;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Advanced</h1>
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
            onClick={toggleShutdown}
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
      </div>

      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>✦</span>
          <h2 style={sectionTitle}>Audio AI</h2>
        </div>

        <div style={toggleRow}>
          <div>
            <div style={toggleLabel}>Enable Audio AI</div>
            <div style={toggleHint}>When off, the AI summary buttons are hidden on every audio page.</div>
          </div>
          <button
            onClick={() => setAudioAiEnabled(!audioAiEnabled)}
            style={audioAiEnabled ? { ...toggle, ...toggleOn } : toggle}
            aria-label="Toggle Audio AI"
          >
            <div style={audioAiEnabled ? { ...toggleKnob, transform: "translateX(22px)" } : toggleKnob} />
          </button>
        </div>

        <Field label="Who can use it">
          <div style={checkRow}>
            {AUDIENCE_OPTIONS.map((opt) => (
              <label key={opt.value} style={checkLabel}>
                <input
                  type="checkbox"
                  checked={audioAiAudiences.includes(opt.value)}
                  onChange={() => toggleAudience(opt.value)}
                  disabled={!audioAiEnabled}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </Field>
      </div>

      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>👤</span>
          <h2 style={sectionTitle}>App Registration</h2>
        </div>

        <div style={toggleRow}>
          <div>
            <div style={toggleLabel}>Allow New Sign-Ups</div>
            <div style={toggleHint}>When off, the Sign Up page (and first-time Google sign-in) turns visitors away.</div>
          </div>
          <button
            onClick={() => setRegistrationEnabled(!registrationEnabled)}
            style={registrationEnabled ? { ...toggle, ...toggleOn } : toggle}
            aria-label="Toggle new sign-ups"
          >
            <div style={registrationEnabled ? { ...toggleKnob, transform: "translateX(22px)" } : toggleKnob} />
          </button>
        </div>

        {!registrationEnabled && (
          <div style={{ ...statusBanner, background: "#fee2e2", border: "1px solid #fca5a5" }}>
            <span style={{ color: "#dc2626" }}>⚠️ Sign-ups are OFF — new visitors can't create an account right now.</span>
          </div>
        )}

        <Field label="Max Daily Sign-Ups">
          <input
            type="number"
            min="0"
            value={maxDailyRegistrations}
            onChange={(e) => setMaxDailyRegistrations(e.target.value)}
            style={input}
            placeholder="Leave blank for unlimited"
          />
          <div style={toggleHint}>
            {todayRegistrationCount === null ? "Loading today's count…" : `${todayRegistrationCount} sign-up${todayRegistrationCount === 1 ? "" : "s"} so far today.`}
          </div>
        </Field>
      </div>

      <div style={saveRow}>
        {perms.canEdit && (
          <button onClick={handleSave} disabled={saving} style={saving ? { ...saveBtn, opacity: 0.6 } : saveBtn}>
            {saving ? "Saving…" : "Save Settings"}
          </button>
        )}
        {saved && <span style={savedMsg}>✓ Saved!</span>}
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
const checkRow = { display: "flex", gap: "16px", flexWrap: "wrap" };
const checkLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", cursor: "pointer" };
const input = { padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const saveRow = { display: "flex", alignItems: "center", gap: "14px", marginTop: "20px" };
const saveBtn = { padding: "12px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const savedMsg = { fontSize: "13px", fontFamily: "sans-serif", color: "#16a34a", fontWeight: "600" };