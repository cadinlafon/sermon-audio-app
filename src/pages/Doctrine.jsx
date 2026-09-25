import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import { DOCTRINE_SCHEDULE } from "../data/doctrineSchedule";

export default function Doctrine() {
  const navigate = useNavigate();
  const { current, isPlaying, playSermon, togglePlay, playError, playNext } = useAudioPlayer();
  const [content, setContent] = useState(null);
  const [topics, setTopics] = useState({ weeks: [], defaultWeekId: "" });
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({
    weekly: true,
    schedule: false,
    questions: false,
    audio: false,
    docs: false,
    memorization: false,
    notes: false,
  });

  ////////////////////////////////////////////////
  // FETCH
  ////////////////////////////////////////////////
  useEffect(() => {
    async function fetchContent() {
      // Weekly topics are optional — a failure here must never hide the page.
      try {
        const topicsSnap = await getDoc(doc(db, "doctrineWeeks", "topics"));
        if (topicsSnap.exists()) {
          const t = topicsSnap.data();
          setTopics({ weeks: Array.isArray(t.weeks) ? t.weeks.filter((w) => w.published !== false) : [], defaultWeekId: t.defaultWeekId || "" });
        }
      } catch (error) {
        console.warn("Couldn't load weekly topics", error);
      }

      const snap = await getDoc(doc(db, "doctrineWeeks", "current"));
      if (!snap.exists()) {
        setContent(null);
        setLoading(false);
        return;
      }

      const data = snap.data();
      // Legacy docs carried a single audioStorageKey/audioFileName pair
      // instead of an audioFiles list — show it the same way rather than
      // requiring the admin to re-save first.
      const audioFiles = Array.isArray(data.audioFiles) && data.audioFiles.length > 0
        ? data.audioFiles
        : data.audioStorageKey
        ? [{ id: snap.id, label: data.audioFileName || "", audioStorageKey: data.audioStorageKey }]
        : [];

      // Spread order matters: snap.data() may carry a stray "id" field
      // saved by mistake in the past, so the real snap.id must come last
      // to win.
      setContent({ ...data, audioFiles, id: snap.id });
      setLoading(false);
    }

    fetchContent();
  }, []);

  const toggle = (key) => setOpenSections((s) => ({ ...s, [key]: !s[key] }));

  ////////////////////////////////////////////////
  // UI
  ////////////////////////////////////////////////

  if (loading) {
    return (
      <div style={page}>
        <p style={empty}>Loading…</p>
      </div>
    );
  }

  const hasWeeks = topics.weeks.length > 0;

  if (!content && !hasWeeks) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Doctrine Campaign</h1>
        <p style={empty}>Nothing has been added yet. Check back soon.</p>
        <AdminEditLink onClick={() => navigate("/admin/doctrine")} standalone />
      </div>
    );
  }

  // Only weekly topics exist so far — show them on their own.
  if (!content) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Doctrine Campaign</h1>
        <div style={card}>
          <Dropdown label="Weekly Topic" open={openSections.weekly} onToggle={() => toggle("weekly")}>
            <WeeklyTopic weeks={topics.weeks} defaultWeekId={topics.defaultWeekId} />
          </Dropdown>
          <AdminEditLink onClick={() => navigate("/admin/doctrine")} standalone />
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      <h1 style={pageTitle}>Doctrine Campaign</h1>

      {/* CONTENT */}
      <div style={card}>
        {content.imageURL && <img src={content.imageURL} alt="" style={cardImage} />}

        <h2 style={cardTitle}>{content.title || "Untitled"}</h2>

        {content.speaker && <p style={speaker}>Speaker: {content.speaker}</p>}

        {content.details && <p style={details}>{content.details}</p>}

        {hasWeeks && (
          <Dropdown
            label="Weekly Topic"
            open={openSections.weekly}
            onToggle={() => toggle("weekly")}
          >
            <WeeklyTopic weeks={topics.weeks} defaultWeekId={topics.defaultWeekId} />
          </Dropdown>
        )}

        <Dropdown
          label="Schedule"
          open={openSections.schedule}
          onToggle={() => toggle("schedule")}
        >
          <div style={scheduleWrap}>
            <table style={scheduleTable}>
              <thead>
                <tr>
                  <th style={scheduleTh}>Week</th>
                  <th style={scheduleTh}>Date</th>
                  <th style={scheduleTh}>Topic</th>
                  <th style={scheduleTh}>Memory Text</th>
                </tr>
              </thead>
              <tbody>
                {DOCTRINE_SCHEDULE.map((row, i) =>
                  row.break ? (
                    <tr key={i} style={scheduleBreakRow}>
                      <td style={scheduleTd} colSpan={2}>{row.date}</td>
                      <td style={{ ...scheduleTd, ...scheduleBreakText }} colSpan={2}>{row.topic}</td>
                    </tr>
                  ) : (
                    <tr key={i}>
                      <td style={scheduleTd}>{row.week}</td>
                      <td style={scheduleTd}>{row.date}</td>
                      <td style={scheduleTd}>{row.topic}</td>
                      <td style={scheduleTd}>{row.memoryText || "—"}</td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </Dropdown>

        <Dropdown
          label="Questions"
          open={openSections.questions}
          onToggle={() => toggle("questions")}
        >
          {content.questions && content.questions.length > 0 ? (
            <ol style={questionsList}>
              {content.questions.map((q, i) => (
                <li key={i} style={questionItem}>{q}</li>
              ))}
            </ol>
          ) : (
            <p style={emptySection}>No questions added yet.</p>
          )}
          <AdminEditLink onClick={() => navigate("/admin/doctrine")} />
        </Dropdown>

        <Dropdown
          label="Audio"
          open={openSections.audio}
          onToggle={() => toggle("audio")}
        >
          {content.audioFiles && content.audioFiles.length > 0 ? (
            <div style={audioList}>
              {content.audioFiles.map((audio, i) => (
                <AudioPlayerRow
                  key={audio.id || audio.audioStorageKey}
                  audio={audio}
                  index={i}
                  content={content}
                  current={current}
                  isPlaying={isPlaying}
                  playSermon={playSermon}
                  togglePlay={togglePlay}
                  playError={playError}
                  playNext={playNext}
                />
              ))}
            </div>
          ) : (
            <p style={emptySection}>No audio uploaded yet.</p>
          )}
          <AdminEditLink onClick={() => navigate("/admin/doctrine")} />
        </Dropdown>

        <Dropdown
          label="Docs"
          open={openSections.docs}
          onToggle={() => toggle("docs")}
        >
          {content.docsLink ? (
            <a
              href={content.docsLink}
              target="_blank"
              rel="noopener noreferrer"
              style={link}
            >
              Open Docs →
            </a>
          ) : (
            <p style={emptySection}>No docs linked yet.</p>
          )}
          <AdminEditLink onClick={() => navigate("/admin/doctrine")} />
        </Dropdown>

        <Dropdown
          label="Weekly Memorization"
          open={openSections.memorization}
          onToggle={() => toggle("memorization")}
        >
          {content.memorization ? (
            <p style={sectionText}>{content.memorization}</p>
          ) : (
            <p style={emptySection}>No memorization added yet.</p>
          )}
          <AdminEditLink onClick={() => navigate("/admin/doctrine")} />
        </Dropdown>

        <Dropdown
          label="Notes"
          open={openSections.notes}
          onToggle={() => toggle("notes")}
        >
          {content.notes ? (
            <p style={sectionText}>{content.notes}</p>
          ) : (
            <p style={emptySection}>No notes added yet.</p>
          )}
          <AdminEditLink onClick={() => navigate("/admin/doctrine")} />
        </Dropdown>

        <AdminEditLink onClick={() => navigate("/admin/doctrine")} standalone />
      </div>
    </div>
  );
}

////////////////////////////////////////////////
// WEEKLY TOPIC — "‹ Week 2 ›" slider. Opens on the admin-chosen default
// week; arrows, dots, or a swipe move between weeks.
////////////////////////////////////////////////

function WeeklyTopic({ weeks, defaultWeekId }) {
  const start = Math.max(0, weeks.findIndex((w) => w.id === defaultWeekId));
  const [index, setIndex] = useState(start);
  const touchX = useRef(null);
  const week = weeks[Math.min(index, weeks.length - 1)];
  const isDefault = week.id === defaultWeekId;

  const go = (delta) => setIndex((i) => Math.min(weeks.length - 1, Math.max(0, i + delta)));

  const onTouchEnd = (e) => {
    if (touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    touchX.current = null;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  };

  const hasBody = week.topic || week.dateRange || week.memoryText || week.details;

  return (
    <div
      onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
      onTouchEnd={onTouchEnd}
    >
      <div style={sliderBar}>
        <button style={arrowButton(index === 0)} onClick={() => go(-1)} disabled={index === 0} aria-label="Previous week">‹</button>
        <div style={sliderCenter} aria-live="polite">
          <div style={sliderLabel}>{week.label}</div>
          <div style={sliderCount}>{index + 1} of {weeks.length}{isDefault ? " · Current" : ""}</div>
        </div>
        <button style={arrowButton(index === weeks.length - 1)} onClick={() => go(1)} disabled={index === weeks.length - 1} aria-label="Next week">›</button>
      </div>

      {weeks.length > 1 && (
        <div style={dotRow}>
          {weeks.map((w, i) => (
            <button key={w.id} style={dot(i === index)} onClick={() => setIndex(i)} aria-label={`Go to ${w.label}`} />
          ))}
        </div>
      )}

      {hasBody ? (
        <div style={weekBody}>
          {week.topic && <h3 style={weekTopic}>{week.topic}</h3>}
          {week.dateRange && <p style={weekDates}>{week.dateRange}</p>}
          {week.memoryText && (
            <div style={memoryBox}>
              <span style={memoryLabel}>Memory text</span>
              <span style={memoryValue}>{week.memoryText}</span>
            </div>
          )}
          {week.details && <p style={sectionText}>{week.details}</p>}
        </div>
      ) : (
        <p style={emptySection}>Nothing added for this week yet.</p>
      )}
    </div>
  );
}

////////////////////////////////////////////////
// AUDIO PLAYBACK
////////////////////////////////////////////////

function AudioPlayerRow({ audio, index, content, current, isPlaying, playSermon, togglePlay, playError, playNext }) {
  const trackId = audio.id || audio.audioStorageKey;
  const isCurrent = current?.id === trackId;
  const label = audio.label || `Track ${index + 1}`;
  const [queued, setQueued] = useState(false);

  const track = { id: trackId, title: audio.label || content.title, speaker: content.speaker, collection: "doctrineWeeks", audioStorageKey: audio.audioStorageKey };

  const handleClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playSermon(track);
    }
  };

  const handlePlayNext = () => {
    playNext(track);
    setQueued(true);
    setTimeout(() => setQueued(false), 1800);
  };

  return (
    <div style={audioRow}>
      <div style={audioRowButtons}>
        <button style={playButton} onClick={handleClick}>
          {isCurrent && isPlaying ? "⏸ Pause" : `▶ ${label}`}
        </button>
        <button style={playNextButton} onClick={handlePlayNext}>
          {queued ? "✓ Added" : "+ Play Next"}
        </button>
      </div>
      {isCurrent && <p style={nowPlayingText}>Now playing.</p>}
      {isCurrent && playError && <p style={playErrorText}>{playError}</p>}
    </div>
  );
}

