import { Navigate, Outlet } from "react-router-dom";

export default function AdminGate({ user }) {
  if (!user) {
    return <Navigate to="/" />;
  }

  return <Outlet />;
}