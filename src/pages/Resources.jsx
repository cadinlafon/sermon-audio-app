import { useEffect, useMemo, useState } from "react";
import { db } from "../firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { useAuth } from "../context/AuthContext";
import ResourceCard from "../components/ResourceCard";
import ResourceSearch from "../components/ResourceSearch";
import ResourceFilters from "../components/ResourceFilters";
import { sortResources } from "../lib/resourceTypes";

export default function Resources() {
  const { isAdmin } = useAuth();
  const [resources, setResources] = useState([]);
  const [categories, setCategories] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      try {
        const [resSnap, catSnap, secSnap] = await Promise.all([
          getDocs(collection(db, "resources")),
          getDocs(query(collection(db, "resourceCategories"), orderBy("order", "asc"))),
          getDocs(query(collection(db, "resourceSections"), orderBy("order", "asc"))),
        ]);

        const resData = resSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const catData = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const secData = secSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        setResources(resData);
        setCategories(catData);
        setSections(secData);
      } catch (err) {
        console.error("Failed to load resources:", err);
        setError("Couldn't load resources. Please try again in a moment.");
      }
      setLoading(false);
    }

    load();
  }, []);

  const categoriesById = useMemo(() => {
    const map = {};
    categories.forEach((c) => { map[c.id] = c; });
    return map;
  }, [categories]);

  // Non-admins only ever see published resources — the visible list is
  // filtered client-side; Firestore rules are the real backstop for writes.
  const visibleResources = useMemo(
    () => resources.filter((r) => isAdmin || r.published !== false),
    [resources, isAdmin]
  );

  const featured = useMemo(
    () => sortResources(visibleResources.filter((r) => r.featured), "oldest")
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [visibleResources]
  );

  const filtered = useMemo(() => {
    let list = visibleResources;

    if (typeFilter !== "all") list = list.filter((r) => r.type === typeFilter);
    if (categoryFilter !== "all") list = list.filter((r) => r.categoryId === categoryFilter);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) =>
        [r.title, r.description, r.author, r.type, categoriesById[r.categoryId]?.name]
          .filter(Boolean)
          .some((field) => field.toLowerCase().includes(q))
      );
    }

    return sortResources(list, sortBy);
  }, [visibleResources, typeFilter, categoryFilter, search, sortBy, categoriesById]);

  const activeFilterCount =
    (typeFilter !== "all" ? 1 : 0) +
    (categoryFilter !== "all" ? 1 : 0) +
    (sortBy !== "newest" ? 1 : 0);

  // Typing a search or picking a filter switches the page from "browse
  // the curated rows" to "show me matching results" — the two views
  // don't stack, since a filtered result set overlaps the rows anyway.
  const isSearchingOrFiltering = search.trim() !== "" || typeFilter !== "all" || categoryFilter !== "all";

  ////////////////////////////////////////////////
  // UI
  ////////////////////////////////////////////////

  if (loading) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Resources</h1>
        <p style={stateText}>Loading resources…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={page}>
        <h1 style={pageTitle}>Resources</h1>
        <p style={{ ...stateText, color: "#b3432c" }}>{error}</p>
      </div>
    );
  }

  return (
    <div style={page}>
      <h1 style={pageTitle}>Resources</h1>
      <p style={pageSubtitle}>Sermons, studies, and helpful content from Palouse Fellowship.</p>

      {resources.length === 0 ? (
        <p style={stateText}>No resources have been added yet. Check back soon.</p>
      ) : (
        <>
          <div style={toolbar}>
            <div style={searchRow}>
              <div style={{ flex: 1 }}>
                <ResourceSearch value={search} onChange={setSearch} />
              </div>
              <button
                style={showFilters ? { ...filtersBtn, ...filtersBtnActive } : filtersBtn}
                onClick={() => setShowFilters((s) => !s)}
              >
                ⚙ Filters
                {activeFilterCount > 0 && <span style={filtersBadge}>{activeFilterCount}</span>}
              </button>
            </div>

            {showFilters && (
              <ResourceFilters
                typeFilter={typeFilter}
                onTypeChange={setTypeFilter}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                categories={categories}
                sortBy={sortBy}
                onSortChange={setSortBy}
              />
            )}
          </div>

          {isSearchingOrFiltering ? (
            <Section title="Search Results">
              {filtered.length === 0 ? (
                <p style={stateText}>No resources match your search or filters.</p>
              ) : (
                <div style={grid}>
                  {filtered.map((r) => (
                    <ResourceCard key={r.id} resource={r} category={categoriesById[r.categoryId]} />
                  ))}
                </div>
              )}
            </Section>
          ) : (
            <>
              {featured.length > 0 && (
                <Section title="Featured">
                  <div style={grid}>
                    {featured.map((r) => (
                      <ResourceCard key={r.id} resource={r} category={categoriesById[r.categoryId]} />
                    ))}
                  </div>
                </Section>
              )}

              {sections.map((s) => {
                const rowResources = visibleResources.filter((r) => r.sectionIds?.includes(s.id));
                if (rowResources.length === 0) return null;

                return (
                  <Section key={s.id} title={s.name}>
                    <div style={grid}>
                      {rowResources.map((r) => (
                        <ResourceCard key={r.id} resource={r} category={categoriesById[r.categoryId]} />
                      ))}
                    </div>
                  </Section>
                );
              })}

              {featured.length === 0 && sections.every((s) => !visibleResources.some((r) => r.sectionIds?.includes(s.id))) && (
                <p style={stateText}>Nothing featured yet — search above to browse everything.</p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div style={section}>
      <h2 style={sectionTitle}>{title}</h2>
      {children}
    </div>
  );
}

////////////////////////////////////////////////
// STYLES
////////////////////////////////////////////////

const page = {
  padding: "32px 20px 60px",
  maxWidth: "1100px",
  margin: "0 auto",
  background: "#fdf8f3",
  minHeight: "100vh",
};

const pageTitle = {
  textAlign: "center",
  marginBottom: "4px",
  fontFamily: "'Georgia', serif",
  fontWeight: "normal",
  color: "#3d2200",
};

const pageSubtitle = {
  textAlign: "center",
  marginBottom: "28px",
  fontFamily: "sans-serif",
  fontSize: "14px",
  color: "#9b7040",
};

const section = { marginBottom: "36px" };
const sectionTitle = {
  fontSize: "18px",
  fontWeight: "normal",
  color: "#3d2200",
  fontFamily: "'Georgia', serif",
  marginBottom: "16px",
};

const toolbar = { display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" };

const searchRow = { display: "flex", gap: "10px", alignItems: "center" };

const filtersBtn = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "11px 16px",
  borderRadius: "12px",
  border: "1px solid #eddfc8",
  background: "#fffdf9",
  color: "#7a4f10",
  fontSize: "13px",
  fontFamily: "sans-serif",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
  flexShrink: 0,
};

const filtersBtnActive = {
  background: "linear-gradient(135deg, #c97c2e, #a85e18)",
  color: "#fff8ee",
  border: "none",
};

const filtersBadge = {
  fontSize: "10px",
  fontWeight: "700",
  minWidth: "16px",
  height: "16px",
  padding: "0 4px",
  borderRadius: "999px",
  background: "rgba(255,255,255,0.9)",
  color: "#a85e18",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
  gap: "16px",
};

const stateText = {
  textAlign: "center",
  color: "#b08050",
  fontFamily: "sans-serif",
  fontStyle: "italic",
  padding: "40px 0",
};
