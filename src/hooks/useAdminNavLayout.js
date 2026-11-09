import { useCallback, useEffect, useState } from "react";
import { emptyLayout, moveNextTo, sanitizeLayout } from "../config/adminNav";

// One admin's sidebar arrangement, remembered on this device (per account) —
// no database reads or writes, so it costs nothing and works instantly.
const keyFor = (uid) => `pfAdminNav:v1:${uid || "anon"}`;

function load(uid) {
  try {
    const raw = localStorage.getItem(keyFor(uid));
    return raw ? sanitizeLayout(JSON.parse(raw)) : emptyLayout();
  } catch {
    return emptyLayout();
  }
}

export default function useAdminNavLayout(uid) {
  const [layout, setLayout] = useState(() => load(uid));
  useEffect(() => { setLayout(load(uid)); }, [uid]);

  const update = useCallback((fn) => {
    setLayout((prev) => {
      const next = fn(prev);
      try { localStorage.setItem(keyFor(uid), JSON.stringify(next)); } catch { /* storage blocked — still works this visit */ }
      return next;
    });
  }, [uid]);

  return {
    layout,
    toggleCollapsed: (sectionId) => update((l) => ({ ...l, collapsed: { ...l.collapsed, [sectionId]: !l.collapsed[sectionId] } })),
    togglePin: (id) => update((l) => ({ ...l, pinned: l.pinned.includes(id) ? l.pinned.filter((x) => x !== id) : [...l.pinned, id] })),
    movePinned: (id, targetId, after, current) => update((l) => ({ ...l, pinned: moveNextTo(current, id, targetId, after) })),
    moveItem: (sectionId, id, targetId, after, current) => update((l) => ({ ...l, itemOrder: { ...l.itemOrder, [sectionId]: moveNextTo(current, id, targetId, after) } })),
    moveSection: (id, targetId, after, current) => update((l) => ({ ...l, sectionOrder: moveNextTo(current, id, targetId, after) })),
    reset: () => update(() => emptyLayout()),
  };
}
