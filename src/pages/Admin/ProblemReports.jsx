import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { auth, db } from "../../firebase";
import { useModulePermissions } from "../../hooks/usePermissions";
import { logAdminAction } from "../../utils/adminAudit";
import {
  REPORTS, PREBUILT_TAGS, MAX_REPLY, toMillis,
  markSeenByAdmin, setTags, addReply, deleteReport,
} from "../../utils/problemReports";

// Admin → Reports: what people sent through "Report a Problem". Opening a
// report marks it seen (clearing the red dot on the sidebar button); replies
// appear for the sender with a dot until they read them. Tag reports with the
// pre-built tags or your own.

const fmt = (ms) => (ms ? new Date(ms).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export default function ProblemReports() {
  const perms = useModulePermissions("reports");
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openId, setOpenId] = useState(null);
  const [filter, setFilter] = useState("all"); // all | unseen | tag:<name>
  const [search, setSearch] = useState("");

  useEffect(() => onSnapshot(
    query(collection(db, REPORTS), orderBy("createdAt", "desc")),
    (snap) => { setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); setLoading(false); },
    (err) => { console.error("Couldn't load reports", err); setError("Couldn't load the reports."); setLoading(false); }
  ), []);

  // Custom tags already in use anywhere, so they can be re-applied in one tap.
  const customTags = useMemo(() => {
    const used = new Set();
    reports.forEach((r) => (r.tags || []).forEach((t) => { if (!PREBUILT_TAGS.includes(t)) used.add(t); }));
    return [...used].sort((a, b) => a.localeCompare(b));
  }, [reports]);

  const allTags = useMemo(() => {
    const counts = {};
    reports.forEach((r) => (r.tags || []).forEach((t) => { counts[t] = (counts[t] || 0) + 1; }));
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [reports]);

  const unseen = reports.filter((r) => r.adminSeen !== true).length;
  const shown = reports.filter((r) => {
    if (filter === "unseen" && r.adminSeen === true) return false;
    if (filter.startsWith("tag:") && !(r.tags || []).includes(filter.slice(4))) return false;
    const q = search.trim().toLowerCase();
    if (q && ![r.title, r.details, r.userName, r.userEmail, ...(r.tags || [])].some((v) => String(v || "").toLowerCase().includes(q))) return false;
    return true;
  });

  const open = (r) => {
    const next = openId === r.id ? null : r.id;
    setOpenId(next);
    // Opening a report is what "seen" means.
    if (next && r.adminSeen !== true && perms.canEdit) markSeenByAdmin(r.id).catch((err) => console.error("Couldn't mark seen", err));
  };

  return (
    <div style={page}>
      <div style={pageHeader}>
        <h1 style={pageTitle}>Problem Reports</h1>
        <p style={pageSubtitle}>What people send from the profile sidebar. {unseen > 0 ? `${unseen} not opened yet.` : "Everything has been opened."}</p>
      </div>

      <div style={toolbar}>
        <input style={searchInput} placeholder="Search reports, people, tags…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search reports" />
      </div>
      <div style={chipRow}>
        <button style={filter === "all" ? { ...chip, ...chipOn } : chip} onClick={() => setFilter("all")}>All ({reports.length})</button>
        <button style={filter === "unseen" ? { ...chip, ...chipOn } : chip} onClick={() => setFilter("unseen")}>Not opened ({unseen})</button>
        {allTags.map(([t, n]) => (
          <button key={t} style={filter === `tag:${t}` ? { ...chip, ...chipOn } : chip} onClick={() => setFilter(filter === `tag:${t}` ? "all" : `tag:${t}`)}>{t} ({n})</button>
        ))}
      </div>

      {loading && <p style={hint}>Loading…</p>}
      {error && <p style={{ ...hint, color: "var(--color-b3432c)" }}>{error}</p>}
      {!loading && !error && shown.length === 0 && <p style={hint}>{reports.length === 0 ? "No reports yet." : "No reports match."}</p>}

      {shown.map((r) => (
        <ReportCard
          key={r.id}
          report={r}
          isOpen={openId === r.id}
          onToggle={() => open(r)}
          customTags={customTags}
          canEdit={perms.canEdit}
          canDelete={perms.canDelete}
          requireEdit={perms.requireEdit}
          requireDelete={perms.requireDelete}
          onDeleted={() => setOpenId(null)}
        />
      ))}
    </div>
  );
}

