import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import useAudioList from "../hooks/useAudioList";
import usePageNotices from "../hooks/usePageNotices";
import AudioListView from "../components/AudioListView";

// Sunday School. Everything about how the page looks and behaves is set in
// Admin → Audio Page Manager and rendered by AudioListView. (Sunday School has
// always listed lessons oldest first — that is still its default sort.)
export default function SundaySchool() {
  const { playSermon } = useAudioPlayer();
  const notices = usePageNotices();

  const [lessons, setLessons, loading] = useAudioList(
    async () => {
      const q = query(collection(db, "audio"), where("type", "==", "sundayschool"));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return data;
    },
    (a) => a.type === "sundayschool"
  );

  const saveSummaryLocally = (id, aiSummary) => {
    setLessons((items) => items.map((item) => item.id === id ? { ...item, aiSummary } : item));
  };

  return (
    <AudioListView
      pageKey="sundayschool"
      items={lessons}
      loading={loading}
      onPlay={playSermon}
      onSummarySaved={saveSummaryLocally}
      notices={notices}
    />
  );
}
