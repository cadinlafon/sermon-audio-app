import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

import LoadingScreen from "./components/LoadingScreen";
import PopupNotification from "./components/PopupNotification";
import NotificationPopup from "./components/NotificationPopup";
import IosInstallPopup from "./components/IosInstallPopup";
import TopBar from "./components/topbar";
import BottomBar from "./components/bottombar";
import MiniPlayer from "./components/MiniPlayer";
import AppGuard from "./components/AppGuard";
import PageGate from "./components/PageGate";

import RouteLogger from "./RouteLogger";
import { logEvent } from "./utils/logEvent";
import { captureTrafficSource } from "./utils/trafficSource";

// Public / user pages
import YourListens from "./pages/YourListens";
import Saved from "./pages/Saved";
import Stats from "./pages/Stats";
import Home from "./pages/Home";
import Sermons from "./pages/Sermons";
import SundaySchool from "./pages/SundaySchool";
import Feedback from "./pages/Feedback";
import Settings from "./pages/Settings/Settings";
import SignUp from "./pages/SignUp";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import AdminAccess from "./pages/AdminAccess";
import Player from "./pages/Player";
import SuggestFeature from "./pages/SuggestFeature";
import Contact from "./pages/Contact";
import Account from "./pages/Settings/Account";
import AudioAppLanding from "./pages/AudioAppLanding";
import Doctrine from "./pages/Doctrine";
import Resources from "./pages/Resources";
import ResourceDetail from "./pages/ResourceDetail";

// Admin
import PageNotices from "./pages/Admin/PageNotices";
import AdminGate from "./pages/Admin/AdminGate";
import AdminLayout from "./pages/Admin/AdminLayout";
import Dashboard from "./pages/Admin/Dashboard";
import UploadAudio from "./pages/Admin/UploadAudio";
import Users from "./pages/Admin/Users";
import Analytics from "./pages/Admin/Analytics";
import AdminContentManager from "./pages/Admin/AdminContentManager";
import AdminSettings from "./pages/Admin/Settings";
import Logs from "./pages/Admin/Logs";
import AdminNotifications from "./pages/Admin/AdminNotifications";
import AdminSuggestions from "./pages/Admin/AdminSuggestions";
import AdminNotices from "./pages/Admin/AdminNotices";
import SendNotifactions from "./pages/Admin/SendNotifactions";
import Referrals from "./pages/Admin/Referrals";
import DoctrineAdmin from "./pages/Admin/DoctrineAdmin";
import PageManager from "./pages/Admin/PageManager";
import ResourceManager from "./pages/Admin/ResourceManager";


//////////////////////////////////////////////////
// AUTH GUARDS
//////////////////////////////////////////////////

/*
 * Pages that REQUIRE the user to be logged in.
 *
 * If someone tries to access one while logged out,
 * they are sent to /login.
 */
function RequireAuth({ user, children }) {
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}


/*
 * Pages that should ONLY be accessible while logged out.
 *
 * If someone is already logged in and tries to visit
 * /login or /signup, send them home instead.
 */
function RequireLoggedOut({ user, children }) {
  if (user) {
    return <Navigate to="/" replace />;
  }

  return children;
}


