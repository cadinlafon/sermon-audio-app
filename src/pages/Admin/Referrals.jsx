import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

import { db } from "../../firebase";
import { PLATFORMS, normalizePlatform } from "../../utils/trafficSource";

const FEATURED_PLATFORMS = [
  "facebook",
  "instagram",
  "youtube",
  "chatgpt",
  "claude",
  "google",
  "direct",
];

const RANGE_OPTIONS = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

function getLogPlatform(log) {
  if (log.latestPlatform) return log.latestPlatform;
  if (log.firstPlatform) return log.firstPlatform;

  const guess = normalizePlatform(
    log.latestTrafficSource || log.firstTrafficSource || null,
    null
  );

  return PLATFORMS[guess] ? guess : "other";
}

function emptyStats() {
  const stats = {};
  Object.keys(PLATFORMS).forEach((key) => {
    stats[key] = {
      visits: 0,
      uniqueVisitors: new Set(),
      sessions: new Set(),
      signups: 0,
    };
  });
  return stats;
}

export default function Referrals() {
  const [tab, setTab] = useState("overview");
  const [rangeDays, setRangeDays] = useState(30);

  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  //////////////////////////////////////////////////
  // LOAD LOGS — bounded to the selected date range so this
  // never has to scan the entire history of the app.
  //////////////////////////////////////////////////
  useEffect(() => {
    const cutoff = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000);

    setLoadingLogs(true);

    const q = query(
      collection(db, "logs"),
      where("createdAt", ">=", cutoff)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setLogs(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoadingLogs(false);
      },
      (error) => {
        console.error("Referrals: logs query failed", error);
        setLoadingLogs(false);
      }
    );

    return () => unsub();
  }, [rangeDays]);

  //////////////////////////////////////////////////
  // LOAD USERS — for signup attribution. This is a small
  // collection (one doc per account), so loading it in full is fine.
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsub = onSnapshot(collection(db, "users"), (snapshot) => {
      setUsers(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return () => unsub();
  }, []);

  //////////////////////////////////////////////////
  // AGGREGATE
  //////////////////////////////////////////////////
  const { platformStats, dailySeries, totals, topLines } = useMemo(() => {
    const stats = emptyStats();
    const dayMap = {};

    logs.forEach((log) => {
      if (log.event !== "app_opened") return;

      const platform = PLATFORMS[getLogPlatform(log)] ? getLogPlatform(log) : "other";
      const bucket = stats[platform];

      bucket.visits += 1;
      if (log.visitorId) bucket.uniqueVisitors.add(log.visitorId);
      if (log.sessionId) bucket.sessions.add(log.sessionId);

      if (log.createdAt?.seconds) {
        const dateKey = new Date(log.createdAt.seconds * 1000)
          .toISOString()
          .split("T")[0];

        if (!dayMap[dateKey]) dayMap[dateKey] = {};
        dayMap[dateKey][platform] = (dayMap[dateKey][platform] || 0) + 1;
      }
    });

    users.forEach((user) => {
      const platform = PLATFORMS[user.referral?.platform]
        ? user.referral.platform
        : "direct";

      stats[platform].signups += 1;
    });

    const dailySeriesArr = Object.keys(dayMap)
      .sort()
      .map((date) => ({ date, ...dayMap[date] }));

    const totalVisits = Object.values(stats).reduce((sum, s) => sum + s.visits, 0);

    const totalUniqueVisitors = new Set(
      logs.filter((l) => l.event === "app_opened" && l.visitorId).map((l) => l.visitorId)
    ).size;

    const top = Object.entries(stats)
      .sort((a, b) => b[1].visits - a[1].visits)
      .filter(([, s]) => s.visits > 0)
      .slice(0, 5)
      .map(([key]) => key);

    return {
      platformStats: stats,
      dailySeries: dailySeriesArr,
      totals: {
        visits: totalVisits,
        uniqueVisitors: totalUniqueVisitors,
        signups: users.length,
      },
      topLines: top,
    };
  }, [logs, users]);

  const displayedPlatforms = useMemo(() => {
    const extras = Object.keys(PLATFORMS).filter(
      (key) =>
        !FEATURED_PLATFORMS.includes(key) &&
        (platformStats[key].visits > 0 || platformStats[key].signups > 0)
    );

    const ordered = [...FEATURED_PLATFORMS, ...extras];

    return ordered
      .map((key) => ({ key, ...PLATFORMS[key], stats: platformStats[key] }))
      .sort((a, b) => {
        // Keep the featured set first among themselves, sorted by visits,
        // then any extra detected sources after, also sorted by visits.
        const aFeatured = FEATURED_PLATFORMS.includes(a.key);
        const bFeatured = FEATURED_PLATFORMS.includes(b.key);
        if (aFeatured !== bFeatured) return aFeatured ? -1 : 1;
        return b.stats.visits - a.stats.visits;
      });
  }, [platformStats]);

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h1 style={title}>Referrals</h1>
          <p style={subtitle}>
            See where your visitors and signups are coming from.
          </p>
        </div>

        <div style={tabRow}>
          <TabButton active={tab === "overview"} onClick={() => setTab("overview")}>
            Overview
          </TabButton>
          <TabButton active={tab === "links"} onClick={() => setTab("links")}>
            Quick Links
          </TabButton>
          <TabButton active={tab === "campaigns"} onClick={() => setTab("campaigns")}>
            Campaign Links
          </TabButton>
        </div>
      </div>

      {tab === "overview" && (
        <Overview
          rangeDays={rangeDays}
          setRangeDays={setRangeDays}
          loading={loadingLogs}
          totals={totals}
          displayedPlatforms={displayedPlatforms}
          dailySeries={dailySeries}
          topLines={topLines}
        />
      )}

      {tab === "links" && <QuickLinks />}

      {tab === "campaigns" && <CampaignLinks logs={logs} rangeDays={rangeDays} />}
    </div>
  );
}