////////////////////////////////////////////////
// ADMIN SHORTCUT
////////////////////////////////////////////////

function AdminEditLink({ onClick, standalone }) {
  return (
    <button
      style={standalone ? { ...adminLink, ...adminLinkStandalone } : adminLink}
      onClick={onClick}
    >
      Are you an admin and need to make a change? Click here
    </button>
  );
}

////////////////////////////////////////////////
// DROPDOWN
////////////////////////////////////////////////

function Dropdown({ label, open, onToggle, children }) {
  return (
    <div style={dropdown}>
      <button style={dropdownHeader} onClick={onToggle}>
        <span>{label}</span>
        <span style={dropdownChevron(open)}>▾</span>
      </button>

      {open && <div style={dropdownBody}>{children}</div>}
    </div>
  );
}

////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////

const page = {
  padding: "32px 20px 60px",
  maxWidth: "700px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
};

const pageTitle = {
  textAlign: "center",
  marginBottom: "24px",
  fontFamily: "'Georgia', serif",
  fontWeight: "normal",
  color: "#3d2200",
};

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "18px",
  padding: "24px 22px",
  boxShadow: "0 2px 10px rgba(160,100,40,0.06)",
  overflow: "hidden",
};

const cardImage = {
  display: "block",
  width: "calc(100% + 44px)",
  height: "200px",
  objectFit: "cover",
  margin: "-24px -22px 20px",
};

