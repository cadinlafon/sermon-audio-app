import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc, collection, getDocs, query, where, documentId } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import ResourceTypeIcon from "../components/ResourceTypeIcon";
import {
  getTypeMeta,
  formatResourceDate,
  extractYouTubeId,
  youTubeEmbedUrl,
  spotifyEmbedUrl,
  parseSpotifyLink,
  FILE_TYPE_ICON,
  COLLECTION_TYPES,
} from "../lib/resourceTypes";

export default function ResourceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [resource, setResource] = useState(null);
  const [category, setCategory] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightboxImage, setLightboxImage] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");
      setResource(null);
      setCategory(null);
      setItems([]);
      try {
        const snap = await getDoc(doc(db, "resources", id));
        if (!snap.exists()) {
          if (!cancelled) setError("not-found");
          return;
        }

        const data = { id: snap.id, ...snap.data() };
        if (!cancelled) setResource(data);

        if (data.categoryId) {
          const catSnap = await getDoc(doc(db, "resourceCategories", data.categoryId));
          if (!cancelled && catSnap.exists()) setCategory({ id: catSnap.id, ...catSnap.data() });
        }

        if (COLLECTION_TYPES.has(data.type) && data.items?.length > 0) {
          const q = query(collection(db, "resources"), where(documentId(), "in", data.items.slice(0, 30)));
          const itemsSnap = await getDocs(q);
          const itemMap = {};
          itemsSnap.forEach((d) => { itemMap[d.id] = { id: d.id, ...d.data() }; });
          if (!cancelled) setItems(data.items.map((itemId) => itemMap[itemId]).filter(Boolean));
        }
      } catch (err) {
        console.error("Failed to load resource:", err);
        if (!cancelled) setError("load-failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div style={page}>
        <p style={stateText}>Loading…</p>
      </div>
    );
  }

  if (error === "not-found" || !resource) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Not Found</h1>
        <p style={stateText}>This resource doesn't exist or may have been removed.</p>
        <BackLink navigate={navigate} />
      </div>
    );
  }

  if (error === "load-failed") {
    return (
      <div style={page}>
        <p style={{ ...stateText, color: "#b3432c" }}>Couldn't load this resource. Please try again.</p>
        <BackLink navigate={navigate} />
      </div>
    );
  }

  if (resource.published === false && !isAdmin) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Not Available</h1>
        <p style={stateText}>This resource isn't published yet.</p>
        <BackLink navigate={navigate} />
      </div>
    );
  }

  const meta = getTypeMeta(resource.type);

  return (
    <div style={page}>
      <BackLink navigate={navigate} />

      {resource.published === false && (
        <div style={draftBanner}>Unpublished — only visible to admins.</div>
      )}

      <div style={card}>
        {resource.thumbnailUrl && <img src={resource.thumbnailUrl} alt="" style={heroImage} />}

        <div style={cardBody}>
          <span style={typeBadge}><ResourceTypeIcon type={resource.type} /> {meta.label}</span>

          <h1 style={title}>{resource.title}</h1>

          <div style={metaRow}>
            {resource.author && <span style={metaItem}>{resource.author}</span>}
            {resource.date && <span style={metaItem}>{formatResourceDate(resource.date)}</span>}
            {category && <span style={categoryTag}>{category.name}</span>}
          </div>

          {resource.description && <p style={description}>{resource.description}</p>}

          <div style={contentArea}>
            <ResourceContent resource={resource} items={items} onOpenImage={setLightboxImage} />
          </div>
        </div>
      </div>

      {lightboxImage && (
        <div style={lightboxBg} onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} alt="" style={lightboxImg} />
        </div>
      )}
    </div>
  );
}

////////////////////////////////////////////////
// PER-TYPE CONTENT
////////////////////////////////////////////////

function ResourceContent({ resource, items, onOpenImage }) {
  switch (resource.type) {
    case "audio":
    case "scripture":
      return <AudioContent resource={resource} />;
    case "podcast":
      return <PodcastContent resource={resource} />;
    case "youtube":
      return <YouTubeContent resource={resource} />;
    case "spotify":
      return <SpotifyContent resource={resource} />;
    case "image":
      return <ImageContent resource={resource} onOpenImage={onOpenImage} />;
    case "playlist":
    case "course":
      return <ItemListContent resource={resource} items={items} />;
    default:
      return <LinkContent resource={resource} />;
  }
}

