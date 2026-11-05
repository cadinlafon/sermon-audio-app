import { useEffect, useState } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

// Every page notice (Admin → Audio Page Manager → Notices). The audio pages
// filter these themselves (page, schedule, category, placement) — see
// utils/pageNotices.js. One small read per page visit, as before.
export default function usePageNotices() {
  const [notices, setNotices] = useState([]);
  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, "pageNotices"))
      .then((snap) => { if (!cancelled) setNotices(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); })
      .catch((err) => console.warn("Couldn't load page notices", err));
    return () => { cancelled = true; };
  }, []);
  return notices;
}