const questionsList = {
  margin: 0,
  paddingLeft: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const questionItem = {
  fontSize: "14px",
  color: "#5c3a1e",
  fontFamily: "sans-serif",
  lineHeight: 1.6,
};

const cardTitle = {
  fontSize: "22px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: "0 0 8px",
};

const speaker = {
  fontSize: "13px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  margin: "0 0 14px",
};

const details = {
  fontSize: "14px",
  color: "#5c3a1e",
  fontFamily: "sans-serif",
  lineHeight: 1.7,
  margin: "0 0 20px",
  whiteSpace: "pre-wrap",
};

const dropdown = {
  border: "1px solid #eddfc8",
  borderRadius: "12px",
  marginBottom: "10px",
  overflow: "hidden",
};

const dropdownHeader = {
  width: "100%",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "13px 16px",
  background: "#fdf1de",
  border: "none",
  fontFamily: "sans-serif",
  fontSize: "14px",
  fontWeight: "600",
  color: "#5c3a1e",
  cursor: "pointer",
};

const dropdownChevron = (open) => ({
  display: "inline-block",
  transition: "transform 0.15s",
  transform: open ? "rotate(180deg)" : "rotate(0deg)",
  color: "#a85e18",
});

const dropdownBody = {
  padding: "14px 16px",
  background: "#fffdf9",
};

const sectionText = {
  fontSize: "14px",
  color: "#5c3a1e",
  fontFamily: "sans-serif",
  lineHeight: 1.7,
  margin: 0,
  whiteSpace: "pre-wrap",
};

const emptySection = {
  fontSize: "13px",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontStyle: "italic",
  margin: 0,
};

const scheduleWrap = {
  overflowX: "auto",
  margin: "-2px",
  padding: "2px",
};

const scheduleTable = {
  width: "100%",
  minWidth: "480px",
  borderCollapse: "collapse",
  fontFamily: "sans-serif",
  fontSize: "13px",
};

const scheduleTh = {
  textAlign: "left",
  padding: "8px 10px",
  fontSize: "11px",
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "#9b7040",
  borderBottom: "1px solid #eddfc8",
  whiteSpace: "nowrap",
};

const scheduleTd = {
  padding: "8px 10px",
  color: "#5c3a1e",
  borderBottom: "1px solid #f0e4d0",
  verticalAlign: "top",
};

const scheduleBreakRow = {
  background: "#fdf1de",
};

const scheduleBreakText = {
  fontWeight: "600",
  color: "#a85e18",
  letterSpacing: "0.03em",
};

const link = {
  fontSize: "14px",
  color: "#a85e18",
  fontFamily: "sans-serif",
  fontWeight: "600",
  textDecoration: "none",
};

const empty = {
  textAlign: "center",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontStyle: "italic",
  padding: "40px 0",
};

const audioList = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const audioRow = {};

const audioRowButtons = { display: "flex", gap: "8px", flexWrap: "wrap" };

const playButton = {
  padding: "10px 20px",
  borderRadius: "999px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e 0%, #a85e18 100%)",
  color: "#fff8ee",
  fontSize: "13px",
  fontWeight: "600",
  fontFamily: "sans-serif",
  cursor: "pointer",
  boxShadow: "0 3px 10px rgba(160,80,20,0.25)",
};

const playNextButton = {
  padding: "10px 16px",
  borderRadius: "999px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  color: "#7a4f10",
  fontSize: "13px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};

const nowPlayingText = {
  fontSize: "12px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  margin: "8px 0 0",
};

const playErrorText = {
  fontSize: "12px",
  color: "#b3432c",
  fontFamily: "sans-serif",
  margin: "6px 0 0",
};

const adminLink = {
  display: "block",
  width: "100%",
  textAlign: "left",
  border: "none",
  background: "transparent",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontSize: "11px",
  fontStyle: "italic",
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0,
  marginTop: "12px",
};

const adminLinkStandalone = {
  textAlign: "center",
  marginTop: "16px",
  paddingTop: "16px",
  borderTop: "1px solid #f0e4d0",
};

const sliderBar = { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" };
const sliderCenter = { textAlign: "center", flex: 1, minWidth: 0 };
const sliderLabel = { fontSize: "20px", fontFamily: "'Georgia', serif", color: "#3d2200" };
const sliderCount = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", marginTop: "2px", letterSpacing: "0.04em" };
const arrowButton = (disabled) => ({
  width: "44px", height: "44px", borderRadius: "50%", border: "1px solid #eddfc8", background: disabled ? "#f6efe6" : "#fdf1de",
  color: disabled ? "#cdb99a" : "#a85e18", fontSize: "26px", lineHeight: 1, cursor: disabled ? "default" : "pointer", flexShrink: 0,
  display: "flex", alignItems: "center", justifyContent: "center", paddingBottom: "3px",
});
const dotRow = { display: "flex", justifyContent: "center", gap: "7px", flexWrap: "wrap", margin: "12px 0 4px" };
const dot = (active) => ({ width: active ? "18px" : "8px", height: "8px", borderRadius: "999px", border: "none", padding: 0, cursor: "pointer", background: active ? "#c97c2e" : "#e4d3b8", transition: "width 0.15s" });
const weekBody = { marginTop: "14px", paddingTop: "14px", borderTop: "1px solid #f0e4d0", display: "flex", flexDirection: "column", gap: "10px" };
const weekTopic = { margin: 0, fontSize: "17px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const weekDates = { margin: 0, fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", letterSpacing: "0.03em" };
const memoryBox = { display: "flex", flexDirection: "column", gap: "3px", background: "#fdf1de", borderRadius: "10px", padding: "10px 12px" };
const memoryLabel = { fontSize: "10px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#9b7040", fontFamily: "sans-serif" };
const memoryValue = { fontSize: "14px", color: "#5c3a1e", fontFamily: "'Georgia', serif" };