function AudioContent({ resource }) {
  const { current, isPlaying, playSermon, togglePlay, playError } = useAudioPlayer();
  const isCurrent = current?.id === resource.id;

  return (
    <div style={stackCol}>
      {resource.scriptureReference && (
        <p style={scriptureRef}>{resource.scriptureReference}</p>
      )}

      {resource.audioStorageKey ? (
        <div>
          <button
            style={primaryBtn}
            onClick={() => (isCurrent ? togglePlay() : playSermon({ id: resource.id, title: resource.title, speaker: resource.author, collection: "resources", audioStorageKey: resource.audioStorageKey }))}
          >
            {isCurrent && isPlaying ? "⏸ Pause" : "▶ Play Audio"}
          </button>
          {isCurrent && playError && <p style={errorText}>{playError}</p>}
        </div>
      ) : resource.url ? (
        <audio controls src={resource.url} style={{ width: "100%" }} />
      ) : (
        <p style={stateText}>No audio available yet.</p>
      )}

      {resource.url && resource.audioStorageKey && (
        <a href={resource.url} target="_blank" rel="noopener noreferrer" style={secondaryLink}>
          Open resource link →
        </a>
      )}
    </div>
  );
}

function PodcastContent({ resource }) {
  const looksPlayable = /\.(mp3|m4a|wav|ogg)(\?|$)/i.test(resource.url || "");

  if (looksPlayable) {
    return <audio controls src={resource.url} style={{ width: "100%" }} />;
  }

  return resource.url ? (
    <a href={resource.url} target="_blank" rel="noopener noreferrer" style={primaryBtnLink}>
      🎙️ Listen to Episode {resource.episodeNumber ? `#${resource.episodeNumber}` : ""} ↗
    </a>
  ) : (
    <p style={stateText}>No podcast link yet.</p>
  );
}

function YouTubeContent({ resource }) {
  const embedUrl = youTubeEmbedUrl(resource.url);
  const videoId = extractYouTubeId(resource.url);

  if (!embedUrl) {
    return <p style={stateText}>This YouTube link couldn't be read.</p>;
  }

  return (
    <div>
      <div style={videoWrap}>
        <iframe
          src={embedUrl}
          title={resource.title}
          style={videoFrame}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
      <a
        href={`https://www.youtube.com/watch?v=${videoId}`}
        target="_blank"
        rel="noopener noreferrer"
        style={secondaryLink}
      >
        Open on YouTube →
      </a>
    </div>
  );
}

function SpotifyContent({ resource }) {
  const embedUrl = spotifyEmbedUrl(resource.url);
  const parsed = parseSpotifyLink(resource.url);

  if (!embedUrl) {
    return resource.url ? (
      <a href={resource.url} target="_blank" rel="noopener noreferrer" style={primaryBtnLink}>
        🎵 Open in Spotify ↗
      </a>
    ) : (
      <p style={stateText}>No Spotify link has been added yet.</p>
    );
  }

  const height = parsed.kind === "track" ? 152 : parsed.kind === "album" || parsed.kind === "playlist" ? 352 : 232;

  return (
    <div>
      <iframe
        src={embedUrl}
        title={resource.title}
        width="100%"
        height={height}
        style={spotifyFrame}
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
      />
      <a href={resource.url} target="_blank" rel="noopener noreferrer" style={secondaryLink}>
        Open in Spotify →
      </a>
    </div>
  );
}

function ImageContent({ resource, onOpenImage }) {
  const images = resource.images?.length > 0
    ? resource.images
    : resource.thumbnailUrl
    ? [{ url: resource.thumbnailUrl }]
    : [];

  if (images.length === 0) return <p style={stateText}>No images uploaded yet.</p>;

  return (
    <div style={imageGrid}>
      {images.map((img, i) => (
        <img
          key={i}
          src={img.url}
          alt=""
          style={galleryImg}
          onClick={() => onOpenImage(img.url)}
        />
      ))}
    </div>
  );
}

