import { useEffect, useRef, useState } from "react";
import {
  AUTO_REFRESH_AFTER_MS,
  DAILY_REFRESH_BUDGET,
  NUM_OF_DAYS,
  byMetric,
  formatDuration,
  isStale,
  loadCachedInsights,
  refreshInsights,
  refreshesLeftToday,
} from "../../utils/clarityInsights";

// Extra analytics from Microsoft Clarity (sessions, engagement, frustration
// signals, devices, referrers, popular pages) on the admin App analytics page.
// Clarity allows 10 API calls a day, so this shows the saved copy first and
// only fetches when it's old or someone presses Refresh — see
// utils/clarityInsights.js.

const FRICTION = [
  ["DeadClickCount", "Dead clicks", "Clicks that did nothing"],
  ["RageClickCount", "Rage clicks", "Rapid repeated clicks"],
  ["QuickbackClick", "Quick-backs", "Left a page almost immediately"],
  ["ExcessiveScroll", "Excessive scrolling", "Lots of scrolling without finding it"],
  ["ScriptErrorCount", "Script errors", "Errors in the page's code"],
  ["ErrorClickCount", "Error clicks", "Clicks that triggered an error"],
];

const BREAKDOWNS = [
  ["Device", "Devices"],
  ["Browser", "Browsers"],
  ["OS", "Operating systems"],
  ["Country", "Countries"],
  ["ReferrerUrl", "Where visitors came from"],
];

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const fmt = (v) => num(v).toLocaleString();

