import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { usePages } from "../context/PagesContext";
import {
  getDisplayName,
  isVisibleInNav,
  sortForNavigation,
  BADGE_COLORS,
} from "../lib/pageManager";

// A page's icon is either a legacy /navigation/*.png path or an
// emoji chosen in Page Manager's icon picker.
function iconProp(icon) {
  return icon && icon.startsWith("/") ? { src: icon } : { icon };
}

export default function BottomBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { pages } = usePages();

  const [showMore, setShowMore] = useState(false);
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          setIsAdmin(true);
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
    });

    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // PAGE MANAGER — DYNAMIC NAV LISTS
  //////////////////////////////////////////////////
  const visiblePages = (pages || []).filter(isVisibleInNav);
  const primaryPages = sortForNavigation(visiblePages.filter((p) => p.navSlot === "primary"));
  const morePages = sortForNavigation(visiblePages.filter((p) => p.navSlot === "more"));
  const settingsPage = (pages || []).find((p) => p.id === "settings");
  const settingsHidden = settingsPage ? !isVisibleInNav(settingsPage) : false;

  //////////////////////////////////////////////////
  // NAV
  //////////////////////////////////////////////////
  const go = (path) => {
    navigate(path);
    setShowMore(false);
  };

  const isActive = (path) => location.pathname === path;

  //////////////////////////////////////////////////
  // SETTINGS CLICK
  //////////////////////////////////////////////////
  const handleSettingsClick = () => {
    if (!user) {
      alert("Create an account to access settings");
      navigate("/signup");
      setShowMore(false);
      return;
    }
    go("/settings");
  };

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <>
      {/* BOTTOM BAR */}
      <div style={bar}>
        {primaryPages.map((p) => (
          <NavButton
            key={p.id}
            {...iconProp(p.icon)}
            label={getDisplayName(p)}
            badge={p.badgeEnabled ? { text: p.badgeText, color: p.badgeColor } : null}
            locked={p.status === "locked"}
            active={isActive(p.route)}
            onClick={() => go(p.route)}
          />
        ))}

        <NavButton
          src="/navigation/more.png"
          label="More"
          active={false}
          onClick={() => setShowMore(true)}
        />
      </div>

      {/* MORE SHEET */}
      {showMore && (
        <>
          <div style={backdrop} onClick={() => setShowMore(false)} />

          <div style={sheet}>
            <div style={handle} />

            <p style={sheetTitle}>More</p>

            {/* PAGE MANAGER CONTROLLED PAGES */}
            {morePages.length > 0 && (
              <div style={grid}>
                {morePages.map((p) => (
                  <SheetButton
                    key={p.id}
                    icon={p.icon}
                    label={getDisplayName(p)}
                    badge={p.badgeEnabled ? { text: p.badgeText, color: p.badgeColor } : null}
                    locked={p.status === "locked"}
                    onClick={() => go(p.route)}
                  />
                ))}
              </div>
            )}

            <div style={divider} />

            {/* BOTTOM ROW */}
            <div style={grid}>
              {!settingsHidden && (
                <SheetButton
                  icon="⚙️"
                  label="Settings"
                  onClick={handleSettingsClick}
                  muted={!user}
                />
              )}
              {isAdmin && (
                <SheetButton icon="🛡️" label="Admin" onClick={() => go("/admin")} />
              )}
              <SheetButton icon="🧑‍💻" label="Dev Info" onClick={() => go("/dev-info")} />
            </div>

            <button style={closeBtn} onClick={() => setShowMore(false)}>
              Close
            </button>
          </div>
        </>
      )}
    </>
  );
}

//////////////////////////////////////////////////
// SUB-COMPONENTS
//////////////////////////////////////////////////

function NavBadge({ badge }) {
  if (!badge || !badge.text) return null;
  const colors = BADGE_COLORS[badge.color] || BADGE_COLORS.amber;

  return (
    <span
      style={{
        position: "absolute",
        top: "-6px",
        right: "-10px",
        fontSize: "8px",
        fontWeight: "700",
        padding: "1px 5px",
        borderRadius: "999px",
        background: colors.bg,
        color: colors.color,
        fontFamily: "sans-serif",
        whiteSpace: "nowrap",
        boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
      }}
    >
      {badge.text}
    </span>
  );
}