function ItemListContent({ resource, items }) {
  if (!items || items.length === 0) {
    return <p style={stateText}>No lessons or items have been added to this {resource.type} yet.</p>;
  }

  return (
    <div style={stackCol}>
      {resource.url && (
        <a href={resource.url} target="_blank" rel="noopener noreferrer" style={secondaryLink}>
          Open external resource →
        </a>
      )}
      <ol style={itemList}>
        {items.map((item, i) => (
          <li key={item.id} style={itemRow}>
            <Link to={`/resources/${item.id}`} style={itemLink}>
              <span style={itemNumber}>{i + 1}.</span>
              <ResourceTypeIcon type={item.type} size={16} />
              <span>{item.title}</span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}

function LinkContent({ resource }) {
  const meta = getTypeMeta(resource.type);
  const fileIcon = resource.fileType ? FILE_TYPE_ICON[resource.fileType.toLowerCase()] : null;

  if (!resource.url) return <p style={stateText}>No link has been added yet.</p>;

  return (
    <a href={resource.url} target="_blank" rel="noopener noreferrer" style={primaryBtnLink}>
      {fileIcon ? `${fileIcon} ` : ""}{meta.actionLabel} ↗
    </a>
  );
}

////////////////////////////////////////////////
// SHARED BITS
////////////////////////////////////////////////

function BackLink({ navigate }) {
  return (
    <button style={backLink} onClick={() => navigate("/resources")}>
      ← Back to Resources
    </button>
  );
}

////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////

const page = { padding: "24px 20px 60px", maxWidth: "760px", margin: "0 auto", background: "#fdf8f3", minHeight: "100vh" };
const pageTitle = { textAlign: "center", fontFamily: "'Georgia', serif", fontWeight: "normal", color: "#3d2200" };
const stateText = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "20px 0" };
const errorText = { color: "#b3432c", fontSize: "13px", fontFamily: "sans-serif", margin: "8px 0 0" };

const backLink = { border: "none", background: "transparent", color: "#a85e18", fontFamily: "sans-serif", fontSize: "13px", cursor: "pointer", padding: "0 0 16px", display: "block" };

const draftBanner = { background: "#fef3c7", border: "1px solid #f6e4b0", color: "#7a5a10", padding: "10px 14px", borderRadius: "10px", fontFamily: "sans-serif", fontSize: "13px", marginBottom: "16px", textAlign: "center" };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "18px", overflow: "hidden", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const heroImage = { width: "100%", height: "260px", objectFit: "cover", display: "block" };
const cardBody = { padding: "24px 22px" };

const typeBadge = { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", fontWeight: "600", padding: "4px 10px", borderRadius: "999px", background: "#fdf1de", color: "#7a4f10", fontFamily: "sans-serif", marginBottom: "12px" };
const title = { fontSize: "24px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: "0 0 10px" };
const metaRow = { display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", marginBottom: "14px" };
const metaItem = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const categoryTag = { fontSize: "11px", padding: "3px 9px", borderRadius: "999px", background: "#e8f0fe", color: "#2a5ab5", fontFamily: "sans-serif" };
const description = { fontSize: "14px", color: "#5c3a1e", fontFamily: "sans-serif", lineHeight: 1.7, margin: "0 0 20px", whiteSpace: "pre-wrap" };

const contentArea = { borderTop: "1px solid #f0e4d0", paddingTop: "20px" };
const stackCol = { display: "flex", flexDirection: "column", gap: "12px" };

const scriptureRef = { fontSize: "18px", fontFamily: "'Georgia', serif", color: "#3d2200", fontStyle: "italic", margin: 0 };

const primaryBtn = { padding: "12px 22px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)", color: "#fff8ee", fontSize: "14px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const primaryBtnLink = { display: "inline-block", padding: "12px 22px", borderRadius: "999px", border: "none", background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)", color: "#fff8ee", fontSize: "14px", fontWeight: "600", fontFamily: "sans-serif", textDecoration: "none", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" };
const secondaryLink = { fontSize: "13px", color: "#a85e18", fontFamily: "sans-serif", fontWeight: "600", textDecoration: "none" };

const videoWrap = { position: "relative", paddingTop: "56.25%", borderRadius: "12px", overflow: "hidden", marginBottom: "10px" };
const videoFrame = { position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" };
const spotifyFrame = { border: "none", borderRadius: "12px", marginBottom: "10px", display: "block" };

const imageGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "10px" };
const galleryImg = { width: "100%", height: "110px", objectFit: "cover", borderRadius: "10px", border: "1px solid #eddfc8", cursor: "pointer" };

const itemList = { margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: "8px" };
const itemRow = { border: "1px solid #eddfc8", borderRadius: "10px", background: "#fdf8f3" };
const itemLink = { display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", textDecoration: "none", color: "#3d2200", fontFamily: "sans-serif", fontSize: "14px" };
const itemNumber = { color: "#9b7040", fontSize: "13px" };

const lightboxBg = { position: "fixed", inset: 0, background: "rgba(20,10,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "20px", cursor: "zoom-out" };
const lightboxImg = { maxWidth: "100%", maxHeight: "90vh", borderRadius: "10px" };