//////////////////////////////////////////////////
// OVERVIEW TAB
//////////////////////////////////////////////////

function Overview({
  rangeDays,
  setRangeDays,
  loading,
  totals,
  displayedPlatforms,
  dailySeries,
  topLines,
}) {
  return (
    <>
      <div style={rangeRow}>
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.days}
            onClick={() => setRangeDays(opt.days)}
            style={
              rangeDays === opt.days
                ? { ...rangeButton, ...rangeButtonActive }
                : rangeButton
            }
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={summaryGrid}>
        <SummaryCard label={`Visits (last ${rangeDays} days)`} value={totals.visits} />
        <SummaryCard
          label={`Unique visitors (last ${rangeDays} days)`}
          value={totals.uniqueVisitors}
        />
        <SummaryCard label="Signups (all time)" value={totals.signups} />
      </div>

      {loading && <div style={empty}>Loading referral data…</div>}

      <div style={grid}>
        {displayedPlatforms.map((p) => (
          <div key={p.key} style={card}>
            <div style={cardTop}>
              <span style={cardIcon}>{p.icon}</span>
              <span style={cardLabel}>{p.label}</span>
            </div>

            <div style={statsGrid}>
              <div style={stat}>
                <strong>{p.stats.visits}</strong>
                <span>Visits</span>
              </div>
              <div style={stat}>
                <strong>{p.stats.uniqueVisitors.size}</strong>
                <span>Unique</span>
              </div>
              <div style={stat}>
                <strong>{p.stats.signups}</strong>
                <span>Signups</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={chartCard}>
        <h2 style={sectionTitle}>Visits over time</h2>

        {dailySeries.length === 0 ? (
          <div style={empty}>No visit data yet for this range.</div>
        ) : (
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eddfc8" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fontFamily: "sans-serif" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: "sans-serif" }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontFamily: "sans-serif", fontSize: 12 }} />
              {topLines.map((key) => (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  name={PLATFORMS[key].label}
                  stroke={PLATFORMS[key].color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={summaryCard}>
      <strong style={summaryValue}>{value}</strong>
      <span style={summaryLabel}>{label}</span>
    </div>
  );
}

//////////////////////////////////////////////////
// QUICK LINKS TAB — ready-made UTM links for common
// platforms, generated instantly, no setup required.
//////////////////////////////////////////////////

const QUICK_LINK_DEFAULTS = [
  { key: "facebook", medium: "social" },
  { key: "instagram", medium: "social" },
  { key: "youtube", medium: "video" },
  { key: "chatgpt", medium: "ai" },
  { key: "claude", medium: "ai" },
  { key: "google", medium: "search" },
  { key: "tiktok", medium: "social" },
  { key: "email", medium: "email" },
  { key: "sms", medium: "sms" },
  { key: "bulletin", medium: "print" },
];

function QuickLinks() {
  const [campaign, setCampaign] = useState("general");

  function buildUrl(platformKey, medium) {
    const url = new URL(window.location.origin + "/");
    url.searchParams.set("utm_source", platformKey);
    url.searchParams.set("utm_medium", medium);
    if (campaign.trim()) url.searchParams.set("utm_campaign", campaign.trim());
    return url.toString();
  }

  async function copyLink(url) {
    await navigator.clipboard.writeText(url);
    alert("Link copied!");
  }

  function showQr(url) {
    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" +
      encodeURIComponent(url);
    window.open(qrUrl, "_blank");
  }

  return (
    <div>
      <div style={quickLinksIntro}>
        <p style={subtitle}>
          Ready-to-use tracking links for the usual places you share the app.
          Every visit and signup through one of these is automatically
          bucketed into the matching platform on the Overview tab — nothing
          to set up ahead of time.
        </p>

        <div style={field}>
          <label style={labelStyle}>Campaign label (optional)</label>
          <input
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            style={input}
            placeholder="e.g. summer-2026"
          />
        </div>
      </div>

      <div style={linksGrid}>
        {QUICK_LINK_DEFAULTS.map(({ key, medium }) => {
          const platform = PLATFORMS[key];
          const url = buildUrl(key, medium);

          return (
            <div key={key} style={card}>
              <div style={cardTop}>
                <span style={cardIcon}>{platform.icon}</span>
                <span style={cardLabel}>{platform.label}</span>
              </div>

              <div style={trackingUrl}>{url}</div>

              <div style={cardActions}>
                <button style={secondaryButton} onClick={() => copyLink(url)}>
                  Copy URL
                </button>
                <button style={secondaryButton} onClick={() => showQr(url)}>
                  QR Code
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

//////////////////////////////////////////////////
// CAMPAIGN LINKS TAB — custom named tracking links for
// specific posts/pushes (e.g. "FB — Easter post" vs generic Facebook).
// Reuses the bounded `logs` already loaded for the Overview tab
// instead of running its own separate unbounded query.
//////////////////////////////////////////////////

const defaultForm = {
  name: "",
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
  utmId: "",
  type: "Other",
  description: "",
  notes: "",
  destinationUrl: "",
};

const sourceTypes = [
  "Social Media",
  "QR Code",
  "Printed Flyer",
  "Website",
  "Email",
  "Advertisement",
  "Church Bulletin",
  "Other",
];

function getTrackingUrl(point) {
  const base = point.destinationUrl || window.location.origin + "/";

  try {
    const url = new URL(base);
    if (point.source) url.searchParams.set("utm_source", point.source);
    if (point.medium) url.searchParams.set("utm_medium", point.medium);
    if (point.campaign) url.searchParams.set("utm_campaign", point.campaign);
    if (point.content) url.searchParams.set("utm_content", point.content);
    if (point.term) url.searchParams.set("utm_term", point.term);
    if (point.utmId) url.searchParams.set("utm_id", point.utmId);
    return url.toString();
  } catch {
    return `${window.location.origin}/?utm_source=${encodeURIComponent(point.source || "")}`;
  }
}

function CampaignLinks({ logs, rangeDays }) {
  const [points, setPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    const q = query(collection(db, "entrancePoints"), orderBy("createdAt", "desc"));

    const unsub = onSnapshot(q, (snapshot) => {
      setPoints(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const statistics = useMemo(() => {
    const result = {};

    points.forEach((point) => {
      result[point.id] = {
        visits: 0,
        visitors: new Set(),
        sessions: new Set(),
      };
    });

    logs.forEach((log) => {
      if (log.event !== "app_opened") return;

      const source = log.latestTrafficSource || log.firstTrafficSource;
      if (!source) return;

      points.forEach((point) => {
        if (!point.source) return;
        if (point.source.toLowerCase() !== source.toLowerCase()) return;

        const bucket = result[point.id];
        bucket.visits += 1;
        if (log.visitorId) bucket.visitors.add(log.visitorId);
        if (log.sessionId) bucket.sessions.add(log.sessionId);
      });
    });

    return result;
  }, [points, logs]);

  function updateForm(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function createPoint(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter a name.");
      return;
    }
    if (!form.source.trim()) {
      alert("Please enter a UTM source.");
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, "entrancePoints"), {
        name: form.name.trim(),
        source: form.source.trim(),
        medium: form.medium.trim() || null,
        campaign: form.campaign.trim() || null,
        content: form.content.trim() || null,
        term: form.term.trim() || null,
        utmId: form.utmId.trim() || null,
        type: form.type,
        description: form.description.trim() || null,
        notes: form.notes.trim() || null,
        destinationUrl: form.destinationUrl.trim() || null,
        active: true,
        createdAt: serverTimestamp(),
      });

      setForm(defaultForm);
      setShowCreate(false);
    } catch (error) {
      console.error(error);
      alert("Could not create the campaign link.");
    } finally {
      setSaving(false);
    }
  }

  async function disablePoint(point) {
    if (!window.confirm(`Disable "${point.name}"?`)) return;

    try {
      await updateDoc(doc(db, "entrancePoints", point.id), {
        active: false,
        disabledAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
      alert("Could not disable this campaign link.");
    }
  }

  async function copyUrl(point) {
    await navigator.clipboard.writeText(getTrackingUrl(point));
    alert("Tracking URL copied!");
  }

  function showQrCode(point) {
    const qrUrl =
      "https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=" +
      encodeURIComponent(getTrackingUrl(point));
    window.open(qrUrl, "_blank");
  }

  return (
    <div>
      <div style={campaignHeader}>
        <p style={subtitle}>
          For tracking a specific post or push separately from your general
          platform links (stats below reflect the last {rangeDays} days).
        </p>
        <button style={addButton} onClick={() => setShowCreate(true)}>
          +
        </button>
      </div>

      {loading && <div style={empty}>Loading campaign links…</div>}

      {!loading && points.length === 0 && (
        <div style={empty}>
          <div style={emptyIcon}>🔗</div>
          <h2>No campaign links yet</h2>
          <p>Create one to track a specific post, flyer, or push.</p>
          <button style={primaryButton} onClick={() => setShowCreate(true)}>
            Create Campaign Link
          </button>
        </div>
      )}

      <div style={grid}>
        {points.map((point) => {
          const stats = statistics[point.id] || {
            visits: 0,
            visitors: new Set(),
            sessions: new Set(),
          };

          return (
            <div key={point.id} style={{ ...card, opacity: point.active ? 1 : 0.6 }}>
              <div style={cardTop}>
                <div>
                  <div style={typeBadge}>{point.type || "Other"}</div>
                  <div style={cardLabel}>{point.name}</div>
                  <div style={sourceText}>utm_source={point.source}</div>
                </div>
                <div
                  style={{
                    ...statusPill,
                    background: point.active ? "#e7f6e9" : "#f3e5e5",
                    color: point.active ? "#286a31" : "#8a3d3d",
                  }}
                >
                  {point.active ? "Active" : "Disabled"}
                </div>
              </div>

              <div style={statsGrid}>
                <div style={stat}>
                  <strong>{stats.visits}</strong>
                  <span>Visits</span>
                </div>
                <div style={stat}>
                  <strong>{stats.visitors.size}</strong>
                  <span>Unique</span>
                </div>
                <div style={stat}>
                  <strong>{stats.sessions.size}</strong>
                  <span>Sessions</span>
                </div>
              </div>

              <div style={cardActions}>
                <button style={secondaryButton} onClick={() => copyUrl(point)}>
                  Copy URL
                </button>
                <button style={secondaryButton} onClick={() => showQrCode(point)}>
                  QR Code
                </button>
                {point.active && (
                  <button style={dangerButton} onClick={() => disablePoint(point)}>
                    Disable
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showCreate && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>Create Campaign Link</h2>
                <p style={modalSubtitle}>Custom UTM tracking link.</p>
              </div>
              <button style={closeButton} onClick={() => setShowCreate(false)}>
                ×
              </button>
            </div>

            <form onSubmit={createPoint} style={formStyle}>
              <Field label="Name" required value={form.name} onChange={(v) => updateForm("name", v)} placeholder="Easter FB post" />
              <Field label="UTM Source" required value={form.source} onChange={(v) => updateForm("source", v)} placeholder="facebook" />
              <Field label="UTM Medium" value={form.medium} onChange={(v) => updateForm("medium", v)} placeholder="social" />
              <Field label="UTM Campaign" value={form.campaign} onChange={(v) => updateForm("campaign", v)} placeholder="easter-2026" />
              <Field label="UTM Content" value={form.content} onChange={(v) => updateForm("content", v)} placeholder="post-1" />
              <Field label="UTM Term" value={form.term} onChange={(v) => updateForm("term", v)} placeholder="Optional" />
              <Field label="UTM ID" value={form.utmId} onChange={(v) => updateForm("utmId", v)} placeholder="Optional" />

              <div style={field}>
                <label style={labelStyle}>Type</label>
                <select value={form.type} onChange={(e) => updateForm("type", e.target.value)} style={input}>
                  {sourceTypes.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>

              <Field label="Description" value={form.description} onChange={(v) => updateForm("description", v)} placeholder="Facebook Easter post" />
              <Field label="Destination URL" value={form.destinationUrl} onChange={(v) => updateForm("destinationUrl", v)} placeholder={window.location.origin + "/"} />

              <div style={field}>
                <label style={labelStyle}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => updateForm("notes", e.target.value)}
                  style={{ ...input, minHeight: "80px", resize: "vertical" }}
                />
              </div>

              <div style={urlPreview}>
                <span>Your tracking URL will look like:</span>
                <code>
                  {window.location.origin}/?utm_source={form.source || "example"}
                  {form.medium ? `&utm_medium=${form.medium}` : ""}
                  {form.campaign ? `&utm_campaign=${form.campaign}` : ""}
                </code>
              </div>

              <div style={formActions}>
                <button type="button" style={secondaryButton} onClick={() => setShowCreate(false)}>
                  Cancel
                </button>
                <button type="submit" style={primaryButton} disabled={saving}>
                  {saving ? "Creating…" : "Create Campaign Link"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, required, value, onChange, placeholder }) {
  return (
    <div style={field}>
      <label style={labelStyle}>
        {label}
        {required && <span style={{ color: "#b34a35" }}> *</span>}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={input} />
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={active ? { ...tabButton, ...tabButtonActive } : tabButton}>
      {children}
    </button>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = { maxWidth: "1200px" };

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-end",
  flexWrap: "wrap",
  gap: "16px",
  marginBottom: "20px",
};

const title = {
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  margin: 0,
  fontFamily: "'Georgia', serif",
};

const subtitle = {
  color: "#9b7040",
  margin: "5px 0 0",
  fontFamily: "sans-serif",
  fontSize: "14px",
};

const tabRow = { display: "flex", gap: "6px" };

const tabButton = {
  border: "1px solid #eddfc8",
  borderRadius: "9px",
  padding: "9px 16px",
  background: "#fffdf9",
  color: "#7a4f10",
  cursor: "pointer",
  fontFamily: "sans-serif",
  fontSize: "13px",
};

const tabButtonActive = {
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff",
  border: "1px solid transparent",
};

const rangeRow = { display: "flex", gap: "6px", marginBottom: "18px" };

const rangeButton = {
  border: "1px solid #eddfc8",
  borderRadius: "999px",
  padding: "6px 14px",
  background: "#fffdf9",
  color: "#7a4f10",
  cursor: "pointer",
  fontFamily: "sans-serif",
  fontSize: "12px",
};

const rangeButtonActive = {
  background: "#f4e7d4",
  color: "#3d2200",
  fontWeight: "bold",
};

const summaryGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
  gap: "12px",
  marginBottom: "22px",
};

const summaryCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "14px",
  padding: "16px 18px",
  display: "flex",
  flexDirection: "column",
  gap: "4px",
};

const summaryValue = {
  fontSize: "26px",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
};

const summaryLabel = {
  fontSize: "12px",
  color: "#9b7040",
  fontFamily: "sans-serif",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: "14px",
  marginBottom: "24px",
};

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "16px",
};

const cardTop = { display: "flex", alignItems: "center", gap: "10px", justifyContent: "space-between" };

const cardIcon = { fontSize: "22px" };

const cardLabel = {
  fontFamily: "'Georgia', serif",
  color: "#3d2200",
  fontSize: "15px",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "8px",
  marginTop: "16px",
};

const stat = { display: "flex", flexDirection: "column", gap: "2px", fontFamily: "sans-serif" };

const chartCard = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "20px",
};

const sectionTitle = {
  fontFamily: "'Georgia', serif",
  color: "#3d2200",
  margin: "0 0 14px",
  fontSize: "18px",
};

const empty = { textAlign: "center", padding: "50px 20px", color: "#9b7040", fontFamily: "sans-serif" };

const emptyIcon = { fontSize: "40px" };

const quickLinksIntro = { marginBottom: "18px", maxWidth: "560px" };

const linksGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: "14px",
};

const trackingUrl = {
  background: "#f8f1e8",
  padding: "10px",
  borderRadius: "8px",
  wordBreak: "break-all",
  fontFamily: "monospace",
  fontSize: "11px",
  color: "#5c3a1e",
  marginTop: "12px",
};

const cardActions = { display: "flex", gap: "7px", flexWrap: "wrap", marginTop: "14px" };

const secondaryButton = {
  border: "1px solid #eddfc8",
  borderRadius: "9px",
  padding: "8px 12px",
  background: "#fffdf9",
  color: "#7a4f10",
  cursor: "pointer",
  fontFamily: "sans-serif",
  fontSize: "12px",
};

const dangerButton = { ...secondaryButton, color: "#a33d32" };

const primaryButton = {
  border: "none",
  borderRadius: "9px",
  padding: "9px 15px",
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "sans-serif",
};

const field = { display: "flex", flexDirection: "column", gap: "6px" };

const labelStyle = { fontSize: "13px", fontWeight: "600", color: "#5c3a1e", fontFamily: "sans-serif" };

const input = {
  padding: "10px 12px",
  borderRadius: "9px",
  border: "1px solid #eddfc8",
  background: "#fff",
  color: "#3d2200",
  fontSize: "14px",
  outline: "none",
  fontFamily: "sans-serif",
};

const campaignHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: "16px",
  marginBottom: "18px",
};

const addButton = {
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "white",
  fontSize: "26px",
  cursor: "pointer",
  flexShrink: 0,
};

const typeBadge = {
  display: "inline-block",
  fontSize: "11px",
  padding: "4px 9px",
  borderRadius: "999px",
  background: "#f4e7d4",
  color: "#7a4f10",
  fontFamily: "sans-serif",
  marginBottom: "6px",
};

const sourceText = { marginTop: "4px", fontFamily: "monospace", fontSize: "12px", color: "#9b7040" };

const statusPill = { height: "fit-content", padding: "4px 9px", borderRadius: "999px", fontSize: "11px", fontFamily: "sans-serif" };

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(40, 25, 10, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 1000,
};

const modal = {
  background: "#fffdf9",
  borderRadius: "18px",
  width: "100%",
  maxWidth: "600px",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  boxShadow: "0 20px 60px rgba(40,20,0,0.25)",
};

const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" };

const modalTitle = { margin: 0, fontFamily: "'Georgia', serif", color: "#3d2200" };

const modalSubtitle = { margin: "5px 0 0", color: "#9b7040", fontFamily: "sans-serif", fontSize: "13px" };

const closeButton = { border: "none", background: "transparent", fontSize: "28px", cursor: "pointer", color: "#7a4f10" };

const formStyle = { display: "flex", flexDirection: "column", gap: "12px" };

const urlPreview = {
  background: "#f8f1e8",
  borderRadius: "10px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontSize: "12px",
  color: "#7a4f10",
  fontFamily: "sans-serif",
};

const formActions = { display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "6px" };