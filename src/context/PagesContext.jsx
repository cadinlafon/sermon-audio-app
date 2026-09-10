import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { PAGE_REGISTRY } from "../pageRegistry";
import { getEffectiveConfig, mergeBaseConfig } from "../lib/pageManager";

const PagesContext = createContext();

////////////////////////////////////////////////////////////////
// Live Page Manager configuration, mirrored from Firestore.
//
// Follows the same pattern as ShutdownContext: a single
// onSnapshot listener keeps every client in sync in real time
// so Page Manager changes made by an admin show up immediately
// for everyone else, without a refresh.
////////////////////////////////////////////////////////////////

export function PagesProvider({ children }) {
  const [docsById, setDocsById] = useState({});
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "pages"),
      (snap) => {
        const map = {};
        snap.forEach((d) => {
          map[d.id] = d.data();
        });
        setDocsById(map);
        setLoading(false);
      },
      () => setLoading(false)
    );

    return () => unsub();
  }, []);

  // Re-evaluate scheduled changes periodically so a session left
  // open doesn't miss a schedule that becomes due while idle.
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const pages = useMemo(() => {
    return PAGE_REGISTRY.map((entry) => getEffectiveConfig(entry, docsById[entry.id]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsById, tick]);

  const baseConfigs = useMemo(() => {
    return PAGE_REGISTRY.map((entry) => mergeBaseConfig(entry, docsById[entry.id]));
  }, [docsById]);

  const getPage = (id) => pages.find((p) => p.id === id) || null;
  const getBasePage = (id) => baseConfigs.find((p) => p.id === id) || null;

  const value = {
    pages,
    baseConfigs,
    getPage,
    getBasePage,
    rawDocsById: docsById,
    loading,
  };

  return <PagesContext.Provider value={value}>{children}</PagesContext.Provider>;
}

export function usePages() {
  return useContext(PagesContext);
}
