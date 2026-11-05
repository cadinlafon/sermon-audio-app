import { useMemo, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../../../../firebase";
import { Card, Field, Select, TextInput, Toggle, Button, input } from "../ui";

// Featured Audio: pinned items + a Featured section, a featured series, a
// "recently added" section, "most played", and hand-made collections.
export default function FeaturedSection({ page, setPage, items, canEdit }) {
  const f = page.featured;
  const setF = (patch) => setPage((p) => ({ ...p, featured: { ...p.featured, ...patch } }));
  const byId = useMemo(() => new Map(items.map((i) => [i.id, i])), [items]);
  const label = (id) => { const i = byId.get(id); return i ? `${i.title}${i.speaker ? ` — ${i.speaker}` : ""}` : `(removed recording)`; };
  const seriesNames = useMemo(() => [...new Set(items.map((i) => (i.series || "").trim()).filter(Boolean))].sort(), [items]);

  const [popularBusy, setPopularBusy] = useState(false);
  const [popularMsg, setPopularMsg] = useState("");

  const refreshPopular = async () => {
    if (!window.confirm("Look at the last 90 days of listening to find the most-played recordings?\n\nThis reads every play recorded in that window (a database read each).")) return;
    setPopularBusy(true);
    setPopularMsg("");
    try {
      const since = new Date(Date.now() - 90 * 86400000);
      const snap = await getDocs(query(collection(db, "appUsage"), where("createdAt", ">=", since)));
      const counts = new Map();
      snap.docs.forEach((d) => { const id = d.data().sermonId; if (byId.has(id)) counts.set(id, (counts.get(id) || 0) + 1); });
      const ids = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([id]) => id);
      setF({ popular: { ...f.popular, ids, updatedAt: new Date().toISOString() } });
      setPopularMsg(ids.length ? `Found ${ids.length} recordings from ${snap.size} plays. Remember to Save.` : "No plays in the last 90 days for this page's recordings.");
    } catch (err) {
      console.error(err);
      setPopularMsg("Couldn't read the play history.");
    }
    setPopularBusy(false);
  };

  const move = (arr, i, dir) => { const j = i + dir; if (j < 0 || j >= arr.length) return arr; const n = [...arr]; [n[i], n[j]] = [n[j], n[i]]; return n; };

  return (
    <>
      <Card title="Pinned audio" hint="Pinned recordings float to the top of the list. Turn on the Featured section to show them in their own block instead.">
        <Toggle label="Show pinned audio in a Featured section" checked={f.enabled} onChange={(v) => setF({ enabled: v })} disabled={!canEdit} />
        <Field label="Section title"><TextInput value={f.title} onChange={(v) => setF({ title: v })} maxLength={60} disabled={!canEdit || !f.enabled} /></Field>
        <Field label="Add a recording"><AudioPicker items={items} chosen={f.pinned.map((p) => p.id)} onAdd={(id) => setF({ pinned: [...f.pinned, { id, expiresAt: "" }] })} disabled={!canEdit} /></Field>
        {f.pinned.length === 0 && <p style={muted}>Nothing pinned.</p>}
        {f.pinned.map((p, i) => (
          <div key={p.id} style={row}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={rowTitle}>{label(p.id)}</div>
              <label style={expiry}>Stop featuring after <input type="date" style={{ ...input, width: "auto", padding: "5px 8px" }} value={p.expiresAt} onChange={(e) => setF({ pinned: f.pinned.map((x) => (x.id === p.id ? { ...x, expiresAt: e.target.value } : x)) })} disabled={!canEdit} /> {p.expiresAt ? "" : "(never)"}</label>
            </div>
            <Mini onClick={() => setF({ pinned: move(f.pinned, i, -1) })} disabled={!canEdit || i === 0}>▲</Mini>
            <Mini onClick={() => setF({ pinned: move(f.pinned, i, 1) })} disabled={!canEdit || i === f.pinned.length - 1}>▼</Mini>
            <Mini danger onClick={() => setF({ pinned: f.pinned.filter((x) => x.id !== p.id) })} disabled={!canEdit}>✕</Mini>
          </div>
        ))}
      </Card>

      <Card title="Featured series" hint="Gives one series its own section, in episode order. Set a recording's series in Content Manager → Edit (or when uploading).">
        <Toggle label="Feature a series" checked={f.series.enabled} onChange={(v) => setF({ series: { ...f.series, enabled: v } })} disabled={!canEdit} />
        <Field label="Series" hint={seriesNames.length ? "" : "No recordings on this page have a series yet."}>
          <Select value={f.series.name} onChange={(v) => setF({ series: { ...f.series, name: v } })} options={[["", "— choose a series —"], ...seriesNames.map((n) => [n, n]), ...(f.series.name && !seriesNames.includes(f.series.name) ? [[f.series.name, `${f.series.name} (no recordings)`]] : [])]} disabled={!canEdit || !f.series.enabled} />
        </Field>
        <Field label="Section title" hint="Blank = “Series: <name>”."><TextInput value={f.series.title} onChange={(v) => setF({ series: { ...f.series, title: v } })} maxLength={60} disabled={!canEdit || !f.series.enabled} /></Field>
      </Card>

      <Card title="Recently added" hint="A section of the newest recordings.">
        <Toggle label="Show a Recently added section" checked={f.recent.enabled} onChange={(v) => setF({ recent: { ...f.recent, enabled: v } })} disabled={!canEdit} />
        <Field label="Section title"><TextInput value={f.recent.title} onChange={(v) => setF({ recent: { ...f.recent, title: v } })} maxLength={60} disabled={!canEdit || !f.recent.enabled} /></Field>
        <div style={two}>
          <Field label="How many"><Select value={String(f.recent.count)} onChange={(v) => setF({ recent: { ...f.recent, count: Number(v) } })} options={[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => [String(n), String(n)])} disabled={!canEdit || !f.recent.enabled} /></Field>
          <Field label="Added within the last"><Select value={String(f.recent.days)} onChange={(v) => setF({ recent: { ...f.recent, days: Number(v) } })} options={[[7, "7 days"], [14, "14 days"], [30, "30 days"], [60, "60 days"], [90, "90 days"], [180, "6 months"], [365, "1 year"]].map(([n, l]) => [String(n), l])} disabled={!canEdit || !f.recent.enabled} /></Field>
        </div>
      </Card>

      <Card title="Most played" hint="The public can't see play counts, so this is a snapshot: press the button to work out the most-played recordings from the last 90 days, then Save. Refresh it whenever you like.">
        <Toggle label="Show a Most played section" checked={f.popular.enabled} onChange={(v) => setF({ popular: { ...f.popular, enabled: v } })} disabled={!canEdit} />
        <Field label="Section title"><TextInput value={f.popular.title} onChange={(v) => setF({ popular: { ...f.popular, title: v } })} maxLength={60} disabled={!canEdit || !f.popular.enabled} /></Field>
        <Field label="How many"><Select value={String(f.popular.count)} onChange={(v) => setF({ popular: { ...f.popular, count: Number(v) } })} options={[1, 2, 3, 4, 5, 6, 8, 10, 12].map((n) => [String(n), String(n)])} disabled={!canEdit || !f.popular.enabled} /></Field>
        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <Button onClick={refreshPopular} disabled={!canEdit || popularBusy}>{popularBusy ? "Working…" : "↻ Update from play history"}</Button>
          <span style={muted}>{f.popular.updatedAt ? `Last updated ${new Date(f.popular.updatedAt).toLocaleDateString()} · ${f.popular.ids.length} recordings` : "Not updated yet"}</span>
        </div>
        {popularMsg && <p style={muted} role="status">{popularMsg}</p>}
        {f.popular.ids.slice(0, f.popular.count).map((id, i) => <div key={id} style={{ ...muted, color: "var(--color-5c3a1e)" }}>{i + 1}. {label(id)}</div>)}
      </Card>

      <Card title="Curated collections" hint="Hand-pick recordings into your own named sections — a topic, a season, “start here”. Up to 6.">
        {f.collections.map((c, ci) => (
          <div key={c.id} style={collection_}>
            <div style={two}>
              <Field label="Title"><TextInput value={c.title} onChange={(v) => setF({ collections: f.collections.map((x) => (x.id === c.id ? { ...x, title: v } : x)) })} maxLength={60} disabled={!canEdit} /></Field>
              <Field label="Stop showing after"><input type="date" style={input} value={c.expiresAt} onChange={(e) => setF({ collections: f.collections.map((x) => (x.id === c.id ? { ...x, expiresAt: e.target.value } : x)) })} disabled={!canEdit} /></Field>
            </div>
            <Toggle label="Show this collection" checked={c.enabled} onChange={(v) => setF({ collections: f.collections.map((x) => (x.id === c.id ? { ...x, enabled: v } : x)) })} disabled={!canEdit} />
            <Field label="Add a recording"><AudioPicker items={items} chosen={c.ids} onAdd={(id) => setF({ collections: f.collections.map((x) => (x.id === c.id ? { ...x, ids: [...x.ids, id] } : x)) })} disabled={!canEdit || c.ids.length >= 30} /></Field>
            {c.ids.map((id, i) => (
              <div key={id} style={row}>
                <div style={{ flex: 1, minWidth: 0, ...rowTitle }}>{label(id)}</div>
                <Mini onClick={() => setF({ collections: f.collections.map((x) => (x.id === c.id ? { ...x, ids: move(x.ids, i, -1) } : x)) })} disabled={!canEdit || i === 0}>▲</Mini>
                <Mini onClick={() => setF({ collections: f.collections.map((x) => (x.id === c.id ? { ...x, ids: move(x.ids, i, 1) } : x)) })} disabled={!canEdit || i === c.ids.length - 1}>▼</Mini>
                <Mini danger onClick={() => setF({ collections: f.collections.map((x) => (x.id === c.id ? { ...x, ids: x.ids.filter((y) => y !== id) } : x)) })} disabled={!canEdit}>✕</Mini>
              </div>
            ))}
            <div><Button kind="danger" onClick={() => setF({ collections: f.collections.filter((x) => x.id !== c.id) })} disabled={!canEdit}>Delete collection {ci + 1}</Button></div>
          </div>
        ))}
        {f.collections.length < 6 && (
          <Button kind="dashed" onClick={() => setF({ collections: [...f.collections, { id: `c${Date.now().toString(36)}`, title: "New collection", ids: [], enabled: true, expiresAt: "" }] })} disabled={!canEdit}>+ New collection</Button>
        )}
      </Card>
    </>
  );
}

