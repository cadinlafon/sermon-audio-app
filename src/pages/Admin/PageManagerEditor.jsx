import { useEffect, useMemo, useState } from "react";
import {
  PAGE_STATUSES,
  STATUS_META,
  ACCESS_LEVELS,
  BADGE_COLORS,
  ICON_CHOICES,
  SCHEDULE_TYPES,
  sanitizeIcon,
  toDate,
} from "../../lib/pageManager";
import {
  savePageConfig,
  resetPageToDefaults,
  fetchPageHistory,
} from "../../lib/pageManagerFirestore";
import { Timestamp } from "firebase/firestore";
import LockedScreen from "../PageStates/LockedScreen";
import MaintenanceScreen from "../PageStates/MaintenanceScreen";
import ComingSoonScreen from "../PageStates/ComingSoonScreen";

const TABS = [
  { id: "general", label: "General" },
  { id: "navigation", label: "Navigation" },
  { id: "access", label: "Access" },
  { id: "status", label: "Status" },
  { id: "maintenance", label: "Maintenance" },
  { id: "comingsoon", label: "Coming Soon" },
  { id: "scheduling", label: "Scheduling" },
  { id: "history", label: "History" },
];

function toDatetimeLocal(value) {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDateInput(value) {
  const d = toDate(value);
  if (!d) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function PageManagerEditor({ page, allUsers, actor, onClose, onSaved }) {
  const [form, setForm] = useState(page);
  const [tab, setTab] = useState("general");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [historyEntries, setHistoryEntries] = useState(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allowSearch, setAllowSearch] = useState("");
  const [denySearch, setDenySearch] = useState("");
  const [scheduleDraft, setScheduleDraft] = useState({ type: "status", value: "active", runAt: "" });

  useEffect(() => {
    setForm(page);
  }, [page]);

  const set = (field) => (e) => {
    const value = e?.target
      ? e.target.type === "checkbox"
        ? e.target.checked
        : e.target.value
      : e;
    setForm((f) => ({ ...f, [field]: value }));
  };

  //////////////////////////////////////////////////
  // SAVE
  //////////////////////////////////////////////////
  const handleSave = async () => {
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const updates = { ...form };
      if (updates.accessLevel === "role" && !updates.requiredRole) {
        updates.requiredRole = "admin";
      }
      delete updates.route;
      delete updates.defaultName;
      delete updates.defaultIcon;
      delete updates.navSlot;

      await savePageConfig(page.id, page, updates, actor);
      setSuccess("Saved successfully.");
      onSaved?.();
    } catch (err) {
      console.error("Page Manager save failed:", err);
      setError("Something went wrong saving this page. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  //////////////////////////////////////////////////
  // RESET
  //////////////////////////////////////////////////
  const handleReset = async () => {
    setSaving(true);
    setError("");

    try {
      await resetPageToDefaults(page.id, page, actor);
      setSuccess("Page reset to defaults.");
      setShowResetConfirm(false);
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Page Manager reset failed:", err);
      setError("Couldn't reset this page. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  //////////////////////////////////////////////////
  // HISTORY
  //////////////////////////////////////////////////
  useEffect(() => {
    if (tab !== "history" || historyEntries !== null) return;

    setHistoryLoading(true);
    fetchPageHistory(page.id)
      .then(setHistoryEntries)
      .catch(() => setHistoryEntries([]))
      .finally(() => setHistoryLoading(false));
  }, [tab, page.id, historyEntries]);

  //////////////////////////////////////////////////
  // USER OVERRIDES
  //////////////////////////////////////////////////
  const filteredUsers = (searchText) => {
    if (!searchText.trim() || !allUsers) return [];
    const q = searchText.toLowerCase();
    return allUsers
      .filter((u) => u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q))
      .slice(0, 6);
  };

  const addOverride = (list, u) => {
    setForm((f) => {
      const overrides = f.userOverrides || { allow: [], deny: [] };
      const entry = { uid: u.uid, email: u.email || u.name || u.uid };

      return {
        ...f,
        userOverrides: {
          allow: list === "allow"
            ? [...overrides.allow.filter((x) => x.uid !== u.uid), entry]
            : overrides.allow.filter((x) => x.uid !== u.uid),
          deny: list === "deny"
            ? [...overrides.deny.filter((x) => x.uid !== u.uid), entry]
            : overrides.deny.filter((x) => x.uid !== u.uid),
        },
      };
    });
    if (list === "allow") setAllowSearch("");
    else setDenySearch("");
  };

  const removeOverride = (list, uid) => {
    setForm((f) => ({
      ...f,
      userOverrides: {
        ...f.userOverrides,
        [list]: f.userOverrides[list].filter((x) => x.uid !== uid),
      },
    }));
  };

  //////////////////////////////////////////////////
  // SCHEDULING
  //////////////////////////////////////////////////
  const scheduleTypeMeta = SCHEDULE_TYPES.find((t) => t.value === scheduleDraft.type);

  const addSchedule = () => {
    if (!scheduleDraft.runAt) {
      setError("Pick a date/time for the schedule first.");
      return;
    }
    setError("");

    const entry = {
      id: crypto.randomUUID(),
      type: scheduleDraft.type,
      value: scheduleTypeMeta?.needsValue ? scheduleDraft.value : null,
      runAt: Timestamp.fromDate(new Date(scheduleDraft.runAt)),
      createdAt: Timestamp.now(),
      createdBy: actor?.email || actor?.uid || "unknown",
    };

    setForm((f) => ({ ...f, schedules: [...(f.schedules || []), entry] }));
    setScheduleDraft({ type: "status", value: "active", runAt: "" });
  };

  const removeSchedule = (id) => {
    setForm((f) => ({ ...f, schedules: (f.schedules || []).filter((s) => s.id !== id) }));
  };

  const sortedSchedules = useMemo(() => {
    return [...(form.schedules || [])].sort((a, b) => (toDate(a.runAt) || 0) - (toDate(b.runAt) || 0));
  }, [form.schedules]);

  //////////////////////////////////////////////////
  // UI
  //////////////////////////////////////////////////

  return (
    <div style={modalBg} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={modalHeader}>
          <div>
            <h2 style={modalTitle}>{form.defaultName}</h2>
            <p style={modalSubtitle}>{form.route}</p>
          </div>
          <div style={headerActions}>
            <button style={ghostBtn} onClick={() => setShowPreview(true)}>👁 Preview</button>
            <button style={closeX} onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={tabRow}>
          {TABS.map((t) => (
            <button
              key={t.id}
              style={tab === t.id ? { ...tabBtn, ...tabBtnActive } : tabBtn}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div style={tabBody}>
          {tab === "general" && (
            <GeneralTab form={form} set={set} />
          )}

          {tab === "navigation" && (
            <NavigationTab form={form} set={set} setForm={setForm} />
          )}

          {tab === "access" && (
            <AccessTab
              form={form}
              set={set}
              allowSearch={allowSearch}
              setAllowSearch={setAllowSearch}
              denySearch={denySearch}
              setDenySearch={setDenySearch}
              filteredUsers={filteredUsers}
              addOverride={addOverride}
              removeOverride={removeOverride}
            />
          )}

          {tab === "status" && (
            <StatusTab form={form} set={set} setForm={setForm} />
          )}

          {tab === "maintenance" && (
            <MaintenanceTab form={form} set={set} />
          )}

          {tab === "comingsoon" && (
            <ComingSoonTab form={form} set={set} />
          )}

          {tab === "scheduling" && (
            <SchedulingTab
              scheduleDraft={scheduleDraft}
              setScheduleDraft={setScheduleDraft}
              scheduleTypeMeta={scheduleTypeMeta}
              addSchedule={addSchedule}
              removeSchedule={removeSchedule}
              sortedSchedules={sortedSchedules}
            />
          )}

          {tab === "history" && (
            <HistoryTab historyLoading={historyLoading} historyEntries={historyEntries} />
          )}
        </div>

        {error && <p style={errorText}>{error}</p>}
        {success && <p style={successText}>{success}</p>}

        <div style={modalFooter}>
          <button style={dangerGhostBtn} onClick={() => setShowResetConfirm(true)}>
            Reset to Defaults
          </button>

          <div style={footerRight}>
            <button style={cancelBtn} onClick={onClose}>Cancel</button>
            <button style={saveBtn} onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </div>
      </div>

      {showResetConfirm && (
        <div style={confirmOverlay} onClick={(e) => e.stopPropagation()}>
          <div style={confirmBox}>
            <h3 style={confirmTitle}>Reset "{form.defaultName}" to defaults?</h3>
            <p style={confirmText}>
              This clears every Page Manager customization for this page (name,
              icon, badge, status, access rules, and ordering). The page itself
              will not be deleted.
            </p>
            <div style={confirmActions}>
              <button style={cancelBtn} onClick={() => setShowResetConfirm(false)}>Cancel</button>
              <button style={dangerBtn} onClick={handleReset} disabled={saving}>
                {saving ? "Resetting…" : "Reset Page"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showPreview && (
        <div style={confirmOverlay} onClick={() => setShowPreview(false)}>
          <div style={previewBox} onClick={(e) => e.stopPropagation()}>
            <div style={previewHeader}>
              <p style={previewLabel}>Preview — how this page appears to a visitor</p>
              <button style={closeX} onClick={() => setShowPreview(false)}>✕</button>
            </div>

            <div style={previewNavMock}>
              <span style={previewNavIcon}>
                {form.icon?.startsWith("/") ? <img src={form.icon} alt="" style={{ width: 20, height: 20 }} /> : form.icon}
              </span>
              <span style={previewNavName}>{form.navLabel?.trim() || form.name}</span>
              {form.badgeEnabled && form.badgeText && (
                <span style={{
                  fontSize: "10px", fontWeight: 700, padding: "2px 7px", borderRadius: "999px",
                  background: (BADGE_COLORS[form.badgeColor] || BADGE_COLORS.amber).bg,
                  color: (BADGE_COLORS[form.badgeColor] || BADGE_COLORS.amber).color,
                  fontFamily: "sans-serif",
                }}>
                  {form.badgeText}
                </span>
              )}
              {form.status === "locked" && <span>🔒</span>}
            </div>

            <div style={previewFrame}>
              {form.status === "locked" && <LockedScreen config={form} />}
              {form.status === "maintenance" && <MaintenanceScreen config={form} />}
              {form.status === "coming-soon" && <ComingSoonScreen config={form} />}
              {!["locked", "maintenance", "coming-soon"].includes(form.status) && (
                <div style={previewNormal}>
                  <p>This page will render normally{form.status === "beta" ? " with a Beta badge in navigation." : "."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

////////////////////////////////////////////////////////////////
// TABS
////////////////////////////////////////////////////////////////

function GeneralTab({ form, set }) {
  return (
    <div style={sectionStack}>
      <Field label="Page Name">
        <input value={form.name || ""} onChange={set("name")} style={input} />
      </Field>

      <Field label="Description" hint="Used in Page Manager, tooltips, and Coming Soon / Maintenance screens.">
        <textarea value={form.description || ""} onChange={set("description")} style={{ ...input, height: "80px", resize: "vertical" }} />
      </Field>

      <Field label="Route">
        <input value={form.route} disabled style={{ ...input, opacity: 0.6, cursor: "not-allowed" }} />
      </Field>
    </div>
  );
}

function NavigationTab({ form, set, setForm }) {
  return (
    <div style={sectionStack}>
      <ToggleRow
        label="Show in Navigation"
        checked={!!form.showInNavigation}
        onChange={(v) => setForm((f) => ({ ...f, showInNavigation: v }))}
      />

      <Field label="Navigation Name" hint="Leave blank to use the page name.">
        <input value={form.navLabel || ""} onChange={set("navLabel")} style={input} placeholder={form.name} />
      </Field>

      <Field label="Icon">
        <div style={iconGrid}>
          {ICON_CHOICES.map((emoji) => (
            <button
              key={emoji}
              style={form.icon === emoji ? { ...iconChoice, ...iconChoiceActive } : iconChoice}
              onClick={() => setForm((f) => ({ ...f, icon: emoji }))}
              type="button"
            >
              {emoji}
            </button>
          ))}
        </div>
        <input
          value={form.icon?.startsWith("/") ? "" : form.icon || ""}
          onChange={(e) => setForm((f) => ({ ...f, icon: sanitizeIcon(e.target.value) }))}
          style={{ ...input, marginTop: "8px" }}
          placeholder="Or type a custom emoji"
        />
      </Field>

      <ToggleRow
        label="Pin to Top"
        checked={!!form.pinned}
        onChange={(v) => setForm((f) => ({ ...f, pinned: v }))}
      />

      <Field label="Order" hint="Lower numbers appear first. Precise drag-and-drop reordering is available from the Page Manager table.">
        <input
          type="number"
          value={form.order ?? 0}
          onChange={(e) => setForm((f) => ({ ...f, order: Number(e.target.value) || 0 }))}
          style={input}
        />
      </Field>

      <div style={divider} />

      <ToggleRow
        label="Show Badge"
        checked={!!form.badgeEnabled}
        onChange={(v) => setForm((f) => ({ ...f, badgeEnabled: v }))}
      />

      {form.badgeEnabled && (
        <>
          <Field label="Badge Text">
            <input value={form.badgeText || ""} onChange={set("badgeText")} style={input} placeholder="NEW" maxLength={12} />
          </Field>

          <Field label="Badge Type">
            <select value={form.badgeType || "text"} onChange={set("badgeType")} style={input}>
              <option value="text">Text</option>
              <option value="number">Number</option>
              <option value="status">Status</option>
              <option value="custom">Custom</option>
            </select>
          </Field>

          <Field label="Badge Color">
            <div style={colorRow}>
              {Object.entries(BADGE_COLORS).map(([key, c]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, badgeColor: key }))}
                  style={{
                    ...colorSwatch,
                    background: c.bg,
                    color: c.color,
                    border: form.badgeColor === key ? "2px solid #a85e18" : "1px solid #eddfc8",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </Field>
        </>
      )}
    </div>
  );
}

function AccessTab({ form, set, allowSearch, setAllowSearch, denySearch, setDenySearch, filteredUsers, addOverride, removeOverride }) {
  return (
    <div style={sectionStack}>
      <Field label="Access Level">
        <select value={form.accessLevel || "public"} onChange={set("accessLevel")} style={input}>
          {ACCESS_LEVELS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
      </Field>

      {form.accessLevel === "role" && (
        <Field label="Required Role" hint={`e.g. "admin". Matches the role field on the user's account.`}>
          <input value={form.requiredRole || ""} onChange={set("requiredRole")} style={input} placeholder="admin" />
        </Field>
      )}

      <ToggleRow
        label="Require Login"
        checked={!!form.requireLogin}
        onChange={(v) => set("requireLogin")(v)}
      />

      <div style={divider} />

      <p style={subLabel}>Individual User Access</p>
      <p style={hintText}>
        Exceptions override the access level above. A user in Denied is always
        blocked; a user in Allowed can access this page even if they don't meet
        the access level.
      </p>

      <div style={overrideCols}>
        <div>
          <p style={overrideColTitle}>✅ Allowed</p>
          <input
            value={allowSearch}
            onChange={(e) => setAllowSearch(e.target.value)}
            placeholder="Search by name or email…"
            style={input}
          />
          {filteredUsers(allowSearch).length > 0 && (
            <div style={suggestBox}>
              {filteredUsers(allowSearch).map((u) => (
                <button key={u.uid} style={suggestItem} onClick={() => addOverride("allow", u)}>
                  {u.name || u.email} {u.email && u.name ? `(${u.email})` : ""}
                </button>
              ))}
            </div>
          )}
          <div style={chipRow}>
            {(form.userOverrides?.allow || []).map((u) => (
              <span key={u.uid} style={chip}>
                {u.email}
                <button style={chipX} onClick={() => removeOverride("allow", u.uid)}>✕</button>
              </span>
            ))}
          </div>
        </div>

        <div>
          <p style={overrideColTitle}>🚫 Denied</p>
          <input
            value={denySearch}
            onChange={(e) => setDenySearch(e.target.value)}
            placeholder="Search by name or email…"
            style={input}
          />
          {filteredUsers(denySearch).length > 0 && (
            <div style={suggestBox}>
              {filteredUsers(denySearch).map((u) => (
                <button key={u.uid} style={suggestItem} onClick={() => addOverride("deny", u)}>
                  {u.name || u.email} {u.email && u.name ? `(${u.email})` : ""}
                </button>
              ))}
            </div>
          )}
          <div style={chipRow}>
            {(form.userOverrides?.deny || []).map((u) => (
              <span key={u.uid} style={{ ...chip, background: "#fee2e2", color: "#991b1b" }}>
                {u.email}
                <button style={chipX} onClick={() => removeOverride("deny", u.uid)}>✕</button>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusTab({ form, setForm }) {
  return (
    <div style={sectionStack}>
      <ToggleRow
        label="Page Enabled"
        checked={form.enabled !== false}
        onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
      />
      <p style={hintText}>Disabling a page keeps its configuration but blocks access entirely and hides it from navigation.</p>

      <div style={divider} />

      <p style={subLabel}>Status</p>
      <div style={statusGrid}>
        {PAGE_STATUSES.map((status) => {
          const meta = STATUS_META[status];
          const active = form.status === status;
          return (
            <button
              key={status}
              type="button"
              onClick={() => {
                setForm((f) => {
                  const next = { ...f, status };
                  if (status === "beta" && !f.badgeEnabled) {
                    next.badgeEnabled = true;
                    next.badgeText = "BETA";
                    next.badgeColor = "purple";
                  }
                  return next;
                });
              }}
              style={{
                ...statusChoice,
                background: active ? meta.bg : "#fdf8f3",
                color: active ? meta.color : "#5c3a1e",
                border: active ? `2px solid ${meta.color}` : "1px solid #eddfc8",
              }}
            >
              <span>{meta.icon}</span> {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MaintenanceTab({ form, set }) {
  return (
    <div style={sectionStack}>
      <Field label="Maintenance Title">
        <input value={form.maintenanceTitle || ""} onChange={set("maintenanceTitle")} style={input} placeholder={`${form.name} is under maintenance`} />
      </Field>
      <Field label="Message">
        <textarea value={form.maintenanceMessage || ""} onChange={set("maintenanceMessage")} style={{ ...input, height: "80px", resize: "vertical" }} placeholder="We're making improvements. Please check back soon." />
      </Field>
      <Field label="Estimated Return" hint="Optional.">
        <input
          type="datetime-local"
          value={toDatetimeLocal(form.maintenanceUntil)}
          onChange={(e) => set("maintenanceUntil")(e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : null)}
          style={input}
        />
      </Field>
    </div>
  );
}

function ComingSoonTab({ form, set }) {
  return (
    <div style={sectionStack}>
      <Field label="Coming Soon Title">
        <input value={form.comingSoonTitle || ""} onChange={set("comingSoonTitle")} style={input} placeholder={`${form.name} is coming soon`} />
      </Field>
      <Field label="Message">
        <textarea value={form.comingSoonMessage || ""} onChange={set("comingSoonMessage")} style={{ ...input, height: "80px", resize: "vertical" }} placeholder={`${form.name} isn't available quite yet.`} />
      </Field>
      <Field label="Planned Release Date" hint="Optional.">
        <input
          type="date"
          value={toDateInput(form.releaseDate)}
          onChange={(e) => set("releaseDate")(e.target.value ? Timestamp.fromDate(new Date(e.target.value)) : null)}
          style={input}
        />
      </Field>
      <Field label="Badge" hint="Optional small tag shown on the Coming Soon screen.">
        <input value={form.comingSoonBadge || ""} onChange={set("comingSoonBadge")} style={input} placeholder="SOON" maxLength={16} />
      </Field>
    </div>
  );
}

function SchedulingTab({ scheduleDraft, setScheduleDraft, scheduleTypeMeta, addSchedule, removeSchedule, sortedSchedules }) {
  const now = new Date();

  return (
    <div style={sectionStack}>
      <p style={subLabel}>Add a Scheduled Change</p>

      <div style={scheduleForm}>
        <select
          value={scheduleDraft.type}
          onChange={(e) => {
            const nextType = e.target.value;
            const nextMeta = SCHEDULE_TYPES.find((t) => t.value === nextType);
            setScheduleDraft((s) => ({
              ...s,
              type: nextType,
              value: nextMeta?.needsValue === "status" ? "active" : nextMeta?.needsValue === "text" ? "" : null,
            }));
          }}
          style={input}
        >
          {SCHEDULE_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        {scheduleTypeMeta?.needsValue === "status" && (
          <select
            value={scheduleDraft.value}
            onChange={(e) => setScheduleDraft((s) => ({ ...s, value: e.target.value }))}
            style={input}
          >
            {PAGE_STATUSES.map((st) => (
              <option key={st} value={st}>{STATUS_META[st].label}</option>
            ))}
          </select>
        )}

        {scheduleTypeMeta?.needsValue === "text" && (
          <input
            value={scheduleDraft.value}
            onChange={(e) => setScheduleDraft((s) => ({ ...s, value: e.target.value }))}
            style={input}
            placeholder="Badge text, e.g. NEW"
          />
        )}

        <input
          type="datetime-local"
          value={scheduleDraft.runAt}
          onChange={(e) => setScheduleDraft((s) => ({ ...s, runAt: e.target.value }))}
          style={input}
        />

        <button type="button" style={saveBtn} onClick={addSchedule}>+ Add Schedule</button>
      </div>

      <div style={divider} />

      <p style={subLabel}>Scheduled Changes</p>
      {sortedSchedules.length === 0 && <p style={hintText}>No scheduled changes for this page.</p>}

      {sortedSchedules.map((s) => {
        const runAtDate = toDate(s.runAt);
        const applied = runAtDate && runAtDate <= now;
        const typeMeta = SCHEDULE_TYPES.find((t) => t.value === s.type);

        return (
          <div key={s.id} style={scheduleRow}>
            <div>
              <p style={scheduleRowTitle}>
                {typeMeta?.label || s.type} {s.value ? `→ ${s.value}` : ""}
              </p>
              <p style={scheduleRowDate}>
                {runAtDate ? runAtDate.toLocaleString() : "—"}{" "}
                <span style={applied ? appliedTag : pendingTag}>{applied ? "Applied" : "Pending"}</span>
              </p>
            </div>
            <button style={actionBtn} onClick={() => removeSchedule(s.id)}>Delete</button>
          </div>
        );
      })}
    </div>
  );
}

function HistoryTab({ historyLoading, historyEntries }) {
  if (historyLoading) return <p style={hintText}>Loading history…</p>;
  if (!historyEntries || historyEntries.length === 0) {
    return <p style={hintText}>No changes recorded yet.</p>;
  }

  return (
    <div style={sectionStack}>
      {historyEntries.map((entry) => (
        <div key={entry.id} style={historyEntry}>
          <p style={historyMeta}>
            <strong>{entry.changedBy}</strong>{" "}
            {entry.at?.toDate ? entry.at.toDate().toLocaleString() : ""}
          </p>
          {entry.note && <p style={historyNote}>{entry.note}</p>}
          {(entry.changes || []).map((c, i) => (
            <p key={i} style={historyChange}>
              <strong>{c.field}</strong>: {String(c.from)} → {String(c.to)}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

////////////////////////////////////////////////////////////////
// SHARED FORM PIECES
////////////////////////////////////////////////////////////////

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={fieldLabel}>{label}</label>
      {children}
      {hint && <p style={hintText}>{hint}</p>}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }) {
  return (
    <label style={toggleRow}>
      <span>{label}</span>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

////////////////////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////////////////////

const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "16px" };
const modal = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "640px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "92vh" };
const modalHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" };
const modalTitle = { fontSize: "20px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0 };
const modalSubtitle = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", margin: "2px 0 0" };
const headerActions = { display: "flex", gap: "8px", alignItems: "center" };
const ghostBtn = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const closeX = { border: "none", background: "transparent", color: "#9b7040", fontSize: "16px", cursor: "pointer" };

const tabRow = { display: "flex", gap: "6px", flexWrap: "wrap", borderBottom: "1px solid #eddfc8", paddingBottom: "10px" };
const tabBtn = { padding: "6px 12px", borderRadius: "999px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const tabBtnActive = { background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", border: "none" };

const tabBody = { overflowY: "auto", paddingRight: "4px", flex: 1 };
const sectionStack = { display: "flex", flexDirection: "column", gap: "14px" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const hintText = { fontSize: "11px", color: "#b08050", fontFamily: "sans-serif", margin: 0, lineHeight: 1.5 };
const subLabel = { fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", fontWeight: "600", margin: 0 };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const divider = { height: "1px", background: "#eddfc8" };

const toggleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e" };

const iconGrid = { display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: "6px" };
const iconChoice = { fontSize: "16px", padding: "6px 0", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", cursor: "pointer" };
const iconChoiceActive = { border: "2px solid #a85e18", background: "#fdf1de" };

const colorRow = { display: "flex", gap: "8px", flexWrap: "wrap" };
const colorSwatch = { padding: "6px 12px", borderRadius: "8px", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };

const overrideCols = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" };
const overrideColTitle = { fontSize: "12px", fontFamily: "sans-serif", color: "#5c3a1e", fontWeight: "600", margin: "0 0 6px" };
const suggestBox = { border: "1px solid #eddfc8", borderRadius: "10px", marginTop: "4px", overflow: "hidden", background: "#fffdf9" };
const suggestItem = { display: "block", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", fontSize: "12px", fontFamily: "sans-serif", color: "#5c3a1e", cursor: "pointer" };
const chipRow = { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "8px" };
const chip = { display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11px", padding: "4px 8px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontFamily: "sans-serif" };
const chipX = { border: "none", background: "transparent", cursor: "pointer", fontSize: "10px", color: "inherit" };

const statusGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "8px" };
const statusChoice = { padding: "10px 12px", borderRadius: "10px", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" };

const scheduleForm = { display: "grid", gridTemplateColumns: "1.2fr 1fr 1fr auto", gap: "8px", alignItems: "center" };
const scheduleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", border: "1px solid #eddfc8", borderRadius: "10px", background: "#fffdf9" };
const scheduleRowTitle = { fontSize: "13px", color: "#3d2200", fontFamily: "sans-serif", margin: "0 0 2px" };
const scheduleRowDate = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif", margin: 0, display: "flex", gap: "6px", alignItems: "center" };
const appliedTag = { fontSize: "10px", padding: "1px 6px", borderRadius: "999px", background: "#dcfce7", color: "#166534" };
const pendingTag = { fontSize: "10px", padding: "1px 6px", borderRadius: "999px", background: "#f6e4b0", color: "#7a5a10" };

const historyEntry = { padding: "10px 12px", border: "1px solid #eddfc8", borderRadius: "10px", background: "#fffdf9" };
const historyMeta = { fontSize: "12px", color: "#5c3a1e", fontFamily: "sans-serif", margin: "0 0 4px" };
const historyNote = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", fontStyle: "italic", margin: "0 0 4px" };
const historyChange = { fontSize: "12px", color: "#7a5530", fontFamily: "sans-serif", margin: "2px 0" };

const errorText = { color: "#b3432c", fontSize: "12px", fontFamily: "sans-serif", margin: 0 };
const successText = { color: "#166534", fontSize: "12px", fontFamily: "sans-serif", margin: 0 };

const modalFooter = { display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #eddfc8", paddingTop: "14px" };
const footerRight = { display: "flex", gap: "10px" };
const dangerGhostBtn = { padding: "9px 14px", borderRadius: "10px", border: "1px solid #f3b7a8", background: "transparent", color: "#b3432c", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const cancelBtn = { padding: "9px 16px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const saveBtn = { padding: "9px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const dangerBtn = { padding: "9px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #d65f5f, #a83232)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const actionBtn = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #eddfc8", background: "transparent", color: "#5c3a1e", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };

const confirmOverlay = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3100, padding: "20px" };
const confirmBox = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "24px", maxWidth: "420px", width: "100%" };
const confirmTitle = { fontSize: "16px", color: "#3d2200", fontFamily: "'Georgia', serif", margin: "0 0 10px" };
const confirmText = { fontSize: "13px", color: "#7a5530", fontFamily: "sans-serif", lineHeight: 1.6, margin: "0 0 18px" };
const confirmActions = { display: "flex", justifyContent: "flex-end", gap: "10px" };

const previewBox = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", padding: "20px", maxWidth: "460px", width: "100%", maxHeight: "88vh", overflowY: "auto" };
const previewHeader = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" };
const previewLabel = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const previewNavMock = { display: "flex", alignItems: "center", gap: "8px", padding: "12px 14px", border: "1px solid #eddfc8", borderRadius: "12px", background: "#fdf8f3", marginBottom: "14px" };
const previewNavIcon = { fontSize: "18px" };
const previewNavName = { fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", fontWeight: "600" };
const previewFrame = { border: "1px dashed #eddfc8", borderRadius: "12px", overflow: "hidden", minHeight: "160px" };
const previewNormal = { padding: "40px 20px", textAlign: "center", color: "#9b7040", fontFamily: "sans-serif", fontSize: "13px" };
