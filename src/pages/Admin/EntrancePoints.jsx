import { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { db } from "../../firebase";

const defaultForm = {
  name: "",
  source: "",
  medium: "",
  campaign: "",
  content: "",
  term: "",
  utmId: "",
  type: "Other",
  description: "",
  createdDate: "",
  campaignStartDate: "",
  notes: "",
  destinationUrl: "",
};

const sourceTypes = [
  "Social Media",
  "QR Code",
  "Printed Flyer",
  "Website",
  "Email",
  "Advertisement",
  "Church Bulletin",
  "Other",
];

function formatDate(value) {
  if (!value) return "—";

  if (value?.seconds) {
    return new Date(value.seconds * 1000).toLocaleDateString();
  }

  return new Date(value).toLocaleDateString();
}

function formatDateTime(value) {
  if (!value) return "—";

  if (value?.seconds) {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  return new Date(value).toLocaleString();
}

function getTrackingUrl(point) {
  const base =
    point.destinationUrl ||
    window.location.origin + "/";

  try {
    const url = new URL(base);

    if (point.source) {
      url.searchParams.set("utm_source", point.source);
    }

    if (point.medium) {
      url.searchParams.set("utm_medium", point.medium);
    }

    if (point.campaign) {
      url.searchParams.set("utm_campaign", point.campaign);
    }

    if (point.content) {
      url.searchParams.set("utm_content", point.content);
    }

    if (point.term) {
      url.searchParams.set("utm_term", point.term);
    }

    if (point.utmId) {
      url.searchParams.set("utm_id", point.utmId);
    }

    return url.toString();
  } catch {
    return `${window.location.origin}/?utm_source=${encodeURIComponent(
      point.source || ""
    )}`;
  }
}

export default function EntrancePoints() {
  const [points, setPoints] = useState([]);
  const [logs, setLogs] = useState([]);

  const [showCreate, setShowCreate] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState(null);

  const [form, setForm] = useState(defaultForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  //////////////////////////////////////////////////
  // LOAD ENTRANCE POINTS
  //////////////////////////////////////////////////

  useEffect(() => {
    const q = query(
      collection(db, "entrancePoints"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      setPoints(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );

      setLoading(false);
    });
  }, []);

  //////////////////////////////////////////////////
  // LOAD LOGS
  //////////////////////////////////////////////////

  useEffect(() => {
    const q = query(
      collection(db, "logs"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(q, (snapshot) => {
      setLogs(
        snapshot.docs.map((item) => ({
          id: item.id,
          ...item.data(),
        }))
      );
    });
  }, []);

  //////////////////////////////////////////////////
  // CREATE
  //////////////////////////////////////////////////

  async function createPoint(e) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Please enter a name.");
      return;
    }

    if (!form.source.trim()) {
      alert("Please enter a UTM source.");
      return;
    }

    setSaving(true);

    try {
      await addDoc(collection(db, "entrancePoints"), {
        name: form.name.trim(),

        source: form.source.trim(),
        medium: form.medium.trim() || null,
        campaign: form.campaign.trim() || null,
        content: form.content.trim() || null,
        term: form.term.trim() || null,
        utmId: form.utmId.trim() || null,

        type: form.type,

        description:
          form.description.trim() || null,

        createdDate:
          form.createdDate || null,

        campaignStartDate:
          form.campaignStartDate || null,

        notes:
          form.notes.trim() || null,

        destinationUrl:
          form.destinationUrl.trim() || null,

        active: true,

        createdAt: serverTimestamp(),

        visitCount: 0,
        uniqueVisitorCount: 0,
        sessionCount: 0,
        registeredUserCount: 0,
      });

      setForm({
        ...defaultForm,
        createdDate: new Date()
          .toISOString()
          .split("T")[0],
      });

      setShowCreate(false);
    } catch (error) {
      console.error(error);
      alert("Could not create the entrance point.");
    } finally {
      setSaving(false);
    }
  }

  //////////////////////////////////////////////////
  // DISABLE
  //////////////////////////////////////////////////

  async function disablePoint(point) {
    const confirmed = window.confirm(
      `Disable "${point.name}"?`
    );

    if (!confirmed) return;

    try {
      await updateDoc(
        doc(db, "entrancePoints", point.id),
        {
          active: false,
          disabledAt: serverTimestamp(),
        }
      );
    } catch (error) {
      console.error(error);
      alert("Could not disable this entrance point.");
    }
  }

  //////////////////////////////////////////////////
  // STATISTICS
  //////////////////////////////////////////////////

  const statistics = useMemo(() => {
    const result = {};

    points.forEach((point) => {
      result[point.id] = {
        visits: 0,
        visitors: new Set(),
        sessions: new Set(),
        users: new Set(),
        lastVisit: null,
        pwaInstalls: 0,
      };
    });

    logs.forEach((log) => {
      const source =
        log.latestTrafficSource ||
        log.firstTrafficSource;

      if (!source) return;

      const matchingPoints = points.filter(
        (point) =>
          point.source?.toLowerCase() ===
          source.toLowerCase()
      );

      matchingPoints.forEach((point) => {
        if (!result[point.id]) return;

        if (
          log.event === "app_opened" ||
          log.event === "session_start"
        ) {
          result[point.id].visits += 1;
        }

        if (log.visitorId) {
          result[point.id].visitors.add(
            log.visitorId
          );
        }

        if (log.sessionId) {
          result[point.id].sessions.add(
            log.sessionId
          );
        }

        if (log.userId) {
          result[point.id].users.add(
            log.userId
          );
        }

        if (log.event === "pwa_installed") {
          result[point.id].pwaInstalls += 1;
        }

        if (log.createdAt) {
          const currentTime =
            log.createdAt.seconds || 0;

          const previousTime =
            result[point.id].lastVisit?.seconds ||
            0;

          if (currentTime > previousTime) {
            result[point.id].lastVisit =
              log.createdAt;
          }
        }
      });
    });

    return result;
  }, [points, logs]);

  //////////////////////////////////////////////////
  // QR CODE
  //////////////////////////////////////////////////

  function showQrCode(point) {
    const url = getTrackingUrl(point);

    const qrUrl =
      `https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=` +
      encodeURIComponent(url);

    window.open(qrUrl, "_blank");
  }

  //////////////////////////////////////////////////
  // COPY
  //////////////////////////////////////////////////

  async function copyUrl(point) {
    const url = getTrackingUrl(point);

    await navigator.clipboard.writeText(url);

    alert("Tracking URL copied!");
  }

  //////////////////////////////////////////////////
  // FORM FIELD
  //////////////////////////////////////////////////

  function updateForm(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  //////////////////////////////////////////////////
  // RENDER
  //////////////////////////////////////////////////

  return (
    <div style={page}>
      <div style={header}>
        <div>
          <h1 style={title}>Entrance Points</h1>

          <p style={subtitle}>
            Track where visitors are coming from.
          </p>
        </div>

        <button
          style={addButton}
          onClick={() => {
            setForm({
              ...defaultForm,
              createdDate: new Date()
                .toISOString()
                .split("T")[0],
            });

            setShowCreate(true);
          }}
        >
          +
        </button>
      </div>

      {loading && (
        <div style={empty}>
          Loading entrance points...
        </div>
      )}

      {!loading && points.length === 0 && (
        <div style={empty}>
          <div style={emptyIcon}>🔗</div>

          <h2>No entrance points yet</h2>

          <p>
            Create one to start tracking visitors.
          </p>

          <button
            style={primaryButton}
            onClick={() => setShowCreate(true)}
          >
            Create Entrance Point
          </button>
        </div>
      )}

      <div style={grid}>
        {points.map((point) => {
          const stats =
            statistics[point.id] || {
              visits: 0,
              visitors: new Set(),
              sessions: new Set(),
              users: new Set(),
              lastVisit: null,
              pwaInstalls: 0,
            };

          return (
            <div
              key={point.id}
              style={{
                ...card,
                opacity: point.active ? 1 : 0.65,
              }}
            >
              <div style={cardTop}>
                <div>
                  <div style={typeBadge}>
                    {point.type || "Other"}
                  </div>

                  <h2 style={cardTitle}>
                    {point.name}
                  </h2>

                  <div style={sourceText}>
                    utm_source={point.source}
                  </div>
                </div>

                <div
                  style={{
                    ...status,
                    background: point.active
                      ? "#e7f6e9"
                      : "#f3e5e5",
                    color: point.active
                      ? "#286a31"
                      : "#8a3d3d",
                  }}
                >
                  {point.active
                    ? "Active"
                    : "Disabled"}
                </div>
              </div>

              <div style={statsGrid}>
                <div style={stat}>
                  <strong>
                    {stats.visits}
                  </strong>

                  <span>Visits</span>
                </div>

                <div style={stat}>
                  <strong>
                    {stats.visitors.size}
                  </strong>

                  <span>
                    Unique Visitors
                  </span>
                </div>

                <div style={stat}>
                  <strong>
                    {stats.sessions.size}
                  </strong>

                  <span>Sessions</span>
                </div>

                <div style={stat}>
                  <strong>
                    {stats.users.size}
                  </strong>

                  <span>Users</span>
                </div>
              </div>

              <div style={cardDetails}>
                <div>
                  <span>Created</span>
                  <strong>
                    {formatDate(
                      point.createdDate
                    )}
                  </strong>
                </div>

                <div>
                  <span>Last Visit</span>
                  <strong>
                    {formatDateTime(
                      stats.lastVisit
                    )}
                  </strong>
                </div>
              </div>

              <div style={cardActions}>
                <button
                  style={secondaryButton}
                  onClick={() =>
                    setSelectedPoint(point)
                  }
                >
                  Details
                </button>

                <button
                  style={secondaryButton}
                  onClick={() =>
                    copyUrl(point)
                  }
                >
                  Copy URL
                </button>

                <button
                  style={secondaryButton}
                  onClick={() =>
                    showQrCode(point)
                  }
                >
                  QR Code
                </button>

                {point.active && (
                  <button
                    style={dangerButton}
                    onClick={() =>
                      disablePoint(point)
                    }
                  >
                    Disable
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* CREATE MODAL */}

      {showCreate && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>
                  Create Entrance Point
                </h2>

                <p style={modalSubtitle}>
                  Create a UTM tracking link.
                </p>
              </div>

              <button
                style={closeButton}
                onClick={() =>
                  setShowCreate(false)
                }
              >
                ×
              </button>
            </div>

            <form
              onSubmit={createPoint}
              style={form}
            >
              <Field
                label="Name"
                required
                value={form.name}
                onChange={(value) =>
                  updateForm("name", value)
                }
                placeholder="Facebook"
              />

              <Field
                label="UTM Source"
                required
                value={form.source}
                onChange={(value) =>
                  updateForm("source", value)
                }
                placeholder="facebook"
              />

              <Field
                label="UTM Medium"
                value={form.medium}
                onChange={(value) =>
                  updateForm("medium", value)
                }
                placeholder="social"
              />

              <Field
                label="UTM Campaign"
                value={form.campaign}
                onChange={(value) =>
                  updateForm("campaign", value)
                }
                placeholder="summer-2026"
              />

              <Field
                label="UTM Content"
                value={form.content}
                onChange={(value) =>
                  updateForm("content", value)
                }
                placeholder="post-1"
              />

              <Field
                label="UTM Term"
                value={form.term}
                onChange={(value) =>
                  updateForm("term", value)
                }
                placeholder="Optional"
              />

              <Field
                label="UTM ID"
                value={form.utmId}
                onChange={(value) =>
                  updateForm("utmId", value)
                }
                placeholder="Optional"
              />

              <div style={field}>
                <label style={label}>
                  Type
                </label>

                <select
                  value={form.type}
                  onChange={(e) =>
                    updateForm(
                      "type",
                      e.target.value
                    )
                  }
                  style={input}
                >
                  {sourceTypes.map((type) => (
                    <option key={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <Field
                label="Description"
                value={form.description}
                onChange={(value) =>
                  updateForm(
                    "description",
                    value
                  )
                }
                placeholder="Facebook page link"
              />

              <div style={field}>
                <label style={label}>
                  Creation Date
                </label>

                <input
                  type="date"
                  value={form.createdDate}
                  onChange={(e) =>
                    updateForm(
                      "createdDate",
                      e.target.value
                    )
                  }
                  style={input}
                />
              </div>

              <div style={field}>
                <label style={label}>
                  Campaign Start Date
                </label>

                <input
                  type="date"
                  value={form.campaignStartDate}
                  onChange={(e) =>
                    updateForm(
                      "campaignStartDate",
                      e.target.value
                    )
                  }
                  style={input}
                />
              </div>

              <Field
                label="Destination URL"
                value={form.destinationUrl}
                onChange={(value) =>
                  updateForm(
                    "destinationUrl",
                    value
                  )
                }
                placeholder={window.location.origin + "/"}
              />

              <div style={field}>
                <label style={label}>
                  Notes
                </label>

                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    updateForm(
                      "notes",
                      e.target.value
                    )
                  }
                  style={{
                    ...input,
                    minHeight: "100px",
                    resize: "vertical",
                  }}
                  placeholder="Anything else about this entrance point..."
                />
              </div>

              <div style={urlPreview}>
                <span>
                  Your tracking URL will look like:
                </span>

                <code>
                  {window.location.origin}/
                  ?utm_source=
                  {form.source || "example"}
                  {form.medium
                    ? `&utm_medium=${form.medium}`
                    : ""}
                  {form.campaign
                    ? `&utm_campaign=${form.campaign}`
                    : ""}
                </code>
              </div>

              <div style={formActions}>
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() =>
                    setShowCreate(false)
                  }
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  style={primaryButton}
                  disabled={saving}
                >
                  {saving
                    ? "Creating..."
                    : "Create Entrance Point"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DETAILS MODAL */}

      {selectedPoint && (
        <div style={overlay}>
          <div style={modal}>
            <div style={modalHeader}>
              <div>
                <h2 style={modalTitle}>
                  {selectedPoint.name}
                </h2>

                <p style={modalSubtitle}>
                  Entrance Point Details
                </p>
              </div>

              <button
                style={closeButton}
                onClick={() =>
                  setSelectedPoint(null)
                }
              >
                ×
              </button>
            </div>

            <div style={detailSection}>
              <h3 style={sectionTitle}>
                UTM Parameters
              </h3>

              <Detail
                label="Source"
                value={selectedPoint.source}
              />

              <Detail
                label="Medium"
                value={selectedPoint.medium}
              />

              <Detail
                label="Campaign"
                value={selectedPoint.campaign}
              />

              <Detail
                label="Content"
                value={selectedPoint.content}
              />

              <Detail
                label="Term"
                value={selectedPoint.term}
              />

              <Detail
                label="ID"
                value={selectedPoint.utmId}
              />
            </div>

            <div style={detailSection}>
              <h3 style={sectionTitle}>
                Tracking URL
              </h3>

              <div style={trackingUrl}>
                {getTrackingUrl(selectedPoint)}
              </div>

              <div style={cardActions}>
                <button
                  style={secondaryButton}
                  onClick={() =>
                    copyUrl(selectedPoint)
                  }
                >
                  Copy URL
                </button>

                <button
                  style={secondaryButton}
                  onClick={() =>
                    showQrCode(selectedPoint)
                  }
                >
                  QR Code
                </button>
              </div>
            </div>

            <div style={detailSection}>
              <h3 style={sectionTitle}>
                Information
              </h3>

              <Detail
                label="Type"
                value={selectedPoint.type}
              />

              <Detail
                label="Description"
                value={
                  selectedPoint.description
                }
              />

              <Detail
                label="Created"
                value={formatDate(
                  selectedPoint.createdDate
                )}
              />

              <Detail
                label="Campaign Start"
                value={formatDate(
                  selectedPoint.campaignStartDate
                )}
              />

              <Detail
                label="Notes"
                value={selectedPoint.notes}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  value,
  onChange,
  placeholder,
}) {
  return (
    <div style={field}>
      <label style={labelStyle}>
        {label}

        {required && (
          <span style={{ color: "#b34a35" }}>
            {" "}
            *
          </span>
        )}
      </label>

      <input
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        placeholder={placeholder}
        style={input}
      />
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={detail}>
      <span>{label}</span>

      <strong>
        {value || "—"}
      </strong>
    </div>
  );
}

const page = {
  maxWidth: "1200px",
};

const header = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "25px",
};

const title = {
  fontSize: "28px",
  fontWeight: "normal",
  color: "#3d2200",
  margin: 0,
  fontFamily: "'Georgia', serif",
};

const subtitle = {
  color: "#9b7040",
  margin: "5px 0 0",
  fontFamily: "sans-serif",
};

const addButton = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  border: "none",
  background:
    "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "white",
  fontSize: "30px",
  cursor: "pointer",
  boxShadow:
    "0 4px 12px rgba(160,80,20,0.25)",
};

const grid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px",
};

const card = {
  background: "#fffdf9",
  border: "1px solid #eddfc8",
  borderRadius: "16px",
  padding: "18px",
};

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  gap: "15px",
};

const typeBadge = {
  display: "inline-block",
  fontSize: "11px",
  padding: "4px 9px",
  borderRadius: "999px",
  background: "#f4e7d4",
  color: "#7a4f10",
  fontFamily: "sans-serif",
  marginBottom: "8px",
};

const cardTitle = {
  margin: 0,
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
};

const sourceText = {
  marginTop: "5px",
  fontFamily: "monospace",
  fontSize: "12px",
  color: "#9b7040",
};

const status = {
  height: "fit-content",
  padding: "4px 9px",
  borderRadius: "999px",
  fontSize: "11px",
  fontFamily: "sans-serif",
};

const statsGrid = {
  display: "grid",
  gridTemplateColumns:
    "repeat(4, 1fr)",
  gap: "8px",
  marginTop: "20px",
};

const stat = {
  display: "flex",
  flexDirection: "column",
  gap: "3px",
};

const cardDetails = {
  display: "grid",
  gridTemplateColumns:
    "1fr 1fr",
  gap: "12px",
  marginTop: "18px",
  paddingTop: "15px",
  borderTop: "1px solid #eddfc8",
};

const cardActions = {
  display: "flex",
  gap: "7px",
  flexWrap: "wrap",
  marginTop: "18px",
};

const primaryButton = {
  border: "none",
  borderRadius: "9px",
  padding: "9px 15px",
  background:
    "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "sans-serif",
};

const secondaryButton = {
  border: "1px solid #eddfc8",
  borderRadius: "9px",
  padding: "8px 12px",
  background: "#fffdf9",
  color: "#7a4f10",
  cursor: "pointer",
  fontFamily: "sans-serif",
};

const dangerButton = {
  ...secondaryButton,
  color: "#a33d32",
};

const empty = {
  textAlign: "center",
  padding: "80px 20px",
  color: "#9b7040",
};

const emptyIcon = {
  fontSize: "45px",
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(40, 25, 10, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  zIndex: 1000,
};

const modal = {
  background: "#fffdf9",
  borderRadius: "18px",
  width: "100%",
  maxWidth: "650px",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "24px",
  boxShadow:
    "0 20px 60px rgba(40,20,0,0.25)",
};

const modalHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: "20px",
};

const modalTitle = {
  margin: 0,
  fontFamily: "'Georgia', serif",
  color: "#3d2200",
};

const modalSubtitle = {
  margin: "5px 0 0",
  color: "#9b7040",
};

const closeButton = {
  border: "none",
  background: "transparent",
  fontSize: "30px",
  cursor: "pointer",
  color: "#7a4f10",
};

const form = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const field = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

const labelStyle = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#5c3a1e",
  fontFamily: "sans-serif",
};

const label = labelStyle;

const input = {
  padding: "10px 12px",
  borderRadius: "9px",
  border: "1px solid #eddfc8",
  background: "#fff",
  color: "#3d2200",
  fontSize: "14px",
  outline: "none",
  fontFamily: "sans-serif",
};

const urlPreview = {
  background: "#f8f1e8",
  borderRadius: "10px",
  padding: "12px",
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  fontSize: "12px",
  color: "#7a4f10",
};

const formActions = {
  display: "flex",
  justifyContent: "flex-end",
  gap: "8px",
  marginTop: "10px",
};

const detailSection = {
  borderTop: "1px solid #eddfc8",
  paddingTop: "18px",
  marginTop: "18px",
};

const sectionTitle = {
  fontFamily: "'Georgia', serif",
  color: "#3d2200",
  margin: "0 0 12px",
};

const detail = {
  display: "flex",
  justifyContent: "space-between",
  gap: "20px",
  padding: "8px 0",
  borderBottom: "1px solid #f1e7d9",
  fontFamily: "sans-serif",
};

const trackingUrl = {
  background: "#f8f1e8",
  padding: "12px",
  borderRadius: "8px",
  wordBreak: "break-all",
  fontFamily: "monospace",
  fontSize: "12px",
  color: "#5c3a1e",
};