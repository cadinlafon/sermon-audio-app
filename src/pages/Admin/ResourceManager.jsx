import { useEffect, useMemo, useState } from "react";
import { db } from "../../firebase";
import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
} from "firebase/firestore";
import { useAuth } from "../../context/AuthContext";
import { deletePrivateAudio } from "../../utils/privateAudioUpload";
import { deletePublicImage } from "../../utils/imageUpload";
import ResourceTypeIcon from "../../components/ResourceTypeIcon";
import ResourceForm from "./ResourceForm";
import CategoryManager from "./CategoryManager";
import { RESOURCE_TYPES, RESOURCE_TYPE_META, blankResource, formatResourceDate } from "../../lib/resourceTypes";

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "unpublished", label: "Unpublished" },
];

const FEATURED_FILTERS = [
  { value: "all", label: "All" },
  { value: "featured", label: "Featured" },
  { value: "not-featured", label: "Not Featured" },
];

export default function ResourceManager() {
  const { user } = useAuth();
  const actor = user ? { uid: user.uid, email: user.email } : null;

  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [featuredFilter, setFeaturedFilter] = useState("all");

  const [editingResource, setEditingResource] = useState(null);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showSectionManager, setShowSectionManager] = useState(false);
  const [toast, setToast] = useState(null);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [resSnap, catSnap, secSnap] = await Promise.all([
        getDocs(collection(db, "resources")),
        getDocs(collection(db, "resourceCategories")),
        getDocs(collection(db, "resourceSections")),
      ]);
      setResources(resSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
      setSections(secSnap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    } catch (err) {
      console.error(err);
      setError("Couldn't load resources.");
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const categoriesById = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [categories]);

  const showToast = (message, isError) => {
    setToast({ message, isError });
    setTimeout(() => setToast(null), 3000);
  };

  ////////////////////////////////////////////////
  // FILTERING
  ////////////////////////////////////////////////
  const filtered = useMemo(() => {
    let list = [...resources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (typeFilter !== "all") list = list.filter((r) => r.type === typeFilter);
    if (categoryFilter !== "all") list = list.filter((r) => r.categoryId === categoryFilter);
    if (statusFilter === "published") list = list.filter((r) => r.published !== false);
    if (statusFilter === "unpublished") list = list.filter((r) => r.published === false);
    if (featuredFilter === "featured") list = list.filter((r) => r.featured);
    if (featuredFilter === "not-featured") list = list.filter((r) => !r.featured);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        [r.title, r.description, r.author, r.type, categoriesById[r.categoryId]?.name]
          .filter(Boolean)
          .some((f) => f.toLowerCase().includes(q))
      );
    }

    return list;
  }, [resources, typeFilter, categoryFilter, statusFilter, featuredFilter, search, categoriesById]);

  ////////////////////////////////////////////////
  // CREATE / EDIT
  ////////////////////////////////////////////////
  const nextOrder = () => resources.reduce((max, r) => Math.max(max, r.order ?? 0), 0) + 1;

  const openCreate = () => setEditingResource({ ...blankResource("audio"), order: nextOrder() });
  const openEdit = (r) => setEditingResource({ ...blankResource(r.type), ...r });

  const cleanupOrphans = (before, after) => {
    if (!before) return;
    if (before.audioStorageKey && before.audioStorageKey !== after.audioStorageKey) {
      deletePrivateAudio(before.audioStorageKey).catch((err) => console.error("Couldn't delete old audio:", err));
    }
    if (before.thumbnailStorageKey && before.thumbnailStorageKey !== after.thumbnailStorageKey) {
      deletePublicImage(before.thumbnailStorageKey).catch((err) => console.error("Couldn't delete old thumbnail:", err));
    }
  };

  const handleSave = async (form) => {
    const { id, ...payload } = form;
    payload.order = Number(payload.order) || 0;

    if (id) {
      const before = resources.find((r) => r.id === id);
      await updateDoc(doc(db, "resources", id), { ...payload, updatedAt: serverTimestamp(), updatedBy: actor?.email || "unknown" });
      cleanupOrphans(before, payload);
    } else {
      await addDoc(collection(db, "resources"), {
        ...payload,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor?.email || "unknown",
      });
    }

    setEditingResource(null);
    showToast("Saved successfully.");
    load();
  };

  ////////////////////////////////////////////////
  // QUICK ACTIONS
  ////////////////////////////////////////////////
  const togglePublished = async (r) => {
    try {
      await updateDoc(doc(db, "resources", r.id), { published: r.published === false, updatedAt: serverTimestamp() });
      load();
    } catch (err) {
      console.error(err);
      showToast("Couldn't update publish status.", true);
    }
  };

  const toggleFeatured = async (r) => {
    try {
      await updateDoc(doc(db, "resources", r.id), { featured: !r.featured, updatedAt: serverTimestamp() });
      load();
    } catch (err) {
      console.error(err);
      showToast("Couldn't update featured status.", true);
    }
  };

  const handleDuplicate = async (r) => {
    try {
      // eslint-disable-next-line no-unused-vars
      const { id, createdAt, updatedAt, ...rest } = r;
      await addDoc(collection(db, "resources"), {
        ...rest,
        title: `${r.title} (Copy)`,
        published: false,
        featured: false,
        order: nextOrder(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        updatedBy: actor?.email || "unknown",
      });
      showToast("Duplicated as an unpublished draft.");
      load();
    } catch (err) {
      console.error(err);
      showToast("Couldn't duplicate resource.", true);
    }
  };

  const handleDelete = async (r) => {
    if (!window.confirm(`Permanently delete "${r.title}"? This cannot be undone.`)) return;
    try {
      await deleteDoc(doc(db, "resources", r.id));
      if (r.audioStorageKey) deletePrivateAudio(r.audioStorageKey).catch((err) => console.error(err));
      if (r.thumbnailStorageKey) deletePublicImage(r.thumbnailStorageKey).catch((err) => console.error(err));
      (r.images || []).forEach((img) => {
        if (img.storageKey) deletePublicImage(img.storageKey).catch((err) => console.error(err));
      });
      showToast("Resource deleted.");
      load();
    } catch (err) {
      console.error(err);
      showToast("Couldn't delete resource.", true);
    }
  };

  const move = async (r, direction) => {
    const sorted = [...resources].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const index = sorted.findIndex((x) => x.id === r.id);
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= sorted.length) return;

    try {
      [sorted[index], sorted[swapWith]] = [sorted[swapWith], sorted[index]];
      await Promise.all(sorted.map((res, i) => updateDoc(doc(db, "resources", res.id), { order: i })));
      load();
    } catch (err) {
      console.error(err);
      showToast("Couldn't reorder resources.", true);
    }
  };

  ////////////////////////////////////////////////
  // UI
  ////////////////////////////////////////////////

  if (loading) return <p style={hintText}>Loading resources…</p>;
  if (error) return <p style={{ ...hintText, color: "#b3432c" }}>{error}</p>;

  return (
    <div style={page}>
      <div style={pageHeader}>
        <div>
          <h1 style={pageTitle}>Resources</h1>
          <p style={pageSubtitle}>Manage the resource library visitors browse on the Resources page.</p>
        </div>
        <div style={headerActions}>
          <button style={ghostBtn} onClick={() => setShowCategoryManager(true)}>Manage Categories</button>
          <button style={ghostBtn} onClick={() => setShowSectionManager(true)}>Manage Rows</button>
          <button style={addBtn} onClick={openCreate}>+ New Resource</button>
        </div>
      </div>

      <div style={toolbar}>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search resources…" style={searchInput} />

        <div style={filterRow}>
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={filterSelect}>
            <option value="all">All Types</option>
            {RESOURCE_TYPES.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_META[t].label}</option>)}
          </select>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={filterSelect}>
            <option value="all">All Categories</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={filterSelect}>
            {STATUS_FILTERS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <select value={featuredFilter} onChange={(e) => setFeaturedFilter(e.target.value)} style={filterSelect}>
            {FEATURED_FILTERS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </div>
      </div>

      <div style={tableWrap}>
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Title</th>
              <th style={th}>Type</th>
              <th style={th}>Category</th>
              <th style={th}>Status</th>
              <th style={th}>Featured</th>
              <th style={th}>Added</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} style={tr}>
                <td style={td}>
                  <div style={titleCell}>
                    {r.thumbnailUrl ? <img src={r.thumbnailUrl} alt="" style={rowThumb} /> : <span style={rowThumbFallback}><ResourceTypeIcon type={r.type} size={16} /></span>}
                    <span>{r.title}</span>
                  </div>
                </td>
                <td style={td}><span style={typeTag}><ResourceTypeIcon type={r.type} size={12} /> {RESOURCE_TYPE_META[r.type]?.label}</span></td>
                <td style={td}><span style={mutedText}>{categoriesById[r.categoryId]?.name || "—"}</span></td>
                <td style={td}>
                  <span style={r.published === false ? statusBadgeOff : statusBadgeOn}>
                    {r.published === false ? "Unpublished" : "Published"}
                  </span>
                </td>
                <td style={td}>{r.featured ? <span style={featuredBadge}>★ Featured</span> : <span style={mutedText}>—</span>}</td>
                <td style={td}><span style={mutedText}>{r.createdAt?.toDate ? r.createdAt.toDate().toLocaleDateString() : "—"}</span></td>
                <td style={td}>
                  <div style={actionRow}>
                    <button style={moveBtn} onClick={() => move(r, -1)}>▲</button>
                    <button style={moveBtn} onClick={() => move(r, 1)}>▼</button>
                    <button style={actionBtn} onClick={() => openEdit(r)}>Edit</button>
                    <button style={actionBtn} onClick={() => window.open(`/resources/${r.id}`, "_blank")}>Preview</button>
                    <button style={actionBtn} onClick={() => handleDuplicate(r)}>Duplicate</button>
                    <button style={actionBtn} onClick={() => togglePublished(r)}>{r.published === false ? "Publish" : "Unpublish"}</button>
                    <button style={actionBtn} onClick={() => toggleFeatured(r)}>{r.featured ? "Unfeature" : "Feature"}</button>
                    <button style={{ ...actionBtn, color: "#dc2626", borderColor: "#fca5a5" }} onClick={() => handleDelete(r)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && <p style={empty}>No resources match your filters.</p>}
      </div>

      {editingResource && (
        <ResourceForm
          resource={editingResource}
          categories={categories}
          sections={sections}
          allResources={resources}
          actor={actor}
          onSave={handleSave}
          onClose={() => setEditingResource(null)}
        />
      )}

      {showCategoryManager && (
        <CategoryManager
          collectionName="resourceCategories"
          title="Manage Categories"
          addPlaceholder="New category name…"
          deleteWarning="Resources using it will keep it as an unlabeled category."
          items={categories}
          onChanged={load}
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {showSectionManager && (
        <CategoryManager
          collectionName="resourceSections"
          title="Manage Rows"
          addPlaceholder="New row name, e.g. Lectures…"
          deleteWarning="Resources assigned to it will just no longer appear in that row."
          items={sections}
          onChanged={load}
          onClose={() => setShowSectionManager(false)}
        />
      )}

      {toast && (
        <div style={toast.isError ? { ...toastBox, ...toastError } : toastBox}>{toast.message}</div>
      )}
    </div>
  );
}

////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////

const page = { maxWidth: "1200px" };
const pageHeader = { display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "24px" };
const pageTitle = { fontSize: "26px", fontWeight: "normal", color: "#3d2200", margin: "0 0 4px", fontFamily: "'Georgia', serif" };
const pageSubtitle = { fontSize: "14px", color: "#9b7040", fontFamily: "sans-serif", margin: 0 };
const headerActions = { display: "flex", gap: "10px", flexWrap: "wrap" };
const ghostBtn = { padding: "10px 16px", borderRadius: "10px", border: "1px solid #eddfc8", background: "transparent", color: "#7a4f10", fontSize: "13px", fontFamily: "sans-serif", cursor: "pointer", whiteSpace: "nowrap" };
const addBtn = { padding: "10px 18px", borderRadius: "10px", border: "none", background: "linear-gradient(135deg, #c97c2e, #a85e18)", color: "#fff8ee", fontSize: "14px", fontFamily: "sans-serif", cursor: "pointer", boxShadow: "0 3px 10px rgba(160,80,20,0.25)", whiteSpace: "nowrap" };

const toolbar = { display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" };
const searchInput = { padding: "9px 14px", borderRadius: "10px", border: "1px solid #eddfc8", background: "#fffdf9", fontSize: "13px", fontFamily: "sans-serif", color: "#3d2200", outline: "none", width: "320px", maxWidth: "100%" };
const filterRow = { display: "flex", gap: "8px", flexWrap: "wrap" };
const filterSelect = { padding: "7px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "#fdf8f3", fontSize: "12px", fontFamily: "sans-serif", color: "#3d2200" };

const tableWrap = { background: "#fffdf9", border: "1px solid #eddfc8", borderRadius: "16px", overflow: "auto", boxShadow: "0 2px 12px rgba(160,100,40,0.07)" };
const table = { width: "100%", borderCollapse: "collapse", minWidth: "1100px" };
const th = { padding: "12px 16px", textAlign: "left", fontSize: "11px", fontFamily: "sans-serif", color: "#9b7040", letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: "1px solid #eddfc8", background: "#fdf8f3" };
const tr = { borderBottom: "1px solid #f0e4d0" };
const td = { padding: "12px 16px", verticalAlign: "middle" };

const titleCell = { display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", fontFamily: "'Georgia', serif", color: "#3d2200" };
const rowThumb = { width: "34px", height: "34px", objectFit: "cover", borderRadius: "8px", border: "1px solid #eddfc8" };
const rowThumbFallback = { width: "34px", height: "34px", borderRadius: "8px", background: "#fdf1de", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

const typeTag = { display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", padding: "3px 9px", borderRadius: "999px", background: "#fdf1de", color: "#7a4f10", fontFamily: "sans-serif", whiteSpace: "nowrap" };
const mutedText = { fontSize: "12px", color: "#9b7040", fontFamily: "sans-serif" };
const statusBadgeOn = { fontSize: "11px", padding: "3px 9px", borderRadius: "999px", background: "#dcfce7", color: "#166534", fontFamily: "sans-serif" };
const statusBadgeOff = { fontSize: "11px", padding: "3px 9px", borderRadius: "999px", background: "#e9e4d9", color: "#4b5563", fontFamily: "sans-serif" };
const featuredBadge = { fontSize: "11px", padding: "3px 9px", borderRadius: "999px", background: "#f6e4b0", color: "#7a5a10", fontFamily: "sans-serif" };

const actionRow = { display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" };
const actionBtn = { padding: "5px 10px", borderRadius: "8px", border: "1px solid #eddfc8", background: "transparent", color: "#5c3a1e", fontSize: "11px", fontFamily: "sans-serif", cursor: "pointer" };
const moveBtn = { width: "22px", height: "22px", padding: 0, borderRadius: "6px", border: "1px solid #eddfc8", background: "#fdf8f3", color: "#7a4f10", fontSize: "9px", cursor: "pointer" };

const empty = { textAlign: "center", color: "#b08050", fontFamily: "sans-serif", fontStyle: "italic", padding: "30px" };
const hintText = { fontSize: "13px", color: "#b08050", fontFamily: "sans-serif" };

const toastBox = { position: "fixed", bottom: "24px", right: "24px", background: "#166534", color: "#fff", padding: "12px 18px", borderRadius: "10px", fontSize: "13px", fontFamily: "sans-serif", boxShadow: "0 4px 16px rgba(0,0,0,0.2)", zIndex: 4000 };
const toastError = { background: "#991b1b" };
