import { useState } from "react";
import { DURATIONS, MONTHS, SORTS, STATUSES } from "../hooks/useAudioFilters";

// Search + sort + filters for an audio list, with active-filter chips,
// a result count, and reset. Pair with useAudioFilters().
export default function AudioFilterBar({ f, showType, loading }) {
  const { filters, set, reset, options, chips, result, total } = f;
  const [open, setOpen] = useState(false);
  const advancedActive = chips.filter((c) => c.key !== "search").length;

  return (
    <div style={wrap}>
      <div style={topRow}>
        <div style={searchWrap}>
          <input
            type="search"
            placeholder="Search title or speaker…"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            style={searchInput}
            aria-label="Search"
          />
          {filters.search && (
            <button style={clearBtn} onClick={() => set({ search: "" })} aria-label="Clear search" title="Clear search">✕</button>
          )}
        </div>
        <select value={filters.sort} onChange={(e) => set({ sort: e.target.value })} style={select} aria-label="Sort">
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button style={advancedActive ? { ...toggleBtn, ...toggleOn } : toggleBtn} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
          ⚙ Filters{advancedActive ? ` (${advancedActive})` : ""}
        </button>
      </div>

      {open && (
        <div style={panel}>
          <label style={field}>
            <span style={label}>Speaker</span>
            <select value={filters.speaker} onChange={(e) => set({ speaker: e.target.value })} style={select}>
              <option value="all">All speakers</option>
              {options.speakers.map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
          {showType && (
            <label style={field}>
              <span style={label}>Type</span>
              <select value={filters.type} onChange={(e) => set({ type: e.target.value })} style={select}>
                <option value="all">All types</option>
                <option value="sermon">Sermons</option>
                <option value="homily">Homilies</option>
              </select>
            </label>
          )}
          <label style={field}>
            <span style={label}>Length</span>
            <select value={filters.duration} onChange={(e) => set({ duration: e.target.value })} style={select}>
              {DURATIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={field}>
            <span style={label}>Year</span>
            <select value={filters.year} onChange={(e) => set({ year: e.target.value })} style={select}>
              <option value="all">Any year</option>
              {options.years.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </label>
          <label style={field}>
            <span style={label}>Month</span>
            <select value={filters.month} onChange={(e) => set({ month: e.target.value })} style={select}>
              <option value="all">Any month</option>
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
          </label>
          <label style={field}>
            <span style={label}>Progress</span>
            <select value={filters.status} onChange={(e) => set({ status: e.target.value })} style={select}>
              {STATUSES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label style={check}><input type="checkbox" checked={filters.liked} onChange={(e) => set({ liked: e.target.checked })} /> Liked only</label>
          <label style={check}><input type="checkbox" checked={filters.downloaded} onChange={(e) => set({ downloaded: e.target.checked })} /> Downloaded only (works offline)</label>
        </div>
      )}

      {(chips.length > 0 || !loading) && (
        <div style={statusRow}>
          <span style={count} role="status" aria-live="polite">
            {loading ? "Loading…" : chips.length ? `${result.length} of ${total} recordings` : `${total} recording${total === 1 ? "" : "s"}`}
          </span>
          {chips.map((c) => (
            <button key={c.key} style={chip} onClick={() => set(c.clear)} aria-label={`Remove filter ${c.label}`}>
              {c.label} <span aria-hidden="true">✕</span>
            </button>
          ))}
          {chips.length > 0 && <button style={resetBtn} onClick={reset}>Reset filters</button>}
        </div>
      )}
    </div>
  );
}

// Shown when filters leave nothing: says why and offers one-tap fixes.
export function NoResults({ f, offlineNothing }) {
  const { chips, set, reset, filters } = f;
  if (offlineNothing) {
    return (
      <div style={empty}>
        <div style={{ fontSize: "34px" }}>📴</div>
        <h3 style={emptyTitle}>You're offline</h3>
        <p style={emptyText}>Nothing has been downloaded yet. Download audio while you're online to listen without a connection.</p>
      </div>
    );
  }
  return (
    <div style={empty}>
      <div style={{ fontSize: "34px" }}>🔍</div>
      <h3 style={emptyTitle}>{chips.length ? "No matches" : "Nothing here yet"}</h3>
      {chips.length > 0 ? (
        <>
          <p style={emptyText}>Nothing fits {chips.length === 1 ? "this filter" : "all of these filters"}. Try one of these:</p>
          <div style={sugRow}>
            {chips.map((c) => (
              <button key={c.key} style={sugBtn} onClick={() => set(c.clear)}>Remove {c.label}</button>
            ))}
            {chips.length > 1 && <button style={{ ...sugBtn, ...sugPrimary }} onClick={reset}>Clear everything</button>}
          </div>
          {filters.search && <p style={emptyHint}>Tip: search matches titles and speakers — try a shorter or different word.</p>}
        </>
      ) : (
        <p style={emptyText}>Check back soon for new recordings.</p>
      )}
    </div>
  );
}

const wrap = { marginBottom: "18px" };
const topRow = { display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", alignItems: "center" };
const searchWrap = { position: "relative", flex: "1 1 220px", maxWidth: "340px" };
const searchInput = { width: "100%", boxSizing: "border-box", padding: "10px 38px 10px 16px", borderRadius: "999px", border: "1px solid #eddfc8", fontSize: "13px", fontFamily: "sans-serif", background: "#fffdf9", color: "#3d2200", outline: "none" };
const clearBtn = { position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)", width: "26px", height: "26px", borderRadius: "50%", border: "none", background: "#f0e4d0", color: "#7a4f10", fontSize: "12px", cursor: "pointer" };
const select = { padding: "9px 14px", borderRadius: "999px", border: "1px solid #eddfc8", fontSize: "13px", fontFamily: "sans-serif", background: "#fffdf9", color: "#3d2200", maxWidth: "100%" };
const toggleBtn = { padding: "9px 16px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const toggleOn = { background: "#fde8b8", borderColor: "#e5c27a", fontWeight: "600" };
const panel = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "12px", background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "14px", margin: "12px auto 0", maxWidth: "640px" };
const field = { display: "flex", flexDirection: "column", gap: "4px" };
const label = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" };
const check = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", cursor: "pointer" };
const statusRow = { display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", justifyContent: "center", marginTop: "12px" };
const count = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const chip = { padding: "5px 10px", borderRadius: "999px", border: "none", background: "#f4e7d4", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const resetBtn = { padding: "5px 10px", borderRadius: "999px", border: "1px solid #eddfc8", background: "transparent", color: "#a85e18", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer", textDecoration: "underline" };
const empty = { textAlign: "center", padding: "30px 10px" };
const emptyTitle = { margin: "8px 0 4px", fontSize: "18px", fontWeight: "normal", color: "#3d2200" };
const emptyText = { margin: "0 0 12px", color: "#9b7040", fontFamily: "sans-serif", fontSize: "14px", lineHeight: 1.5 };
const emptyHint = { margin: "12px 0 0", color: "#b08050", fontFamily: "sans-serif", fontSize: "12px", fontStyle: "italic" };
const sugRow = { display: "flex", flexWrap: "wrap", gap: "8px", justifyContent: "center" };
const sugBtn = { padding: "8px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const sugPrimary = { background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", border: "none" };
