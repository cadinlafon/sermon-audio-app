import { useEffect, useMemo, useState } from "react";
import { useModulePermissions, usePermissions } from "../../hooks/usePermissions";
import { useAdminPin } from "../../context/AdminPinContext";
import { logAdminAction } from "../../utils/adminAudit";
import { AGENT_PRESETS, AGENT_PROVIDERS, AGENT_SCOPE_GROUPS, RISKY_SCOPES, SCOPE_LABELS } from "../../config/agentScopes";
import {
  agentApiUrl, createAgentKey, deleteAgentKey, listAgentKeys, rotateAgentKey, setAgentRevoked, updateAgentScopes,
} from "../../utils/agentKeys";

const EXPIRY_OPTIONS = [
  { value: 0, label: "Never expires" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

const formatWhen = (ts) => {
  const ms = ts?.seconds ? ts.seconds * 1000 : null;
  return ms ? new Date(ms).toLocaleString() : "Never";
};

export default function Agents() {
  const perms = useModulePermissions("agents");
  const actingPerms = usePermissions();
  const pinCtx = useAdminPin();

  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // null = closed; { id?, name, provider, scopes:Set, expiresInDays }
  const [saving, setSaving] = useState(false);
  const [reveal, setReveal] = useState(null); // { name, key }
  const [copied, setCopied] = useState("");
  const [showHelp, setShowHelp] = useState(false);

  const apiUrl = agentApiUrl();

  const load = async () => {
    try {
      setKeys(await listAgentKeys());
    } catch (err) {
      console.error("Couldn't load agent keys", err);
    }
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  // Only a full admin can mint or widen agent access — otherwise a restricted
  // admin could hand an agent more power than they hold themselves.
  const canManage = perms.canEdit && !actingPerms.isRestricted;

  // Every path that produces a working key goes through the strict gate:
  // it asks for the Admin PIN / passkey each time, even when PIN protection
  // is off or the session is already unlocked.
  const authorize = async () => {
    if (!pinCtx?.requirePin) return false;
    return pinCtx.requirePin("agentKey", { strict: true });
  };

  const copy = async (text, id) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(""), 1500);
    } catch { /* ignore */ }
  };

  //////////////////////////////////////////////////
  // FORM
  //////////////////////////////////////////////////

  const openNew = () => {
    if (!perms.requireEdit()) return;
    setForm({ name: "", provider: "Claude", scopes: new Set(AGENT_PRESETS[0].scopes), expiresInDays: 0 });
  };
  const openEdit = (k) => {
    if (!perms.requireEdit()) return;
    setForm({ id: k.id, name: k.name, provider: k.provider, scopes: new Set(k.scopes || []), expiresInDays: 0, existing: k });
  };
  const toggleScope = (id) => setForm((f) => {
    const next = new Set(f.scopes);
    if (next.has(id)) next.delete(id);
    else {
      next.add(id);
      // Anything beyond read implies being able to read.
      const base = id.split(":")[0];
      if (!id.endsWith(":read") && SCOPE_LABELS[`${base}:read`]) next.add(`${base}:read`);
    }
    return { ...f, scopes: next };
  });
  const applyPreset = (scopes) => setForm((f) => ({ ...f, scopes: new Set(scopes) }));

  const riskyPicked = useMemo(() => (form ? [...form.scopes].filter((s) => RISKY_SCOPES.includes(s)) : []), [form]);

  const submit = async () => {
    if (!canManage || !form) return;
    if (!form.name.trim()) { alert("Give this agent a name."); return; }
    if (form.scopes.size === 0) { alert("Pick at least one permission."); return; }
    setSaving(true);
    try {
      const scopes = [...form.scopes].sort();
      if (form.id) {
        if (!(await authorize())) { setSaving(false); return; }
        await updateAgentScopes(form.id, scopes);
        logAdminAction({
          category: "agent_key", action: "updateAgentPermissions", targetType: "agentKey", targetId: form.id, targetLabel: form.name,
          before: { scopes: form.existing?.scopes || [] }, after: { scopes },
        });
      } else {
        if (!(await authorize())) { setSaving(false); return; }
        const { id, key } = await createAgentKey({ name: form.name.trim(), provider: form.provider, scopes, expiresInDays: form.expiresInDays });
        logAdminAction({
          category: "agent_key", action: "createAgentKey", targetType: "agentKey", targetId: id, targetLabel: form.name.trim(),
          before: null, after: { provider: form.provider, scopes, expiresInDays: form.expiresInDays || null },
        });
        setReveal({ name: form.name.trim(), key });
      }
      setForm(null);
      load();
    } catch (err) {
      console.error(err);
      alert("Couldn't save this agent. Please try again.");
    }
    setSaving(false);
  };

  //////////////////////////////////////////////////
  // KEY ACTIONS
  //////////////////////////////////////////////////

  const rotate = async (k) => {
    if (!canManage) return;
    if (!window.confirm(`Generate a new key for "${k.name}"? The current key stops working immediately.`)) return;
    if (!(await authorize())) return;
    try {
      const key = await rotateAgentKey(k.id);
      logAdminAction({ category: "agent_key", action: "rotateAgentKey", targetType: "agentKey", targetId: k.id, targetLabel: k.name, before: { keyPrefix: k.keyPrefix }, after: { keyPrefix: key.slice(0, 8) } });
      setReveal({ name: k.name, key });
      load();
    } catch (err) {
      console.error(err);
      alert("Couldn't rotate this key.");
    }
  };

  const toggleRevoked = async (k) => {
    if (!perms.requireEdit()) return;
    if (!k.revoked && !window.confirm(`Revoke "${k.name}"? It will stop working immediately.`)) return;
    // Turning a key back ON restores access, so it needs the same authorization as minting one.
    if (k.revoked && !(await authorize())) return;
    await setAgentRevoked(k.id, !k.revoked);
    logAdminAction({ category: "agent_key", action: k.revoked ? "restoreAgentKey" : "revokeAgentKey", targetType: "agentKey", targetId: k.id, targetLabel: k.name, before: { revoked: !!k.revoked }, after: { revoked: !k.revoked } });
    load();
  };

  const remove = async (k) => {
    if (!perms.requireDelete()) return;
    if (!window.confirm(`Delete "${k.name}" permanently? Its key stops working and can't be restored.`)) return;
    await deleteAgentKey(k.id);
    logAdminAction({ category: "agent_key", action: "deleteAgentKey", targetType: "agentKey", targetId: k.id, targetLabel: k.name, before: { provider: k.provider, scopes: k.scopes || [] }, after: null });
    load();
  };

  const statusOf = (k) => {
    if (k.revoked) return { label: "Revoked", ...revokedPill };
    const exp = k.expiresAt?.seconds ? k.expiresAt.seconds * 1000 : null;
    if (exp && exp < Date.now()) return { label: "Expired", ...revokedPill };
    return { label: "Active", ...activePill };
  };

  const mcpConfig = JSON.stringify({ mcpServers: { "church-app": { type: "http", url: apiUrl, headers: { Authorization: "Bearer YOUR_AGENT_KEY" } } } }, null, 2);

  //////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////

  return (
    <div style={page}>
      <div style={pageHeader}>
        <div>
          <h1 style={pageTitle}>AI Agents</h1>
          <p style={pageSubtitle}>Let Claude, ChatGPT, or other agents work with your app — with only the permissions you pick.</p>
        </div>
        {canManage && <button style={primaryBtn} onClick={openNew}>+ Connect an Agent</button>}
      </div>

      {actingPerms.isRestricted && (
        <div style={noticeBox}>Restricted admins can view agents but can't create keys or change what an agent may do.</div>
      )}

      <div style={infoCard}>
        <div style={infoRow}>
          <span style={infoLabel}>Agent endpoint</span>
          <code style={codeInline}>{apiUrl}</code>
          <button style={smallBtn} onClick={() => copy(apiUrl, "url")}>{copied === "url" ? "✓ Copied" : "Copy"}</button>
        </div>
        <button style={linkBtn} onClick={() => setShowHelp((v) => !v)}>{showHelp ? "Hide" : "How to connect"} ▾</button>
        {showHelp && (
          <div style={helpBox}>
            <p style={helpP}><strong>Claude (MCP):</strong> add this as a remote MCP server that sends the key as a Bearer header — for example in Claude Code:</p>
            <pre style={pre}>{`claude mcp add --transport http church-app ${apiUrl} \\\n  --header "Authorization: Bearer YOUR_AGENT_KEY"`}</pre>
            <p style={helpP}>Or in an MCP client's JSON config:</p>
            <pre style={pre}>{mcpConfig}</pre>
            <p style={helpP}><strong>ChatGPT (Custom GPT → Actions):</strong> use Import from URL with <code style={codeInline}>{apiUrl}/openapi.json</code> (no key in the URL), then set Authentication → API Key → Auth Type: Bearer and paste the key there. The imported schema lists every tool; ones your key lacks permission for will be refused.</p>
            <p style={helpP}><strong>Anything else:</strong> plain HTTP works too — <code style={codeInline}>POST {apiUrl}/tools/&lt;tool_name&gt;</code> with a JSON body and <code style={codeInline}>Authorization: Bearer KEY</code>.</p>
            <p style={helpMuted}>An agent only ever sees the tools its key allows, and every change it makes appears in Logs → Admin Actions under "Agent Actions". Note: claude.ai's built-in custom connectors may require OAuth rather than a static key; Claude Code, Claude Desktop config, and API-based agents accept the header above.</p>
          </div>
        )}
      </div>

      {loading ? (
        <p style={empty}>Loading…</p>
      ) : keys.length === 0 ? (
        <div style={emptyCard}>
          <span style={{ fontSize: "34px" }}>🤖</span>
          <p style={emptyTitle}>No agents connected yet</p>
          <p style={empty}>Create a key, choose what the agent can do, and paste it into Claude or ChatGPT.</p>
        </div>
      ) : (
        keys.map((k) => {
          const status = statusOf(k);
          const scopes = k.scopes || [];
          const risky = scopes.filter((s) => RISKY_SCOPES.includes(s)).length;
          return (
            <div key={k.id} style={card}>
              <div style={cardTop}>
                <div>
                  <div style={agentName}>{k.name} <span style={providerPill}>{k.provider}</span></div>
                  <div style={meta}>Key <code style={codeInline}>{k.keyPrefix}…</code> · Created {formatWhen(k.createdAt)} · Last used {formatWhen(k.lastUsedAt)}</div>
                  {k.expiresAt?.seconds && <div style={meta}>Expires {formatWhen(k.expiresAt)}</div>}
                </div>
                <span style={{ ...pill, background: status.bg, color: status.color }}>{status.label}</span>
              </div>

              <div style={chips}>
                {scopes.length === 0 && <span style={meta}>No permissions</span>}
                {scopes.map((s) => (
                  <span key={s} style={RISKY_SCOPES.includes(s) ? chipRisky : chip}>{SCOPE_LABELS[s] || s}</span>
                ))}
              </div>
              {risky > 0 && <div style={meta}>⚠ Can change or expose data ({risky} permission{risky === 1 ? "" : "s"})</div>}

              <div style={actions}>
                {canManage && <button style={smallBtn} onClick={() => openEdit(k)}>Edit permissions</button>}
                {canManage && <button style={smallBtn} onClick={() => rotate(k)}>Rotate key</button>}
                {perms.canEdit && <button style={smallBtn} onClick={() => toggleRevoked(k)}>{k.revoked ? "Restore" : "Revoke"}</button>}
                {perms.canDelete && <button style={dangerBtn} onClick={() => remove(k)}>Delete</button>}
              </div>
            </div>
          );
        })
      )}

      {/* CREATE / EDIT */}
      {form && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>{form.id ? "Edit permissions" : "Connect an agent"}</h2>

            {!form.id && (
              <>
                <label style={fieldLabel}>Name</label>
                <input style={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Claude — weekly assistant" maxLength={60} />
                <div style={twoCol}>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Provider</label>
                    <select style={input} value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}>
                      {AGENT_PROVIDERS.map((p) => <option key={p}>{p}</option>)}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={fieldLabel}>Key lifetime</label>
                    <select style={input} value={form.expiresInDays} onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })}>
                      {EXPIRY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                </div>
              </>
            )}
            {form.id && <p style={meta}>{form.name} · {form.provider}</p>}

            <div style={presetRow}>
              <span style={fieldLabel}>Quick pick:</span>
              {AGENT_PRESETS.map((p) => <button key={p.key} type="button" style={smallBtn} onClick={() => applyPreset(p.scopes)}>{p.label}</button>)}
            </div>

            <div style={scopeList}>
              {AGENT_SCOPE_GROUPS.map((g) => (
                <div key={g.key} style={scopeGroup}>
                  <div style={groupTitle}>{g.icon} {g.label}</div>
                  {g.scopes.map((s) => (
                    <label key={s.id} style={scopeRow}>
                      <input type="checkbox" checked={form.scopes.has(s.id)} onChange={() => toggleScope(s.id)} />
                      <span>
                        <span style={s.danger ? { color: "#a33622" } : undefined}>{s.label}</span>
                        {s.hint && <span style={scopeHint}> — {s.hint}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              ))}
            </div>

            {riskyPicked.length > 0 && (
              <div style={warnBox}>⚠ This agent will be able to change or delete your content{riskyPicked.includes("users:read") ? " and read user emails" : ""}. Every change is logged under "Agent Actions".</div>
            )}
            <p style={meta}>🔒 Saving will ask for your Admin PIN or passkey.</p>

            <div style={modalActions}>
              <button style={primaryBtn} onClick={submit} disabled={saving}>{saving ? "Working…" : form.id ? "Save permissions" : "Create key"}</button>
              <button style={cancelBtn} onClick={() => setForm(null)} disabled={saving}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ONE-TIME KEY REVEAL */}
      {reveal && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>Key for {reveal.name}</h2>
            <p style={meta}>Copy it now — for security it's stored only as a hash and can't be shown again. If you lose it, rotate the key.</p>
            <code style={keyBox}>{reveal.key}</code>
            <div style={modalActions}>
              <button style={primaryBtn} onClick={() => copy(reveal.key, "key")}>{copied === "key" ? "✓ Copied" : "Copy key"}</button>
              <button style={cancelBtn} onClick={() => setReveal(null)}>I've saved it</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

//////////////////////////////////////////////////
// STYLES
//////////////////////////////////////////////////

const page = { maxWidth: "900px" };
const pageHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", flexWrap: "wrap", marginBottom: "20px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const primaryBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", fontWeight: "600" };
const smallBtn = { padding: "6px 12px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const dangerBtn = { ...smallBtn, border: "1px solid #f3c8ba", background: "#fff5f2", color: "#a33622" };
const cancelBtn = { padding: "10px 18px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const linkBtn = { background: "none", border: "none", color: "#a85e18", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer", padding: 0, marginTop: "8px" };
const noticeBox = { background: "#fef3c7", color: "#92400e", padding: "10px 14px", borderRadius: "10px", fontSize: "13px", fontFamily: "sans-serif", marginBottom: "14px" };
const infoCard = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "14px 16px", marginBottom: "16px" };
const infoRow = { display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" };
const infoLabel = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" };
const codeInline = { fontFamily: "monospace", fontSize: "12px", background: "#f8eee3", padding: "2px 6px", borderRadius: "6px", color: "#5c3a1e", wordBreak: "break-all" };
const helpBox = { marginTop: "10px", borderTop: "1px solid #f0e4d0", paddingTop: "10px" };
const helpP = { fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", lineHeight: 1.55, margin: "8px 0" };
const helpMuted = { fontSize: "12px", fontFamily: "sans-serif", color: "#9b7040", lineHeight: 1.5 };
const pre = { background: "#fdf8f3", border: "1px solid #eddfc8", borderRadius: "8px", padding: "10px 12px", fontSize: "11px", overflowX: "auto", margin: "6px 0", color: "#5c3a1e" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "14px", padding: "16px 18px", marginBottom: "12px", display: "flex", flexDirection: "column", gap: "10px" };
const cardTop = { display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "flex-start" };
const agentName = { fontSize: "16px", color: "#3d2200", fontFamily: "'Georgia', serif" };
const providerPill = { fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "#eee8ff", color: "#6547a5", fontFamily: "sans-serif", marginLeft: "6px" };
const meta = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif", marginTop: "3px" };
const pill = { fontSize: "11px", padding: "3px 10px", borderRadius: "999px", fontFamily: "sans-serif", fontWeight: "600", whiteSpace: "nowrap" };
const activePill = { bg: "#dcfce7", color: "#166534" };
const revokedPill = { bg: "#fee2e2", color: "#991b1b" };
const chips = { display: "flex", flexWrap: "wrap", gap: "6px" };
const chip = { fontSize: "11px", padding: "3px 9px", borderRadius: "999px", background: "#f4e7d4", color: "#7a4f10", fontFamily: "sans-serif" };
const chipRisky = { ...chip, background: "#fde8d8", color: "#a3551f" };
const actions = { display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid #f0e4d0", paddingTop: "10px" };
const empty = { fontSize: "13px", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", textAlign: "center" };
const emptyCard = { ...card, alignItems: "center", padding: "36px 20px" };
const emptyTitle = { fontFamily: "'Georgia', serif", color: "#3d2200", fontSize: "17px", margin: 0 };
const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" };
const modal = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "26px", width: "100%", maxWidth: "560px", display: "flex", flexDirection: "column", gap: "12px", maxHeight: "90vh", overflowY: "auto" };
const modalTitle = { fontSize: "20px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0 };
const fieldLabel = { fontSize: "11px", color: "#9b7040", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "0.05em" };
const input = { width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };
const twoCol = { display: "flex", gap: "12px", flexWrap: "wrap" };
const presetRow = { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" };
const scopeList = { display: "flex", flexDirection: "column", gap: "10px" };
const scopeGroup = { border: "1px solid #eddfc8", borderRadius: "10px", padding: "10px 12px", background: "#fdf8f3" };
const groupTitle = { fontSize: "13px", fontWeight: "600", color: "#3d2200", fontFamily: "sans-serif", marginBottom: "6px" };
const scopeRow = { display: "flex", gap: "8px", alignItems: "flex-start", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e", padding: "3px 0", cursor: "pointer" };
const scopeHint = { color: "#9b7040", fontSize: "12px" };
const warnBox = { background: "#fff5f2", border: "1px solid #f3c8ba", color: "#a33622", padding: "10px 12px", borderRadius: "10px", fontSize: "12px", fontFamily: "sans-serif" };
const modalActions = { display: "flex", gap: "10px", marginTop: "4px", flexWrap: "wrap" };
const keyBox = { display: "block", fontFamily: "monospace", fontSize: "13px", background: "#fdf8f3", border: "1px dashed #c97c2e", borderRadius: "10px", padding: "14px", wordBreak: "break-all", color: "#3d2200", userSelect: "all" };
