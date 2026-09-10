import { useRef, useState } from "react";
import { uploadPrivateAudio } from "../../utils/privateAudioUpload";
import { uploadPublicImage } from "../../utils/imageUpload";
import ResourceTypeIcon from "../../components/ResourceTypeIcon";
import {
  RESOURCE_TYPES,
  RESOURCE_TYPE_META,
  DOWNLOAD_FILE_TYPES,
  typeUsesField,
  extractYouTubeId,
  youTubeThumbnail,
} from "../../lib/resourceTypes";

const URL_LABELS = {
  youtube: "YouTube URL",
  spotify: "Spotify URL (episode or show link)",
  document: "Document URL",
  website: "Website URL",
  podcast: "Podcast URL",
  book: "Book URL",
  article: "Article URL",
  presentation: "Presentation URL",
  download: "File URL",
  scripture: "Resource URL (optional)",
  course: "External Course URL (optional)",
};

export default function ResourceForm({ resource, categories, sections, allResources, actor, onSave, onClose }) {
  const [form, setForm] = useState({ ...resource, sectionIds: resource.sectionIds || [] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [audioUploading, setAudioUploading] = useState(false);
  const [audioProgress, setAudioProgress] = useState(null);
  const audioInputRef = useRef();

  const [thumbUploading, setThumbUploading] = useState(false);
  const [thumbProgress, setThumbProgress] = useState(null);
  const thumbInputRef = useRef();

  const [imagesUploading, setImagesUploading] = useState(false);
  const imagesInputRef = useRef();

  const [itemSearch, setItemSearch] = useState("");

  const set = (field) => (e) => {
    const value = e?.target ? (e.target.type === "checkbox" ? e.target.checked : e.target.value) : e;
    setForm((f) => ({ ...f, [field]: value }));
  };

  ////////////////////////////////////////////////
  // AUDIO
  ////////////////////////////////////////////////
  const handleAudioSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("audio/")) { alert("Please choose an audio file."); return; }
    setAudioUploading(true);
    setAudioProgress(null);
    try {
      const audioStorageKey = await uploadPrivateAudio(file, setAudioProgress);
      setForm((f) => ({ ...f, audioStorageKey, audioFileName: file.name }));
    } catch (err) {
      console.error(err);
      alert("Audio upload failed.");
    }
    setAudioUploading(false);
    setAudioProgress(null);
  };

  ////////////////////////////////////////////////
  // THUMBNAIL
  ////////////////////////////////////////////////
  const handleThumbSelect = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Please choose an image file."); return; }
    setThumbUploading(true);
    setThumbProgress(null);
    try {
      const { url, storageKey } = await uploadPublicImage(file, setThumbProgress);
      setForm((f) => ({ ...f, thumbnailUrl: url, thumbnailStorageKey: storageKey }));
    } catch (err) {
      console.error(err);
      alert("Thumbnail upload failed.");
    }
    setThumbUploading(false);
    setThumbProgress(null);
  };

  const useYouTubeThumbnail = () => {
    const thumb = youTubeThumbnail(form.url);
    if (thumb) setForm((f) => ({ ...f, thumbnailUrl: thumb, thumbnailStorageKey: "" }));
  };

  ////////////////////////////////////////////////
  // GALLERY IMAGES
  ////////////////////////////////////////////////
  const handleImagesSelect = async (files) => {
    const list = Array.from(files || []).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;
    setImagesUploading(true);
    try {
      const uploaded = [];
      for (const file of list) {
        const { url, storageKey } = await uploadPublicImage(file);
        uploaded.push({ url, storageKey });
      }
      setForm((f) => ({ ...f, images: [...(f.images || []), ...uploaded] }));
    } catch (err) {
      console.error(err);
      alert("One or more images failed to upload.");
    }
    setImagesUploading(false);
  };

  const removeImage = (index) => {
    setForm((f) => ({ ...f, images: f.images.filter((_, i) => i !== index) }));
  };

  ////////////////////////////////////////////////
  // ROWS / SECTIONS
  ////////////////////////////////////////////////
  const toggleSection = (id) => {
    setForm((f) => ({
      ...f,
      sectionIds: f.sectionIds.includes(id)
        ? f.sectionIds.filter((x) => x !== id)
        : [...f.sectionIds, id],
    }));
  };

  ////////////////////////////////////////////////
  // ITEMS (playlist / course)
  ////////////////////////////////////////////////
  const selectedItems = (form.items || [])
    .map((id) => allResources.find((r) => r.id === id))
    .filter(Boolean);

  const itemOptions = (allResources || [])
    .filter((r) => r.id !== resource.id && !(form.items || []).includes(r.id))
    .filter((r) => !itemSearch.trim() || r.title.toLowerCase().includes(itemSearch.toLowerCase()));

  const addItem = (id) => {
    setForm((f) => ({ ...f, items: [...(f.items || []), id] }));
    setItemSearch("");
  };

  const removeItem = (id) => {
    setForm((f) => ({ ...f, items: (f.items || []).filter((x) => x !== id) }));
  };

  ////////////////////////////////////////////////
  // SAVE
  ////////////////////////////////////////////////
  const handleSave = async () => {
    if (!form.title.trim()) return setError("Title is required.");

    setSaving(true);
    setError("");
    try {
      await onSave(form);
    } catch (err) {
      console.error(err);
      setError("Something went wrong saving this resource. Please try again.");
      setSaving(false);
    }
  };

  const meta = RESOURCE_TYPE_META[form.type];

  return (
    <div style={modalBg} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <div style={header}>
          <h2 style={modalTitle}>{resource.id ? "Edit Resource" : "New Resource"}</h2>
          <button style={closeX} onClick={onClose}>✕</button>
        </div>

        <div style={scrollArea}>
          <Field label="Resource Type">
            <div style={typeGrid}>
              {RESOURCE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  style={form.type === t ? { ...typeChoice, ...typeChoiceActive } : typeChoice}
                  onClick={() => set("type")(t)}
                >
                  <ResourceTypeIcon type={t} size={16} /> {RESOURCE_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Title">
            <input value={form.title} onChange={set("title")} style={input} placeholder="Resource title" />
          </Field>

          <Field label="Description">
            <textarea value={form.description} onChange={set("description")} style={{ ...input, height: "70px", resize: "vertical" }} placeholder="Short description…" />
          </Field>

          <div style={row2}>
            <Field label="Author / Speaker">
              <input value={form.author} onChange={set("author")} style={input} placeholder="Optional" />
            </Field>
            <Field label="Date">
              <input type="date" value={form.date} onChange={set("date")} style={input} />
            </Field>
          </div>

          <Field label="Category">
            <select value={form.categoryId} onChange={set("categoryId")} style={input}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>

          <Field label="Rows" hint="Curated homepage rows this resource should appear in, like Featured. Manage rows from the Resources admin page.">
            {sections.length === 0 ? (
              <p style={hintText}>No rows created yet.</p>
            ) : (
              <div style={sectionCheckRow}>
                {sections.map((s) => (
                  <label key={s.id} style={sectionCheckLabel}>
                    <input
                      type="checkbox"
                      checked={form.sectionIds.includes(s.id)}
                      onChange={() => toggleSection(s.id)}
                    />
                    {s.name}
                  </label>
                ))}
              </div>
            )}
          </Field>

          <Field label="Thumbnail">
            {form.thumbnailUrl ? (
              <div>
                <img src={form.thumbnailUrl} alt="" style={thumbPreview} />
                <div style={rowActions}>
                  <button type="button" style={smallBtn} onClick={() => thumbInputRef.current.click()} disabled={thumbUploading}>Replace</button>
                  <button type="button" style={{ ...smallBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => setForm((f) => ({ ...f, thumbnailUrl: "", thumbnailStorageKey: "" }))} disabled={thumbUploading}>Remove</button>
                </div>
              </div>
            ) : (
              <div style={rowActions}>
                <button type="button" style={uploadBtn} onClick={() => thumbInputRef.current.click()} disabled={thumbUploading}>
                  {thumbUploading ? "Uploading…" : "🖼️ Upload Thumbnail"}
                </button>
                {form.type === "youtube" && extractYouTubeId(form.url) && (
                  <button type="button" style={smallBtn} onClick={useYouTubeThumbnail}>Use YouTube Thumbnail</button>
                )}
              </div>
            )}
            {thumbUploading && (
              <ProgressBar progress={thumbProgress} />
            )}
            <input ref={thumbInputRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { handleThumbSelect(e.target.files[0]); e.target.value = ""; }} />
          </Field>

          {typeUsesField(form.type, "url") && (
            <Field label={URL_LABELS[form.type] || "URL"}>
              <input value={form.url} onChange={set("url")} style={input} placeholder="https://…" />
            </Field>
          )}

          {typeUsesField(form.type, "uploadAudio") && (
            <Field label="Audio File">
              {form.audioStorageKey ? (
                <div style={fileRow}>
                  <span style={fileRowName}>🎵 {form.audioFileName || "Audio file"}</span>
                  <div style={rowActions}>
                    <button type="button" style={smallBtn} onClick={() => audioInputRef.current.click()} disabled={audioUploading}>Replace</button>
                    <button type="button" style={{ ...smallBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => setForm((f) => ({ ...f, audioStorageKey: "", audioFileName: "" }))} disabled={audioUploading}>Remove</button>
                  </div>
                </div>
              ) : (
                <button type="button" style={uploadBtn} onClick={() => audioInputRef.current.click()} disabled={audioUploading}>
                  {audioUploading ? "Uploading…" : "🎙️ Upload Audio File"}
                </button>
              )}
              {audioUploading && <ProgressBar progress={audioProgress} />}
              <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => { handleAudioSelect(e.target.files[0]); e.target.value = ""; }} />
            </Field>
          )}

          {typeUsesField(form.type, "duration") && (
            <Field label="Duration" hint="Optional, e.g. 32:15">
              <input value={form.duration || ""} onChange={set("duration")} style={input} placeholder="mm:ss" />
            </Field>
          )}

          {typeUsesField(form.type, "fileType") && (
            <Field label="File Type">
              <select value={form.fileType} onChange={set("fileType")} style={input}>
                <option value="">Select…</option>
                {DOWNLOAD_FILE_TYPES.map((ft) => <option key={ft} value={ft}>{ft.toUpperCase()}</option>)}
              </select>
            </Field>
          )}

          {typeUsesField(form.type, "siteName") && (
            <Field label="Website Name">
              <input value={form.siteName} onChange={set("siteName")} style={input} placeholder="Optional" />
            </Field>
          )}

          {typeUsesField(form.type, "episodeNumber") && (
            <Field label="Episode Number">
              <input value={form.episodeNumber} onChange={set("episodeNumber")} style={input} placeholder="Optional" />
            </Field>
          )}

          {typeUsesField(form.type, "publisher") && (
            <Field label="Publisher">
              <input value={form.publisher} onChange={set("publisher")} style={input} placeholder="Optional" />
            </Field>
          )}

          {typeUsesField(form.type, "scriptureReference") && (
            <Field label="Scripture Reference">
              <input value={form.scriptureReference} onChange={set("scriptureReference")} style={input} placeholder="e.g. John 3:16-18" />
            </Field>
          )}

          {typeUsesField(form.type, "images") && (
            <Field label="Images">
              <div style={imageGrid}>
                {(form.images || []).map((img, i) => (
                  <div key={i} style={imageThumbWrap}>
                    <img src={img.url} alt="" style={imageThumb} />
                    <button type="button" style={imageRemoveBtn} onClick={() => removeImage(i)}>✕</button>
                  </div>
                ))}
              </div>
              <button type="button" style={uploadBtn} onClick={() => imagesInputRef.current.click()} disabled={imagesUploading}>
                {imagesUploading ? "Uploading…" : "+ Add Images"}
              </button>
              <input ref={imagesInputRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={(e) => { handleImagesSelect(e.target.files); e.target.value = ""; }} />
            </Field>
          )}

          {typeUsesField(form.type, "items") && (
            <Field label={form.type === "course" ? "Lessons" : "Playlist Items"}>
              <div style={chipRow}>
                {selectedItems.map((item) => (
                  <span key={item.id} style={chip}>
                    <ResourceTypeIcon type={item.type} size={12} /> {item.title}
                    <button type="button" style={chipX} onClick={() => removeItem(item.id)}>✕</button>
                  </span>
                ))}
                {selectedItems.length === 0 && <p style={hintText}>No items added yet.</p>}
              </div>
              <input
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                placeholder="Search resources to add…"
                style={input}
              />
              {itemSearch.trim() && itemOptions.length > 0 && (
                <div style={suggestBox}>
                  {itemOptions.slice(0, 6).map((r) => (
                    <button key={r.id} type="button" style={suggestItem} onClick={() => addItem(r.id)}>
                      <ResourceTypeIcon type={r.type} size={13} /> {r.title}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          )}

          <div style={toggleRow}>
            <label style={toggleLabel}>
              <input type="checkbox" checked={form.featured} onChange={set("featured")} /> Featured
            </label>
            <label style={toggleLabel}>
              <input type="checkbox" checked={form.published} onChange={set("published")} /> Published
            </label>
          </div>

          <Field label="Order" hint="Lower numbers appear first among featured items.">
            <input type="number" value={form.order} onChange={(e) => set("order")(Number(e.target.value) || 0)} style={input} />
          </Field>
        </div>

        {error && <p style={errorText}>{error}</p>}

        <div style={footer}>
          <button style={cancelBtn} onClick={onClose}>Cancel</button>
          <button style={saveBtn} onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : `Save ${meta.label}`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ progress }) {
  return (
    <div style={progressTrack}>
      <div
        style={{
          ...progressFill,
          width: progress === null ? "40%" : `${progress}%`,
          ...(progress === null ? { animation: "uploadSlide 1.1s ease-in-out infinite" } : {}),
        }}
      />
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
      <label style={fieldLabel}>{label}</label>
      {children}
      {hint && <p style={hintText}>{hint}</p>}
    </div>
  );
}

////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////

const modalBg = { position: "fixed", inset: 0, background: "rgba(40,18,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: "16px" };
const modal = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "20px", padding: "24px", width: "100%", maxWidth: "560px", maxHeight: "92vh", display: "flex", flexDirection: "column", gap: "14px" };
const header = { display: "flex", justifyContent: "space-between", alignItems: "center" };
const modalTitle = { fontSize: "20px", fontWeight: "normal", color: "#3d2200", fontFamily: "'Georgia', serif", margin: 0 };
const closeX = { border: "none", background: "transparent", color: "#9b7040", fontSize: "16px", cursor: "pointer" };

const scrollArea = { overflowY: "auto", display: "flex", flexDirection: "column", gap: "14px", paddingRight: "4px" };

const typeGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "6px" };
const typeChoice = { display: "flex", alignItems: "center", gap: "6px", padding: "8px 10px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#5c3a1e", fontSize: "12px", fontFamily: "sans-serif", cursor: "pointer" };
const typeChoiceActive = { border: "2px solid #a85e18", background: "#fdf1de", fontWeight: "600" };

const fieldLabel = { fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.06em", textTransform: "uppercase" };
const hintText = { fontSize: "11px", color: "#b08050", fontFamily: "sans-serif", margin: 0 };
const input = { padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "14px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "100%", boxSizing: "border-box" };
const row2 = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };

const uploadBtn = { padding: "9px 14px", borderRadius: "10px", border: "1px dashed #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const smallBtn = { padding: "5px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fffdf9", color: "#5c3a1e", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };
const rowActions = { display: "flex", gap: "6px", flexWrap: "wrap", marginTop: "6px" };
const thumbPreview = { width: "100%", height: "120px", objectFit: "cover", borderRadius: "10px", border: "1px solid #eddfc8" };

const fileRow = { display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fdf8f3", flexWrap: "wrap" };
const fileRowName = { fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200" };

const progressTrack = { height: "6px", background: "#eddfc8", borderRadius: "999px", overflow: "hidden", marginTop: "8px" };
const progressFill = { height: "100%", background: "linear-gradient(to right, #e08930, #c97c2e)", borderRadius: "999px", transition: "width 0.2s ease-out" };

const imageGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))", gap: "8px", marginBottom: "8px" };
const imageThumbWrap = { position: "relative" };
const imageThumb = { width: "100%", height: "70px", objectFit: "cover", borderRadius: "8px", border: "1px solid #eddfc8" };
const imageRemoveBtn = { position: "absolute", top: "2px", right: "2px", width: "18px", height: "18px", borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "9px", cursor: "pointer" };

const chipRow = { display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" };
const chip = { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", padding: "5px 9px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontFamily: "sans-serif" };
const chipX = { border: "none", background: "transparent", cursor: "pointer", fontSize: "10px", color: "inherit" };
const suggestBox = { border: "1px solid #eddfc8", borderRadius: "10px", marginTop: "4px", overflow: "hidden", background: "#fffdf9" };
const suggestItem = { display: "flex", alignItems: "center", gap: "6px", width: "100%", textAlign: "left", padding: "8px 10px", border: "none", background: "transparent", fontSize: "12px", fontFamily: "sans-serif", color: "#5c3a1e", cursor: "pointer" };

const toggleRow = { display: "flex", gap: "20px" };
const sectionCheckRow = { display: "flex", gap: "14px", flexWrap: "wrap" };
const sectionCheckLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e" };
const toggleLabel = { display: "flex", alignItems: "center", gap: "6px", fontSize: "13px", fontFamily: "sans-serif", color: "#5c3a1e" };

const errorText = { color: "#b3432c", fontSize: "12px", fontFamily: "sans-serif", margin: 0 };
const footer = { display: "flex", justifyContent: "flex-end", gap: "10px", borderTop: "1px solid #eddfc8", paddingTop: "14px" };
const cancelBtn = { padding: "10px 18px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const saveBtn = { padding: "10px 20px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
