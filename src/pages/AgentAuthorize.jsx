import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useAuth } from "../context/AuthContext";
import { useAdminPin, AdminPinProvider } from "../context/AdminPinContext";
import { logAdminAction } from "../utils/adminAudit";
import { agentApiUrl, listAgentKeys } from "../utils/agentKeys";
import { SCOPE_LABELS, RISKY_SCOPES } from "../config/agentScopes";

// Consent screen for OAuth connectors (ChatGPT etc.). The agent-api edge
// function sends the browser here (Supabase can't serve HTML itself). A FULL
// admin picks which existing agent — and therefore which permissions — the
// connector gets, and must pass the Admin PIN/passkey to approve.
export default function AgentAuthorize() {
  const { user, isAdmin, permissions, authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (authLoading) return <Shell><p style={muted}>Loading…</p></Shell>;

  if (!user) {
    return (
      <Shell>
        <h1 style={title}>Sign in to continue</h1>
        <p style={muted}>An AI app is asking to connect. Sign in as an administrator to review the request.</p>
        <button style={primary} onClick={() => navigate(`/login?next=${encodeURIComponent(`/agent-authorize${location.search}`)}`)}>Sign in</button>
      </Shell>
    );
  }

  if (!isAdmin || permissions) {
    return (
      <Shell>
        <h1 style={title}>Full admin access required</h1>
        <p style={muted}>Only a full administrator can connect an AI app. You're signed in as {user.email}.</p>
        <button style={secondary} onClick={() => navigate("/")}>Back to the app</button>
      </Shell>
    );
  }

  return (
    <AdminPinProvider>
      <Consent />
    </AdminPinProvider>
  );
}

function Consent() {
  const { search } = useLocation();
  const pinCtx = useAdminPin();
  const p = new URLSearchParams(search);
  const params = { client_id: p.get("client_id"), redirect_uri: p.get("redirect_uri"), state: p.get("state") || undefined, code_challenge: p.get("code_challenge") };

  const [clientName, setClientName] = useState("");
  const [agents, setAgents] = useState(null);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const invalid = !params.client_id || !params.redirect_uri || !params.code_challenge;

  useEffect(() => {
    if (invalid) return;
    fetch(`${agentApiUrl()}/oauth/client?client_id=${encodeURIComponent(params.client_id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => setClientName(d.name))
      .catch(() => setError("This connection request isn't recognized. Start again from the app you're connecting."));
    listAgentKeys()
      .then((all) => {
        const active = all.filter((k) => !k.revoked && !(k.expiresAt?.seconds && k.expiresAt.seconds * 1000 < Date.now()));
        setAgents(active);
        if (active.length === 1) setSelected(active[0].id);
      })
      .catch(() => setError("Couldn't load your agents."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const send = async (extra) => {
    const token = await auth.currentUser.getIdToken();
    const res = await fetch(`${agentApiUrl()}/oauth/approve`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...params, ...extra }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.redirectTo) throw new Error(data.error || "Couldn't complete the request.");
    return data;
  };

  const approve = async () => {
    const agent = agents.find((a) => a.id === selected);
    if (!agent) { setError("Choose which agent to connect."); return; }
    setError("");
    setBusy(true);
    try {
      // Same strict gate as minting a key: Admin PIN / passkey, every time.
      if (!(await pinCtx.requirePin("agentKey", { strict: true }))) { setBusy(false); return; }
      const data = await send({ agent_id: agent.id });
      logAdminAction({ category: "agent_key", action: "authorizeConnector", targetType: "agentKey", targetId: agent.id, targetLabel: agent.name, before: null, after: { client: clientName || params.client_id, scopes: agent.scopes || [] } });
      window.location.assign(data.redirectTo);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const deny = async () => {
    setBusy(true);
    try {
      window.location.assign((await send({ deny: true })).redirectTo);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  if (invalid) return <Shell><h1 style={title}>Invalid request</h1><p style={muted}>This page must be opened by an AI app that's trying to connect.</p></Shell>;

  const chosen = agents?.find((a) => a.id === selected);
  const risky = (chosen?.scopes || []).some((s) => RISKY_SCOPES.includes(s));

  return (
    <Shell>
      <div style={{ fontSize: "30px" }}>🤖</div>
      <h1 style={title}>{clientName || "An AI app"} wants to connect</h1>
      <p style={muted}>Choose which agent it acts as. It will be able to do only what that agent is allowed to — nothing more — and every change it makes is logged.</p>

      {agents === null ? <p style={muted}>Loading agents…</p> : agents.length === 0 ? (
        <p style={warn}>You have no active agents. Create one in Admin → AI Agents (choose its permissions there), then connect again.</p>
      ) : (
        <div style={list}>
          {agents.map((a) => (
            <label key={a.id} style={{ ...option, ...(selected === a.id ? optionOn : null) }}>
              <input type="radio" name="agent" checked={selected === a.id} onChange={() => setSelected(a.id)} />
              <span>
                <strong>{a.name}</strong> <span style={pill}>{a.provider}</span>
                <span style={chips}>
                  {(a.scopes || []).map((s) => <span key={s} style={RISKY_SCOPES.includes(s) ? chipRisky : chip}>{SCOPE_LABELS[s] || s}</span>)}
                </span>
              </span>
            </label>
          ))}
        </div>
      )}

      {risky && <p style={warn}>⚠ This agent can change or delete your content.</p>}
      {error && <p style={warn} role="alert">{error}</p>}

      <div style={row}>
        <button style={primary} onClick={approve} disabled={busy || !agents?.length}>{busy ? "Working…" : "Allow"}</button>
        <button style={secondary} onClick={deny} disabled={busy}>Deny</button>
      </div>
      <p style={muted}>🔒 Allowing asks for your Admin PIN or passkey.</p>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={page}>
      <div style={card}>{children}</div>
    </div>
  );
}

const page = { minHeight: "100vh", background: "#fdf8f3", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" };
const card = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "32px 28px", width: "100%", maxWidth: "520px", display: "flex", flexDirection: "column", gap: "14px", fontFamily: "'Georgia', serif" };
const title = { fontSize: "22px", fontWeight: "normal", color: "#3d2200", margin: 0 };
const muted = { fontSize: "13px", color: "#9b7040", fontFamily: "sans-serif", lineHeight: 1.55, margin: 0 };
const warn = { fontSize: "13px", color: "#a33622", background: "#fff5f2", border: "1px solid #f3c8ba", borderRadius: "10px", padding: "10px 12px", fontFamily: "sans-serif", margin: 0 };
const list = { display: "flex", flexDirection: "column", gap: "10px" };
const option = { display: "flex", gap: "10px", alignItems: "flex-start", border: "1px solid #eddfc8", borderRadius: "12px", padding: "12px", cursor: "pointer", fontFamily: "sans-serif", fontSize: "14px", color: "#3d2200", background: "#fdf8f3" };
const optionOn = { borderColor: "#c97c2e", background: "#fff6e8" };
const pill = { fontSize: "10px", padding: "2px 8px", borderRadius: "999px", background: "#eee8ff", color: "#6547a5", marginLeft: "6px" };
const chips = { display: "flex", flexWrap: "wrap", gap: "5px", marginTop: "8px" };
const chip = { fontSize: "11px", padding: "2px 8px", borderRadius: "999px", background: "#f4e7d4", color: "#7a4f10" };
const chipRisky = { ...chip, background: "#fde8d8", color: "#a3551f" };
const row = { display: "flex", gap: "10px" };
const primary = { flex: 1, padding: "12px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", fontWeight: "600" };
const secondary = { flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
