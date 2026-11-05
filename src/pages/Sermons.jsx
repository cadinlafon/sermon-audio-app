import { db } from "../firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { useAudioPlayer } from "../context/AudioPlayerContext";
import useAudioList from "../hooks/useAudioList";
import usePageNotices from "../hooks/usePageNotices";
import AudioListView from "../components/AudioListView";

// Sermons & Homilies. Everything about how the page looks and behaves is set
// in Admin → Audio Page Manager and rendered by AudioListView.
export default function Sermons() {
  const { playSermon } = useAudioPlayer();
  const notices = usePageNotices();

  const [sermons, setSermons, loading] = useAudioList(
    async () => {
      const q = query(collection(db, "audio"), where("type", "in", ["sermon", "homily"]));
      const snapshot = await getDocs(q);
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      data.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      return data;
    },
    (a) => a.type === "sermon" || a.type === "homily"
  );

  const saveSummaryLocally = (id, aiSummary) => {
    setSermons((items) => items.map((item) => item.id === id ? { ...item, aiSummary } : item));
  };

  return (
    <AudioListView
      pageKey="sermons"
      items={sermons}
      loading={loading}
      onPlay={playSermon}
      onSummarySaved={saveSummaryLocally}
      notices={notices}
    />
  );
}