export default function ClarityInsights() {
  const [cached, setCached] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const startedRef = useRef(false);

  const refresh = async (current) => {
    setRefreshing(true);
    setError("");
    try {
      setCached(await refreshInsights(current));
    } catch (err) {
      setError(err.message || "Couldn't load Clarity data.");
    }
    setRefreshing(false);
  };

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    (async () => {
      const existing = await loadCachedInsights();
      setCached(existing);
      setLoading(false);
      // Self-update when the saved copy is old (or there isn't one yet) and
      // the day's refresh budget allows it.
      if (isStale(existing) && refreshesLeftToday(existing) > 0) refresh(existing);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const metrics = cached ? byMetric(cached.data) : {};
  const traffic = metrics.Traffic?.[0];
  const engagement = metrics.EngagementTime?.[0];
  const scroll = metrics.ScrollDepth?.[0];
  const left = refreshesLeftToday(cached);

  return (
    <div style={card}>
      <div style={header}>
        <div>
          <h2 style={title}>📊 Microsoft Clarity <span style={range}>· last {NUM_OF_DAYS} days</span></h2>
          <p style={meta}>
            {loading
              ? "Loading…"
              : cached
              ? `Updated ${new Date(cached.fetchedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${left} of ${DAILY_REFRESH_BUDGET} refreshes left today`
              : "No Clarity data saved yet."}
          </p>
        </div>
        <button onClick={() => refresh(cached)} disabled={refreshing || loading || left <= 0} style={refreshing || left <= 0 ? { ...refreshBtn, opacity: 0.55 } : refreshBtn}>
          {refreshing ? "Refreshing…" : "↻ Refresh"}
        </button>
      </div>

      {error && <p style={errorText} role="alert">{error}</p>}

      {!cached && !loading && !refreshing && !error && <p style={meta}>Press Refresh to pull data from Clarity.</p>}

      {cached && (
        <>
          {/* TRAFFIC + ENGAGEMENT */}
          <div style={tiles}>
            <Tile label="Sessions" value={fmt(traffic?.totalSessionCount)} />
            <Tile label="Unique users" value={fmt(traffic?.distinctUserCount)} />
            <Tile label="Pages / session" value={num(traffic?.pagesPerSessionPercentage).toFixed(1)} />
            <Tile label="Bot sessions" value={fmt(traffic?.totalBotSessionCount)} hint="Clarity-detected bots/crawlers" />
            <Tile label="Time on site" value={formatDuration(engagement?.totalTime)} />
            <Tile label="Active time" value={formatDuration(engagement?.activeTime)} />
            <Tile label="Avg scroll depth" value={`${num(scroll?.averageScrollDepth).toFixed(0)}%`} />
          </div>

          {/* FRICTION */}
          <h3 style={sectionTitle}>Frustration signals</h3>
          <div style={frictionGrid}>
            {FRICTION.map(([key, label, hint]) => {
              const row = metrics[key]?.[0];
              const total = num(row?.subTotal);
              const pct = num(row?.sessionsWithMetricPercentage);
              return (
                <div key={key} style={total > 0 ? { ...frictionTile, ...frictionTileHot } : frictionTile} title={hint}>
                  <div style={frictionLabel}>{label}</div>
                  <div style={frictionValue}>{fmt(total)}</div>
                  <div style={frictionSub}>{pct.toFixed(0)}% of sessions</div>
                </div>
              );
            })}
          </div>

          {/* BREAKDOWNS */}
          <div style={listGrid}>
            {BREAKDOWNS.map(([key, label]) => (
              <BarList key={key} title={label} rows={(metrics[key] || []).map((r) => ({ label: r.name, count: num(r.sessionsCount) }))} unit="sessions" />
            ))}
            <BarList title="Popular pages" rows={(metrics.PopularPages || []).map((r) => ({ label: shortUrl(r.url), count: num(r.visitsCount), full: r.url }))} unit="visits" />
          </div>

          {!isStale(cached) ? null : <p style={meta}>This copy is more than {AUTO_REFRESH_AFTER_MS / 3600000} hours old.</p>}
        </>
      )}
    </div>
  );
}

function shortUrl(url) {
  try {
    const u = new URL(url);
    return `${u.pathname}${u.search}` || "/";
  } catch {
    return url || "—";
  }
}

function Tile({ label, value, hint }) {
  return (
    <div style={tile} title={hint}>
      <div style={tileLabel}>{label}</div>
      <div style={tileValue}>{value}</div>
    </div>
  );
}

function BarList({ title: heading, rows, unit }) {
  const list = rows.filter((r) => r.label).slice(0, 8);
  const max = Math.max(...list.map((r) => r.count), 1);
  return (
    <div style={listCard}>
      <h3 style={sectionTitle}>{heading}</h3>
      {list.length === 0 && <p style={meta}>No data.</p>}
      {list.map((r) => (
        <div key={r.label} style={barRow} title={r.full || r.label}>
          <span style={barLabel}>{r.label}</span>
          <div style={barTrack}><div style={{ ...barFill, width: `${(r.count / max) * 100}%` }} /></div>
          <span style={barCount}>{r.count.toLocaleString()}</span>
        </div>
      ))}
      {list.length > 0 && <div style={barUnit}>{unit}</div>}
    </div>
  );
}

const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "16px", padding: "22px 24px", marginBottom: "28px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap", marginBottom: "14px" };
const title = { fontSize: "17px", fontWeight: "normal", color: "var(--color-5c3a1e)", fontFamily: "'Georgia', serif", margin: "0 0 4px" };
const range = { fontSize: "13px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const meta = { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0, lineHeight: 1.5 };
const refreshBtn = { padding: "8px 16px", borderRadius: "10px", border: "1px solid var(--color-c97c2e)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const errorText = { color: "var(--color-b3432c)", fontSize: "13px", fontFamily: "sans-serif", margin: "0 0 12px" };

const tiles = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px", marginBottom: "6px" };
const tile = { background: "var(--color-fdf8f3)", border: "1px solid var(--color-eddfc8)", borderRadius: "12px", padding: "12px 14px" };
const tileLabel = { fontSize: "11px", color: "var(--color-9b7040)", fontFamily: "sans-serif", letterSpacing: "0.04em", marginBottom: "3px" };
const tileValue = { fontSize: "22px", fontWeight: "bold", color: "var(--color-3d2200)", fontFamily: "sans-serif" };

const sectionTitle = { fontSize: "13px", fontWeight: "600", color: "var(--color-5c3a1e)", fontFamily: "sans-serif", margin: "18px 0 8px" };
const frictionGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "10px" };
const frictionTile = { border: "1px solid var(--color-eddfc8)", borderRadius: "12px", padding: "10px 12px", background: "var(--color-fdf8f3)" };
const frictionTileHot = { borderColor: "var(--color-f0d898)", background: "var(--color-fffbee)" };
const frictionLabel = { fontSize: "12px", color: "var(--color-7a5530)", fontFamily: "sans-serif" };
const frictionValue = { fontSize: "20px", fontWeight: "bold", color: "var(--color-3d2200)", fontFamily: "sans-serif", margin: "2px 0" };
const frictionSub = { fontSize: "11px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };

const listGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "6px" };
const listCard = { minWidth: 0 };
const barRow = { display: "grid", gridTemplateColumns: "minmax(70px, 40%) 1fr auto", gap: "8px", alignItems: "center", fontFamily: "sans-serif", fontSize: "12.5px", color: "var(--color-5c3a1e)", marginBottom: "6px" };
const barLabel = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const barTrack = { height: "8px", borderRadius: "999px", background: "var(--color-eddfc8)", overflow: "hidden" };
const barFill = { height: "100%", borderRadius: "999px", background: "linear-gradient(to right, var(--color-e08930), var(--color-c97c2e))" };
const barCount = { fontSize: "12px", color: "var(--color-9b7040)" };
const barUnit = { fontSize: "10.5px", color: "var(--color-b08050)", fontFamily: "sans-serif", textAlign: "right" };
