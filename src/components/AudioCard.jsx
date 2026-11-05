import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { toggleSaveSermon } from "../utils/saveSermon";
import { fetchListenProgress } from "../utils/listenProgress";
import { isDownloadedLocally, downloadForOffline, removeOfflineDownload, downloadForLater } from "../utils/offlineDownloads";
import { useToast } from "../context/ToastContext";
import useOnlineStatus from "../hooks/useOnlineStatus";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { useAuth } from "../context/AuthContext";
import useAudioConfig from "../hooks/useAudioConfig";
import { categoryById } from "../data/audioPageDefaults";
import AiSummary from "./AiSummary";
import AddToPlaylistModal from "./AddToPlaylistModal";

const NEW_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

function formatDuration(seconds) {
  const s = Number(seconds);
  if (!s || !Number.isFinite(s)) return null;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = Math.floor(s % 60);
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}` : `${m}:${String(sec).padStart(2, "0")}`;
}

function formatDate(audio) {
  const value = audio.date && /^\d{4}-\d{2}-\d{2}/.test(audio.date)
    ? new Date(Number(audio.date.slice(0, 4)), Number(audio.date.slice(5, 7)) - 1, Number(audio.date.slice(8, 10)))
    : audio.createdAt?.seconds ? new Date(audio.createdAt.seconds * 1000) : null;
  return value ? value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "";
}

// Sizes for the three card layouts (Audio Page Manager → Layout & Cards).
const DENSITY = {
  compact: { pad: "14px 16px 12px", gap: "6px", title: "15px", titleMb: "3px", speakerMb: "9px", btnPad: "6px 12px", btnFont: "12px", radius: "14px", progressMb: "9px", tagMb: "6px" },
  comfortable: { pad: "22px 22px 18px", gap: "8px", title: "17px", titleMb: "5px", speakerMb: "14px", btnPad: "8px 14px", btnFont: "13px", radius: "18px", progressMb: "14px", tagMb: "10px" },
  spacious: { pad: "28px 28px 24px", gap: "10px", title: "19px", titleMb: "7px", speakerMb: "18px", btnPad: "10px 18px", btnFont: "14px", radius: "20px", progressMb: "18px", tagMb: "12px" },
};

// `grid`    — shown in a grid: no bottom margin, fills its cell.
// `preview` — the admin visualizer: static, makes no database calls.
// `index`   — position in the list, to stagger the entrance animation.
export default function AudioCard({ audio, onPlay, onSummarySaved, onSaveChange, grid = false, preview = false, index = 0 }) {
  const { playNext, current, isPlaying, togglePlay, duration, currentTime } = useAudioPlayer();
  const { isAdmin } = useAuth() || {};
  const cfg = useAudioConfig();
  const { layout, card: cardCfg } = cfg.page;
  const adv = cfg.advanced;
  const det = cardCfg.details;
  const dens = DENSITY[layout.cardLayout] || DENSITY.comfortable;
  const [user, setUser] = useState(auth.currentUser);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [queued, setQueued] = useState(false);
  const [progress, setProgress] = useState(null);
  const [showMore, setShowMore] = useState(layout.defaultExpanded);
  const [copied, setCopied] = useState(false);
  const [isDownloaded, setIsDownloaded] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState("");
  const isOnline = useOnlineStatus();
  const [showPlaylist, setShowPlaylist] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => (preview ? undefined : onAuthStateChanged(auth, setUser)), [preview]);

  // "Cards start expanded" (Audio Page Manager) — follows the setting live.
  useEffect(() => { setShowMore(layout.defaultExpanded); }, [layout.defaultExpanded]);

  useEffect(() => {
    if (preview) return undefined;
    let isCurrent = true;
    if (!user) {
      setIsDownloaded(false);
      return undefined;
    }
    isDownloadedLocally(user.uid, audio.id).then((value) => {
      if (isCurrent) setIsDownloaded(value);
    });
    return () => { isCurrent = false; };
  }, [audio.id, user, preview]);

  useEffect(() => {
    if (preview) return undefined;
    let isCurrent = true;
    const user = auth.currentUser;

    if (!user) {
      setIsSaved(false);
      setProgress(null);
      return undefined;
    }

    getDoc(doc(db, "saved", `${user.uid}_${audio.id}`))
      .then((snapshot) => {
        if (isCurrent) setIsSaved(snapshot.exists());
      })
      .catch((error) => {
        console.error("Unable to check saved audio", error);
      });

    fetchListenProgress(user.uid, audio.id)
      .then((data) => {
        if (isCurrent) setProgress(data);
      })
      .catch((error) => {
        console.error("Unable to check listen progress", error);
      });

    return () => { isCurrent = false; };
  }, [audio.id, preview]);

  const handleSave = async () => {
    const user = auth.currentUser;
    if (!user) {
      setSaveError("Please sign in to like audio.");
      return;
    }

    setSaveError("");
    setIsSaving(true);
    try {
      const saved = await toggleSaveSermon(user.uid, audio);
      setIsSaved(saved);
      onSaveChange?.(saved, audio.id);
    } catch (error) {
      console.error("Unable to save audio", error);
      setSaveError("We couldn't update your liked sermons. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const category = categoryById(cfg, audio.type);
  const fallbackLabel = audio.type === "sundayschool" ? "Sunday School" : audio.type === "homily" ? "Homily" : "Sermon";
  const label = `${category?.icon ? `${category.icon} ` : ""}${category?.name || fallbackLabel}`;
  const rememberPosition = cfg.playback.rememberPosition;
  const status = !rememberPosition ? "not-started" : (progress?.status || "not-started");
  const hasUser = preview ? true : !!user;
  const isThisTrack = current?.id === audio.id;
  const isNew = audio.createdAt?.seconds && Date.now() - audio.createdAt.seconds * 1000 < NEW_WINDOW_MS;
  const durationLabel = formatDuration(audio.duration);
  const dateLabel = formatDate(audio);
  const deepLink = `${window.location.origin}/listen/${audio.id}`;
  const canShare = adv.sharing.enabled;
  const canDownload = adv.downloads.enabled && hasUser && (isAdmin ? adv.downloads.roles.admin : adv.downloads.roles.user);
  const showLike = adv.favorites && det.likeButton;
  const shareText = adv.sharing.text
    .replaceAll("{title}", audio.title || "")
    .replaceAll("{speaker}", audio.speaker || "")
    .replaceAll("{series}", audio.series || "")
    .replace(/\s+/g, " ")
    .trim();

  const handlePlayNext = () => {
    playNext(audio);
    setQueued(true);
    setTimeout(() => setQueued(false), 1800);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(deepLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (error) {
      console.error("Couldn't copy link", error);
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: audio.title, text: shareText || audio.speaker, url: deepLink });
      } catch (error) {
        if (error?.name !== "AbortError") console.error("Share failed", error);
      }
    } else {
      handleCopyLink();
    }
  };

  const handleToggleDownload = async () => {
    if (!user) {
      setDownloadError("Please sign in to download audio for offline listening.");
      return;
    }
    setDownloadError("");
    setDownloading(true);
    try {
      if (isDownloaded) {
        await removeOfflineDownload(user, audio.id);
        setIsDownloaded(false);
      } else {
        await downloadForOffline(user, audio);
        setIsDownloaded(true);
      }
    } catch (error) {
      console.error("Couldn't update offline download", error);
      const message = error.message || "Couldn't update this download.";
      if (/limit/i.test(message)) {
        toast(message, { type: "error", action: { label: "Manage", onClick: () => navigate("/downloads") } });
      } else {
        // Offline or a hiccup: offer to fetch it automatically once possible.
        toast(message, { type: "error", action: { label: "Download later", onClick: () => { downloadForLater(user, audio); toast("Queued — it'll download when you're online.", { type: "success" }); } } });
      }
    } finally {
      setDownloading(false);
    }
  };

  const offlineDisabled = !isOnline && !isDownloaded;

  const handlePlayClick = () => {
    if (offlineDisabled) return;
    if (isThisTrack) {
      togglePlay();
      return;
    }
    if (rememberPosition && status === "in-progress" && progress?.position) {
      onPlay(audio, { resumeAt: progress.position });
    } else {
      onPlay(audio);
    }
  };

  // While this card's track is the one actually loaded, show the live
  // position instead of the last-saved snapshot — otherwise the bar
  // would sit frozen next to a "Pause" button that implies it's moving.
  const progressPercent = isThisTrack && duration
    ? Math.min(100, (currentTime / duration) * 100)
    : progress?.duration
    ? Math.min(100, (progress.position / progress.duration) * 100)
    : 0;
  const showProgressBar = det.progressBar && cfg.playback.showProgress && (isThisTrack ? isPlaying || currentTime > 0 : status === "in-progress");

  const sty = cardStyles(dens, grid);
  const primaryButtons = {
    play: (
      <button key="play" onClick={handlePlayClick} style={sty.playButton} disabled={offlineDisabled}>
        {isThisTrack ? (
          <>
            <span style={{ fontSize: "11px" }}>{isPlaying ? "❚❚" : "▶"}</span>
            {isPlaying ? "Pause" : "Play"}
          </>
        ) : (
          <>
            <span style={{ fontSize: "11px" }}>{status === "completed" ? "↻" : "▶"}</span>
            {status === "completed" ? "Play Again" : status === "in-progress" ? "Resume" : "Play"}
          </>
        )}
      </button>
    ),
    playNext: cardCfg.buttons.playNext && (
      <button key="playNext" onClick={handlePlayNext} style={sty.secondaryButton} disabled={offlineDisabled}>
        {queued ? "✓ Added" : "+ Play Next"}
      </button>
    ),
    more: cardCfg.buttons.more && (
      <button
        key="more"
        onClick={() => setShowMore((v) => !v)}
        style={sty.secondaryButton}
        aria-expanded={showMore}
        aria-label={showMore ? "Show fewer actions" : "Show more actions"}
      >
        More <span aria-hidden="true" style={{ fontSize: "10px", marginLeft: "4px" }}>{showMore ? "▴" : "▾"}</span>
      </button>
    ),
  };

  const moreButtons = {
    transcript: cardCfg.buttons.transcript && (
      <button key="transcript" onClick={() => navigate(`/transcripts/${audio.id}`, { state: { autoCreate: true } })} style={sty.actionButton}>
        View Transcript
      </button>
    ),
    copyLink: cardCfg.buttons.copyLink && canShare && (
      <button key="copyLink" onClick={handleCopyLink} style={sty.actionButton}>
        {copied ? "Link copied" : "Copy link"}
      </button>
    ),
    share: cardCfg.buttons.share && canShare && typeof navigator !== "undefined" && navigator.share && (
      <button key="share" onClick={handleShare} style={sty.actionButton}>
        Share
      </button>
    ),
    playlist: cardCfg.buttons.playlist && (
      <button key="playlist" onClick={() => setShowPlaylist(true)} style={sty.actionButton}>
        Add to playlist
      </button>
    ),
    download: cardCfg.buttons.download && canDownload && (
      <button
        key="download"
        onClick={handleToggleDownload}
        style={isDownloaded ? { ...sty.actionButton, ...moreActionButtonActive } : sty.actionButton}
        disabled={downloading}
      >
        {downloading ? "Working…" : isDownloaded ? "Remove download" : "Download"}
      </button>
    ),
  };
  const moreItems = cardCfg.moreOrder.map((id) => moreButtons[id]).filter(Boolean);
  // With the More button hidden, whichever actions are left just show.
  const moreOpen = cardCfg.buttons.more ? showMore : true;

  const animClass = adv.animations === "lively" ? "pf-card-lively" : adv.animations === "subtle" ? "pf-card-subtle" : "";

  return (
    <div
      className={animClass}
      style={{ ...(offlineDisabled ? { ...sty.card, ...cardOffline } : sty.card), ...(animClass ? { animationDelay: `${Math.min(index, 8) * 45}ms` } : null) }}
    >
      {showLike && (
        <button
          type="button"
          onClick={handleSave}
          style={saveButton}
          disabled={isSaving}
          aria-pressed={isSaved}
          aria-label={isSaved ? "Unlike" : "Like"}
          title={isSaved ? "Unlike" : "Like"}
        >
          {isSaved ? "❤️" : "🤍"}
        </button>
      )}
      <div style={{ paddingRight: showLike ? "44px" : 0 }}>
        {det.categoryTag && <span style={{ ...tagStyle(audio.type), marginBottom: dens.tagMb }}>{label}</span>}
        {det.newBadge && isNew && <span style={{ ...newBadge, marginBottom: dens.tagMb }}>✨ New</span>}
        {det.durationBadge && durationLabel && <span style={{ ...durationBadge, marginBottom: dens.tagMb }}>⏱ {durationLabel}</span>}
        {det.downloadedBadge && isDownloaded && <span style={{ ...downloadedBadge, marginBottom: dens.tagMb }}>⬇ Downloaded</span>}
      </div>
      <h3 style={sty.title}>{audio.title}</h3>
      {(det.speaker || (det.date && dateLabel) || (det.series && audio.series)) && (
        <p style={sty.speaker}>
          {[det.speaker && audio.speaker, det.date && dateLabel, det.series && audio.series && `Series: ${audio.series}`].filter(Boolean).join(" · ")}
        </p>
      )}

      {showProgressBar && (
        <div style={{ ...resumeTrack, marginBottom: dens.progressMb }}>
          <div style={{ ...resumeFill, width: `${progressPercent}%` }} />
        </div>
      )}

      <div style={sty.playRow}>
        {cardCfg.buttonOrder.map((id) => primaryButtons[id])}
      </div>
      {moreOpen && moreItems.length > 0 && <div style={sty.moreRow}>{moreItems}</div>}
      {!preview && offlineDisabled && <p style={offlineHint}>📴 You're offline — download this to listen without a connection.</p>}
      {!preview && !user && <p style={signInHint}>🔒 Sign in to save your spot — it'll be right here to resume next time you open the app.</p>}
      {saveError && <p style={saveErrorStyle} role="alert">{saveError}</p>}
      {downloadError && <p style={saveErrorStyle} role="alert">{downloadError}</p>}
      {det.aiSummary && !preview && <AiSummary audio={audio} onSummarySaved={onSummarySaved} />}
      {det.aiSummary && preview && <div style={previewAiButton}>✦ Summarize with AI</div>}
      {showPlaylist && <AddToPlaylistModal audio={audio} onClose={() => setShowPlaylist(false)} />}
    </div>
  );
}

const previewAiButton = { marginTop: "12px", display: "inline-block", padding: "7px 14px", borderRadius: "999px", border: "1px dashed var(--color-c97c2e)", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif" };

// Sizes and spacing for the chosen card layout.
function cardStyles(d, grid) {
  return {
    card: { position: "relative", background: "var(--color-fffdf9)", borderRadius: d.radius, padding: d.pad, marginBottom: grid ? 0 : "16px", border: "1px solid var(--color-eddfc8)", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", ...(grid ? { height: "100%", boxSizing: "border-box" } : null) },
    title: { marginBottom: d.titleMb, fontSize: d.title, fontWeight: "normal", color: "var(--color-3d2200)" },
    speaker: { color: "var(--color-9b7040)", fontSize: "13px", marginBottom: d.speakerMb, fontFamily: "sans-serif" },
    playButton: { display: "inline-flex", alignItems: "center", gap: "6px", padding: d.btnPad, paddingLeft: `calc(${d.btnPad.split(" ")[1]} + 4px)`, paddingRight: `calc(${d.btnPad.split(" ")[1]} + 4px)`, borderRadius: "999px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)", color: "var(--color-fff8ee)", cursor: "pointer", fontSize: d.btnFont, fontFamily: "sans-serif", boxShadow: "0 3px 10px rgba(160,80,20,0.25)" },
    secondaryButton: { display: "inline-flex", alignItems: "center", padding: d.btnPad, borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: d.btnFont, fontFamily: "sans-serif" },
    actionButton: { display: "inline-flex", alignItems: "center", justifyContent: "center", padding: d.btnPad, borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: d.btnFont, fontFamily: "sans-serif" },
    playRow: { display: "flex", gap: d.gap, flexWrap: "wrap" },
    moreRow: { display: "flex", gap: d.gap, flexWrap: "wrap", marginTop: "10px" },
  };
}

const saveButton = { position: "absolute", top: "14px", right: "14px", width: "36px", height: "36px", borderRadius: "50%", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: "17px", lineHeight: 1 };
const tagStyle = (type) => ({ display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: type === "homily" ? "var(--color-e8f0fe)" : type === "sundayschool" ? "var(--color-e9f5e8)" : "var(--color-f6e4b0)", color: type === "homily" ? "var(--color-2a5ab5)" : type === "sundayschool" ? "var(--color-39763c)" : "var(--color-7a5a10)", fontFamily: "sans-serif", marginBottom: "10px", letterSpacing: "0.04em" });
const newBadge = { display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "var(--color-fde8b8)", color: "var(--color-8a5a10)", fontFamily: "sans-serif", marginLeft: "8px", marginBottom: "10px", fontWeight: "600" };
const durationBadge = { display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "var(--color-f0e4d0)", color: "var(--color-7a5530)", fontFamily: "sans-serif", marginLeft: "8px", marginBottom: "10px" };
const moreActionButtonActive = { background: "var(--color-e3f5e6)", color: "var(--color-2f8a4a)", borderColor: "var(--color-bfe6c8)" };
const resumeTrack = { height: "5px", borderRadius: "999px", background: "var(--color-eddfc8)", overflow: "hidden", marginBottom: "14px" };
const resumeFill = { height: "100%", background: "linear-gradient(to right, var(--color-e08930), var(--color-c97c2e))" };
const saveErrorStyle = { color: "var(--color-a33622)", fontSize: "13px", fontFamily: "sans-serif", margin: "10px 0 0" };
const signInHint = { color: "var(--color-9b7040)", fontSize: "12px", fontFamily: "sans-serif", fontStyle: "italic", margin: "10px 0 0" };
const downloadedBadge = { display: "inline-block", fontSize: "11px", padding: "3px 10px", borderRadius: "999px", background: "var(--color-e3f5e6)", color: "var(--color-2f8a4a)", fontFamily: "sans-serif", marginLeft: "8px", marginBottom: "10px", fontWeight: "600" };
const cardOffline = { opacity: 0.55 };
const offlineHint = { color: "var(--color-9b7040)", fontSize: "12px", fontFamily: "sans-serif", fontStyle: "italic", margin: "10px 0 0" };
