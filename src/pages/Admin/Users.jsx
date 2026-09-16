import { useEffect, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import { ADMIN_MODULES, blankPermissions, NO_ACCESS_MESSAGE } from "../../config/adminModules";
import { useModulePermissions, usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../context/AuthContext";
import { useAdminPin } from "../../context/AdminPinContext";
import { disableUser, enableUser, resetNotificationSubscription, deleteUserData, exportUserData, downloadJson } from "../../utils/userAdmin";
import { logAdminAction } from "../../utils/adminAudit";
import UserStatsModal from "./UserStatsModal";

export default function Users() {
  const perms = useModulePermissions("users");
  // The acting admin's own grants — used to stop a restricted admin from
  // handing out more access than they themselves have, and to stop anyone
  // from changing their own role/permissions through this page.
  const actingPerms = usePermissions();
  const { user: currentUser } = useAuth();
  const pinCtx = useAdminPin();
  const requirePin = pinCtx?.requirePin || (async () => true);

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editData, setEditData] = useState({
    fullName: "",
    email: "",
  });

  // Filters
  const [adminFilter, setAdminFilter] = useState("all");
  const [registrationFilter, setRegistrationFilter] = useState("all");
  const [activityFilter, setActivityFilter] = useState("all");

  // Permissions popup — for promoting/adjusting a Restricted Admin.
  const [permTarget, setPermTarget] = useState(null);
  const [permForm, setPermForm] = useState(blankPermissions());
  const [savingPerms, setSavingPerms] = useState(false);

  // Stats popup — per-user activity charts and history.
  const [statsTarget, setStatsTarget] = useState(null);
  const [exportingId, setExportingId] = useState(null);

  const fetchUsers = async () => {
    const snapshot = await getDocs(collection(db, "users"));

    setUsers(
      snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      }))
    );
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  //////////////////////////////////////////////////
  // LOGIN METHOD
  //////////////////////////////////////////////////

  const getLoginMethod = (u) => {
    if (u.provider === "google" || u.provider === "google.com") {
      return "Google";
    }

    if (u.provider === "password") {
      return "Email";
    }

    if (u.loginMethod === "google") {
      return "Google";
    }

    if (u.loginMethod === "email") {
      return "Email";
    }

    return "Other";
  };

  //////////////////////////////////////////////////
  // HOW THEY FOUND THE APP
  //////////////////////////////////////////////////

  const getHowFound = (u) => {
    // New signup field
    if (u.howFound && u.howFound.trim()) {
      return u.howFound;
    }

    // If an older/newer version stores it under referral,
    // use that as a fallback.
    if (u.referral?.howFound && u.referral.howFound.trim()) {
      return u.referral.howFound;
    }

    // Existing users who don't have the field
    return "Other";
  };

  //////////////////////////////////////////////////
  // EDIT USER
  //////////////////////////////////////////////////

  const startEdit = (u) => {
    setEditingId(u.id);

    setEditData({
      fullName: u.fullName || u.name || "",
      email: u.email || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id) => {
    if (!perms.requireEdit()) return;

    await updateDoc(doc(db, "users", id), {
      fullName: editData.fullName,
      name: editData.fullName,
      email: editData.email,
    });

    setEditingId(null);
    fetchUsers();
  };

  //////////////////////////////////////////////////
  // ADMIN
  //////////////////////////////////////////////////

  // No one can change their own role/permissions from this page — full
  // admins included. Otherwise a restricted admin with users:edit could
  // just grant themselves more access directly.
  const guardNotSelf = (id) => {
    if (id === currentUser?.uid) {
      alert("You can't change your own admin status.");
      return false;
    }
    return true;
  };

  // Full, unrestricted admin — clears any prior restricted-admin
  // permissions object so nothing stale lingers. Only a full (unrestricted)
  // admin can hand out full access; a restricted admin granting someone
  // else unrestricted access would be escalating past their own limits.
  const makeAdmin = async (id) => {
    if (!perms.requireEdit()) return;
    if (!guardNotSelf(id)) return;
    if (actingPerms.isRestricted) {
      alert(NO_ACCESS_MESSAGE);
      return;
    }
    if (!(await requirePin("roleChange"))) return;

    const target = users.find((u) => u.id === id);

    await updateDoc(doc(db, "users", id), {
      role: "admin",
      permissions: deleteField(),
    });

    logAdminAction({
      category: "role_change",
      action: "makeAdmin",
      targetType: "user",
      targetId: id,
      targetLabel: target?.fullName || target?.email || id,
      before: { role: target?.role || "user", permissions: target?.permissions || null },
      after: { role: "admin", permissions: null },
    });

    fetchUsers();
  };

  const removeAdmin = async (id) => {
    if (!perms.requireEdit()) return;
    if (!guardNotSelf(id)) return;
    if (!(await requirePin("roleChange"))) return;

    const target = users.find((u) => u.id === id);

    await updateDoc(doc(db, "users", id), {
      role: "user",
      permissions: deleteField(),
    });

    logAdminAction({
      category: "role_change",
      action: "removeAdmin",
      targetType: "user",
      targetId: id,
      targetLabel: target?.fullName || target?.email || id,
      before: { role: target?.role || "user", permissions: target?.permissions || null },
      after: { role: "user", permissions: null },
    });

    fetchUsers();
  };

  //////////////////////////////////////////////////
  // RESTRICTED ADMIN PERMISSIONS
  //////////////////////////////////////////////////

  // A shallow merge so a module added to the config after this user's
  // permissions were last saved shows up unchecked instead of undefined.
  const mergePermissions = (stored) => {
    const base = blankPermissions();
    if (stored && typeof stored === "object") {
      for (const key of Object.keys(base)) {
        if (stored[key]) base[key] = { ...base[key], ...stored[key] };
      }
    }
    return base;
  };

  const openPermissions = (user, blank) => {
    if (!guardNotSelf(user.id)) return;
    setPermTarget(user);
    setPermForm(mergePermissions(blank ? null : user.permissions));
  };

  const closePermissions = () => {
    setPermTarget(null);
  };

  // A restricted admin can only hand out (or take away) capabilities they
  // themselves hold — otherwise they could use this popup to grant a
  // second account more access than they have, an indirect escalation. A
  // full admin has no such limit.
  const isLocked = (key, action) => actingPerms.isRestricted && !actingPerms.can(key, action);

  const togglePerm = (key, action) => {
    if (isLocked(key, action)) return;
    setPermForm((f) => {
      const next = { ...f[key], [action]: !f[key][action] };
      // An edit or delete right without view doesn't make sense.
      if ((action === "edit" || action === "delete") && next[action]) next.view = true;
      return { ...f, [key]: next };
    });
  };

  const setAllPerms = (value) => {
    setPermForm((prev) => {
      const next = {};
      for (const key of Object.keys(prev)) {
        next[key] = { ...prev[key] };
        for (const action of Object.keys(prev[key])) {
          if (!isLocked(key, action)) next[key][action] = value;
        }
      }
      return next;
    });
  };

  const savePermissions = async () => {
    if (!perms.requireEdit()) return;
    if (!permTarget) return;
    if (!guardNotSelf(permTarget.id)) return;
    if (!(await requirePin("roleChange"))) return;

    setSavingPerms(true);
    try {
      await updateDoc(doc(db, "users", permTarget.id), {
        role: "admin",
        permissions: permForm,
      });

      logAdminAction({
        category: "role_change",
        action: "savePermissions",
        targetType: "user",
        targetId: permTarget.id,
        targetLabel: permTarget.fullName || permTarget.email || permTarget.id,
        before: { role: permTarget.role || "user", permissions: permTarget.permissions || null },
        after: { role: "admin", permissions: permForm },
      });

      closePermissions();
      fetchUsers();
    } finally {
      setSavingPerms(false);
    }
  };

  //////////////////////////////////////////////////
  // DELETE — purges everything this app can attribute to the account,
  // then the profile doc itself. No Admin SDK wired up, so the actual
  // Firebase Auth login technically still exists underneath — same
  // client-enforced model as disable (see AuthContext).
  //////////////////////////////////////////////////

  const deleteUser = async (id) => {
    if (!perms.requireDelete()) return;
    if (!guardNotSelf(id)) return;
    if (!window.confirm("Delete this user? This removes their profile, liked sermons, notes, and listening progress. This can't be undone.")) return;
    if (!(await requirePin("deleteUser"))) return;

    const target = users.find((u) => u.id === id);

    await deleteUserData(id);

    logAdminAction({
      category: "account_delete",
      action: "deleteUser",
      targetType: "user",
      targetId: id,
      targetLabel: target?.fullName || target?.email || id,
      before: { fullName: target?.fullName || null, email: target?.email || null, role: target?.role || "user" },
      after: null,
    });

    fetchUsers();
  };

  //////////////////////////////////////////////////
  // ACCOUNT STATUS / NOTIFICATIONS / EXPORT
  //////////////////////////////////////////////////

  const handleDisable = async (id) => {
    if (!perms.requireEdit()) return;
    if (!guardNotSelf(id)) return;
    const reason = window.prompt("Reason (optional) — shown to the user when they're signed out:") || "";
    if (!(await requirePin("roleChange"))) return;

    const target = users.find((u) => u.id === id);

    await disableUser(id, reason);

    logAdminAction({
      category: "account_disable",
      action: "disableUser",
      targetType: "user",
      targetId: id,
      targetLabel: target?.fullName || target?.email || id,
      before: { disabled: false },
      after: { disabled: true, reason: reason || null },
    });

    fetchUsers();
  };

  const handleEnable = async (id) => {
    if (!perms.requireEdit()) return;
    if (!(await requirePin("roleChange"))) return;

    const target = users.find((u) => u.id === id);

    await enableUser(id);

    logAdminAction({
      category: "account_disable",
      action: "enableUser",
      targetType: "user",
      targetId: id,
      targetLabel: target?.fullName || target?.email || id,
      before: { disabled: true, reason: target?.disabledReason || null },
      after: { disabled: false },
    });

    fetchUsers();
  };

  const handleResetNotifications = async (id) => {
    if (!perms.requireEdit()) return;
    if (!window.confirm("Reset this user's notification subscription? They'll need to re-enable notifications in the app.")) return;
    await resetNotificationSubscription(id);
    fetchUsers();
  };

  const handleExport = async (user) => {
    if (!perms.requireEdit()) return;
    setExportingId(user.id);
    try {
      const data = await exportUserData(user.id);
      downloadJson(data, `user-${user.id}.json`);
    } catch (err) {
      console.error("Export failed", err);
      alert("Couldn't export this user's data. Please try again.");
    }
    setExportingId(null);
  };

  //////////////////////////////////////////////////
  // SEARCH / FILTERS
  //////////////////////////////////////////////////

  const DAY_MS = 24 * 60 * 60 * 1000;

  const filtered = users.filter((u) => {
    const name = (u.fullName || u.name || "").toLowerCase();
    const email = (u.email || "").toLowerCase();
    const howFound = getHowFound(u).toLowerCase();

    const searchText = search.toLowerCase();
    if (searchText && !name.includes(searchText) && !email.includes(searchText) && !howFound.includes(searchText)) {
      return false;
    }

    const isAdmin = u.role === "admin";
    const isRestricted = isAdmin && u.permissions && typeof u.permissions === "object";
    if (adminFilter === "admin" && !(isAdmin && !isRestricted)) return false;
    if (adminFilter === "restricted" && !isRestricted) return false;
    if (adminFilter === "user" && isAdmin) return false;

    if (registrationFilter !== "all") {
      const days = Number(registrationFilter);
      const createdMs = u.createdAt?.seconds ? u.createdAt.seconds * 1000 : null;
      if (!createdMs || Date.now() - createdMs > days * DAY_MS) return false;
    }

    if (activityFilter !== "all") {
      const lastActiveMs = u.lastActiveAt?.seconds ? u.lastActiveAt.seconds * 1000 : null;
      const active30 = lastActiveMs && Date.now() - lastActiveMs <= 30 * DAY_MS;
      if (activityFilter === "active" && !active30) return false;
      if (activityFilter === "inactive" && active30) return false;
    }

    return true;
  });

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Users</h1>

        <p style={pageSubtitle}>
          {users.length} registered user
          {users.length !== 1 ? "s" : ""}
        </p>
      </div>

      <div style={toolbar}>
        <input
          placeholder="Search by name, email, or referral…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={searchInput}
        />
        <select value={adminFilter} onChange={(e) => setAdminFilter(e.target.value)} style={filterSelect}>
          <option value="all">All Roles</option>
          <option value="admin">Full Admins</option>
          <option value="restricted">Restricted Admins</option>
          <option value="user">Users</option>
        </select>
        <select value={registrationFilter} onChange={(e) => setRegistrationFilter(e.target.value)} style={filterSelect}>
          <option value="all">Any Registration Date</option>
          <option value="7">Last 7 Days</option>
          <option value="30">Last 30 Days</option>
          <option value="90">Last 90 Days</option>
        </select>
        <select value={activityFilter} onChange={(e) => setActivityFilter(e.target.value)} style={filterSelect}>
          <option value="all">Any Activity</option>
          <option value="active">Active in Last 30 Days</option>
          <option value="inactive">Inactive 30+ Days</option>
        </select>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              {[
                "Name",
                "Email",
                "Login",
                "Found App Via",
                "Role",
                "Actions",
              ].map((h) => (
                <th key={h} style={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {filtered.map((user) => {
              const isEditing = editingId === user.id;
              const isAdmin = user.role === "admin";
              const isRestricted = isAdmin && user.permissions && typeof user.permissions === "object";
              const isSelf = user.id === currentUser?.uid;
              const howFound = getHowFound(user);

              return (
                <tr key={user.id} style={tr}>
                  {/* NAME */}
                  <td style={td}>
                    {isEditing ? (
                      <input
                        value={editData.fullName}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            fullName: e.target.value,
                          })
                        }
                        style={inlineInput}
                      />
                    ) : (
                      <span style={nameText}>
                        {user.fullName || user.name || "—"}
                      </span>
                    )}
                  </td>

                  {/* EMAIL */}
                  <td style={td}>
                    {isEditing ? (
                      <input
                        value={editData.email}
                        onChange={(e) =>
                          setEditData({
                            ...editData,
                            email: e.target.value,
                          })
                        }
                        style={inlineInput}
                      />
                    ) : (
                      <span style={emailText}>
                        {user.email || "—"}
                      </span>
                    )}
                  </td>

                  {/* LOGIN METHOD */}
                  <td style={td}>
                    <span style={methodBadge}>
                      {getLoginMethod(user)}
                    </span>
                  </td>

                  {/* HOW THEY FOUND APP */}
                  <td style={td}>
                    <span style={getReferralBadgeStyle(howFound)}>
                      {getReferralIcon(howFound)} {howFound}
                    </span>
                  </td>

                  {/* ROLE */}
                  <td style={td}>
                    <span
                      style={
                        isRestricted
                          ? restrictedBadge
                          : isAdmin
                          ? adminBadge
                          : userBadge
                      }
                    >
                      {isRestricted ? "Restricted" : isAdmin ? "Admin" : "User"}
                    </span>
                    {user.disabled && <span style={disabledBadge}>Disabled</span>}
                  </td>

                  {/* ACTIONS */}
                  <td style={td}>
                    <div style={actionRow}>
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => saveEdit(user.id)}
                          style={saveBtn}
                        >
                          Save
                        </button>

                        <button
                          onClick={cancelEdit}
                          style={cancelBtn}
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button style={statsBtn} onClick={() => setStatsTarget(user)}>
                          Stats
                        </button>

                        {(perms.canEdit || perms.canDelete) && (
                      <select
                        defaultValue=""
                        onChange={(e) => {
                          const a = e.target.value;

                          e.target.value = "";

                          if (a === "edit") {
                            startEdit(user);
                          }

                          if (a === "delete") {
                            deleteUser(user.id);
                          }

                          if (a === "makeAdmin") {
                            makeAdmin(user.id);
                          }

                          if (a === "removeAdmin") {
                            removeAdmin(user.id);
                          }

                          if (a === "makeRestricted") {
                            openPermissions(user, true);
                          }

                          if (a === "editPermissions") {
                            openPermissions(user, false);
                          }

                          if (a === "disable") {
                            handleDisable(user.id);
                          }

                          if (a === "enable") {
                            handleEnable(user.id);
                          }

                          if (a === "resetNotifications") {
                            handleResetNotifications(user.id);
                          }

                          if (a === "export") {
                            handleExport(user);
                          }
                        }}
                        style={actionSelect}
                      >
                        <option value="" disabled>
                          Actions
                        </option>

                        {perms.canEdit && (
                          <>
                            {/* No one can change their own admin status here —
                                see guardNotSelf; keeping these options off this
                                row's menu avoids the alert entirely. */}
                            {!isSelf && (
                              <>
                                {isRestricted ? (
                                  <>
                                    <option value="editPermissions">Edit Permissions</option>
                                    {!actingPerms.isRestricted && <option value="makeAdmin">Make Full Admin</option>}
                                    <option value="removeAdmin">Remove Admin</option>
                                  </>
                                ) : isAdmin ? (
                                  <>
                                    <option value="makeRestricted">Make Restricted Admin</option>
                                    <option value="removeAdmin">Remove Admin</option>
                                  </>
                                ) : (
                                  <>
                                    {!actingPerms.isRestricted && <option value="makeAdmin">Make Admin</option>}
                                    <option value="makeRestricted">Make Restricted Admin</option>
                                  </>
                                )}
                              </>
                            )}

                            <option value="edit">Edit</option>
                            <option value="export">Export User Data</option>
                            <option value="resetNotifications">Reset Notifications</option>
                            {!isSelf && (
                              user.disabled ? (
                                <option value="enable">Enable Account</option>
                              ) : (
                                <option value="disable">Disable Account</option>
                              )
                            )}
                          </>
                        )}

                        {perms.canDelete && (
                          <option value="delete">
                            Delete
                          </option>
                        )}
                          </select>
                        )}
                        {exportingId === user.id && <span style={exportingHint}>Exporting…</span>}
                      </>
                    )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <p style={empty}>No users found.</p>
        )}
      </div>

      {/* PERMISSIONS MODAL */}
      {permTarget && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>Admin Permissions</h2>
            <p style={pageSubtitle}>
              {permTarget.fullName || permTarget.name || permTarget.email || "This user"}
            </p>

            <div style={checkRow}>
              <button type="button" style={modalCancelBtn} onClick={() => setAllPerms(true)}>
                Select all
              </button>
              <button type="button" style={modalCancelBtn} onClick={() => setAllPerms(false)}>
                Clear all
              </button>
            </div>

            {actingPerms.isRestricted && (
              <p style={lockedHint}>
                Grayed-out boxes are capabilities you don't have yourself — you can only grant what you already have.
              </p>
            )}

            <div style={moduleList}>
              {ADMIN_MODULES.map((m) => (
                <div key={m.key} style={moduleRow}>
                  <span style={moduleLabel}>{m.icon} {m.label}</span>
                  <div style={checkRow}>
                    {m.actions.map((action) => {
                      const locked = isLocked(m.key, action);
                      return (
                        <label key={action} style={locked ? { ...checkLabel, ...checkLabelLocked } : checkLabel}>
                          <input
                            type="checkbox"
                            checked={permForm[m.key][action]}
                            onChange={() => togglePerm(m.key, action)}
                            disabled={locked}
                          />
                          {action === "view" ? "View" : action === "edit" ? "Edit" : "Delete"}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div style={modalActions}>
              <button style={modalSaveBtn} onClick={savePermissions} disabled={savingPerms}>
                {savingPerms ? "Saving…" : "Save"}
              </button>
              <button style={modalCancelBtn} onClick={closePermissions} disabled={savingPerms}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STATS MODAL */}
      {statsTarget && (
        <UserStatsModal user={statsTarget} onClose={() => setStatsTarget(null)} />
      )}
    </div>
  );
}

//////////////////////////////////////////////////
// REFERRAL BADGE
//////////////////////////////////////////////////

function getReferralIcon(source) {
  const value = source.toLowerCase();

  if (value.includes("facebook")) return "f";
  if (value.includes("instagram")) return "◎";
  if (value.includes("youtube")) return "▶";
  if (value.includes("google")) return "G";
  if (value.includes("chatgpt")) return "✦";
  if (value.includes("claude")) return "✦";
  if (value.includes("gemini")) return "✦";
  if (value.includes("qr")) return "▦";
  if (value.includes("email")) return "✉";
  if (value.includes("text") || value.includes("sms")) return "💬";

  return "•";
}

function getReferralBadgeStyle(source) {
  const value = source.toLowerCase();

  let background = "#f3eadc";
  let color = "#7a5530";

  if (value.includes("facebook")) {
    background = "#e8f0fe";
    color = "#2a5ab5";
  } else if (value.includes("instagram")) {
    background = "#fce7f3";
    color = "#a33b70";
  } else if (value.includes("youtube")) {
    background = "#fee2e2";
    color = "#b42318";
  } else if (value.includes("google")) {
    background = "#e8f5e9";
    color = "#28743c";
  } else if (
    value.includes("chatgpt") ||
    value.includes("claude") ||
    value.includes("gemini")
  ) {
    background = "#eee8ff";
    color = "#6547a5";
  } else if (value.includes("qr")) {
    background = "#f4e7d4";
    color = "#8a5a16";
  } else if (value.includes("email")) {
    background = "#e8f0fe";
    color = "#345b91";
  }

  return {
    fontSize: "11px",
    padding: "4px 9px",
    borderRadius: "999px",
    background,
    color,
    fontFamily: "sans-serif",
    whiteSpace: "nowrap",
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
  };
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = {
  maxWidth: "1200px",
};

const pageHeader = {
  marginBottom: "24px",
};

const pageTitle = {
  fontSize: "26px",
  fontWeight: "normal",
  color: "#3d2200",
  margin: "0 0 4px",
  fontFamily: "'Georgia', serif",
};

const pageSubtitle = {
  fontSize: "14px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  margin: 0,
};

const toolbar = {
  marginBottom: "16px",
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const searchInput = {
  padding: "9px 14px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  outline: "none",
  width: "280px",
  flexShrink: 0,
};

const filterSelect = {
  padding: "9px 12px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  cursor: "pointer",
};

const tableWrap = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  overflow: "auto",
  boxShadow: "0 2px 12px rgba(160,100,40,0.07)",
};

const table = {
  width: "100%",
  borderCollapse: "collapse",
  minWidth: "900px",
};

const th = {
  padding: "12px 16px",
  textAlign: "left",
  fontSize: "11px",
  fontFamily: "sans-serif",
  color: "#9b7040",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  borderBottom: "1px solid #eddfc8",
  background: "#fdf8f3",
};

const tr = {
  borderBottom: "1px solid #f0e4d0",
};

const td = {
  padding: "12px 16px",
  verticalAlign: "middle",
};

const nameText = {
  fontSize: "14px",
  fontFamily: "'Georgia', serif",
  color: "#3d2200",
};

const emailText = {
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#7a5530",
};

const methodBadge = {
  fontSize: "11px",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "#e8f0fe",
  color: "#2a5ab5",
  fontFamily: "sans-serif",
};

const adminBadge = {
  fontSize: "11px",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "#dcfce7",
  color: "#166534",
  fontFamily: "sans-serif",
};

const userBadge = {
  fontSize: "11px",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "#f6e4b0",
  color: "#7a5a10",
  fontFamily: "sans-serif",
};

const actionRow = {
  display: "flex",
  gap: "6px",
};

const saveBtn = {
  padding: "5px 10px",
  borderRadius: "6px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff8ee",
  fontSize: "12px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};

const cancelBtn = {
  padding: "5px 10px",
  borderRadius: "6px",
  border: "1px solid #eddfc8",
  background: "transparent",
  color: "#7a4f10",
  fontSize: "12px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};

const actionSelect = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "#3d2200",
  cursor: "pointer",
};

const statsBtn = {
  padding: "6px 10px",
  borderRadius: "8px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  color: "#5c3a1e",
  fontSize: "12px",
  fontFamily: "sans-serif",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const inlineInput = {
  padding: "5px 8px",
  borderRadius: "6px",
  border: "1px solid #eddfc8",
  fontSize: "13px",
  fontFamily: "sans-serif",
  background: "#fdf8f3",
  width: "100%",
};

const empty = {
  textAlign: "center",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontStyle: "italic",
  padding: "30px",
};

const restrictedBadge = {
  fontSize: "11px",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "#fde8d8",
  color: "#a3551f",
  fontFamily: "sans-serif",
};

const disabledBadge = {
  display: "inline-block",
  fontSize: "11px",
  padding: "3px 8px",
  borderRadius: "999px",
  background: "#fee2e2",
  color: "#991b1b",
  fontFamily: "sans-serif",
  marginLeft: "6px",
};

const exportingHint = {
  fontSize: "11px",
  color: "#9b7040",
  fontFamily: "sans-serif",
  fontStyle: "italic",
};

const modalBg = {
  position: "fixed",
  inset: 0,
  background: "rgba(40,18,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 2000,
  padding: "20px",
};

const modal = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "20px",
  padding: "28px",
  width: "100%",
  maxWidth: "480px",
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  maxHeight: "90vh",
  overflowY: "auto",
};

const modalTitle = {
  fontSize: "20px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  margin: 0,
};

const checkRow = {
  display: "flex",
  gap: "16px",
  flexWrap: "wrap",
};

const checkLabel = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  fontSize: "13px",
  fontFamily: "sans-serif",
  color: "#5c3a1e",
  cursor: "pointer",
};

const checkLabelLocked = {
  color: "#b0a494",
  cursor: "not-allowed",
};

const lockedHint = {
  fontSize: "12px",
  fontFamily: "sans-serif",
  color: "#9b7040",
  fontStyle: "italic",
  margin: 0,
};

const moduleList = {
  display: "flex",
  flexDirection: "column",
  gap: "10px",
};

const moduleRow = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  padding: "10px 12px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "#fdf8f3",
};

const moduleLabel = {
  fontSize: "13px",
  fontFamily: "sans-serif",
  fontWeight: "600",
  color: "#3d2200",
};

const modalActions = {
  display: "flex",
  gap: "10px",
  marginTop: "4px",
};

const modalSaveBtn = {
  flex: 1,
  padding: "11px",
  borderRadius: "10px",
  border: "none",
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff8ee",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};

const modalCancelBtn = {
  flex: 1,
  padding: "11px",
  borderRadius: "10px",
  border: "1px solid #eddfc8",
  background: "transparent",
  color: "#7a4f10",
  fontSize: "14px",
  fontFamily: "sans-serif",
  cursor: "pointer",
};