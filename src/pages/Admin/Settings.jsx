import { useEffect, useState } from "react";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "../../firebase";
import { useModulePermissions } from "../../hooks/usePermissions";
import { useAdminPin } from "../../context/AdminPinContext";
import { logAdminAction } from "../../utils/adminAudit";
import { loadAnalyticsPages, saveAnalyticsPages } from "../../utils/analyticsPages";
import { isHttpUrl } from "../../lib/resourceTypes";
import { DEFAULT_IDLE_MINUTES, MIN_IDLE_MINUTES, MAX_IDLE_MINUTES, clampIdleMinutes } from "../../utils/adminIdle";

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
  const [liquidScreen, setLiquidScreen] = useState(false);
  const [adminTimeoutEnabled, setAdminTimeoutEnabled] = useState(true);
  const [adminTimeoutMinutes, setAdminTimeoutMinutes] = useState(String(DEFAULT_IDLE_MINUTES));
  const [analyticsPages, setAnalyticsPages] = useState([]); // [{ id, label, url }]
  const [maxDailyRegistrations, setMaxDailyRegistrations] = useState("");
  const [todayRegistrationCount, setTodayRegistrationCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [originalConfig, setOriginalConfig] = useState(null);
  const [showAiLogs, setShowAiLogs] = useState(false);
  const [aiLogs, setAiLogs] = useState(null);
  const [aiLogsError, setAiLogsError] = useState("");
  const [aiLogsLoading, setAiLogsLoading] = useState(false);

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
          setLiquidScreen(data.liquidScreen === true);
          setAdminTimeoutEnabled(data.adminTimeoutEnabled !== false);
          setAdminTimeoutMinutes(String(clampIdleMinutes(data.adminTimeoutMinutes ?? DEFAULT_IDLE_MINUTES)));
          if (data.maxDailyRegistrations) setMaxDailyRegistrations(String(data.maxDailyRegistrations));
          setOriginalConfig({
            shutdown: data.shutdown || false,
            message: data.message || "",
            audioAiEnabled: data.audioAiEnabled !== undefined ? data.audioAiEnabled : true,
            audioAiAudiences: data.audioAiAudiences || ["guest", "user", "admin"],
            registrationEnabled: data.registrationEnabled !== undefined ? data.registrationEnabled : true,
            maxDailyRegistrations: data.maxDailyRegistrations || 0,
            liquidScreen: data.liquidScreen === true,
            adminTimeoutEnabled: data.adminTimeoutEnabled !== false,
            adminTimeoutMinutes: clampIdleMinutes(data.adminTimeoutMinutes ?? DEFAULT_IDLE_MINUTES),
          });
        }
      } catch (err) { console.error("Failed to load config:", err); }
      setLoading(false);
    };
    fetchConfig();
    loadAnalyticsPages().then(setAnalyticsPages);

    const todayKey = new Date().toISOString().slice(0, 10);
    getDoc(doc(db, "registrationCounts", todayKey))
      .then((snap) => setTodayRegistrationCount(snap.exists() ? snap.data().count || 0 : 0))
      .catch(() => setTodayRegistrationCount(0));
  }, []);

  const toggleShutdown = async () => {
    if (!(await requirePin("appShutdown"))) return;
    setShutdown((v) => !v);
  };

  const loadAiLogs = async () => {
    setAiLogsLoading(true);
    setAiLogsError("");
    try {
      const snap = await getDocs(query(collection(db, "aiSummaryLogs"), orderBy("createdAt", "desc"), limit(50)));
      setAiLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error("Failed to load AI summary logs:", err);
      setAiLogsError("Couldn't load the logs.");
    }
    setAiLogsLoading(false);
  };

  const toggleAiLogs = () => {
    const next = !showAiLogs;
    setShowAiLogs(next);
    if (next && aiLogs === null) loadAiLogs();
  };

  const toggleAudience = (value) => {
    setAudioAiAudiences((current) =>
      current.includes(value) ? current.filter((v) => v !== value) : [...current, value]
    );
  };

  const updateAnalyticsPage = (id, patch) => setAnalyticsPages((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  const moveAnalyticsPage = (i, dir) => setAnalyticsPages((list) => {
    const j = i + dir;
    if (j < 0 || j >= list.length) return list;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  const handleSave = async () => {
    if (!perms.requireEdit()) return;
    const minutes = Number(adminTimeoutMinutes);
    if (adminTimeoutEnabled && (!Number.isInteger(minutes) || minutes < MIN_IDLE_MINUTES || minutes > MAX_IDLE_MINUTES)) {
      alert(`The inactivity timeout must be a whole number of minutes between ${MIN_IDLE_MINUTES} and ${MAX_IDLE_MINUTES}.`);
      return;
    }
    // Blank rows are ignored; every other row needs a name and a real web address.
    const filledPages = analyticsPages.filter((p) => p.label.trim() || p.url.trim());
    const badPage = filledPages.find((p) => !p.label.trim() || !isHttpUrl(p.url));
    if (badPage) {
      alert(`Analytics page "${badPage.label.trim() || badPage.url.trim()}" needs a name and a full link starting with https://`);
      return;
    }
    setSaving(true);
    try {
      const after = {
        shutdown, message,
        audioAiEnabled, audioAiAudiences,
        registrationEnabled, maxDailyRegistrations: Number(maxDailyRegistrations) || 0,
        liquidScreen,
        adminTimeoutEnabled,
        adminTimeoutMinutes: clampIdleMinutes(adminTimeoutMinutes),
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

      await saveAnalyticsPages(filledPages);
      setAnalyticsPages(filledPages);

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
          <div style={{ ...statusBanner, background: "var(--color-fee2e2)", border: "1px solid var(--color-fca5a5)" }}>
            <span style={{ color: "var(--color-dc2626)" }}>⚠️ Maintenance mode is ON — the app is currently unavailable to users.</span>
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

        <div style={logsDivider} />

        <div style={toggleRow}>
          <div>
            <div style={toggleLabel}>Logs</div>
            <div style={toggleHint}>The last 50 times someone ran the AI summary — including repeat clicks on an already-summarized recording.</div>
          </div>
          <button onClick={toggleAiLogs} style={logsToggleBtn}>
            {showAiLogs ? "Hide" : "View"} Logs {showAiLogs ? "▲" : "▼"}
          </button>
        </div>

        {showAiLogs && (
          <div style={logsBox}>
            <div style={logsHeading}>Users who have ran the AI Summarize:</div>
            {aiLogsLoading ? (
              <div style={logsEmpty}>Loading…</div>
            ) : aiLogsError ? (
              <div style={{ ...logsEmpty, color: "var(--color-dc2626)" }}>{aiLogsError}</div>
            ) : aiLogs && aiLogs.length > 0 ? (
              <div style={logsList}>
                {aiLogs.map((log) => (
                  <div key={log.id} style={logRow}>
                    <span style={logRowText}>
                      <strong>{log.userName || log.userEmail || "Unknown user"}</strong>
                      {" – Summarized “"}{log.audioTitle || "Untitled audio"}{"”"}
                    </span>
                    {log.createdAt && <span style={logRowTime}>{formatLogTime(log.createdAt)}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <div style={logsEmpty}>No one has run an AI summary yet.</div>
            )}
          </div>
        )}
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
          <div style={{ ...statusBanner, background: "var(--color-fee2e2)", border: "1px solid var(--color-fca5a5)" }}>
            <span style={{ color: "var(--color-dc2626)" }}>⚠️ Sign-ups are OFF — new visitors can't create an account right now.</span>
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

      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>💧</span>
          <h2 style={sectionTitle}>Liquid Screen</h2>
        </div>

        <div style={toggleRow}>
          <div>
            <div style={toggleLabel}>Liquid Screen</div>
            <div style={toggleHint}>When on, the whole app uses a frosted, translucent "liquid glass" look like Apple devices. When off, it keeps the classic design. Applies to everyone after you save.</div>
          </div>
          <button
            onClick={() => setLiquidScreen(!liquidScreen)}
            style={liquidScreen ? { ...toggle, ...toggleOn } : toggle}
            aria-label="Toggle Liquid Screen"
            aria-pressed={liquidScreen}
          >
            <div style={liquidScreen ? { ...toggleKnob, transform: "translateX(22px)" } : toggleKnob} />
          </button>
        </div>
      </div>

      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>📈</span>
          <h2 style={sectionTitle}>Analytics Pages</h2>
        </div>

        <div style={toggleHint}>
          These show under <strong>Analytics</strong> in the admin sidebar, after the built-in <strong>App</strong> page. Each opens its link in a new tab.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "14px" }}>
          {analyticsPages.map((p, i) => (
            <div key={p.id} style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" }}>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <input style={input} value={p.label} onChange={(e) => updateAnalyticsPage(p.id, { label: e.target.value })} placeholder="Name, e.g. Microsoft Clarity" aria-label={`Analytics page ${i + 1} name`} disabled={!perms.canEdit} />
                {perms.canEdit && (
                  <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
                    <button type="button" style={analyticsToolBtn} onClick={() => moveAnalyticsPage(i, -1)} disabled={i === 0} aria-label={`Move ${p.label || "page"} up`}>▲</button>
                    <button type="button" style={analyticsToolBtn} onClick={() => moveAnalyticsPage(i, 1)} disabled={i === analyticsPages.length - 1} aria-label={`Move ${p.label || "page"} down`}>▼</button>
                    <button type="button" style={{ ...analyticsToolBtn, color: "var(--color-dc2626)", borderColor: "var(--color-fca5a5)" }} onClick={() => setAnalyticsPages((l) => l.filter((x) => x.id !== p.id))} aria-label={`Remove ${p.label || "page"}`}>✕</button>
                  </div>
                )}
              </div>
              <input style={input} value={p.url} onChange={(e) => updateAnalyticsPage(p.id, { url: e.target.value })} placeholder="https://…" aria-label={`Analytics page ${i + 1} link`} disabled={!perms.canEdit} />
            </div>
          ))}
          {analyticsPages.length === 0 && <div style={toggleHint}>No extra analytics pages yet — only the built-in App page shows.</div>}
          {perms.canEdit && (
            <button type="button" style={{ alignSelf: "flex-start", padding: "9px 16px", borderRadius: "999px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" }} onClick={() => setAnalyticsPages((l) => [...l, { id: `page-${Date.now().toString(36)}`, label: "", url: "" }])}>
              + Add analytics page
            </button>
          )}
        </div>
      </div>

      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>⏱️</span>
          <h2 style={sectionTitle}>Admin Inactivity Timeout</h2>
        </div>

        <div style={toggleRow}>
          <div>
            <div style={toggleLabel}>Sign out of the admin dashboard when idle</div>
            <div style={toggleHint}>When on, the dashboard locks and sends you back to the app after this long with no activity, with a "Sign back in" button. Uploads in progress aren't interrupted.</div>
          </div>
          <button
            onClick={() => setAdminTimeoutEnabled(!adminTimeoutEnabled)}
            style={adminTimeoutEnabled ? { ...toggle, ...toggleOn } : toggle}
            aria-label="Toggle admin inactivity timeout"
            aria-pressed={adminTimeoutEnabled}
          >
            <div style={adminTimeoutEnabled ? { ...toggleKnob, transform: "translateX(22px)" } : toggleKnob} />
          </button>
        </div>

        {adminTimeoutEnabled ? (
          <Field label="Length (minutes)">
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="number"
                min={MIN_IDLE_MINUTES}
                max={MAX_IDLE_MINUTES}
                step="1"
                value={adminTimeoutMinutes}
                onChange={(e) => setAdminTimeoutMinutes(e.target.value)}
                style={{ ...input, width: "110px" }}
                aria-label="Inactivity timeout in minutes"
              />
              {[2, 5, 10, 15, 30, 60].map((m) => (
                <button key={m} type="button" onClick={() => setAdminTimeoutMinutes(String(m))} style={String(m) === String(adminTimeoutMinutes) ? { ...logsToggleBtn, background: "var(--color-f6e4b0)", borderColor: "var(--color-c97c2e)" } : logsToggleBtn}>{m} min</button>
              ))}
            </div>
            <div style={toggleHint}>Between {MIN_IDLE_MINUTES} and {MAX_IDLE_MINUTES} minutes. The default is {DEFAULT_IDLE_MINUTES}.</div>
          </Field>
        ) : (
          <div style={{ ...statusBanner, background: "var(--color-fee2e2)", border: "1px solid var(--color-fca5a5)" }}>
            <span style={{ color: "var(--color-dc2626)" }}>⚠️ The timeout is OFF — anyone using a browser where you're signed in as admin stays in the dashboard until they close it or log out.</span>
          </div>
        )}
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

function formatLogTime(createdAt) {
  const date = typeof createdAt?.toDate === "function" ? createdAt.toDate() : new Date(createdAt);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

const page = { maxWidth: "600px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0 };
const loadingWrap = { padding: "40px", fontFamily: "sans-serif", color: "var(--color-9b7040)" };

const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "18px", padding: "24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", display: "flex", flexDirection: "column", gap: "20px" };
const sectionHeader = { display: "flex", alignItems: "center", gap: "10px", paddingBottom: "16px", borderBottom: "1px solid var(--color-eddfc8)" };
const sectionIcon = { fontSize: "20px" };
const sectionTitle = { margin: 0, fontSize: "18px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" };

const toggleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" };
const toggleLabel = { fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", marginBottom: "3px" };
const toggleHint = { fontSize: "12px", fontFamily: "sans-serif", color: "var(--color-9b7040)" };
const toggle = { width: "46px", height: "26px", borderRadius: "999px", background: "var(--color-eddfc8)", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" };
const toggleOn = { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))" };
const toggleKnob = { position: "absolute", top: "3px", left: "3px", width: "20px", height: "20px", borderRadius: "50%", background: "var(--color-ffffff)", transition: "transform 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" };
const statusBanner = { padding: "10px 14px", borderRadius: "10px", fontSize: "13px", fontFamily: "sans-serif" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", letterSpacing: "0.06em", textTransform: "uppercase" };
const logsDivider = { borderTop: "1px solid var(--color-eddfc8)", margin: "4px 0" };
const logsToggleBtn = { padding: "8px 14px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-3d2200)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const logsBox = { background: "var(--color-fdf8f3)", border: "1px solid var(--color-eddfc8)", borderRadius: "12px", padding: "14px 16px" };
const logsHeading = { fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-3d2200)", fontWeight: "600", marginBottom: "10px" };
const logsList = { display: "flex", flexDirection: "column", gap: "8px", maxHeight: "320px", overflowY: "auto" };
const logRow = { display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "10px", padding: "8px 10px", background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "8px" };
const logRowText = { fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-3d2200)", lineHeight: "1.4" };
const logRowTime = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", whiteSpace: "nowrap", flexShrink: 0 };
const logsEmpty = { fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-9b7040)" };
const checkRow = { display: "flex", gap: "16px", flexWrap: "wrap" };
const checkLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-5c3a1e)", cursor: "pointer" };
const input = { padding: "10px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none", width: "100%", boxSizing: "border-box" };
const saveRow = { display: "flex", alignItems: "center", gap: "14px", marginTop: "20px" };
const saveBtn = { padding: "12px 24px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const savedMsg = { fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-16a34a)", fontWeight: "600" };
const analyticsToolBtn = { width: "30px", height: "30px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "12px" };