function ReportCard({ report: r, isOpen, onToggle, customTags, canEdit, canDelete, requireEdit, requireDelete, onDeleted }) {
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [customTag, setCustomTag] = useState("");
  const [error, setError] = useState("");

  const tags = r.tags || [];
  const replies = Array.isArray(r.replies) ? r.replies : [];
  const isNew = r.adminSeen !== true;

  const toggleTag = async (tag) => {
    if (!requireEdit()) return;
    const next = tags.includes(tag) ? tags.filter((t) => t !== tag) : [...tags, tag];
    try { await setTags(r.id, next); } catch (err) { console.error(err); setError("Couldn't save the tag."); }
  };

  const addCustom = async () => {
    const t = customTag.trim().slice(0, 30);
    if (!t || tags.includes(t)) { setCustomTag(""); return; }
    if (!requireEdit()) return;
    try { await setTags(r.id, [...tags, t]); setCustomTag(""); } catch (err) { console.error(err); setError("Couldn't save the tag."); }
  };

  const sendReply = async () => {
    if (!requireEdit() || sending) return;
    setSending(true);
    setError("");
    try {
      await addReply(r, reply, auth.currentUser?.displayName || "Palouse Fellowship");
      logAdminAction({ category: "content_edit", action: "replyToReport", targetType: "problemReport", targetId: r.id, targetLabel: r.title, before: null, after: { reply: reply.trim().slice(0, 200) } });
      setReply("");
    } catch (err) {
      console.error("Couldn't send the reply", err);
      setError(err?.message || "Couldn't send the reply.");
    }
    setSending(false);
  };

  const remove = async () => {
    if (!requireDelete()) return;
    if (!window.confirm(`Delete "${r.title}"? The sender will no longer see it.`)) return;
    try {
      await deleteReport(r.id);
      logAdminAction({ category: "content_delete", action: "deleteReport", targetType: "problemReport", targetId: r.id, targetLabel: r.title, before: { title: r.title, from: r.userEmail }, after: null });
      onDeleted();
    } catch (err) { console.error(err); setError("Couldn't delete it."); }
  };

  return (
    <div style={isNew ? { ...card, ...cardNew } : card}>
      <button style={cardHead} onClick={onToggle} aria-expanded={isOpen}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={cardTitleRow}>
            {isNew && <span style={newDot} role="status" aria-label="Not opened yet" />}
            <span style={cardTitle}>{r.title}</span>
          </span>
          <span style={cardMeta}>{r.userName || "User"}{r.userEmail ? ` · ${r.userEmail}` : ""} · {fmt(toMillis(r.createdAt))}{replies.length > 0 ? ` · ${replies.length} ${replies.length === 1 ? "reply" : "replies"}` : ""}</span>
          {tags.length > 0 && <span style={tagRow}>{tags.map((t) => <span key={t} style={tagChip}>{t}</span>)}</span>}
        </span>
        <span aria-hidden="true" style={chev}>{isOpen ? "▴" : "▾"}</span>
      </button>

      {isOpen && (
        <div style={cardBody}>
          <p style={detailsText}>{r.details}</p>

          <div style={sectionLabel}>Tags</div>
          <div style={tagEditor}>
            {PREBUILT_TAGS.map((t) => (
              <button key={t} disabled={!canEdit} style={tags.includes(t) ? { ...tagBtn, ...tagBtnOn } : tagBtn} onClick={() => toggleTag(t)} aria-pressed={tags.includes(t)}>{t}</button>
            ))}
            {customTags.map((t) => (
              <button key={t} disabled={!canEdit} style={tags.includes(t) ? { ...tagBtn, ...tagBtnOn, ...tagBtnCustom } : { ...tagBtn, ...tagBtnCustom }} onClick={() => toggleTag(t)} aria-pressed={tags.includes(t)}>{t}</button>
            ))}
            {tags.filter((t) => !PREBUILT_TAGS.includes(t) && !customTags.includes(t)).map((t) => (
              <button key={t} style={{ ...tagBtn, ...tagBtnOn, ...tagBtnCustom }} onClick={() => toggleTag(t)}>{t} ✕</button>
            ))}
          </div>
          {canEdit && (
            <div style={customRow}>
              <input style={input} value={customTag} maxLength={30} placeholder="Custom tag…" onChange={(e) => setCustomTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }} aria-label="Add a custom tag" />
              <button style={smallBtn} onClick={addCustom} disabled={!customTag.trim()}>Add tag</button>
            </div>
          )}

          <div style={sectionLabel}>Conversation</div>
          {replies.length === 0 && <div style={hint}>No replies yet.</div>}
          {replies.map((rep, i) => (
            <div key={i} style={replyBox}>
              <div style={replyMeta}>{rep.by || "Admin"} · {fmt(rep.at)}</div>
              <div style={replyText}>{rep.body}</div>
            </div>
          ))}
          {r.userUnread === true && <div style={hint}>The sender hasn't read your latest reply yet.</div>}

          {canEdit && (
            <>
              <textarea style={{ ...input, minHeight: "80px", resize: "vertical" }} value={reply} maxLength={MAX_REPLY} placeholder={`Reply to ${r.userName || "the sender"}…`} onChange={(e) => setReply(e.target.value)} aria-label="Reply" />
              <div style={actions}>
                <button style={primaryBtn} onClick={sendReply} disabled={sending || !reply.trim()}>{sending ? "Sending…" : "Send reply"}</button>
                <button style={smallBtn} onClick={() => markSeenByAdmin(r.id, !(r.adminSeen === true)).catch(() => {})}>{r.adminSeen === true ? "Mark as not opened" : "Mark as opened"}</button>
                {canDelete && <button style={dangerBtn} onClick={remove}>Delete</button>}
              </div>
            </>
          )}
          {error && <div style={{ ...hint, color: "var(--color-b3432c)" }} role="alert">{error}</div>}
        </div>
      )}
    </div>
  );
}

