import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";
import { ADMIN_MODULES, NO_ACCESS_MESSAGE } from "../config/adminModules";

/**
 * Global admin-permission view over the live AuthContext data. A full
 * (unrestricted) admin — permissions absent/null — can do everything; a
 * restricted admin can only do what their permissions object grants.
 */
export function usePermissions() {
  const { isAdmin, permissions, authLoading } = useAuth();

  const can = (key, action) => {
    if (!isAdmin) return false;
    if (!permissions) return true; // full admin
    return permissions[key]?.[action] === true;
  };

  const canView = (key) => can(key, "view");
  const canEdit = (key) => can(key, "edit");
  const canDelete = (key) => can(key, "delete");

  const visibleModules = useMemo(
    () => ADMIN_MODULES.filter((m) => canView(m.key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isAdmin, permissions]
  );

  return {
    loading: authLoading,
    isAdmin,
    isRestricted: isAdmin && !!permissions,
    permissions,
    can,
    canView,
    canEdit,
    canDelete,
    visibleModules,
  };
}

/**
 * Page-scoped permission check for one admin module. `requireEdit`/
 * `requireDelete` are the real enforcement point — call them as the first
 * line of a write handler (not just to decide whether to show a button),
 * since there's no server-side backstop in this app for these checks.
 */
export function useModulePermissions(moduleKey) {
  const { loading, canView, canEdit, canDelete } = usePermissions();

  const requireEdit = () => {
    if (canEdit(moduleKey)) return true;
    alert(NO_ACCESS_MESSAGE);
    return false;
  };

  const requireDelete = () => {
    if (canDelete(moduleKey)) return true;
    alert(NO_ACCESS_MESSAGE);
    return false;
  };

  return {
    loading,
    canView: canView(moduleKey),
    canEdit: canEdit(moduleKey),
    canDelete: canDelete(moduleKey),
    requireEdit,
    requireDelete,
  };
}
