import { useEffect, useRef, useState } from "react";
import { loadAudioList } from "../utils/audioListCache";

// Loads an audio list with an offline fallback, and reloads whenever the
// connection changes so the list fills in as soon as you're back online.
export default function useAudioList(fetchFn, matchesType) {
  const [items, setItems] = useState([]);
  const [tick, setTick] = useState(0);
  const latest = useRef({ fetchFn, matchesType });
  latest.current = { fetchFn, matchesType };

  useEffect(() => {
    let cancelled = false;
    loadAudioList(() => latest.current.fetchFn(), (a) => latest.current.matchesType(a)).then((data) => {
      if (!cancelled) setItems(data);
    });
    return () => { cancelled = true; };
  }, [tick]);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener("online", bump);
    window.addEventListener("offline", bump);
    return () => {
      window.removeEventListener("online", bump);
      window.removeEventListener("offline", bump);
    };
  }, []);

  return [items, setItems];
}