// Search box + results to add one recording from this page's list.
function AudioPicker({ items, chosen, onAdd, disabled }) {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    return items
      .filter((i) => !chosen.includes(i.id))
      .filter((i) => !term || `${i.title || ""} ${i.speaker || ""} ${i.series || ""}`.toLowerCase().includes(term))
      .sort((a, b) => (b.order ?? 0) - (a.order ?? 0))
      .slice(0, 6);
  }, [items, chosen, q]);
  return (
    <div>
      <input style={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by title, speaker or series…" disabled={disabled} aria-label="Find a recording" />
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
        {matches.map((i) => (
          <button key={i.id} type="button" style={pick} onClick={() => { onAdd(i.id); setQ(""); }} disabled={disabled}>
            + {i.title}{i.speaker ? <span style={{ color: "var(--color-9b7040)" }}> — {i.speaker}</span> : null}
          </button>
        ))}
        {matches.length === 0 && <span style={muted}>{items.length === 0 ? "No recordings on this page." : "No more matches."}</span>}
      </div>
    </div>
  );
}

const Mini = ({ children, onClick, disabled, danger }) => (
  <button type="button" onClick={onClick} disabled={disabled} style={{ width: "28px", height: "28px", flexShrink: 0, borderRadius: "8px", border: `1px solid ${danger ? "var(--color-fca5a5)" : "var(--color-eddfc8)"}`, background: "var(--color-fffdf9)", color: danger ? "var(--color-dc2626)" : "var(--color-7a4f10)", cursor: disabled ? "not-allowed" : "pointer", fontSize: "11px", opacity: disabled ? 0.5 : 1 }}>{children}</button>
);

const muted = { margin: 0, fontSize: "12.5px", color: "var(--color-9b7040)", fontFamily: "sans-serif" };
const row = { display: "flex", alignItems: "center", gap: "8px", padding: "8px 10px", borderRadius: "10px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" };
const rowTitle = { fontSize: "13.5px", color: "var(--color-3d2200)", fontFamily: "sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const expiry = { display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--color-9b7040)", fontFamily: "sans-serif", marginTop: "5px" };
const two = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" };
const pick = { textAlign: "left", padding: "8px 11px", borderRadius: "9px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fffdf9)", color: "var(--color-3d2200)", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer" };
const collection_ = { display: "flex", flexDirection: "column", gap: "10px", padding: "12px", borderRadius: "12px", border: "1px solid var(--color-eddfc8)", background: "var(--color-fdf8f3)" };
