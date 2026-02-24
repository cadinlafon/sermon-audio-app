import { Routes, Route } from "react-router-dom";
import AdminLayout from "./Admin/AdminLayout";
import Dashboard from "./Admin/Dashboard";
import UploadAudio from "./Admin/UploadAudio";
import Users from "./Admin/Users";
import Notifications from "./Admin/Notifications";
import Analytics from "./Admin/Analytics";

export default function Admin() {
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
