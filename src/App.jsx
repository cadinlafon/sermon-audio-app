import { Routes, Route } from "react-router-dom";

// Pages
import Home from "./pages/Home";
import Sermons from "./pages/Sermons";
import Homilys from "./pages/Homilys";
import SundaySchool from "./pages/SundaySchool";
import Feedback from "./pages/Feedback";
import Settings from "./pages/Settings";
import About from "./pages/About";
import Admin from "./pages/Admin";
import SignUp from "./pages/SignUp";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";
import AdminGate from "./pages/AdminGate";
import Notifications from "./pages/Notifications";
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
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists() && userDoc.data().role === "admin") {
          setIsAdmin(true);
        } else {
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
        <Route path="/" element={<Home />} />
        <Route path="/sermons" element={<Sermons />} />
        <Route path="/homilys" element={<Homilys />} />
        <Route path="/sundayschool" element={<SundaySchool />} />
        <Route path="/feedback" element={<Feedback />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/about" element={<About />} />
        <Route path="/signup" element={<SignUp />} />
<Route path="/notifications" element={<Notifications />} />
        {/* ✅ ADMIN ROUTE */}
        <Route
          path="/admin/*"
          element={<AdminGate user={isAdmin ? user : null} />}
        />
      </Routes>
    </>
  );
}
export default App;