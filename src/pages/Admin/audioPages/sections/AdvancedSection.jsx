import { Card, Field, Select, TextInput, Toggle } from "../ui";
import { QUALITIES, ANIMATIONS, PAGE_SIZES } from "../../../../data/audioPageDefaults";

// Advanced: downloads, quality, sharing, favorites, animations (whole app)
// and pagination (this page).
export default function AdvancedSection({ advanced, upAdvanced, setAdvanced, page, up, canEdit, pageLabel }) {
  const dl = advanced.downloads;
  return (
    <>
      <Card title="Downloads" hint="Offline downloads need an account, so signed-out visitors never get the Download button.">
        <Toggle label="Allow audio downloads" checked={dl.enabled} onChange={(v) => setAdvanced((a) => ({ ...a, downloads: { ...a.downloads, enabled: v } }))} disabled={!canEdit} />
        <Field label="Who can download">
          <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", opacity: dl.enabled ? 1 : 0.5 }}>
            <label style={chk}><input type="checkbox" checked={dl.roles.user} onChange={(e) => setAdvanced((a) => ({ ...a, downloads: { ...a.downloads, roles: { ...a.downloads.roles, user: e.target.checked } } }))} disabled={!canEdit || !dl.enabled} /> Signed-in users</label>
            <label style={chk}><input type="checkbox" checked={dl.roles.admin} onChange={(e) => setAdvanced((a) => ({ ...a, downloads: { ...a.downloads, roles: { ...a.downloads.roles, admin: e.target.checked } } }))} disabled={!canEdit || !dl.enabled} /> Admins</label>
          </div>
        </Field>
      </Card>

      <Card title="Audio quality" hint="Data saver streams the small voice-quality copy made at upload time (when a recording has one) — far less data, but it sounds thinner. Offline downloads always use the original.">
        <Field label="Default audio quality"><Select value={advanced.quality} onChange={(v) => upAdvanced("quality", v)} options={QUALITIES} disabled={!canEdit} /></Field>
      </Card>

      <Card title="Sharing & favorites">
        <Toggle label="Enable sharing" hint="Off: the Share and Copy link buttons disappear from cards." checked={advanced.sharing.enabled} onChange={(v) => setAdvanced((a) => ({ ...a, sharing: { ...a.sharing, enabled: v } }))} disabled={!canEdit} />
        <Field label="Social sharing text" hint="Placeholders: {title}  {speaker}  {series}. Used when someone shares from their phone.">
          <TextInput value={advanced.sharing.text} onChange={(v) => setAdvanced((a) => ({ ...a, sharing: { ...a.sharing, text: v } }))} maxLength={200} disabled={!canEdit || !advanced.sharing.enabled} />
        </Field>
        <Toggle label="Enable favorites (likes)" hint="Off: the heart button and the “Liked only” filter are hidden everywhere." checked={advanced.favorites} onChange={(v) => upAdvanced("favorites", v)} disabled={!canEdit} />
      </Card>

      <Card title="Card animations">
        <Field label="Animation style" hint="How cards appear as a page opens. Visitors who prefer reduced motion never see animation."><Select value={advanced.animations} onChange={(v) => upAdvanced("animations", v)} options={ANIMATIONS} disabled={!canEdit} /></Field>
      </Card>

      <Card title={`Pagination — ${pageLabel}`} hint="How many cards appear at once on this page. (The full list is still loaded; this keeps long pages quick to scroll.)">
        <Field label="Show">
          <Select value={page.pagination.mode} onChange={(v) => up("pagination", "mode", v)} options={[["all", "Everything at once"], ["loadMore", "A set number, with a “Show more” button"]]} disabled={!canEdit} />
        </Field>
        <Field label="Cards at a time">
          <Select value={String(page.pagination.size)} onChange={(v) => up("pagination", "size", Number(v))} options={PAGE_SIZES.map((n) => [String(n), `${n} cards`])} disabled={!canEdit || page.pagination.mode === "all"} />
        </Field>
      </Card>
    </>
  );
}
const chk = { display: "flex", alignItems: "center", gap: "8px", fontSize: "13.5px", color: "var(--color-3d2200)", fontFamily: "sans-serif" };
