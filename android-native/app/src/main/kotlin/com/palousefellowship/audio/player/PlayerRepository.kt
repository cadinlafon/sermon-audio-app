package com.palousefellowship.audio.player

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.google.firebase.auth.FirebaseAuth
import com.palousefellowship.audio.R
import com.palousefellowship.audio.data.config.PlaybackConfig
import com.palousefellowship.audio.data.config.RemoteConfigRepository
import com.palousefellowship.audio.data.config.resolveAudioConfig
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.prefs.PlayerSettings
import com.palousefellowship.audio.data.prefs.PlayerSettingsStore
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.data.repository.DownloadRepository
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * App-wide playback state, shared by the mini player and the full Player screen —
 * a port of the web app's AudioPlayerContext. Wraps a [MediaController] connected to
 * [PlaybackService] (background playback, lock screen, notification, headset
 * buttons). Owns the Play-Next queue, recently played, repeat / shuffle, the sleep
 * timer, listen tracking, resume, and the admin's automatic audio outro.
 */
class PlayerRepository(
    private val appContext: Context,
    private val audioRepository: AudioRepository,
    private val downloadRepository: DownloadRepository,
    private val listenProgressRepository: ListenProgressRepository,
    private val tracker: ListenTracker,
    private val settingsStore: PlayerSettingsStore,
    private val remoteConfig: RemoteConfigRepository,
    private val scope: CoroutineScope,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private companion object {
        const val OUTRO_NONE = 0
        const val OUTRO_PLAYING = 1
        const val OUTRO_DONE = 2
        val SUMMARIZABLE = setOf("sermon", "homily", "sundayschool")
    }

    private var controller: MediaController? = null
    private var current: Audio? = null
    private val upcoming = mutableListOf<Audio>()
    private val past = mutableListOf<Audio>()   // played out of the queue this session — what "repeat queue" loops
    private val history = mutableListOf<Audio>()

    private var outroPhase = OUTRO_NONE
    private var outroDurationMs = 0L
    private var outroWatch: Job? = null
    private var lastSeekAt = 0L

    private var positionTicker: Job? = null
    private var lastTickPositionMs = -1L
    private var pendingSeconds = 0.0
    private var sessionSeconds = 0L
    private var sessionLastAt = 0L
    private var playedCurrentId: String? = null
    private var lastRequest: Triple<Audio, Long, Boolean>? = null

    private var sleepJob: Job? = null
    private var sleepEndsAt = 0L

    private val _state = MutableStateFlow(PlayerUiState())
    val state: StateFlow<PlayerUiState> = _state.asStateFlow()

    private val admin: PlaybackConfig get() = resolveAudioConfig(remoteConfig.status.value.audioPages).playback
    private val quality: String get() = resolveAudioConfig(remoteConfig.status.value.audioPages).advanced.quality
    private val settings: PlayerSettings get() = settingsStore.settings.value.effective(admin)

    init {
        upcoming += settingsStore.loadList("queue", 200)
        history += settingsStore.loadList("history", 30)
        publish()
        // Speed / skip / repeat changes (the listener's or the admin's) apply live.
        scope.launch {
            kotlinx.coroutines.flow.combine(settingsStore.settings, remoteConfig.status) { _, _ -> Unit }.collect {
                applySpeed()
                publish()
            }
        }
        // Signed-in listener: quietly pick back up their last in-progress recording (paused).
        scope.launch {
            var attempted = false
            com.palousefellowship.audio.data.config.SessionRepositoryHolder.flow?.collect { s ->
                if (s.uid != null && !attempted) {
                    attempted = true
                    if (admin.rememberPosition && current == null) {
                        listenProgressRepository.getLastPlayed()?.let { (audio, pos) ->
                            if (current == null) loadAndPlay(audio, pos * 1000, autoplay = false, addToHistory = false)
                        }
                    }
                }
            }
        }
    }

    // ── state publishing ────────────────────────────────────────────────────

    private fun publish() {
        val s = settings
        _state.update {
            it.copy(
                queue = upcoming.toList(), history = history.toList(),
                hasNext = upcoming.isNotEmpty() || s.repeat == "queue",
                hasPrevious = true,
                speed = s.speed, skipBackSeconds = s.skipBack, skipForwardSeconds = s.skipForward,
                repeat = s.repeat, shuffle = s.shuffle,
            )
        }
    }

    private fun persistLists() {
        settingsStore.saveList("queue", upcoming)
        settingsStore.saveList("history", history)
    }

    private fun applySpeed() {
        // The outro always plays at normal speed.
        controller?.setPlaybackSpeed(if (outroPhase == OUTRO_PLAYING) 1f else settings.speed)
    }

    // ── controller listener ─────────────────────────────────────────────────

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _state.update { it.copy(isPlaying = isPlaying) }
            if (isPlaying) {
                onPlay()
                startPositionTicker()
            } else {
                positionTicker?.cancel()
                flushListenTime()
                saveProgressNow()
            }
        }

        override fun onPlaybackStateChanged(playbackState: Int) {
            _state.update {
                it.copy(
                    phase = when (playbackState) {
                        Player.STATE_BUFFERING -> PlaybackPhase.LOADING
                        Player.STATE_READY -> PlaybackPhase.READY
                        else -> it.phase
                    },
                    durationMs = if (outroPhase == OUTRO_DONE) outroDurationMs else controller?.duration?.takeIf { d -> d != C.TIME_UNSET } ?: it.durationMs,
                )
            }
            if (playbackState == Player.STATE_READY && outroPhase == OUTRO_PLAYING) outroWatch?.cancel()
            if (playbackState == Player.STATE_ENDED) onEnded()
        }

        override fun onPositionDiscontinuity(oldPosition: Player.PositionInfo, newPosition: Player.PositionInfo, reason: Int) {
            if (reason == Player.DISCONTINUITY_REASON_SEEK) lastSeekAt = System.currentTimeMillis()
        }

        override fun onPlayerError(error: PlaybackException) {
            if (outroPhase == OUTRO_PLAYING) { endOutro(); return } // an outro that can't play finishes quietly
            _state.update {
                it.copy(phase = PlaybackPhase.ERROR, isPlaying = false, errorMessage = "This recording couldn't be played. Check your connection and try again.")
            }
        }
    }

    fun connect(onReady: () -> Unit = {}) {
        if (controller != null) { onReady(); return }
        val token = SessionToken(appContext, ComponentName(appContext, PlaybackService::class.java))
        val future = MediaController.Builder(appContext, token).buildAsync()
        future.addListener({
            controller = future.get().also { it.addListener(playerListener) }
            applySpeed()
            onReady()
        }, MoreExecutors.directExecutor())
    }

    // ── playing ─────────────────────────────────────────────────────────────

    /** Starts [audio] (the queue is untouched, like the web's playSermon). [fromList] is accepted
     * for callers that have one but playback order is the queue's job ("Play all" fills it). */
    @Suppress("UNUSED_PARAMETER")
    fun play(audio: Audio, fromList: List<Audio> = listOf(audio), resumeAtSeconds: Long = 0) {
        loadAndPlay(audio, resumeAtSeconds * 1000)
    }

    fun togglePlayPause() {
        val c = controller ?: return
        if (outroPhase == OUTRO_DONE) { current?.let { loadAndPlay(it, 0) }; return }
        if (c.isPlaying) c.pause() else {
            if (c.playbackState == Player.STATE_ENDED) c.seekTo(0)
            c.play()
        }
    }

    fun seekTo(positionMs: Long) {
        lastSeekAt = System.currentTimeMillis()
        controller?.seekTo(positionMs)
        lastTickPositionMs = positionMs
        _state.update { it.copy(positionMs = positionMs) }
    }

    fun skipBack() = skip(-settings.skipBack * 1000L)
    fun skipForward() = skip(settings.skipForward * 1000L)

    fun skip(deltaMs: Long) {
        val c = controller ?: return
        val target = (c.currentPosition + deltaMs).coerceIn(0, c.duration.takeIf { it != C.TIME_UNSET } ?: Long.MAX_VALUE)
        seekTo(target)
    }

    /** Reloads whatever is currently selected — the player's "Tap to retry". */
    fun retry() {
        lastRequest?.let { (audio, _, _) -> loadAndPlay(audio, (_state.value.positionMs).takeIf { it > 0 } ?: lastRequest!!.second) }
            ?: _state.value.current?.let { loadAndPlay(it, 0) }
    }

    private fun loadAndPlay(audio: Audio, resumeAtMs: Long = 0, autoplay: Boolean = true, addToHistory: Boolean = true) {
        flushListenTime()
        saveProgressNow()
        positionTicker?.cancel()
        outroWatch?.cancel()
        outroPhase = OUTRO_NONE
        playedCurrentId = null
        lastTickPositionMs = -1
        lastRequest = Triple(audio, resumeAtMs, autoplay)
        current = audio
        if (addToHistory) {
            history.removeAll { it.id == audio.id }
            history.add(0, audio)
            while (history.size > 30) history.removeAt(history.size - 1)
            persistLists()
        }
        // "Remember my speed" switched off: every recording starts at the default again.
        if (!admin.rememberSpeed && settingsStore.settings.value.touchedSpeed) settingsStore.update { it.copy(touchedSpeed = false) }
        _state.update {
            it.copy(
                current = audio, phase = PlaybackPhase.LOADING, isPlaying = false, positionMs = resumeAtMs, durationMs = audio.duration * 1000,
                errorMessage = null, isOutro = false,
            )
        }
        publish()
        scope.launch {
            val c = controller
            if (c == null) {
                _state.update { it.copy(phase = PlaybackPhase.ERROR, errorMessage = "Player isn't ready yet — try again in a moment.") }
                return@launch
            }
            // Offline-first: a downloaded copy plays straight from disk.
            val local = downloadRepository.getDownload(audio.id)
            val streamAudio = if (quality == "saver" && !audio.transcribeStorageKey.isNullOrBlank()) audio.copy(audioStorageKey = audio.transcribeStorageKey) else audio
            val urlResult = if (local != null) Result.success(Uri.fromFile(java.io.File(local.localPath)).toString()) else audioRepository.resolvePlaybackUrl(streamAudio)
            urlResult.fold(
                onSuccess = { url ->
                    if (current?.id != audio.id) return@fold // superseded while the URL was being fetched
                    c.setMediaItem(mediaItem(audio.id, url, audio.title, audio.speaker, album(audio)))
                    c.prepare()
                    applySpeed()
                    if (resumeAtMs > 0) c.seekTo(resumeAtMs)
                    if (autoplay) c.play() else _state.update { it.copy(phase = PlaybackPhase.READY) }
                },
                onFailure = { error ->
                    _state.update { it.copy(phase = PlaybackPhase.ERROR, errorMessage = error.message ?: "This recording couldn't be loaded. Tap to retry.") }
                },
            )
        }
    }

    private fun album(a: Audio) = when (a.type) { "sermon" -> "Sermon"; "homily" -> "Homily"; "sundayschool" -> "Sunday School"; else -> "Palouse Fellowship" } + (a.date?.let { " · $it" } ?: "")

    private fun mediaItem(id: String, url: String, title: String, artist: String, album: String): MediaItem {
        val artworkUri = Uri.parse("android.resource://${appContext.packageName}/${R.mipmap.ic_launcher}")
        return MediaItem.Builder().setUri(url).setMediaId(id).setMediaMetadata(
            MediaMetadata.Builder().setTitle(title).setArtist(artist).setAlbumTitle(album).setArtworkUri(artworkUri).build(),
        ).build()
    }

    // ── queue (PlayNext / PlayAll / history) ────────────────────────────────

    /** Newest "Play Next" goes to the front, ahead of what was queued before it. */
    fun playNext(audio: Audio) {
        if (current == null) { play(audio); return }
        upcoming.removeAll { it.id == audio.id }
        upcoming.add(0, audio)
        persistLists(); publish()
    }

    fun removeFromQueue(index: Int) { if (index in upcoming.indices) { upcoming.removeAt(index); persistLists(); publish() } }

    fun clearQueue() { past.clear(); upcoming.clear(); persistLists(); publish() }

    fun moveQueueItem(from: Int, to: Int) {
        if (from == to || from !in upcoming.indices || to !in upcoming.indices) return
        upcoming.add(to, upcoming.removeAt(from)); persistLists(); publish()
    }

    fun shuffleQueueNow() { upcoming.shuffle(); persistLists(); publish() }

    /** "Play all": the first plays now, the rest line up behind it. */
    fun playAll(items: List<Audio>) {
        if (items.isEmpty()) return
        past.clear(); upcoming.clear(); upcoming.addAll(items.drop(1))
        persistLists(); publish()
        loadAndPlay(items.first())
    }

    /** "Add all to queue": appends whatever isn't already queued / playing. */
    fun addAllToQueue(items: List<Audio>): Int {
        val have = upcoming.map { it.id }.toMutableSet().also { s -> current?.let { s += it.id } }
        val fresh = items.filter { it.id !in have }
        upcoming.addAll(fresh)
        persistLists(); publish()
        if (current == null && upcoming.isNotEmpty()) advance(false)
        return fresh.size
    }

    /** "Add remaining": only the items after the current one in [items]. */
    fun addRemainingToQueue(items: List<Audio>): Int {
        val i = current?.let { cur -> items.indexOfFirst { it.id == cur.id } } ?: -1
        return addAllToQueue(if (i >= 0) items.drop(i + 1) else items)
    }

    /** Next recording: from the queue (shuffled if asked), or loop the queue when repeating. */
    fun next() = advance(false)

    private fun advance(auto: Boolean) {
        val cur = current
        if (upcoming.isEmpty()) {
            if (auto && settings.repeat == "queue" && cur != null) {
                val all = past.toList() + cur
                past.clear()
                if (all.size > 1) {
                    upcoming.clear(); upcoming.addAll(all.drop(1)); persistLists(); publish()
                    loadAndPlay(all.first())
                } else if (outroPhase != OUTRO_NONE) {
                    loadAndPlay(cur)
                } else {
                    controller?.let { it.seekTo(0); it.play() }
                }
            }
            return
        }
        val index = if (settings.shuffle) upcoming.indices.random() else 0
        val nextItem = upcoming.removeAt(index)
        if (cur != null) past.add(cur)
        persistLists()
        loadAndPlay(nextItem)
    }

    /** More than 3 s in → restart; otherwise the one before in recently-played (current goes back to the queue front). */
    fun previous() {
        val c = controller
        if (c != null && c.currentPosition > 3000) { seekTo(0); return }
        val prev = history.getOrNull(1)
        if (prev == null) { seekTo(0); return }
        current?.let { cur -> upcoming.removeAll { it.id == cur.id }; upcoming.add(0, cur) }
        history.removeAt(0)
        persistLists()
        loadAndPlay(prev, addToHistory = false)
        history.removeAll { it.id == prev.id }; history.add(0, prev); persistLists(); publish()
    }

    // ── settings the listener can change ────────────────────────────────────

    fun setSpeed(v: Float) { settingsStore.update { it.copy(speed = v, touchedSpeed = true) } }
    fun setSkipBack(v: Int) { settingsStore.update { it.copy(skipBack = v, touchedSkipBack = true) } }
    fun setSkipForward(v: Int) { settingsStore.update { it.copy(skipForward = v, touchedSkipForward = true) } }
    fun setRepeat(v: String) { settingsStore.update { it.copy(repeat = v) } }
    fun setShuffle(v: Boolean) { settingsStore.update { it.copy(shuffle = v) } }

    /** Pauses when the app goes to the background if the admin turned background playback off. */
    fun onAppBackgrounded() { if (!admin.backgroundPlayback && controller?.isPlaying == true) controller?.pause() }

    // ── sleep timer ─────────────────────────────────────────────────────────

    /** minutes → countdown, "endOfTrack" → pause when this recording ends, null → off. */
    fun setSleepTimer(minutes: Int?, endOfTrack: Boolean = false) {
        sleepJob?.cancel()
        when {
            endOfTrack -> _state.update { it.copy(sleepMode = "endOfTrack", sleepRemainingSeconds = 0) }
            minutes == null -> _state.update { it.copy(sleepMode = null, sleepRemainingSeconds = 0) }
            else -> {
                sleepEndsAt = System.currentTimeMillis() + minutes * 60_000L
                _state.update { it.copy(sleepMode = "duration", sleepRemainingSeconds = minutes * 60) }
                sleepJob = scope.launch {
                    while (true) {
                        val remaining = sleepEndsAt - System.currentTimeMillis()
                        if (remaining <= 0) {
                            controller?.pause()
                            _state.update { it.copy(sleepMode = null, sleepRemainingSeconds = 0) }
                            break
                        }
                        _state.update { it.copy(sleepRemainingSeconds = ((remaining + 999) / 1000).toInt()) }
                        delay(1000)
                    }
                }
            }
        }
    }

    // ── end of a recording: outro → repeat / sleep / next ───────────────────

    private fun shouldPlayOutro(): Boolean {
        val cfg = admin
        val cur = current ?: return false
        if (!cfg.outroEnabled || cfg.outroAudioUrl.isEmpty()) return false
        if (outroPhase != OUTRO_NONE) return false
        if (cur.type !in SUMMARIZABLE || cur.id.startsWith("doctrine_") || cur.id.startsWith("resource_")) return false
        if (System.currentTimeMillis() - lastSeekAt < 1500) return false     // seeking to the end isn't "finishing"
        if (_state.value.sleepMode == "endOfTrack" || settings.repeat == "track") return false
        if (!isOnline()) return false
        return true
    }

    private fun isOnline(): Boolean {
        val cm = appContext.getSystemService(Context.CONNECTIVITY_SERVICE) as android.net.ConnectivityManager
        return cm.getNetworkCapabilities(cm.activeNetwork)?.hasCapability(android.net.NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    private fun onEnded() {
        if (outroPhase == OUTRO_PLAYING) { endOutro(); return }
        if (outroPhase == OUTRO_DONE) return
        flushListenTime()
        saveProgressNow(completed = true)
        if (shouldPlayOutro()) startOutro() else finishRecording()
    }

    private fun startOutro() {
        val c = controller ?: return finishRecording()
        val cfg = admin
        outroDurationMs = _state.value.durationMs
        outroPhase = OUTRO_PLAYING
        _state.update {
            it.copy(
                isOutro = true, positionMs = 0, durationMs = 0,
                current = current?.copy(title = cfg.outroTitle, speaker = "Palouse Fellowship"),
            )
        }
        c.setMediaItem(mediaItem("outro", cfg.outroAudioUrl, cfg.outroTitle, "Palouse Fellowship", "Palouse Fellowship"))
        c.setPlaybackSpeed(1f)
        c.prepare(); c.play()
        outroWatch?.cancel()
        outroWatch = scope.launch { delay(12_000); if (outroPhase == OUTRO_PLAYING && controller?.playbackState != Player.STATE_READY) endOutro() }
    }

    private fun endOutro() {
        outroWatch?.cancel()
        if (outroPhase != OUTRO_PLAYING) return
        outroPhase = OUTRO_DONE
        _state.update { it.copy(isOutro = false, current = current, durationMs = outroDurationMs, positionMs = outroDurationMs) }
        applySpeed()
        finishRecording()
    }

    private fun finishRecording() {
        if (_state.value.sleepMode == "endOfTrack") { setSleepTimer(null); return }
        if (settings.repeat == "track") {
            current?.let { if (outroPhase != OUTRO_NONE) loadAndPlay(it, 0) else controller?.let { c -> c.seekTo(0); c.play() } }
            return
        }
        if (!admin.autoPlayNext) return
        advance(true)
    }

    // ── tracking ────────────────────────────────────────────────────────────

    private fun onPlay() {
        val audio = current ?: return
        if (outroPhase != OUTRO_NONE || playedCurrentId == audio.id) return
        playedCurrentId = audio.id
        val uid = auth.currentUser?.uid
        scope.launch { tracker.recordListen(audio.id, uid) }
        if (uid != null) scope.launch { tracker.trackPlay(uid, audio.id, audio.title, audio.speaker) }
    }

    private fun flushListenTime() {
        val seconds = pendingSeconds.toLong()
        val audio = current ?: return
        val uid = auth.currentUser?.uid ?: return
        if (seconds <= 0) return
        pendingSeconds -= seconds
        val isDoctrine = audio.id.startsWith("doctrine_")
        scope.launch { tracker.trackListenTime(uid, audio.id, audio.title, audio.speaker, seconds, audio.type, isDoctrine) }
        val now = System.currentTimeMillis()
        if (now - sessionLastAt > 10 * 60_000L) sessionSeconds = 0
        sessionSeconds += seconds; sessionLastAt = now
        val total = sessionSeconds
        scope.launch { tracker.noteSession(uid, total) }
    }

    private fun saveProgressNow(completed: Boolean = false) {
        val audio = current ?: return
        if (outroPhase != OUTRO_NONE && !completed) return
        if (!admin.rememberPosition) return
        if (audio.id.startsWith("doctrine_") || audio.id.startsWith("resource_")) return
        val durationSec = (if (completed) _state.value.durationMs else _state.value.durationMs) / 1000
        val posSec = if (completed) durationSec else _state.value.positionMs / 1000
        if (posSec <= 0) return
        scope.launch { listenProgressRepository.saveProgress(audio.id, posSec, durationSec) }
    }

    private fun startPositionTicker() {
        positionTicker?.cancel()
        var ticks = 0
        positionTicker = scope.launch {
            while (true) {
                val c = controller
                if (c != null) {
                    val pos = c.currentPosition.coerceAtLeast(0)
                    if (outroPhase == OUTRO_NONE && lastTickPositionMs >= 0) {
                        val elapsed = (pos - lastTickPositionMs) / 1000.0
                        if (elapsed > 0 && elapsed <= 5) pendingSeconds += elapsed
                    }
                    lastTickPositionMs = pos
                    _state.update {
                        it.copy(
                            positionMs = if (outroPhase == OUTRO_DONE) it.positionMs else pos,
                            durationMs = if (outroPhase == OUTRO_DONE) outroDurationMs else c.duration.takeIf { d -> d != C.TIME_UNSET } ?: it.durationMs,
                        )
                    }
                }
                delay(500)
                if (pendingSeconds >= 30) { flushListenTime(); saveProgressNow() }
                ticks++
            }
        }
    }

    fun release() {
        positionTicker?.cancel()
        controller?.removeListener(playerListener)
        controller?.release()
        controller = null
    }
}
