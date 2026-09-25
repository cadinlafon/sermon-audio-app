import { useCallback, useEffect, useRef, useState } from "react";
import { loadCastSdk, guessContentType } from "../utils/cast";

// Chromecast sender. Design: the local <audio> element stays the source of
// truth for every control, timer, and stat in the app; while casting it keeps
// playing *muted* at 1× and the receiver is kept in step with it (play, pause,
// seek, track changes). Remote changes (e.g. the Google Home app) are applied
// back to the local element. That way no other component needs to know about
// casting.
export default function useCastSync({ audioRef, current, audioUrl, getRemoteUrl }) {
  const [state, setState] = useState({ status: "idle", casting: false, deviceName: "", devicesAvailable: null, error: "" });
  const latest = useRef({ current, audioUrl, getRemoteUrl });
  latest.current = { current, audioUrl, getRemoteUrl };
  const ensuring = useRef(null);
  const remoteUrlRef = useRef("");
  const api = useRef(null);
  const castingRef = useRef(false);
  const lastLocalCmd = useRef(0);
  const lastRemoteApply = useRef(0);
  const patch = (p) => setState((s) => ({ ...s, ...p }));

  const loadMedia = useCallback(async (startAt = 0, autoplay = true) => {
    const a = api.current;
    const session = a?.ctx.getCurrentSession();
    const { current: sermon, audioUrl: url } = latest.current;
    if (!session || !sermon || !url) return;
    // A downloaded copy plays from a local blob: URL the TV can't reach, so
    // ask for a normal streaming URL for the receiver instead.
    let remoteUrl = url;
    if (url.startsWith("blob:")) {
      try {
        remoteUrl = await latest.current.getRemoteUrl(sermon);
      } catch {
        patch({ error: "Couldn't get a streaming link for the TV. Connect to the internet and try again." });
        a.ctx.endCurrentSession(true);
        return;
      }
    }
    const { chrome } = window;
    remoteUrlRef.current = remoteUrl;
    const info = new chrome.cast.media.MediaInfo(remoteUrl, guessContentType(sermon));
    info.streamType = chrome.cast.media.StreamType.BUFFERED;
    const meta = new chrome.cast.media.MusicTrackMediaMetadata();
    meta.title = sermon.title || "Recording";
    meta.artist = sermon.speaker || "";
    meta.albumName = "Palouse Fellowship";
    meta.images = [new chrome.cast.Image(`${window.location.origin}/icons/icon-512.png`)];
    info.metadata = meta;
    const req = new chrome.cast.media.LoadRequest(info);
    req.currentTime = startAt;
    req.autoplay = autoplay;
    lastLocalCmd.current = Date.now();
    try {
      await session.loadMedia(req);
      patch({ error: "" });
    } catch (code) {
      patch({ error: `Couldn't start playback on the TV (${code}). The audio host may need to allow Chromecast.` });
      a.ctx.endCurrentSession(true); // hand sound back to this device
    }
  }, []);

  const ensure = useCallback(() => {
    if (api.current) return Promise.resolve(api.current);
    if (!ensuring.current) ensuring.current = setup().catch((e) => { ensuring.current = null; throw e; });
    return ensuring.current;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setup = async () => {
    patch({ status: "loading", error: "" });
    try {
      await loadCastSdk();
    } catch (e) {
      patch({ status: "unavailable", error: e.message });
      throw e;
    }
    const { cast, chrome } = window;
    const ctx = cast.framework.CastContext.getInstance();
    ctx.setOptions({
      receiverApplicationId: chrome.cast.media.DEFAULT_MEDIA_RECEIVER_APP_ID,
      autoJoinPolicy: chrome.cast.AutoJoinPolicy.ORIGIN_SCOPED,
    });
    const player = new cast.framework.RemotePlayer();
    const controller = new cast.framework.RemotePlayerController(player);
    api.current = { ctx, player, controller };

    ctx.addEventListener(cast.framework.CastContextEventType.CAST_STATE_CHANGED, (e) => {
      patch({ devicesAvailable: e.castState !== "NO_DEVICES_AVAILABLE" });
    });
    ctx.addEventListener(cast.framework.CastContextEventType.SESSION_STATE_CHANGED, (e) => {
      const S = cast.framework.SessionState;
      if (e.sessionState === S.SESSION_STARTED || e.sessionState === S.SESSION_RESUMED) {
        castingRef.current = true;
        patch({ casting: true, deviceName: ctx.getCurrentSession()?.getCastDevice()?.friendlyName || "TV", error: "" });
        const audio = audioRef.current;
        if (audio && e.sessionState === S.SESSION_STARTED) loadMedia(audio.currentTime || 0, !audio.paused);
      } else if (e.sessionState === S.SESSION_ENDED) {
        castingRef.current = false;
        patch({ casting: false, deviceName: "" });
      }
    });
    controller.addEventListener(cast.framework.RemotePlayerEventType.ANY_CHANGE, (e) => {
      const audio = audioRef.current;
      if (!castingRef.current || !audio) return;
      const now = Date.now();
      if (now - lastLocalCmd.current < 2000) return; // let our own command settle
      if (e.field === "isPaused") {
        lastRemoteApply.current = now;
        if (player.isPaused && !audio.paused) audio.pause();
        else if (!player.isPaused && audio.paused) audio.play().catch(() => {});
      } else if (e.field === "currentTime" && player.playerState === "PLAYING" && player.mediaInfo?.contentId === remoteUrlRef.current) {
        if (Math.abs(player.currentTime - audio.currentTime) > 2.5) {
          lastRemoteApply.current = now;
          audio.currentTime = player.currentTime;
        }
      }
    });
    patch({ status: "ready", devicesAvailable: ctx.getCastState() !== "NO_DEVICES_AVAILABLE" });
    return api.current;
  };

  // Local element → receiver.
  useEffect(() => {
    if (!state.casting) return undefined;
    const audio = audioRef.current;
    if (!audio) return undefined;
    const remote = () => api.current;
    const onPlay = () => {
      const r = remote(); lastLocalCmd.current = Date.now();
      if (r?.player.isPaused) r.controller.playOrPause();
    };
    const onPause = () => {
      const r = remote(); lastLocalCmd.current = Date.now();
      if (r && !r.player.isPaused && !audio.ended) r.controller.playOrPause();
    };
    const onSeeked = () => {
      if (Date.now() - lastRemoteApply.current < 800) return;
      const r = remote(); if (!r) return;
      lastLocalCmd.current = Date.now();
      r.player.currentTime = audio.currentTime;
      r.controller.seek();
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("seeked", onSeeked);
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("seeked", onSeeked);
    };
  }, [state.casting, audioRef]);

  const start = useCallback(async () => {
    const { ctx } = await ensure();
    try {
      await ctx.requestSession();
    } catch (code) {
      if (code !== "cancel") patch({ error: code === "receiver_unavailable" ? "No Chromecast devices found on this network." : `Couldn't connect (${code}).` });
    }
  }, [ensure]);

  const stop = useCallback(() => { api.current?.ctx.endCurrentSession(true); }, []);

  return { ...state, ensure, start, stop, castLoad: loadMedia, isCastingRef: castingRef };
}
