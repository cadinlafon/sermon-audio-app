import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebase";
import { useMyReports, markRepliesRead, toMillis } from "../utils/problemReports";
import { useAuth } from "../context/AuthContext";

// The problems this person has reported and the replies from the team.
// Opening the page marks every reply as read (the red dot disappears).
export default function MyReports() {
  const navigate = useNavigate();
  const { user, authLoading } = useAuth();
  const { reports, unread } = useMyReports(user || auth.currentUser);
  const clearedRef = useRef(new Set());

  // Mark replies read as they're shown — each report once.
  useEffect(() => {
    const toClear = reports.filter((r) => r.userUnread === true && !clearedRef.current.has(r.id)).map((r) => r.id);
    if (toClear.length === 0) return;
    toClear.forEach((id) => clearedRef.current.add(id));
    markRepliesRead(toClear);
  }, [reports]);

  const fmt = (ms) => (ms ? new Date(ms).toLocaleString([], { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "");

  if (!authLoading && !user) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>My Reports</h1>
        <p style={empty}>Sign in to see the problems you've reported.</p>
      </div>
    );
  }

  return (
    <div style={page}>
      <button style={back} onClick={() => navigate(-1)}>← Back</button>
      <h1 style={pageTitle}>My Reports</h1>
      <p style={subtitle}>Problems you've reported, and what we said back.</p>

      {reports.length === 0 && <p style={empty}>You haven't reported anything. Use <strong>Report a Problem</strong> in the profile sidebar if something goes wrong.</p>}

      {reports.map((r) => {
        const replies = Array.isArray(r.replies) ? r.replies : [];
        const isNew = unread > 0 && r.userUnread === true;
        return (
          <div key={r.id} style={isNew ? { ...card, ...cardNew } : card}>
            <div style={cardTop}>
              <h2 style={cardTitle}>{r.title}</h2>
              {isNew && <span style={newBadge}>New reply</span>}
            </div>
            <div style={meta}>Sent {fmt(toMillis(r.createdAt))}</div>
            <p style={body}>{r.details}</p>

            {replies.length === 0 ? (
              <div style={waiting}>No reply yet — we'll answer here.</div>
            ) : (
              <div style={thread}>
                {replies.map((rep, i) => (
                  <div key={i} style={reply}>
                    <div style={replyMeta}>{rep.by || "Palouse Fellowship"} · {fmt(rep.at)}</div>
                    <div style={replyBody}>{rep.body}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const page = { padding: "28px 20px 80px", maxWidth: "680px", margin: "0 auto", fontFamily: "sans-serif" };
const back = { background: "none", border: "none", color: "var(--color-a85e18)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", padding: 0, marginBottom: "10px" };
const pageTitle = { fontFamily: "'Georgia', serif", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px" };
const subtitle = { fontSize: "14px", color: "var(--color-9b7040)", margin: "0 0 22px" };
const empty = { fontSize: "14px", color: "var(--color-9b7040)", lineHeight: 1.6 };
const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "14px", padding: "16px 18px", marginBottom: "14px" };
const cardNew = { borderColor: "var(--color-e0a458)", boxShadow: "0 0 0 2px rgba(224,137,48,0.18)" };
const cardTop = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" };
const cardTitle = { fontSize: "17px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif", margin: 0 };
const newBadge = { fontSize: "11px", fontWeight: "700", padding: "3px 9px", borderRadius: "999px", background: "var(--color-fee2e2)", color: "var(--color-b91c1c)", whiteSpace: "nowrap" };
const meta = { fontSize: "12px", color: "var(--color-9b7040)", margin: "4px 0 10px" };
const body = { fontSize: "14px", lineHeight: 1.6, color: "var(--color-3d2200)", whiteSpace: "pre-wrap", margin: "0 0 12px" };
const waiting = { fontSize: "12.5px", color: "var(--color-9b7040)", fontStyle: "italic" };
const thread = { display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--color-eddfc8)", paddingTop: "12px" };
const reply = { background: "var(--color-fdf1de)", borderRadius: "10px", padding: "10px 12px" };
const replyMeta = { fontSize: "11.5px", color: "var(--color-7a5530)", marginBottom: "4px", fontWeight: "600" };
const replyBody = { fontSize: "14px", lineHeight: 1.55, color: "var(--color-3d2200)", whiteSpace: "pre-wrap" };
