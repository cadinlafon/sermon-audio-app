import { useCallback, useEffect, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { auth, db } from "../firebase";
import { loadAudioList } from "../utils/audioListCache";
import { fetchAllNotes } from "../utils/notes";
import { buildIndex } from "../utils/searchEngine";
import { DOCTRINE_SCHEDULE } from "../data/doctrineSchedule";

// Loads every searchable source (all best-effort — a source that fails or is
// blocked just contributes nothing) and builds the in-memory index.
// Full transcripts are heavy, so they load only when asked for.
export default function useSearchIndex() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [transcriptsLoaded, setTranscriptsLoaded] = useState(false);
  const [loadingTranscripts, setLoadingTranscripts] = useState(false);
  const parts = useRef({ audio: [], resources: [], categories: [], doctrine: null, topics: [], notes: [], transcripts: [] });

  const rebuild = useCallback(() => setItems(buildIndex({ ...parts.current, schedule: DOCTRINE_SCHEDULE })), []);

  useEffect(() => {
    let cancelled = false;
    const safe = (p, fallback) => p.catch(() => fallback);
    (async () => {
      const [audio, resources, categories, doctrine, topics] = await Promise.all([
        safe(loadAudioList(async () => (await getDocs(collection(db, "audio"))).docs.map((d) => ({ id: d.id, ...d.data() })), () => true), []),
        safe(getDocs(collection(db, "resources")).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))), []),
        safe(getDocs(collection(db, "resourceCategories")).then((s) => s.docs.map((d) => ({ id: d.id, ...d.data() }))), []),
        safe(getDoc(doc(db, "doctrineWeeks", "current")).then((s) => (s.exists() ? s.data() : null)), null),
        safe(getDoc(doc(db, "doctrineWeeks", "topics")).then((s) => (s.exists() && Array.isArray(s.data().weeks) ? s.data().weeks.filter((w) => w.published !== false) : [])), []),
      ]);
      if (cancelled) return;
      Object.assign(parts.current, { audio, resources, categories, doctrine, topics });
      rebuild();
      setLoading(false);
    })();
    const unsub = onAuthStateChanged(auth, async (user) => {
      parts.current.notes = user ? await fetchAllNotes(user.uid).catch(() => []) : [];
      if (!cancelled) rebuild();
    });
    return () => { cancelled = true; unsub(); };
  }, [rebuild]);

  const loadTranscripts = useCallback(async () => {
    setLoadingTranscripts(true);
    try {
      const snap = await getDocs(collection(db, "transcripts"));
      const titles = new Map(parts.current.audio.map((a) => [a.id, a.title]));
      parts.current.transcripts = snap.docs.map((d) => {
        const x = d.data();
        const segments = Array.isArray(x.segments) ? x.segments : [];
        return { audioId: d.id, title: titles.get(d.id) || "Transcript", segments, text: segments.map((s) => s.text).join(" ") };
      });
      setTranscriptsLoaded(true);
      rebuild();
    } catch (error) {
      console.warn("Couldn't load transcripts", error);
      setTranscriptsLoaded(true);
    }
    setLoadingTranscripts(false);
  }, [rebuild]);

  return { items, loading, transcriptsLoaded, loadingTranscripts, loadTranscripts };
}