const page = { maxWidth: "820px" };
const pageHeader = { marginBottom: "20px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0 };
const toolbar = { marginBottom: "10px" };
const searchInput = { width: "100%", boxSizing: "border-box", padding: "10px 14px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none" };
const chipRow = { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "16px" };
const chip = { padding: "6px 12px", borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const chipOn = { background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", border: "1px solid transparent" };
const hint = { fontSize: "13px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: "6px 0" };

const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "14px", marginBottom: "10px", overflow: "hidden" };
const cardNew = { borderColor: "var(--color-e0a458)" };
const cardHead = { display: "flex", alignItems: "center", gap: "10px", width: "100%", padding: "14px 16px", background: "none", border: "none", cursor: "pointer", textAlign: "left", fontFamily: "sans-serif" };
const cardTitleRow = { display: "flex", alignItems: "center", gap: "8px" };
const cardTitle = { fontSize: "15px", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" };
const newDot = { width: "10px", height: "10px", borderRadius: "50%", background: "var(--color-dc2626)", flexShrink: 0 };
const cardMeta = { display: "block", fontSize: "12px", color: "var(--color-9b7040)", marginTop: "3px" };
const tagRow = { display: "flex", gap: "5px", flexWrap: "wrap", marginTop: "7px" };
const tagChip = { fontSize: "11px", padding: "2px 9px", borderRadius: "999px", background: "var(--color-f6e4b0)", color: "var(--color-7a5a10)" };
const chev = { color: "var(--color-9b7040)", fontSize: "12px", flexShrink: 0 };
const cardBody = { padding: "4px 16px 16px", display: "flex", flexDirection: "column", gap: "10px", borderTop: "1px solid var(--color-eddfc8)" };
const detailsText = { fontSize: "14px", lineHeight: 1.6, color: "var(--color-3d2200)", whiteSpace: "pre-wrap", margin: "12px 0 0", fontFamily: "sans-serif" };
const sectionLabel = { fontSize: "11px", letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--color-9b7040)", fontFamily: "sans-serif", marginTop: "6px" };
const tagEditor = { display: "flex", gap: "6px", flexWrap: "wrap" };
const tagBtn = { padding: "5px 11px", borderRadius: "999px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const tagBtnOn = { background: "var(--color-f6e4b0)", borderColor: "var(--color-c97c2e)", color: "var(--color-7a5a10)", fontWeight: "600" };
const tagBtnCustom = { borderStyle: "dashed" };
const customRow = { display: "flex", gap: "8px" };
const replyBox = { background: "var(--color-fdf1de)", borderRadius: "10px", padding: "10px 12px" };
const replyMeta = { fontSize: "11.5px", color: "var(--color-7a5530)", fontWeight: "600", marginBottom: "4px", fontFamily: "sans-serif" };
const replyText = { fontSize: "14px", lineHeight: 1.55, color: "var(--color-3d2200)", whiteSpace: "pre-wrap", fontFamily: "sans-serif" };
const input = { flex: 1, width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none" };
const actions = { display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" };
const primaryBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e) 0%, var(--color-a85e18) 100%)", color: "var(--color-fff8ee)", fontSize: "13px", fontWeight: "600", fontFamily: "sans-serif", cursor: "pointer" };
const smallBtn = { padding: "9px 14px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-7a4f10)", fontSize: "12.5px", fontFamily: "sans-serif", cursor: "pointer" };
const dangerBtn = { ...smallBtn, marginLeft: "auto", color: "var(--color-dc2626)", borderColor: "var(--color-fca5a5)" };
