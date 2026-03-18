import { useShutdown } from "../context/ShutdownContext";
import ShutdownPage from "../pages/ShutdownPage";
import { useLocation } from "react-router-dom";

export default function AppGuard({ user, children }) {

  const { shutdown } = useShutdown();
  const location = useLocation();

  const isAdminRoute = location.pathname.startsWith("/admin");

  if (shutdown && user?.role !== "admin" && !isAdminRoute) {
    return <ShutdownPage />;
  }

  return children;
}