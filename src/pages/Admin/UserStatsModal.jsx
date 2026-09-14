import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../firebase";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";

const RANGES = [
  { key: "daily", label: "Daily", limit: 30 },
  { key: "monthly", label: "Monthly", limit: 12 },
  { key: "yearly", label: "Yearly", limit: 999 },
];

const LOGIN_EVENTS = new Set(["user_login", "google_login"]);

function toDate(log) {
  return log.createdAt?.seconds ? new Date(log.createdAt.seconds * 1000) : null;
}

function getLoginMethod(u) {
  if (u.provider === "google" || u.provider === "google.com") return "Google";
  if (u.provider === "password") return "Email";
  if (u.loginMethod === "google") return "Google";
  if (u.loginMethod === "email") return "Email";
  return "Other";
}

export default function UserStatsModal({ user, onClose }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("daily");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "logs"), where("userId", "==", user.id)));
        if (!cancelled) setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Couldn't load user stats:", err);
        if (!cancelled) setLogs([]);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [user.id]);

  const lastLogin = useMemo(() => {
    const logins = logs.filter((l) => LOGIN_EVENTS.has(l.event)).map(toDate).filter(Boolean);
    if (logins.length === 0) return null;
    return new Date(Math.max(...logins.map((d) => d.getTime())));
  }, [logs]);

  const totalSessions = useMemo(
    () => new Set(logs.map((l) => l.sessionId).filter(Boolean)).size,
    [logs]
  );

  const mostUsedPages = useMemo(() => {
    const counts = {};
    logs.forEach((l) => {
      if (l.event !== "page_visit" || !l.page) return;
      counts[l.page] = (counts[l.page] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [logs]);

  const activitySeries = useMemo(() => {
    const activeRange = RANGES.find((r) => r.key === range);
    const buckets = {};

    logs.forEach((l) => {
      const d = toDate(l);
      if (!d) return;

      let key, label;
      if (range === "daily") {
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      } else if (range === "monthly") {
        key = `${d.getFullYear()}-${d.getMonth()}`;
        label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
      } else {
        key = `${d.getFullYear()}`;
        label = key;
      }

      if (!buckets[key]) buckets[key] = { key, label, count: 0, sortTime: d.getTime() };
      buckets[key].count++;
    });

    return Object.values(buckets)
      .sort((a, b) => a.sortTime - b.sortTime)
      .slice(-activeRange.limit);
  }, [logs, range]);

  const maxPageCount = Math.max(...mostUsedPages.map((p) => p.count), 1);

  return (
    <div style={modalBg}>
      <div style={modal}>
        <div style={header}>
          <div>
            <h2 style={modalTitle}>User Stats</h2>
            <p style={subtitle}>{user.fullName || user.name || user.email || "This user"}</p>
          </div>
        </div>

        {loading ? (
          <p style={hint}>Loading…</p>
        ) : (
          <>
            <div style={statGrid}>
              <StatTile label="Last Login" value={lastLogin ? lastLogin.toLocaleString() : "Never"} />
              <StatTile
                label="Account Created"
                value={user.createdAt?.seconds ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : "—"}
              />
              <StatTile label="Total Sessions" value={totalSessions} />
              <StatTile label="Total Events" value={logs.length} />
              <StatTile label="Login Method" value={getLoginMethod(user)} />
            </div>

            <div style={chartCard}>
              <div style={chartHeader}>
                <h3 style={sectionTitle}>Activity</h3>
                <div style={rangeRow}>
                  {RANGES.map((r) => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRange(r.key)}
                      style={range === r.key ? { ...rangeBtn, ...rangeBtnActive } : rangeBtn}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {activitySeries.length === 0 ? (
                <p style={hint}>No activity recorded yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={activitySeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eddfc8" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontFamily: "sans-serif" }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11, fontFamily: "sans-serif" }} />
                    <Tooltip contentStyle={{ fontFamily: "sans-serif", fontSize: 12, borderRadius: 8 }} />
                    <Bar dataKey="count" name="Events" fill="#c97c2e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={chartCard}>
              <h3 style={sectionTitle}>Most Used Pages</h3>
              {mostUsedPages.length === 0 ? (
                <p style={hint}>No page visits recorded yet.</p>
              ) : (
                <div style={pageList}>
                  {mostUsedPages.map((p) => (
                    <div key={p.page} style={pageRow}>
                      <span style={pageName}>{p.page}</span>
                      <div style={pageBarTrack}>
                        <div style={{ ...pageBarFill, width: `${(p.count / maxPageCount) * 100}%` }} />
                      </div>
                      <span style={pageCount}>{p.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div style={modalActions}>
          <button style={closeBtn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function StatTile({ label, value }) {
  return (
    <div style={statTile}>
      <div style={statTileLabel}>{label}</div>
      <div style={statTileValue}>{value}</div>
    </div>
  );
}

const modalBg = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
  padding: "20px",
};

const modal = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "20px",
  padding: "28px",
  width: "100%",
  maxWidth: "760px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  maxHeight: "90vh",
  overflowY: "auto",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const modalTitle = {
  fontSize: "20px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: 0,
};

const subtitle = {
  fontSize: "13px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  margin: "2px 0 0",
};

const hint = {
  fontSize: "13px",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontStyle: "italic",
  textAlign: "center",
  padding: "20px 0",
  margin: 0,
};

const statGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))",
  gap: "10px",
};

const statTile = {
  background: "#fdf8f3",
  border: "1px solid #eddfc8",
  borderRadius: "12px",
  padding: "12px 14px",
};

const statTileLabel = {
  fontSize: "10px",
  fontFamily: "sans-serif",
  color: "#9b7040",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "4px",
};

const statTileValue = {
  fontSize: "15px",
  fontFamily: "sans-serif",
  fontWeight: "600",
  color: "#3d2200",
};

const chartCard = {
  background: "#fdf8f3",
  border: "1px solid #eddfc8",
  borderRadius: "14px",
  padding: "16px 18px",
};

const chartHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "10px",
  marginBottom: "12px",
};

const sectionTitle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#5c3a1e",
  fontFamily: "sans-serif",
  margin: 0,
};

const rangeRow = {
  display: "flex",
  gap: "6px",
};

const rangeBtn = {
  padding: "5px 12px",
  borderRadius: "999px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  color: "#7a4f10",
  fontSize: "11px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};

const rangeBtnActive = {
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff8ee",
  borderColor: "transparent",
};

const pageList = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
};

const pageRow = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
};

const pageName = {
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  width: "140px",
  flexShrink: 0,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const pageBarTrack = {
  flex: 1,
  height: "8px",
  borderRadius: "999px",
  background: "#eddfc8",
  overflow: "hidden",
};

const pageBarFill = {
  height: "100%",
  borderRadius: "999px",
  background: "linear-gradient(90deg, #e08930, #c97c2e)",
};

const pageCount = {
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "#7a4f10",
  fontWeight: "600",
  width: "24px",
  textAlign: "right",
  flexShrink: 0,
};

const modalActions = {
  display: "flex",
  justifyContent: "flex-end",
};

const closeBtn = {
  padding: "10px 20px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "transparent",
  color: "#7a4f10",
  fontSize: "13px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};
