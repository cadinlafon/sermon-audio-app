import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged } from "firebase/auth";

import AdminLayout from "./Admin/AdminLayout";
import Dashboard from "./Admin/Dashboard";
import UploadAudio from "./Admin/UploadAudio";
import Users from "./Admin/Users";
import Notifications from "./Admin/Notifications";
import Analytics from "./Admin/Analytics";

export default function Admin() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

const ADMIN_EMAILS = [
  "cadinlafon@gmail.com",
  "jonathanmacintosh78@gmail.com"
];
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return null; // Prevent flicker while checking auth
  }

  // 🔐 Block access if not admin
  if (!user || !ADMIN_EMAILS.includes(user.email)) {
  return <Navigate to="/" replace />;
}
  return (
    <Routes>
      <Route path="/" element={<AdminLayout />}>
        <Route index element={<Dashboard />} />
        <Route path="upload" element={<UploadAudio />} />
        <Route path="users" element={<Users />} />
        <Route path="notifications" element={<Notifications />} />
        <Route path="analytics" element={<Analytics />} />
      </Route>
    </Routes>
  );
}