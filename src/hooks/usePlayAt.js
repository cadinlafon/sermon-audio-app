import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { useAudioPlayer } from "../context/AudioPlayerContext";

// Start a recording at a given time from anywhere (notes, bookmarks, search…).
export default function usePlayAt() {
  const { playSermon, current, seekTo, audioRef } = useAudioPlayer();
  const navigate = useNavigate();

  return useCallback(async (audioId, seconds = 0, fallback = {}) => {
    if (current?.id === audioId) {
      seekTo(seconds);
      if (audioRef.current?.paused) audioRef.current.play().catch(() => {});
      navigate("/player");
      return;
    }
    let sermon = { id: audioId, ...fallback };
    try {
      const snap = await getDoc(doc(db, "audio", audioId));
      if (snap.exists()) sermon = { id: snap.id, ...snap.data() };
    } catch { /* offline — the fallback still plays a downloaded copy */ }
    await playSermon(sermon, seconds > 0 ? { resumeAt: seconds } : {});
    navigate("/player");
  }, [current, seekTo, audioRef, playSermon, navigate]);
}
