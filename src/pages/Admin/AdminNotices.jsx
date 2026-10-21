import { useEffect, useState } from "react";
import { db } from "../../firebase";
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, where } from "firebase/firestore";
import { useModulePermissions } from "../../hooks/usePermissions";
import {
  INPUT_TYPES,
  INPUT_TYPE_BY_VALUE,
  OPTION_TYPES,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_OPTION_LENGTH,
  MAX_FIELDS,
  MAX_LABEL_LENGTH,
  blankField,
  fieldsOf,
  formFromNotice,
  inputFieldsForSave,
  noticeHasInput,
  answerFor,
  summarizeField,
  validateInputConfig,
  withFieldType,
} from "../../utils/noticeInputs";

const blankForm = { title: "", details: "", buttonEnabled: false, buttonText: "", buttonType: "url", buttonValue: "", active: true, pinned: false, audience: "all", inputEnabled: false, inputFields: [blankField("text")], inputMessage: "", inputButtonText: "" };

export default function AdminNotices() {
  const perms = useModulePermissions("notices");
  const [notices, setNotices] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(blankForm);
  const [viewingSubmissions, setViewingSubmissions] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);

  const [userMap, setUserMap] = useState({});
  const [viewingStats, setViewingStats] = useState(null);
  const [statsLogs, setStatsLogs] = useState([]);
  const [loadingStats, setLoadingStats] = useState(false);

  const loadNotices = async () => {
    const snap = await getDocs(collection(db, "notices"));
    const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    data.sort((a, b) => (b.pinned === true) - (a.pinned === true));
    setNotices(data);
  };

  useEffect(() => { loadNotices(); }, []);

  useEffect(() => {
    async function loadUsers() {
      try {
        const snap = await getDocs(collection(db, "users"));
        const map = {};
        snap.docs.forEach((d) => {
          const data = d.data();
          map[d.id] = data.name || data.fullName || data.email || d.id;
        });
        setUserMap(map);
      } catch (error) {
        console.error("Could not load users:", error);
      }
    }
    loadUsers();
  }, []);

  const openCreate = () => { setEditing(null); setForm(blankForm); setShowForm(true); };
  const openEdit = (n) => { setEditing(n); setForm({ ...blankForm, ...n, ...formFromNotice(n) }); setShowForm(true); };
  const closeForm = () => { setShowForm(false); setEditing(null); };

  const handleSave = async () => {
    if (!perms.requireEdit()) return;
    if (!form.title || !form.details) return alert("Title and details are required.");
    const inputError = validateInputConfig(form);
    if (inputError) return alert(inputError);
    const payload = { ...form, ...inputFieldsForSave(form) };
    if (editing) await updateDoc(doc(db, "notices", editing.id), payload);
    else await addDoc(collection(db, "notices"), { ...payload, createdAt: serverTimestamp() });
    closeForm(); loadNotices();
  };

  const handleDelete = async (id) => {
    if (!perms.requireDelete()) return;
    if (!window.confirm("Delete this notice?")) return;
    await deleteDoc(doc(db, "notices", id));
    const subsSnap = await getDocs(query(collection(db, "noticeSubmissions"), where("noticeId", "==", id)));
    await Promise.all(subsSnap.docs.map((d) => deleteDoc(doc(db, "noticeSubmissions", d.id))));
    loadNotices();
  };
  const toggleActive = async (n) => { if (!perms.requireEdit()) return; await updateDoc(doc(db, "notices", n.id), { active: !n.active }); loadNotices(); };
  const togglePin = async (n) => { if (!perms.requireEdit()) return; await updateDoc(doc(db, "notices", n.id), { pinned: !n.pinned }); loadNotices(); };

  const openSubmissions = async (n) => {
    setViewingSubmissions(n);
    setLoadingSubmissions(true);
    try {
      const snap = await getDocs(query(collection(db, "noticeSubmissions"), where("noticeId", "==", n.id)));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setSubmissions(data);
    } catch (err) {
      console.error("Error loading submissions:", err);
      setSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };
  const closeSubmissions = () => { setViewingSubmissions(null); setSubmissions([]); };

  const openStats = async (n) => {
    setViewingStats(n);
    setLoadingStats(true);
    try {
      const snap = await getDocs(query(collection(db, "logs"), where("noticeId", "==", n.id)));
      const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setStatsLogs(data);
    } catch (error) {
      console.error("Error loading notice stats:", error);
      setStatsLogs([]);
    } finally {
      setLoadingStats(false);
    }
  };
  const closeStats = () => { setViewingStats(null); setStatsLogs([]); };

  const updateField = (id, patch) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id ? { ...fl, ...patch } : fl)) }));
  const changeFieldType = (id, type) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id ? withFieldType(fl, type) : fl)) }));
  const addField = () => setForm((cur) => (cur.inputFields.length >= MAX_FIELDS ? cur : { ...cur, inputFields: [...cur.inputFields, blankField("text")] }));
  const removeField = (id) => setForm((cur) => (cur.inputFields.length <= 1 ? cur : { ...cur, inputFields: cur.inputFields.filter((fl) => fl.id !== id) }));
  const moveField = (id, dir) => setForm((cur) => {
    const i = cur.inputFields.findIndex((fl) => fl.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cur.inputFields.length) return cur;
    const next = [...cur.inputFields];
    [next[i], next[j]] = [next[j], next[i]];
    return { ...cur, inputFields: next };
  });
  const setFieldOption = (id, i, value) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id ? { ...fl, options: fl.options.map((o, j) => (j === i ? value : o)) } : fl)) }));
  const addFieldOption = (id) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id && fl.options.length < MAX_OPTIONS ? { ...fl, options: [...fl.options, ""] } : fl)) }));
  const removeFieldOption = (id, i) => setForm((cur) => ({ ...cur, inputFields: cur.inputFields.map((fl) => (fl.id === id && fl.options.length > MIN_OPTIONS ? { ...fl, options: fl.options.filter((_, j) => j !== i) } : fl)) }));

  const f = (k) => (e) => setForm({ ...form, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });

  const whoLabel = (entry) => {
    if (entry.userId && userMap[entry.userId]) return userMap[entry.userId];
    if (entry.email) return entry.email;
    return "Guest";
  };

  return (
    <div style={page}>
      <div style={topRow}>
        <div>
          <h1 style={pageTitle}>Notices</h1>
          <p style={pageSubtitle}>Manage announcements shown to app users.</p>
        </div>
        {perms.canEdit && <button style={addBtn} onClick={openCreate}>+ New Notice</button>}
      </div>

      {/* MODAL FORM */}
      {showForm && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>{editing ? "Edit Notice" : "Create Notice"}</h2>

            <Field label="Title"><input value={form.title} onChange={f("title")} style={input} placeholder="Notice title" /></Field>
            <Field label="Details"><textarea value={form.details} onChange={f("details")} style={{ ...input, height: "90px", resize: "vertical" }} placeholder="Details…" /></Field>

            <Field label="Audience">
              <select value={form.audience} onChange={f("audience")} style={input}>
                <option value="all">All</option>
                <option value="users">Signed-in users</option>
                <option value="admins">Admins only</option>
                <option value="guests">Guests only</option>
              </select>
            </Field>

            <div style={checkRow}>
              <label style={checkLabel}><input type="checkbox" checked={form.buttonEnabled} onChange={f("buttonEnabled")} /> Enable action button</label>
              <label style={checkLabel}><input type="checkbox" checked={form.active} onChange={f("active")} /> Active</label>
              <label style={checkLabel}><input type="checkbox" checked={form.pinned} onChange={f("pinned")} /> Pin to top</label>
            </div>

            {form.buttonEnabled && (
              <>
                <Field label="Button Text"><input value={form.buttonText} onChange={f("buttonText")} style={input} placeholder="e.g. Learn More" /></Field>
                <Field label="Button Type">
                  <select value={form.buttonType} onChange={f("buttonType")} style={input}>
                    <option value="url">External URL</option>
                    <option value="page">Internal Page</option>
                  </select>
                </Field>
                <Field label="URL or Path"><input value={form.buttonValue} onChange={f("buttonValue")} style={input} placeholder="https://… or /page" /></Field>
              </>
            )}

            <div style={checkRow}>
              <label style={checkLabel}><input type="checkbox" checked={form.inputEnabled} onChange={f("inputEnabled")} /> Input (collect submissions)</label>
            </div>

            {form.inputEnabled && (
              <>
                <Field label="Intro Message (optional)">
                  <textarea value={form.inputMessage} onChange={f("inputMessage")} style={{ ...input, height: "70px", resize: "vertical" }} placeholder="e.g. Tell us a little about yourself so we can follow up." />
                </Field>

                <div style={fieldEditorList}>
                  {form.inputFields.map((fl, idx) => (
                    <div key={fl.id} style={fieldEditorCard}>
                      <div style={fieldEditorHead}>
                        <strong style={fieldEditorTitle}>Field {idx + 1}</strong>
                        <div style={fieldEditorTools}>
                          <button type="button" style={toolBtn} onClick={() => moveField(fl.id, -1)} disabled={idx === 0} aria-label={`Move field ${idx + 1} up`}>▲</button>
                          <button type="button" style={toolBtn} onClick={() => moveField(fl.id, 1)} disabled={idx === form.inputFields.length - 1} aria-label={`Move field ${idx + 1} down`}>▼</button>
                          {form.inputFields.length > 1 && (
                            <button type="button" style={{ ...toolBtn, color: "var(--color-dc2626)", borderColor: "var(--color-fca5a5)" }} onClick={() => removeField(fl.id)} aria-label={`Remove field ${idx + 1}`}>✕</button>
                          )}
                        </div>
                      </div>

                      <Field label="Label">
                        <input value={fl.label} onChange={(e) => updateField(fl.id, { label: e.target.value })} maxLength={MAX_LABEL_LENGTH} style={input} placeholder={fieldLabelPlaceholder(fl.type)} />
                      </Field>

                      <div style={twoCol}>
                        <Field label="Type">
                          <select value={fl.type} onChange={(e) => changeFieldType(fl.id, e.target.value)} style={input}>
                            {INPUT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
                          </select>
                        </Field>
                        <Field label="Required?">
                          <label style={{ ...checkLabel, padding: "9px 0" }}>
                            <input type="checkbox" checked={fl.required !== false} onChange={(e) => updateField(fl.id, { required: e.target.checked })} /> Must be answered
                          </label>
                        </Field>
                      </div>
                      <span style={typeHint}>{INPUT_TYPE_BY_VALUE[fl.type]?.hint}</span>

                      {OPTION_TYPES.has(fl.type) && (
                        <Field label={fl.type === "prefer" ? "The two options" : `Options (${MIN_OPTIONS}–${MAX_OPTIONS})`}>
                          <div style={optionList}>
                            {fl.options.map((opt, i) => (
                              <div key={i} style={optionRow}>
                                <input
                                  value={opt}
                                  onChange={(e) => setFieldOption(fl.id, i, e.target.value)}
                                  maxLength={MAX_OPTION_LENGTH}
                                  style={input}
                                  placeholder={fl.type === "prefer" ? (i === 0 ? "Option A, e.g. Hymns" : "Option B, e.g. Modern songs") : `Option ${i + 1}`}
                                  aria-label={`Field ${idx + 1} option ${i + 1}`}
                                />
                                {fl.type !== "prefer" && fl.options.length > MIN_OPTIONS && (
                                  <button type="button" style={removeOptBtn} onClick={() => removeFieldOption(fl.id, i)} aria-label={`Remove option ${i + 1}`}>✕</button>
                                )}
                              </div>
                            ))}
                            {fl.type !== "prefer" && fl.options.length < MAX_OPTIONS && (
                              <button type="button" style={addOptBtn} onClick={() => addFieldOption(fl.id)}>+ Add option</button>
                            )}
                          </div>
                        </Field>
                      )}

                      {fl.type === "scale" && (
                        <div style={twoCol}>
                          <Field label="Low end label"><input value={fl.scaleLow} onChange={(e) => updateField(fl.id, { scaleLow: e.target.value })} style={input} placeholder="e.g. Not likely" /></Field>
                          <Field label="High end label"><input value={fl.scaleHigh} onChange={(e) => updateField(fl.id, { scaleHigh: e.target.value })} style={input} placeholder="e.g. Very likely" /></Field>
                        </div>
                      )}

                      {["text", "longtext", "phone", "email"].includes(fl.type) && (
                        <Field label="Placeholder (optional)"><input value={fl.placeholder} onChange={(e) => updateField(fl.id, { placeholder: e.target.value })} style={input} placeholder={fl.type === "phone" ? "e.g. (555) 123-4567" : fl.type === "email" ? "e.g. you@email.com" : "e.g. Type here"} /></Field>
                      )}
                    </div>
                  ))}
                  {form.inputFields.length < MAX_FIELDS && (
                    <button type="button" style={addFieldBtn} onClick={addField}>+ Add another field</button>
                  )}
                </div>

                <Field label="Submit Button Text"><input value={form.inputButtonText} onChange={f("inputButtonText")} style={input} placeholder="e.g. Submit" /></Field>
              </>
            )}

            <div style={modalActions}>
              <button style={saveBtn} onClick={handleSave}>Save</button>
              <button style={cancelBtn} onClick={closeForm}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* LIST */}
      {notices.map((n) => (
        <div key={n.id} style={card}>
          <div style={cardBody}>
            <div style={cardTitleRow}>
              <span style={cardTitle}>{n.title}</span>
              <div style={badgeRow}>
                {n.pinned && <Badge color="var(--color-e8f0fe)" text="var(--color-2a5ab5)" label="Pinned" />}
                {n.active ? <Badge color="var(--color-dcfce7)" text="var(--color-166534)" label="Active" /> : <Badge color="var(--color-fee2e2)" text="var(--color-991b1b)" label="Disabled" />}
                <Badge color="var(--color-f6e4b0)" text="var(--color-7a5a10)" label={n.audience === "all" ? "Everyone" : n.audience === "users" ? "Users" : n.audience === "admins" ? "Admins" : "Guests"} />
              </div>
            </div>
            <p style={cardDetails}>{n.details}</p>
          </div>
          <div style={cardActions}>
            {perms.canEdit && (
              <>
                <button style={actionBtn} onClick={() => openEdit(n)}>Edit</button>
                <button style={actionBtn} onClick={() => toggleActive(n)}>{n.active ? "Disable" : "Enable"}</button>
                <button style={actionBtn} onClick={() => togglePin(n)}>{n.pinned ? "Unpin" : "Pin"}</button>
              </>
            )}
            <button style={actionBtn} onClick={() => openStats(n)}>Stats</button>
            {noticeHasInput(n) && <button style={actionBtn} onClick={() => openSubmissions(n)}>{fieldsOf(n).some((fl) => OPTION_TYPES.has(fl.type) || ["rating", "scale", "yesno", "emoji", "rsvp"].includes(fl.type)) ? "Results" : "Submissions"}</button>}
            {perms.canDelete && (
              <button style={{ ...actionBtn, color: "var(--color-dc2626)", borderColor: "var(--color-fca5a5)" }} onClick={() => handleDelete(n.id)}>Delete</button>
            )}
          </div>
        </div>
      ))}

      {notices.length === 0 && <p style={empty}>No notices yet. Create one above.</p>}

      {/* SUBMISSIONS MODAL */}
      {viewingSubmissions && (
        <div style={modalBg}>
          <div style={modal}>
            <h2 style={modalTitle}>Submissions — {viewingSubmissions.title}</h2>
            <p style={pageSubtitle}>Submissions ({submissions.length})</p>

            {loadingSubmissions && <p style={empty}>Loading…</p>}

            {!loadingSubmissions && submissions.length === 0 && (
              <p style={empty}>No submissions yet.</p>
            )}

            {!loadingSubmissions && <SubmissionSummary notice={viewingSubmissions} submissions={submissions} />}

            {!loadingSubmissions && submissions.map((s) => (
              <div key={s.id} style={submissionRow}>
                {Array.isArray(s.answers) && s.answers.length > 1 ? (
                  <span style={submissionValue}>
                    {s.answers.map((a) => (
                      <span key={a.id} style={answerLine}><span style={answerLabel}>{a.label || "Answer"}:</span> {a.value}</span>
                    ))}
                  </span>
                ) : (
                  <span style={submissionValue}>{s.value}</span>
                )}
                <span style={submissionMeta}>
                  {s.userEmail ? `${s.userEmail} · ` : ""}
                  {s.createdAt?.seconds ? new Date(s.createdAt.seconds * 1000).toLocaleString() : "—"}
                </span>
              </div>
            ))}

            <div style={modalActions}>
              <button style={cancelBtn} onClick={closeSubmissions}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* STATS MODAL */}
      {viewingStats && (() => {
        const views = statsLogs.filter((l) => l.event === "notice_view");
        const clicks = statsLogs.filter((l) => l.event === "notice_click");
        const uniqueCount = (entries) => new Set(entries.map((e) => e.userId || e.visitorId || e.id)).size;

        return (
          <div style={modalBg}>
            <div style={modal}>
              <h2 style={modalTitle}>Stats — {viewingStats.title}</h2>

              {loadingStats && <p style={empty}>Loading…</p>}

              {!loadingStats && (
                <>
                  <div style={statsSummaryRow}>
                    <StatBlock label="Reads" total={views.length} unique={uniqueCount(views)} />
                    <StatBlock label="Clicks" total={clicks.length} unique={uniqueCount(clicks)} />
                  </div>

                  <StatsSection title="Who read it" entries={views} whoLabel={whoLabel} />
                  <StatsSection title="Who clicked it" entries={clicks} whoLabel={whoLabel} />
                </>
              )}

              <div style={modalActions}>
                <button style={cancelBtn} onClick={closeStats}>Close</button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function fieldLabelPlaceholder(type) {
  switch (type) {
    case "poll": return "e.g. What should our next potluck theme be?";
    case "multi": return "e.g. Which topics would you like covered?";
    case "prefer": return "e.g. Which do you prefer on Sunday mornings?";
    case "rating": return "e.g. How would you rate this sermon series?";
    case "scale": return "e.g. How likely are you to invite a friend?";
    case "yesno": return "e.g. Will you join us this Sunday?";
    case "emoji": return "e.g. How did you like the new app update?";
    case "rsvp": return "e.g. Are you coming to the picnic?";
    case "phone": return "e.g. Phone number";
    case "email": return "e.g. Email address";
    case "longtext": return "e.g. Prayer request or feedback";
    default: return "e.g. Your name";
  }
}

// Tally bars for choice / rating answers, one block per field (free-text
// answers just list below).
function SubmissionSummary({ notice, submissions }) {
  const fields = fieldsOf(notice);
  const blocks = fields
    .map((field) => {
      const answers = submissions.map((s) => answerFor(s, field, fields)).filter(Boolean);
      return { field, summary: summarizeField(field, answers) };
    })
    .filter((b) => b.summary);
  if (blocks.length === 0) return null;
  return (
    <>
      {blocks.map(({ field, summary }) => (
        <div key={field.id} style={summaryBox}>
          {field.label && <div style={summaryFieldTitle}>{field.label}</div>}
          {summary.kind === "average" && (
            <div style={summaryHeadline}>Average: <strong>{summary.average.toFixed(1)}</strong> / {summary.max} <span style={summaryMuted}>({summary.total} {summary.total === 1 ? "response" : "responses"})</span></div>
          )}
          {summary.kind === "choices" && (
            <div style={summaryHeadline}><strong>{summary.total}</strong> {summary.total === 1 ? "response" : "responses"}</div>
          )}
          {summary.rows.map((row) => (
            <div key={row.label} style={barRow}>
              <span style={barLabel}>{row.label}</span>
              <div style={barTrack}><div style={{ ...barFill, width: `${row.percent}%` }} /></div>
              <span style={barCount}>{row.count} · {row.percent}%</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}

function Field({ label, children }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}><label style={fieldLabel}>{label}</label>{children}</div>;
}

function Badge({ color, text, label }) {
  return <span style={{ fontSize: "11px", padding: "3px 8px", borderRadius: "999px", background: color, color: text, fontFamily: "sans-serif" }}>{label}</span>;
}

function StatBlock({ label, total, unique }) {
  return (
    <div style={statBlock}>
      <div style={statNumber}>{total}</div>
      <div style={statLabel}>{label}</div>
      <div style={statSub}>{unique} unique {unique === 1 ? "person" : "people"}</div>
    </div>
  );
}

function StatsSection({ title, entries, whoLabel }) {
  return (
    <div style={statsSection}>
      <p style={statsSectionTitle}>{title} ({entries.length})</p>
      {entries.length === 0 && <p style={empty}>Nobody yet.</p>}
      {entries.map((e) => (
        <div key={e.id} style={submissionRow}>
          <span style={submissionValue}>{whoLabel(e)}</span>
          <span style={submissionMeta}>
            {e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleString() : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}

const page = { maxWidth: "860px" };
const topRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "var(--color-3d2200)", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "var(--color-9b7040)", fontFamily: "sans-serif", margin: 0 };
const addBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)", whiteSpace: "nowrap" };

const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, padding: "20px" };
const modal = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "20px", padding: "28px", width: "100%", maxWidth: "440px", display: "flex", flexDirection: "column", gap: "14px", maxHeight: "90vh", overflowY: "auto" };
const modalTitle = { fontSize: "20px", fontWeight: "normal", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif", margin: 0 };
const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "var(--color-9b7040)", letterSpacing: "0.06em", textTransform: "uppercase" };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", fontSize: "14px", fontFamily: "sans-serif", color: "var(--color-3d2200)", outline: "none", width: "100%", boxSizing: "border-box" };
const checkRow = { display: "flex", gap: "16px", flexWrap: "wrap" };
const checkLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "var(--color-5c3a1e)", cursor: "pointer" };
const modalActions = { display: "flex", gap: "10px", marginTop: "4px" };
const saveBtn = { flex: 1, padding: "11px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, var(--color-c97c2e), var(--color-a85e18))", color: "var(--color-fff8ee)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const cancelBtn = { flex: 1, padding: "11px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "transparent", color: "var(--color-7a4f10)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };

const card = { background: "var(--color-fffdf9)", border: "1px solid var(--color-eddfc8)", borderRadius: "16px", padding: "18px 20px", marginBottom: "12px", boxShadow: "0 2px 10px rgba(160,100,40,0.06)" };
const cardBody = { marginBottom: "14px" };
const cardTitleRow = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px", flexWrap: "wrap" };
const cardTitle = { fontSize: "16px", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" };
const badgeRow = { display: "flex", gap: "6px", flexWrap: "wrap" };
const cardDetails = { fontSize: "13px", color: "var(--color-7a5530)", fontFamily: "sans-serif", lineHeight: 1.6, margin: 0 };
const cardActions = { display: "flex", gap: "8px", flexWrap: "wrap", borderTop: "1px solid var(--color-f0e4d0)", paddingTop: "12px" };
const actionBtn = { padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "transparent", color: "var(--color-5c3a1e)", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const empty = { textAlign: "center", color: "var(--color-b08050)", fontFamily: "sans-serif", fontStyle: "italic", padding: "40px 0" };
const submissionRow = { display: "flex", flexDirection: "column", gap: "3px", padding: "10px 0", borderBottom: "1px solid var(--color-f0e4d0)" };
const submissionValue = { fontSize: "14px", color: "var(--color-3d2200)", fontFamily: "sans-serif", wordBreak: "break-word" };
const submissionMeta = { fontSize: "11px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };

const statsSummaryRow = { display: "flex", gap: "12px" };
const statBlock = { flex: 1, background: "var(--color-fdf8f3)", border: "1px solid var(--color-eddfc8)", borderRadius: "12px", padding: "14px", textAlign: "center" };
const statNumber = { fontSize: "26px", color: "var(--color-3d2200)", fontFamily: "'Georgia', serif" };
const statLabel = { fontSize: "12px", color: "var(--color-7a5530)", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "0.04em", margin: "2px 0" };
const statSub = { fontSize: "11px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const statsSection = { marginTop: "8px" };
const statsSectionTitle = { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 4px" };
const typeHint = { fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const optionList = { display: "flex", flexDirection: "column", gap: "8px" };
const optionRow = { display: "flex", gap: "8px", alignItems: "center" };
const removeOptBtn = { width: "34px", height: "34px", flexShrink: 0, borderRadius: "8px", border: "1px solid var(--color-fca5a5)", background: "var(--color-fdf8f3)", color: "var(--color-dc2626)", cursor: "pointer" };
const addOptBtn = { alignSelf: "flex-start", padding: "7px 14px", borderRadius: "999px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const twoCol = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const summaryBox = { margin: "10px 0 14px", padding: "14px", borderRadius: "12px", background: "var(--color-fdf8f3)", border: "1px solid var(--color-eddfc8)", display: "flex", flexDirection: "column", gap: "8px" };
const summaryHeadline = { fontSize: "14px", color: "var(--color-3d2200)", fontFamily: "sans-serif" };
const summaryMuted = { color: "var(--color-9b7040)", fontSize: "12px" };
const barRow = { display: "grid", gridTemplateColumns: "minmax(60px, 140px) 1fr auto", gap: "10px", alignItems: "center", fontFamily: "sans-serif", fontSize: "13px", color: "var(--color-5c3a1e)" };
const barLabel = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const barTrack = { height: "10px", borderRadius: "999px", background: "var(--color-eddfc8)", overflow: "hidden" };
const barFill = { height: "100%", background: "linear-gradient(to right, var(--color-e08930), var(--color-c97c2e))", borderRadius: "999px" };
const barCount = { fontSize: "12px", color: "var(--color-9b7040)", whiteSpace: "nowrap" };

const fieldEditorList = { display: "flex", flexDirection: "column", gap: "12px" };
const fieldEditorCard = { display: "flex", flexDirection: "column", gap: "10px", padding: "14px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)" };
const fieldEditorHead = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" };
const fieldEditorTitle = { fontSize: "13px", color: "var(--color-5c3a1e)", fontFamily: "sans-serif" };
const fieldEditorTools = { display: "flex", gap: "6px" };
const toolBtn = { width: "30px", height: "30px", borderRadius: "8px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)", color: "var(--color-7a4f10)", cursor: "pointer", fontSize: "12px" };
const addFieldBtn = { padding: "10px 16px", borderRadius: "12px", border: "1px dashed var(--color-c97c2e)", background: "none", color: "var(--color-7a4f10)", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer" };
const summaryFieldTitle = { fontSize: "13px", fontWeight: "600", color: "var(--color-5c3a1e)", fontFamily: "sans-serif" };
const answerLine = { display: "block" };
const answerLabel = { color: "var(--color-9b7040)" };
