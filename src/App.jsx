import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

// Public Pages
import Home from "./pages/Home";
import Sermons from "./pages/Sermons";
import Homilys from "./pages/Homilys";
import SundaySchool from "./pages/SundaySchool";
import Feedback from "./pages/Feedback";
import Settings from "./pages/Settings";
import About from "./pages/About";
import SignUp from "./pages/SignUp";
import Notifications from "./pages/Notifications";

// Admin Pages
import AdminGate from "./pages/Admin/AdminGate";
import AdminLayout from "./pages/Admin/AdminLayout";
import Dashboard from "./pages/Admin/Dashboard";
import UploadAudio from "./pages/Admin/UploadAudio";
import Users from "./pages/Admin/Users";
import Analytics from "./pages/Admin/Analytics";

// Components
import Navbar from "./components/Navbar";

function App() {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

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

  if (loading) return null;

  return (
    <>
      <Navbar />

      <Routes>
        {/* PUBLIC ROUTES */}
        <Route path="/" element={<Home />} />
        <Route path="/sermons" element={<Sermons />} />
        <Route path="/homilys" element={<Homilys />} />
        <Route path="/sundayschool" element={<SundaySchool />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/notifications" element={<Notifications />} />

        {/* ADMIN ROUTES (PROTECTED) */}
        <Route
          path="/admin/*"
          element={<AdminGate user={isAdmin ? user : null} />}
        >
          <Route element={<AdminLayout />}>
            {/* Redirect /admin → /admin/dashboard */}
            <Route index element={<Navigate to="dashboard" />} />

            <Route path="dashboard" element={<Dashboard />} />
            <Route path="upload" element={<UploadAudio />} />
            <Route path="users" element={<Users />} />
            <Route path="analytics" element={<Analytics />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;