function NavButton({ src, icon, label, active, onClick, badge, locked }) {
  return (
    <button style={navBtn} onClick={onClick}>
      <span style={iconWrap}>
        {src ? (
          <img src={src} style={navIcon(active)} alt={label} />
        ) : (
          <span style={navEmoji(active)}>{icon}</span>
        )}
        {locked && <span style={lockDot}>🔒</span>}
        <NavBadge badge={badge} />
      </span>
      <span style={navLabel(active)}>{label}</span>
    </button>
  );
}

function SheetButton({ icon, label, onClick, muted, badge, locked }) {
  return (
    <button
      style={{ ...sheetBtn, ...(muted ? sheetBtnMuted : {}) }}
      onClick={onClick}
    >
      <span style={iconWrap}>
        <span style={sheetBtnIcon}>{icon}</span>
        {locked && <span style={lockDot}>🔒</span>}
        <NavBadge badge={badge} />
      </span>
      <span style={sheetBtnLabel}>{label}</span>
    </button>
  );
}

//////////////////////////////////////////////////
// STYLES — BAR
//////////////////////////////////////////////////

const bar = {
  position: "fixed",
  bottom: 0,
  left: 0,
  width: "100%",
  background: "#fffdf9",
  borderTop: "1px solid #eddfc8",
  display: "flex",
  justifyContent: "space-around",
  padding: "8px 0 10px",
  zIndex: 1000,
  boxSizing: "border-box",
};

const navBtn = {
  background: "none",
  border: "none",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "3px",
  cursor: "pointer",
  padding: "0 6px",
  minWidth: 0,
};

const iconWrap = {
  position: "relative",
  display: "inline-flex",
};

const lockDot = {
  position: "absolute",
  bottom: "-4px",
  right: "-6px",
  fontSize: "9px",
  lineHeight: 1,
};

const navIcon = (active) => ({
  width: "22px",
  height: "22px",
  opacity: active ? 1 : 0.45,
  filter: active
    ? "sepia(1) saturate(3) hue-rotate(5deg) brightness(0.7)"
    : "none",
});

const navEmoji = (active) => ({
  fontSize: "20px",
  lineHeight: "22px",
  opacity: active ? 1 : 0.45,
});

const navLabel = (active) => ({
  fontSize: "10px",
  fontFamily: "sans-serif",
  color: active ? "#a85e18" : "#b08050",
  fontWeight: active ? "600" : "400",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "64px",
  textAlign: "center",
});

//////////////////////////////////////////////////
// STYLES — SHEET
//////////////////////////////////////////////////

const backdrop = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.45)",
  zIndex: 999,
};

const sheet = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,          // ← fixes the "pops out left" bug
  width: "100%",
  background: "#fffdf9",
  borderTopLeftRadius: "22px",
  borderTopRightRadius: "22px",
  padding: "16px 20px 32px",
  zIndex: 1000,
  boxShadow: "0 -8px 30px rgba(80,35,0,0.18)",
  boxSizing: "border-box",
};

const handle = {
  width: "36px",
  height: "4px",
  background: "#eddfc8",
  borderRadius: "999px",
  margin: "0 auto 16px",
};

const sheetTitle = {
  textAlign: "center",
  fontFamily: "'Georgia', serif",
  fontSize: "15px",
  color: "#5c3a1e",
  margin: "0 0 16px",
  letterSpacing: "0.02em",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "10px",
  marginBottom: "4px",
};

const sheetBtn = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
  padding: "14px 8px",
  borderRadius: "14px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  cursor: "pointer",
  minWidth: 0,
};

const sheetBtnMuted = {
  opacity: 0.45,
  cursor: "not-allowed",
};

const sheetBtnIcon = {
  fontSize: "22px",
  lineHeight: 1,
};

const sheetBtnLabel = {
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "#5c3a1e",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
};

const divider = {
  height: "1px",
  background: "#eddfc8",
  margin: "14px 0",
};

const closeBtn = {
  marginTop: "18px",
  width: "100%",
  padding: "13px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "transparent",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontSize: "14px",
  cursor: "pointer",
};
