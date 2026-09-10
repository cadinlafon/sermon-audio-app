import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePages } from "../context/PagesContext";
import { resolvePageAccess } from "../lib/pageManager";
import LockedScreen from "../pages/PageStates/LockedScreen";
import MaintenanceScreen from "../pages/PageStates/MaintenanceScreen";
import ComingSoonScreen from "../pages/PageStates/ComingSoonScreen";
import AccessDeniedScreen from "../pages/PageStates/AccessDeniedScreen";
import DisabledScreen from "../pages/PageStates/DisabledScreen";

////////////////////////////////////////////////////////////////
// PageGate — the single reusable mechanism that enforces Page
// Manager's status/access rules on an actual route, not just on
// whether a nav button is shown. Wrap any registered page's
// route element with <PageGate id="...">.
//
// Unregistered pages (no matching id in the registry) render
// their children unchanged — Page Manager never breaks a route
// it doesn't know about.
////////////////////////////////////////////////////////////////

export default function PageGate({ id, children }) {
  const { user, role, isAdmin, authLoading } = useAuth();
  const { getPage, loading: pagesLoading } = usePages();
  const location = useLocation();

  if (authLoading || pagesLoading) return null;

  const config = getPage(id);

  if (!config) return children;

  const { decision } = resolvePageAccess(config, { user, role, isAdmin });

  switch (decision) {
    case "login-required":
      return <Navigate to="/login" replace state={{ from: location.pathname }} />;
    case "access-denied":
      return <AccessDeniedScreen config={config} />;
    case "disabled":
      return <DisabledScreen config={config} />;
    case "locked":
      return <LockedScreen config={config} />;
    case "maintenance":
      return <MaintenanceScreen config={config} />;
    case "coming-soon":
      return <ComingSoonScreen config={config} />;
    default:
      return children;
  }
}
