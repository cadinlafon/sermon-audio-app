import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db } from "../firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAudioPlayer } from "../context/AudioPlayerContext";

export default function Doctrine() {
  const navigate = useNavigate();
  const { current, isPlaying, playSermon, togglePlay, playError } = useAudioPlayer();
  const [content, setContent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSections, setOpenSections] = useState({
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
      const snap = await getDoc(doc(db, "doctrineWeeks", "current"));
      // Spread order matters: snap.data() may carry a stray "id" field
      // saved by mistake in the past, so the real snap.id must come last
      // to win.
      setContent(snap.exists() ? { ...snap.data(), id: snap.id } : null);
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

  if (!content) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Doctrine Campaign</h1>
        <p style={empty}>Nothing has been added yet. Check back soon.</p>
        <AdminEditLink onClick={() => navigate("/admin/doctrine")} standalone />
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
          {content.audioStorageKey ? (
            <AudioPlayerRow
              content={content}
              current={current}
              isPlaying={isPlaying}
              playSermon={playSermon}
              togglePlay={togglePlay}
              playError={playError}
            />
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
// AUDIO PLAYBACK
////////////////////////////////////////////////

function AudioPlayerRow({ content, current, isPlaying, playSermon, togglePlay, playError }) {
  const isCurrent = current?.id === content.id;

  const handleClick = () => {
    if (isCurrent) {
      togglePlay();
    } else {
      playSermon({ id: content.id, title: content.title, speaker: content.speaker, collection: "doctrineWeeks", audioStorageKey: content.audioStorageKey });
    }
  };

  return (
    <div>
      <button style={playButton} onClick={handleClick}>
        {isCurrent && isPlaying ? "⏸ Pause" : "▶ Play Audio"}
      </button>
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