//////////////////////////////////////////////////
// APP
//////////////////////////////////////////////////

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  const location = useLocation();


  //////////////////////////////////////////////////
  // TRAFFIC SOURCE / UTM CAPTURE
  //////////////////////////////////////////////////

  useState(() => {
    captureTrafficSource();
  });


  //////////////////////////////////////////////////
  // SESSION START
  //////////////////////////////////////////////////

  useEffect(() => {
    const sessionId = crypto.randomUUID();

    localStorage.setItem("sessionId", sessionId);
    localStorage.setItem("sessionStart", Date.now());

    logEvent("session_start", { sessionId });
  }, []);


  //////////////////////////////////////////////////
  // SESSION END
  //////////////////////////////////////////////////

  useEffect(() => {
    const handleClose = () => {
      const sessionId = localStorage.getItem("sessionId");
      const start = localStorage.getItem("sessionStart");

      if (!sessionId || !start) return;

      const duration = Math.floor(
        (Date.now() - Number(start)) / 1000
      );

      logEvent("session_end", {
        sessionId,
        duration,
      });
    };

    window.addEventListener("beforeunload", handleClose);

    return () => {
      window.removeEventListener("beforeunload", handleClose);
    };
  }, []);


  //////////////////////////////////////////////////
  // APP OPEN TRACKING
  //////////////////////////////////////////////////

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;

    const device = navigator.userAgent;

    logEvent("app_opened", {
      device,
      mode: isStandalone ? "pwa" : "web",
    });

    if (window.navigator.standalone === true) {
      const alreadyLogged =
        localStorage.getItem("ios_pwa_logged");

      if (!alreadyLogged) {
        logEvent("pwa_installed_ios", {
          device,
        });

        localStorage.setItem(
          "ios_pwa_logged",
          "true"
        );
      }
    }
  }, []);


  //////////////////////////////////////////////////
  // INSTALL EVENTS
  //////////////////////////////////////////////////

  useEffect(() => {
    function handleInstallPrompt() {
      logEvent("pwa_install_prompt_available", {
        device: navigator.userAgent,
      });
    }

    function handleInstalled() {
      const alreadyLogged =
        localStorage.getItem("pwa_installed_logged");

      if (!alreadyLogged) {
        logEvent("pwa_installed", {
          device: navigator.userAgent,
        });

        localStorage.setItem(
          "pwa_installed_logged",
          "true"
        );
      }
    }

    window.addEventListener(
      "beforeinstallprompt",
      handleInstallPrompt
    );

    window.addEventListener(
      "appinstalled",
      handleInstalled
    );

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleInstallPrompt
      );

      window.removeEventListener(
        "appinstalled",
        handleInstalled
      );
    };
  }, []);


  //////////////////////////////////////////////////
  // AUTH
  //////////////////////////////////////////////////

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(
      auth,
      async (currentUser) => {
        setUser(currentUser);

        if (currentUser) {
          try {
            const userDoc = await getDoc(
              doc(db, "users", currentUser.uid)
            );

            if (
              userDoc.exists() &&
              userDoc.data().role === "admin"
            ) {
              setIsAdmin(true);
            } else {
              setIsAdmin(false);
            }
          } catch (error) {
            console.error(
              "Admin check failed:",
              error
            );

            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }

        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);


  //////////////////////////////////////////////////
  // LOADING
  //////////////////////////////////////////////////

  if (loading) {
    return <LoadingScreen />;
  }


  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////

  return (
    <AppGuard user={isAdmin ? { role: "admin" } : null}>

      <PopupNotification />

      <RouteLogger />

      <TopBar />

      <NotificationPopup />

      <IosInstallPopup />


      <div style={{ paddingBottom: "80px" }}>

        <Routes>

          {/* ==========================================
              PUBLIC PAGES
              ========================================== */}

          <Route
            path="/"
            element={
              <PageGate id="home">
                <Home />
              </PageGate>
            }
          />

          <Route
            path="/sermons"
            element={
              <PageGate id="sermons">
                <Sermons />
              </PageGate>
            }
          />

          <Route
            path="/sundayschool"
            element={
              <PageGate id="sundayschool">
                <SundaySchool />
              </PageGate>
            }
          />

          <Route
            path="/doctrine"
            element={
              <PageGate id="doctrine">
                <Doctrine />
              </PageGate>
            }
          />

          <Route
            path="/feedback"
            element={
              <PageGate id="feedback">
                <Feedback />
              </PageGate>
            }
          />

          <Route
            path="/about"
            element={
              <PageGate id="about">
                <AudioAppLanding />
              </PageGate>
            }
          />

          <Route
            path="/audio-app"
            element={<AudioAppLanding />}
          />

          <Route
            path="/contact"
            element={
              <PageGate id="contact">
                <Contact />
              </PageGate>
            }
          />

          <Route
            path="/resources"
            element={
              <PageGate id="resources">
                <Resources />
              </PageGate>
            }
          />

          <Route
            path="/resources/:id"
            element={<ResourceDetail />}
          />

          <Route
            path="/player"
            element={<Player />}
          />

          <Route
            path="/admin-access"
            element={<AdminAccess />}
          />


          {/* ==========================================
              AUTH PAGES
              ONLY LOGGED-OUT USERS CAN ACCESS THESE
              ========================================== */}

          <Route
            path="/login"
            element={
              <RequireLoggedOut user={user}>
                <Login />
              </RequireLoggedOut>
            }
          />

          <Route
            path="/signup"
            element={
              <RequireLoggedOut user={user}>
                <SignUp />
              </RequireLoggedOut>
            }
          />


          {/* ==========================================
              LOGIN-REQUIRED PAGES
              ========================================== */}

          <Route
            path="/your-listens"
            element={
              <PageGate id="your-listens">
                <YourListens />
              </PageGate>
            }
          />

          <Route
            path="/saved"
            element={
              <PageGate id="saved">
                <Saved />
              </PageGate>
            }
          />

          <Route
            path="/stats"
            element={
              <PageGate id="stats">
                <Stats />
              </PageGate>
            }
          />

          <Route
            path="/suggest"
            element={
              <PageGate id="suggest">
                <SuggestFeature />
              </PageGate>
            }
          />

          <Route
            path="/settings"
            element={
              <PageGate id="settings">
                <Settings />
              </PageGate>
            }
          />

          <Route
            path="/Account"
            element={
              <RequireAuth user={user}>
                <Account />
              </RequireAuth>
            }
          />


          {/* ==========================================
              ADMIN
              ========================================== */}

          <Route
            path="/admin/*"
            element={
              <AdminGate
                user={isAdmin ? user : null}
              />
            }
          >

            <Route element={<AdminLayout />}>

              <Route
                index
                element={
                  <Navigate
                    to="dashboard"
                    replace
                  />
                }
              />

              <Route
                path="dashboard"
                element={<Dashboard />}
              />

              <Route
                path="content"
                element={<AdminContentManager />}
              />

              <Route
                path="upload"
                element={<UploadAudio />}
              />

              <Route
                path="users"
                element={<Users />}
              />

              <Route
                path="analytics"
                element={<Analytics />}
              />

              <Route
                path="notifications"
                element={<AdminNotifications />}
              />

              <Route
                path="send-notifications"
                element={<SendNotifactions />}
              />

              <Route
                path="settings"
                element={<AdminSettings />}
              />

              <Route
                path="logs"
                element={<Logs />}
              />

              <Route
                path="suggestions"
                element={<AdminSuggestions />}
              />

              <Route
                path="notices"
                element={<AdminNotices />}
              />

              <Route
                path="pagenotices"
                element={<PageNotices />}
              />

              <Route
                path="referrals"
                element={<Referrals />}
              />

              <Route
                path="doctrine"
                element={<DoctrineAdmin />}
              />

              <Route
                path="resources"
                element={<ResourceManager />}
              />

              <Route
                path="pagemanager"
                element={<PageManager />}
              />

            </Route>

          </Route>


          {/* ==========================================
              404
              ========================================== */}

          <Route
            path="*"
            element={<NotFound />}
          />

        </Routes>

      </div>


      {/* ==========================================
          BOTTOM BAR
          ========================================== */}

      <BottomBar />


      {/* ==========================================
          MINI PLAYER
          ========================================== */}

      {location.pathname !== "/player" && (
        <MiniPlayer />
      )}

    </AppGuard>
  );
}

export default App;