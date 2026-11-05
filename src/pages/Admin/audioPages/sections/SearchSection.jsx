import { Card, Field, TextInput, Toggle, CheckGrid } from "../ui";
import { SEARCH_FIELDS, FILTER_TOGGLES } from "../../../../data/audioPageDefaults";

// Search & Filtering for this page.
export default function SearchSection({ page, up, setPage, canEdit }) {
  const s = page.search;
  return (
    <>
      <Card title="Search" hint="The search box at the top of the page.">
        <Toggle label="Enable search" checked={s.enabled} onChange={(v) => up("search", "enabled", v)} disabled={!canEdit} />
        <Field label="Placeholder text" hint="Shown inside the empty search box. Blank = “Search title or speaker…”.">
          <TextInput value={s.placeholder} onChange={(v) => up("search", "placeholder", v)} placeholder="Search title or speaker…" maxLength={80} disabled={!canEdit || !s.enabled} />
        </Field>
        <Field label="Searchable fields" hint="What a typed search looks at.">
          <CheckGrid items={SEARCH_FIELDS} values={s.fields} onChange={(id, v) => setPage((p) => ({ ...p, search: { ...p.search, fields: { ...p.search.fields, [id]: v } } }))} disabled={!canEdit || !s.enabled} />
        </Field>
      </Card>

      <Card title="Filters" hint="Which options appear in the ⚙ Filters panel. The Series filter only appears when recordings have a series set (Content Manager → Edit).">
        <CheckGrid items={FILTER_TOGGLES} values={s.filters} onChange={(id, v) => setPage((p) => ({ ...p, search: { ...p.search, filters: { ...p.search.filters, [id]: v } } }))} disabled={!canEdit} />
      </Card>

      <Card title="Default filter behavior">
        <Toggle label="Remember each visitor's filters" hint="On: the filters someone picked are still applied next time they open the page. Off: every visit starts fresh." checked={s.rememberFilters} onChange={(v) => up("search", "rememberFilters", v)} disabled={!canEdit} />
        <Toggle label="Filters panel starts open" hint="Otherwise it stays tucked behind the ⚙ Filters button until tapped." checked={s.filtersOpenByDefault} onChange={(v) => up("search", "filtersOpenByDefault", v)} disabled={!canEdit} />
      </Card>
    </>
  );
}
