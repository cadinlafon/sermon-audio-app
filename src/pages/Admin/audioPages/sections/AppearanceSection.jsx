import { useRef, useState } from "react";
import { Card, Field, Select, TextInput, Toggle, Slider, Button } from "../ui";
import DoctrineBanner, { BANNER_LIMITS } from "../../../../components/DoctrineBanner";
import { uploadPublicImage } from "../../../../utils/imageUpload";
import { HEADER_STYLES, SPACING, PAGE_META } from "../../../../data/audioPageDefaults";

// Page Appearance: title, subtitle, banner image, category headers, default
// category, empty/loading messages, spacing.
export default function AppearanceSection({ page, pageKey, categories, featuredCategory, up, setPage, canEdit }) {
  const a = page.appearance;
  const meta = PAGE_META[pageKey];
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState("");

  const setBanner = (patch) => setPage((p) => ({ ...p, appearance: { ...p.appearance, banner: { ...p.appearance.banner, ...patch } } }));

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Please choose an image file."); return; }
    setError("");
    setUploading(true);
    setProgress(null);
    try {
      const { url, storageKey } = await uploadPublicImage(file, setProgress);
      setBanner({ url, storageKey, focusX: 50, focusY: 50, zoom: 1, height: 200, size: 100, align: "center" });
    } catch (err) {
      console.error(err);
      setError(err?.message || "The image upload failed.");
    }
    setUploading(false);
    setProgress(null);
  };

  const pageCategories = categories.filter((c) => meta.categories.includes(c.id));
  const defaultCategoryOptions = [["all", "All categories"], ["featured", "The featured category"], ...pageCategories.map((c) => [c.id, c.plural])];

  return (
    <>
      <Card title="Title & banner">
        <Field label="Page title" hint={`Blank = “${meta.defaultTitle}”.`}><TextInput value={a.title} onChange={(v) => up("appearance", "title", v)} placeholder={meta.defaultTitle} maxLength={80} disabled={!canEdit} /></Field>
        <Field label="Subtitle" hint="A line under the title. Blank = none."><TextInput value={a.subtitle} onChange={(v) => up("appearance", "subtitle", v)} placeholder="e.g. Teaching from our Sunday gatherings" maxLength={200} disabled={!canEdit} /></Field>

        <Field label="Banner image" hint="Shown above the title. The photo itself is never cropped — you choose which part shows.">
          {a.banner.url ? (
            <div>
              <DoctrineBanner url={a.banner.url} settings={a.banner} onChange={({ focusX, focusY }) => setBanner({ focusX, focusY })} />
              <p style={hint}>Drag the picture to choose what shows.</p>
              <div style={sliders}>
                <Slider label="Left ↔ right" min={0} max={100} step={1} value={a.banner.focusX} onChange={(v) => setBanner({ focusX: v })} display={`${Math.round(a.banner.focusX)}%`} />
                <Slider label="Up ↕ down" min={0} max={100} step={1} value={a.banner.focusY} onChange={(v) => setBanner({ focusY: v })} display={`${Math.round(a.banner.focusY)}%`} />
                <Slider label="Zoom" min={BANNER_LIMITS.zoom[0]} max={BANNER_LIMITS.zoom[1]} step={0.05} value={a.banner.zoom} onChange={(v) => setBanner({ zoom: v })} display={`${Math.round(a.banner.zoom * 100)}%`} />
                <Slider label="Overall banner size" min={30} max={100} step={5} value={a.banner.size} onChange={(v) => setBanner({ size: v })} display={`${Math.round(a.banner.size)}%`} />
                <Slider label="Banner height" min={BANNER_LIMITS.height[0]} max={BANNER_LIMITS.height[1]} step={10} value={a.banner.height} onChange={(v) => setBanner({ height: v })} display={`${Math.round(a.banner.height)}px`} />
              </div>
              <p style={hint}>Overall size shrinks the whole banner — width and height together. Height sets how tall it is at 100%.</p>
              {a.banner.size < 100 && (
                <div style={{ marginTop: "10px" }}>
                  <Field label="Banner position on the page"><Select value={a.banner.align} onChange={(v) => setBanner({ align: v })} options={[["left", "Left"], ["center", "Center"], ["right", "Right"]]} disabled={!canEdit} /></Field>
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                <Button onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading}>Replace image</Button>
                <Button kind="danger" onClick={() => setBanner({ url: "", storageKey: "" })} disabled={!canEdit || uploading}>Remove</Button>
              </div>
            </div>
          ) : (
            <Button kind="dashed" onClick={() => fileRef.current?.click()} disabled={!canEdit || uploading}>{uploading ? "Uploading…" : "🖼️ Upload banner image"}</Button>
          )}
          {uploading && <div style={track}><div style={{ ...fill, width: progress === null ? "40%" : `${progress}%` }} /></div>}
          {error && <p style={{ ...hint, color: "var(--color-b3432c)" }} role="alert">{error}</p>}
          <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => { handleFile(e.target.files[0]); e.target.value = ""; }} />
        </Field>
      </Card>

      <Card title="Categories on this page">
        <Field label="Default category selection" hint="Which category is selected when the page opens (visitors can still change it)."><Select value={a.defaultCategory} onChange={(v) => up("appearance", "defaultCategory", v)} options={defaultCategoryOptions} disabled={!canEdit} /></Field>
        {featuredCategory === "" && a.defaultCategory === "featured" && <p style={{ ...hint, color: "var(--color-b3432c)" }}>No featured category is set yet (Categories tab) — this falls back to “All categories”.</p>}
        <Field label="Category header style" hint="Used for headings above groups and featured sections."><Select value={a.headerStyle} onChange={(v) => up("appearance", "headerStyle", v)} options={HEADER_STYLES} disabled={!canEdit} /></Field>
        <Field label="Header alignment"><Select value={a.headerAlign} onChange={(v) => up("appearance", "headerAlign", v)} options={[["left", "Left"], ["center", "Center"]]} disabled={!canEdit} /></Field>
        <Toggle label="Show category descriptions" hint="Descriptions are written on the Categories tab." checked={a.showCategoryDescriptions} onChange={(v) => up("appearance", "showCategoryDescriptions", v)} disabled={!canEdit} />
      </Card>

      <Card title="Messages" hint="Leave blank to use the standard wording.">
        <Field label="When there are no recordings"><TextInput value={a.emptyMessage} onChange={(v) => up("appearance", "emptyMessage", v)} placeholder="Check back soon for new recordings." maxLength={200} disabled={!canEdit} /></Field>
        <Field label="When a search or filter finds nothing"><TextInput value={a.noResultsMessage} onChange={(v) => up("appearance", "noResultsMessage", v)} placeholder="Nothing fits these filters." maxLength={200} disabled={!canEdit} /></Field>
        <Field label="While the page loads"><TextInput value={a.loadingMessage} onChange={(v) => up("appearance", "loadingMessage", v)} placeholder="(no message — just placeholders)" maxLength={120} disabled={!canEdit} /></Field>
      </Card>

      <Card title="Spacing">
        <Field label="Page spacing & card density" hint="The space around the page and between cards."><Select value={a.spacing} onChange={(v) => up("appearance", "spacing", v)} options={SPACING} disabled={!canEdit} /></Field>
      </Card>
    </>
  );
}
const hint = { margin: "8px 0 0", fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const sliders = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "10px 16px", marginTop: "6px" };
const track = { height: "6px", background: "var(--color-eddfc8)", borderRadius: "999px", overflow: "hidden", marginTop: "8px" };
const fill = { height: "100%", background: "linear-gradient(to right, var(--color-e08930), var(--color-c97c2e))", borderRadius: "999px", transition: "width 0.2s" };
