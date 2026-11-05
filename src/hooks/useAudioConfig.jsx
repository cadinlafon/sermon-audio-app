import { createContext, useContext, useMemo } from "react";
import { useShutdown } from "../context/ShutdownContext";
import { resolveAudioConfig } from "../data/audioPageDefaults";

// The Audio Page Manager's settings, resolved for one audio page.
//   const cfg = useAudioConfig("sermons");   // cfg.page, cfg.categories, cfg.playback, cfg.advanced
// Components below an <AudioConfigContext.Provider> (the audio list pages wrap
// their cards in one; the admin visualizer wraps its preview with DRAFT
// settings) read that instead of the saved settings — so a card renders the
// same everywhere without being told which page it's on.
export const AudioConfigContext = createContext(null);

export default function useAudioConfig(pageKey = "sermons") {
  const override = useContext(AudioConfigContext);
  const { audioPages } = useShutdown() || {};
  return useMemo(() => override || resolveAudioConfig(audioPages, pageKey), [override, audioPages, pageKey]);
}
