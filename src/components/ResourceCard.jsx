import { useNavigate } from "react-router-dom";
import ResourceTypeIcon from "./ResourceTypeIcon";
import { getTypeMeta, formatResourceDate, EXTERNAL_LINK_TYPES } from "../lib/resourceTypes";

export default function ResourceCard({ resource, category }) {
  const navigate = useNavigate();
  const meta = getTypeMeta(resource.type);
  const isExternal = EXTERNAL_LINK_TYPES.has(resource.type);

  const open = () => navigate(`/resources/${resource.id}`);

  return (
    <div style={card} onClick={open}>
      <div style={thumbWrap}>
        {resource.thumbnailUrl ? (
          <img src={resource.thumbnailUrl} alt="" style={thumbImg} />
        ) : (
          <div style={thumbFallback}>
            <ResourceTypeIcon type={resource.type} size={30} />
          </div>
        )}
        <span style={typeBadge}>
          <ResourceTypeIcon type={resource.type} size={11} /> {meta.label}
        </span>
        {resource.featured && <span style={featuredBadge}>★ Featured</span>}
      </div>

      <div style={body}>
        <h3 style={title}>{resource.title}</h3>
        {resource.description && <p style={description}>{resource.description}</p>}

        <div style={metaRow}>
          {resource.author && <span style={metaItem}>{resource.author}</span>}
          {resource.date && <span style={metaItem}>{formatResourceDate(resource.date)}</span>}
          {category && <span style={categoryTag}>{category.name}</span>}
        </div>

        <button style={actionBtn} onClick={(e) => { e.stopPropagation(); open(); }}>
          {meta.actionLabel} {isExternal && <span style={externalIcon}>↗</span>}
        </button>
      </div>
    </div>
  );
}

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  overflow: "hidden",
  boxShadow: "0 2px 10px rgba(160,100,40,0.06)",
  cursor: "pointer",
  display: "flex",
  flexDirection: "column",
};

const thumbWrap = { position: "relative", height: "140px", background: "#fdf1de" };
const thumbImg = { width: "100%", height: "100%", objectFit: "cover", display: "block" };
const thumbFallback = { width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" };

const typeBadge = {
  position: "absolute",
  top: "10px",
  left: "10px",
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  fontSize: "11px",
  fontWeight: "600",
  padding: "4px 9px",
  borderRadius: "999px",
  background: "rgba(255,253,249,0.92)",
  color: "#7a4f10",
  fontFamily: "sans-serif",
};

const featuredBadge = {
  position: "absolute",
  top: "10px",
  right: "10px",
  fontSize: "11px",
  fontWeight: "700",
  padding: "4px 9px",
  borderRadius: "999px",
  background: "#f6e4b0",
  color: "#7a5a10",
  fontFamily: "sans-serif",
};

const body = { padding: "16px", display: "flex", flexDirection: "column", gap: "8px", flex: 1 };
const title = { fontSize: "16px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0, lineHeight: 1.3 };
const description = {
  fontSize: "13px",
  color: "#7a5530",
  fontFamily: "sans-serif",
  lineHeight: 1.5,
  margin: 0,
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

const metaRow = { display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" };
const metaItem = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif" };
const categoryTag = { fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "#e8f0fe", color: "#2a5ab5", fontFamily: "sans-serif" };

const actionBtn = {
  marginTop: "6px",
  padding: "9px 14px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  fontSize: "13px",
  fontFamily: "sans-serif",
  fontWeight: "600",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  justifyContent: "center",
};

const externalIcon = { fontSize: "12px" };
