import { RESOURCE_TYPES, RESOURCE_TYPE_META, SORT_OPTIONS } from "../lib/resourceTypes";

export default function ResourceFilters({
  typeFilter,
  onTypeChange,
  categoryFilter,
  onCategoryChange,
  categories,
  sortBy,
  onSortChange,
}) {
  return (
    <div style={wrap}>
      <div style={pillRow}>
        <button
          style={typeFilter === "all" ? { ...pill, ...pillActive } : pill}
          onClick={() => onTypeChange("all")}
        >
          All Types
        </button>
        {RESOURCE_TYPES.map((t) => (
          <button
            key={t}
            style={typeFilter === t ? { ...pill, ...pillActive } : pill}
            onClick={() => onTypeChange(t)}
          >
            {RESOURCE_TYPE_META[t].icon} {RESOURCE_TYPE_META[t].label}
          </button>
        ))}
      </div>

      {categories.length > 0 && (
        <div style={pillRow}>
          <button
            style={categoryFilter === "all" ? { ...pill, ...pillActive } : pill}
            onClick={() => onCategoryChange("all")}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              style={categoryFilter === c.id ? { ...pill, ...pillActive } : pill}
              onClick={() => onCategoryChange(c.id)}
            >
              {c.name}
            </button>
          ))}
        </div>
      )}

      <div style={sortRow}>
        <label style={sortLabel}>Sort by</label>
        <select value={sortBy} onChange={(e) => onSortChange(e.target.value)} style={sortSelect}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
    </div>
  );
}

const wrap = { display: "flex", flexDirection: "column", gap: "10px" };
const pillRow = { display: "flex", gap: "8px", flexWrap: "wrap" };
const pill = { padding: "7px 14px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const pillActive = { background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", border: "none" };
const sortRow = { display: "flex", alignItems: "center", gap: "8px" };
const sortLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const sortSelect = { padding: "7px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "12px", fontFamily: "sans-serif", color: "#3d2200" };
