import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import RouteLogger from "./RouteLogger";
import { logEvent } from "./utils/logEvent";
import IosInstallPopup from "./components/IosInstallPopup";
import NotificationPopup from "./components/NotificationPopup";
import YourListens from "./pages/YourListens";
import Saved from "./pages/Saved";
// Shutdown system
import AppGuard from "./components/AppGuard";
import Stats from "./pages/Stats";
// Public Pages
import Home from "./pages/Home";
import Sermons from "./pages/Sermons";
import Homilys from "./pages/Homilys";
import SundaySchool from "./pages/SundaySchool";
import Feedback from "./pages/Feedback";
import Settings from "./pages/Settings/Settings";
import About from "./pages/About";
import SignUp from "./pages/SignUp";
import NotFound from "./pages/NotFound";
import AdminAccess from "./pages/AdminAccess";
import Player from "./pages/Player";
// Admin Pages
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
import SuggestFeature from "./pages/SuggestFeature";
import AdminSuggestions from "./pages/Admin/AdminSuggestions";
import AdminNotices from "./pages/Admin/AdminNotices";
// Components
import Navbar from "./components/Navbar";
import PopupNotification from "./components/PopupNotification";
import MiniPlayer from "./components/MiniPlayer";
function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  //////////////////////////////////////////////////
  // APP OPEN + MODE DETECTION
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

    // iOS PWA detection
    if (window.navigator.standalone === true) {
      const alreadyLogged = localStorage.getItem("ios_pwa_logged");

      if (!alreadyLogged) {
        logEvent("pwa_installed_ios", { device });
        localStorage.setItem("ios_pwa_logged", "true");
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
      const alreadyLogged = localStorage.getItem("pwa_installed_logged");

      if (!alreadyLogged) {
        logEvent("pwa_installed", {
          device: navigator.userAgent,
        });
        localStorage.setItem("pwa_installed_logged", "true");
      }
    }

    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  //////////////////////////////////////////////////
  // AUTH LISTENER
  //////////////////////////////////////////////////
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        try {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));

          if (userDoc.exists() && userDoc.data().role === "admin") {
            setIsAdmin(true);
          } else {
            setIsAdmin(false);
          }
        } catch (error) {
          console.error("Admin check failed:", error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  //////////////////////////////////////////////////
  // LOADING
  //////////////////////////////////////////////////
  if (loading) return null;

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////
  return (
    <AppGuard user={isAdmin ? { role: "admin" } : null}>
      <PopupNotification />
      <RouteLogger />
      <Navbar />
      <NotificationPopup />
      <IosInstallPopup />

      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Home />} />
        <Route path="/sermons" element={<Sermons />} />
        <Route path="/homilies" element={<Homilys />} />
        <Route path="/sundayschool" element={<SundaySchool />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/about" element={<About />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/admin-access" element={<AdminAccess />} />
        <Route path="*" element={<NotFound />} />
<Route path="/your-listens" element={<YourListens />} />
<Route path="/saved" element={<Saved />} />
<Route path="/stats" element={<Stats />} />
<Route path="/player" element={<Player />} />
            <Route path="suggest" element={<SuggestFeature />} />

        {/* ADMIN ROUTES */}
        <Route
          path="/admin/*"
          element={<AdminGate user={isAdmin ? user : null} />}
        >
          <Route element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="content" element={<AdminContentManager />} />
            <Route path="upload" element={<UploadAudio />} />
            <Route path="users" element={<Users />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="notifications" element={<AdminNotifications />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="logs" element={<Logs />} />
            <Route path="suggestions" element={<AdminSuggestions />} />
            <Route path="notices" element={<AdminNotices />} />
          </Route>
        </Route>
      </Routes>
      <MiniPlayer />

    </AppGuard>
  );
}

export default App;