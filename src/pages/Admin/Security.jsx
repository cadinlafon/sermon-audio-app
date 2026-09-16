import { useState } from "react";
import { useModulePermissions } from "../../hooks/usePermissions";
import { useAdminSecurity } from "../../hooks/useAdminSecurity";
import { useAdminPin } from "../../context/AdminPinContext";
import { SENSITIVE_ACTIONS, SECURITY_CHANGE_ACTION, isValidPin, isPasskeySupported } from "../../config/adminSecurity";
import { logAdminAction } from "../../utils/adminAudit";

export default function Security() {
  const perms = useModulePermissions("security");
  const security = useAdminSecurity();
  const pinCtx = useAdminPin();
  const requirePin = pinCtx?.requirePin || (async () => true);

  const [ownerForm, setOwnerForm] = useState({ open: false, newPin: "", confirmPin: "" });
  const [restrictedForm, setRestrictedForm] = useState({ open: false, newPin: "", confirmPin: "" });
  const [savingOwner, setSavingOwner] = useState(false);
  const [savingRestricted, setSavingRestricted] = useState(false);
  const [addingPasskey, setAddingPasskey] = useState(false);

  const guardEdit = async () => {
    if (!perms.requireEdit()) return false;
    return requirePin(SECURITY_CHANGE_ACTION);
  };

  //////////////////////////////////////////////////
  // PIN ENABLE TOGGLE
  //////////////////////////////////////////////////
  const toggleEnabled = async () => {
    if (!security.hasOwnerPin) {
      alert("Set an admin PIN below before turning this on.");
      return;
    }
    if (!(await guardEdit())) return;
    const next = !security.pinEnabled;
    await security.setPinEnabled(next);
    logAdminAction({
      category: "settings_change",
      action: "togglePinEnabled",
      targetType: "adminSecurity",
      targetId: "status",
      targetLabel: "PIN Protection",
      before: { pinEnabled: security.pinEnabled },
      after: { pinEnabled: next },
    });
  };

  //////////////////////////////////////////////////
  // OWNER PIN
  //////////////////////////////////////////////////
  const saveOwnerPin = async () => {
    const { newPin, confirmPin } = ownerForm;
    if (!isValidPin(newPin)) { alert("PIN must be 4–10 digits."); return; }
    if (newPin !== confirmPin) { alert("PINs don't match."); return; }
    if (!(await guardEdit())) return;
    setSavingOwner(true);
    try {
      const hadPin = security.hasOwnerPin;
      await security.setOwnerPin(newPin);
      logAdminAction({
        category: "settings_change",
        action: "setOwnerPin",
        targetType: "adminSecurity",
        targetId: "status",
        targetLabel: "Admin PIN",
        before: { hasOwnerPin: hadPin },
        after: { hasOwnerPin: true },
      });
      setOwnerForm({ open: false, newPin: "", confirmPin: "" });
    } catch (err) {
      console.error(err);
      alert("Couldn't save the PIN.");
    }
    setSavingOwner(false);
  };

  const removeOwnerPin = async () => {
    if (!window.confirm("Remove the admin PIN? This also turns PIN protection off.")) return;
    if (!(await guardEdit())) return;
    await security.removeOwnerPin();
    logAdminAction({
      category: "settings_change",
      action: "removeOwnerPin",
      targetType: "adminSecurity",
      targetId: "status",
      targetLabel: "Admin PIN",
      before: { hasOwnerPin: true, pinEnabled: security.pinEnabled },
      after: { hasOwnerPin: false, pinEnabled: false },
    });
  };

  //////////////////////////////////////////////////
  // RESTRICTED ADMIN PIN
  //////////////////////////////////////////////////
  const saveRestrictedPin = async () => {
    const { newPin, confirmPin } = restrictedForm;
    if (!isValidPin(newPin)) { alert("PIN must be 4–10 digits."); return; }
    if (newPin !== confirmPin) { alert("PINs don't match."); return; }
    if (!(await guardEdit())) return;
    setSavingRestricted(true);
    try {
      const hadPin = security.hasRestrictedPin;
      await security.setRestrictedPin(newPin);
      logAdminAction({
        category: "settings_change",
        action: "setRestrictedPin",
        targetType: "adminSecurity",
        targetId: "status",
        targetLabel: "Restricted Admin PIN",
        before: { hasRestrictedPin: hadPin },
        after: { hasRestrictedPin: true },
      });
      setRestrictedForm({ open: false, newPin: "", confirmPin: "" });
    } catch (err) {
      console.error(err);
      alert("Couldn't save the PIN.");
    }
    setSavingRestricted(false);
  };

  const removeRestrictedPin = async () => {
    if (!window.confirm("Remove the restricted-admin PIN? Restricted admins won't be able to pass PIN gates until a new one is set.")) return;
    if (!(await guardEdit())) return;
    await security.removeRestrictedPin();
    logAdminAction({
      category: "settings_change",
      action: "removeRestrictedPin",
      targetType: "adminSecurity",
      targetId: "status",
      targetLabel: "Restricted Admin PIN",
      before: { hasRestrictedPin: true },
      after: { hasRestrictedPin: false },
    });
  };

  //////////////////////////////////////////////////
  // REQUIRE-PIN-FOR TOGGLES
  //////////////////////////////////////////////////
  const toggleRequirePinFor = async (key) => {
    if (!(await guardEdit())) return;
    const before = [...security.requirePinFor];
    const next = new Set(security.requirePinFor);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    await security.setRequirePinFor([...next]);
    logAdminAction({
      category: "settings_change",
      action: "toggleRequirePinFor",
      targetType: "adminSecurity",
      targetId: "status",
      targetLabel: key,
      before: { requirePinFor: before },
      after: { requirePinFor: [...next] },
    });
  };

  //////////////////////////////////////////////////
  // PASSKEYS
  //////////////////////////////////////////////////
  const addPasskey = async () => {
    const label = window.prompt('Name this passkey (e.g. "My iPhone")');
    if (!label) return;
    if (!(await guardEdit())) return;
    setAddingPasskey(true);
    try {
      await security.addPasskey(label);
      logAdminAction({
        category: "settings_change",
        action: "addPasskey",
        targetType: "adminSecurity",
        targetId: "passkeys",
        targetLabel: label,
        before: null,
        after: { label },
      });
    } catch (err) {
      console.error(err);
      alert(err?.message || "Couldn't create the passkey.");
    }
    setAddingPasskey(false);
  };

  const removePasskeyRow = async (id) => {
    if (!window.confirm("Remove this passkey?")) return;
    if (!(await guardEdit())) return;
    const target = security.passkeys.find((p) => p.id === id);
    await security.removePasskey(id);
    logAdminAction({
      category: "settings_change",
      action: "removePasskey",
      targetType: "adminSecurity",
      targetId: id,
      targetLabel: target?.label || "Passkey",
      before: { label: target?.label || null },
      after: null,
    });
  };

  if (security.loading) return <div style={loadingWrap}>Loading security settings…</div>;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Security</h1>
        <p style={pageSubtitle}>PIN and passkey protection for sensitive admin actions.</p>
      </div>

      {/* PIN PROTECTION TOGGLE */}
      <div style={card}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>🔑</span>
          <h2 style={sectionTitle}>PIN Protection</h2>
        </div>

        <div style={toggleRow}>
          <div>
            <div style={toggleLabel}>Require PIN for sensitive actions</div>
            <div style={toggleHint}>
              {security.hasOwnerPin ? "When on, the actions below need your PIN or passkey." : "Set an admin PIN first."}
            </div>
          </div>
          <button
            onClick={toggleEnabled}
            style={security.pinEnabled ? { ...toggle, ...toggleOn } : toggle}
            aria-label="Toggle PIN protection"
          >
            <div style={security.pinEnabled ? { ...toggleKnob, transform: "translateX(22px)" } : toggleKnob} />
          </button>
        </div>
      </div>

      {/* OWNER PIN */}
      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>👤</span>
          <h2 style={sectionTitle}>Admin PIN</h2>
        </div>

        <div style={statusRow}>
          <span style={security.hasOwnerPin ? statusDotOn : statusDotOff} />
          <span style={statusText}>{security.hasOwnerPin ? "PIN is set" : "No PIN set"}</span>
        </div>

        {!ownerForm.open ? (
          <div style={btnRow}>
            <button onClick={() => setOwnerForm({ open: true, newPin: "", confirmPin: "" })} style={secondaryBtn}>
              {security.hasOwnerPin ? "Change PIN" : "Set PIN"}
            </button>
            {security.hasOwnerPin && (
              <button onClick={removeOwnerPin} style={dangerBtn}>Remove PIN</button>
            )}
          </div>
        ) : (
          <PinForm
            form={ownerForm}
            setForm={setOwnerForm}
            onSave={saveOwnerPin}
            onCancel={() => setOwnerForm({ open: false, newPin: "", confirmPin: "" })}
            saving={savingOwner}
          />
        )}
      </div>

      {/* RESTRICTED ADMIN PIN */}
      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>🛡️</span>
          <h2 style={sectionTitle}>Restricted Admin PIN</h2>
        </div>
        <p style={cardHint}>One shared PIN used by every restricted admin — separate from your own.</p>

        <div style={statusRow}>
          <span style={security.hasRestrictedPin ? statusDotOn : statusDotOff} />
          <span style={statusText}>{security.hasRestrictedPin ? "PIN is set" : "No PIN set"}</span>
        </div>

        {!restrictedForm.open ? (
          <div style={btnRow}>
            <button onClick={() => setRestrictedForm({ open: true, newPin: "", confirmPin: "" })} style={secondaryBtn}>
              {security.hasRestrictedPin ? "Change PIN" : "Set PIN"}
            </button>
            {security.hasRestrictedPin && (
              <button onClick={removeRestrictedPin} style={dangerBtn}>Remove PIN</button>
            )}
          </div>
        ) : (
          <PinForm
            form={restrictedForm}
            setForm={setRestrictedForm}
            onSave={saveRestrictedPin}
            onCancel={() => setRestrictedForm({ open: false, newPin: "", confirmPin: "" })}
            saving={savingRestricted}
          />
        )}
      </div>

      {/* WHAT REQUIRES A PIN */}
      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>🎯</span>
          <h2 style={sectionTitle}>What Requires a PIN</h2>
        </div>

        <div style={actionList}>
          {SENSITIVE_ACTIONS.map((a) => (
            <ActionToggleRow
              key={a.key}
              icon={a.icon}
              label={a.label}
              checked={security.requirePinFor.has(a.key)}
              onToggle={() => toggleRequirePinFor(a.key)}
            />
          ))}
        </div>
      </div>

      {/* PASSKEYS */}
      <div style={{ ...card, marginTop: "20px" }}>
        <div style={sectionHeader}>
          <span style={sectionIcon}>🪪</span>
          <h2 style={sectionTitle}>Passkeys</h2>
        </div>
        <p style={cardHint}>
          Optional — use Face ID, Touch ID, or Windows Hello instead of typing your PIN. Owner account only.
        </p>

        {!isPasskeySupported() ? (
          <p style={hintMuted}>This browser doesn't support passkeys.</p>
        ) : (
          <>
            {security.passkeys.length === 0 ? (
              <p style={hintMuted}>No passkeys added yet.</p>
            ) : (
              <div style={passkeyList}>
                {security.passkeys.map((p) => (
                  <div key={p.id} style={passkeyRow}>
                    <span style={passkeyName}>🪪 {p.label || "Passkey"}</span>
                    <button onClick={() => removePasskeyRow(p.id)} style={dangerBtnSmall}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div style={btnRow}>
              <button onClick={addPasskey} disabled={addingPasskey} style={secondaryBtn}>
                {addingPasskey ? "Adding…" : "+ Add a Passkey"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PinForm({ form, setForm, onSave, onCancel, saving }) {
  return (
    <div style={pinFormWrap}>
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="New PIN (4–10 digits)"
        value={form.newPin}
        onChange={(e) => setForm({ ...form, newPin: e.target.value.replace(/\D/g, "").slice(0, 10) })}
        style={pinFormInput}
      />
      <input
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        placeholder="Confirm PIN"
        value={form.confirmPin}
        onChange={(e) => setForm({ ...form, confirmPin: e.target.value.replace(/\D/g, "").slice(0, 10) })}
        style={pinFormInput}
      />
      <div style={btnRow}>
        <button onClick={onSave} disabled={saving} style={saveBtn}>{saving ? "Saving…" : "Save PIN"}</button>
        <button onClick={onCancel} style={cancelBtn}>Cancel</button>
      </div>
    </div>
  );
}

function ActionToggleRow({ icon, label, checked, onToggle }) {
  return (
    <label style={actionRow}>
      <span style={actionLabel}>
        <span style={{ marginRight: "8px" }}>{icon}</span>
        {label}
      </span>
      <input type="checkbox" checked={checked} onChange={onToggle} style={{ width: "17px", height: "17px" }} />
    </label>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = { maxWidth: "600px" };
const pageHeader = { marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const loadingWrap = { padding: "40px", fontFamily: "sans-serif", color: "#9b7040" };

const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "18px", padding: "24px", boxShadow: "0 2px 12px rgba(160,100,40,0.07)", display: "flex", flexDirection: "column", gap: "16px" };
const sectionHeader = { display: "flex", alignItems: "center", gap: "10px", paddingBottom: "16px", borderBottom: "1px solid #eddfc8" };
const sectionIcon = { fontSize: "20px" };
const sectionTitle = { margin: 0, fontSize: "18px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif" };
const cardHint = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", margin: "-8px 0 0" };

const toggleRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "16px" };
const toggleLabel = { fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", marginBottom: "3px" };
const toggleHint = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040" };
const toggle = { width: "46px", height: "26px", borderRadius: "999px", background: "#eddfc8", border: "none", cursor: "pointer", position: "relative", flexShrink: 0, transition: "background 0.2s" };
const toggleOn = { background: "linear-gradient(135deg, #c97c2e, #a85e18)" };
const toggleKnob = { position: "absolute", top: "3px", left: "3px", width: "20px", height: "20px", borderRadius: "50%", background: "#fff", transition: "transform 0.2s", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" };

const statusRow = { display: "flex", alignItems: "center", gap: "8px" };
const statusDotOn = { width: "9px", height: "9px", borderRadius: "50%", background: "#16a34a", display: "inline-block" };
const statusDotOff = { width: "9px", height: "9px", borderRadius: "50%", background: "#d0b28a", display: "inline-block" };
const statusText = { fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e" };

const btnRow = { display: "flex", gap: "10px", flexWrap: "wrap" };
const secondaryBtn = { padding: "10px 18px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", fontWeight: "600" };
const dangerBtn = { padding: "10px 18px", borderRadius: "10px", border: "1px solid #f3c8ba", background: "#fff5f2", color: "#a33622", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const dangerBtnSmall = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #f3c8ba", background: "#fff5f2", color: "#a33622", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const saveBtn = { padding: "10px 20px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", fontWeight: "600" };
const cancelBtn = { padding: "10px 18px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#9b7040", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };

const pinFormWrap = { display: "flex", flexDirection: "column", gap: "10px", maxWidth: "280px" };
const pinFormInput = { padding: "10px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "16px", letterSpacing: "0.2em", fontFamily: "monospace", color: "#3d2200", outline: "none" };

const actionList = { display: "flex", flexDirection: "column", gap: "4px" };
const actionRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 4px", borderBottom: "1px solid #f0e4d0", cursor: "pointer" };
const actionLabel = { fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };

const hintMuted = { fontSize: "13px", fontFamily: "sans-serif", color: "#b08050", fontStyle: "italic", margin: 0 };
const passkeyList = { display: "flex", flexDirection: "column", gap: "8px" };
const passkeyRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", borderRadius: "10px", background: "#fdf8f3", border: "1px solid #f0e4d0" };
const passkeyName = { fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };
