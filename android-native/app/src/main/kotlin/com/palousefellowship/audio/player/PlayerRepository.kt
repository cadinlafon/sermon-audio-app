package com.palousefellowship.audio.player

import android.content.ComponentName
import android.content.Context
import android.net.Uri
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.MoreExecutors
import com.palousefellowship.audio.R
import com.palousefellowship.audio.data.model.Audio
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
 * App-wide playback state, shared by the mini player and the full Player
 * screen so they always agree. Wraps a [MediaController] connected to
 * [PlaybackService] — the controller is how any part of the app talks to
 * the actual ExoPlayer instance running in that (possibly background)
 * service, per Media3's session architecture.
 *
 * Also owns a simple in-memory queue (the list a screen was playing from)
 * so Previous/Next "where appropriate" (Step 5) works without needing
 * every item's signed URL resolved up front.
 */
class PlayerRepository(
    private val appContext: Context,
    private val audioRepository: AudioRepository,
    private val downloadRepository: DownloadRepository,
    private val listenProgressRepository: ListenProgressRepository,
    private val scope: CoroutineScope,
) {
    private var controller: MediaController? = null
    private var queue: List<Audio> = emptyList()
    private var queueIndex: Int = -1
    private var positionTicker: Job? = null
    private var progressTickCount = 0

    private val _state = MutableStateFlow(PlayerUiState())
    val state: StateFlow<PlayerUiState> = _state.asStateFlow()

    private val playerListener = object : Player.Listener {
        override fun onIsPlayingChanged(isPlaying: Boolean) {
            _state.update { it.copy(isPlaying = isPlaying) }
            if (isPlaying) {
                startPositionTicker()
            } else {
                positionTicker?.cancel()
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
                    durationMs = controller?.duration?.takeIf { d -> d != androidx.media3.common.C.TIME_UNSET } ?: it.durationMs,
                )
            }
        }

        override fun onPlayerError(error: PlaybackException) {
            _state.update {
                it.copy(
                    phase = PlaybackPhase.ERROR,
                    isPlaying = false,
                    errorMessage = "This recording couldn't be played. Check your connection and try again.",
                )
            }
        }
    }

    fun connect(onReady: () -> Unit = {}) {
        if (controller != null) { onReady(); return }
        val token = SessionToken(appContext, ComponentName(appContext, PlaybackService::class.java))
        val future = MediaController.Builder(appContext, token).buildAsync()
        future.addListener({
            controller = future.get().also { it.addListener(playerListener) }
            onReady()
        }, MoreExecutors.directExecutor())
    }

    /** Starts playing [audio] and remembers [fromList] (the screen's
     * current list, in display order) as the queue for Previous/Next.
     * [resumeAtSeconds] jumps straight to that point once ready — used by
     * Bookmarks / shared timestamp links. */
    fun play(audio: Audio, fromList: List<Audio> = listOf(audio), resumeAtSeconds: Long = 0) {
        queue = fromList
        queueIndex = fromList.indexOfFirst { it.id == audio.id }.coerceAtLeast(0)
        loadAndPlay(audio, resumeAtSeconds * 1000)
    }

    fun togglePlayPause() {
        val c = controller ?: return
        if (c.isPlaying) c.pause() else c.play()
    }

    fun seekTo(positionMs: Long) {
        controller?.seekTo(positionMs)
        _state.update { it.copy(positionMs = positionMs) }
    }

    fun skip(deltaMs: Long) {
        val c = controller ?: return
        val target = (c.currentPosition + deltaMs).coerceIn(0, c.duration.takeIf { it != androidx.media3.common.C.TIME_UNSET } ?: Long.MAX_VALUE)
        seekTo(target)
    }

    /** Inserts [audio] to play right after the current track, without
     * interrupting what's playing now — mirrors the web app's "+ Play
     * Next" button (src/components/AudioCard.jsx, src/pages/Doctrine.jsx).
     * If nothing is playing yet, this just starts it. */
    fun playNext(audio: Audio) {
        if (queueIndex < 0) {
            play(audio)
            return
        }
        val mutable = queue.toMutableList()
        val existingIndex = mutable.indexOfFirst { it.id == audio.id }
        if (existingIndex >= 0 && existingIndex != queueIndex) {
            mutable.removeAt(existingIndex)
            if (existingIndex < queueIndex) queueIndex -= 1
        }
        val insertAt = (queueIndex + 1).coerceAtMost(mutable.size)
        mutable.add(insertAt, audio)
        queue = mutable
        _state.update { it.copy(hasNext = queueIndex in 0 until queue.size - 1) }
    }

    fun next() {
        if (queueIndex < 0 || queueIndex >= queue.size - 1) return
        queueIndex += 1
        loadAndPlay(queue[queueIndex])
    }

    fun previous() {
        if (queueIndex <= 0) return
        queueIndex -= 1
        loadAndPlay(queue[queueIndex])
    }

    /** Reloads whatever is currently selected — used by the player
     * screen's "Tap to retry" error state (Step 12). */
    fun retry() {
        val audio = _state.value.current ?: return
        loadAndPlay(audio)
    }

    private fun loadAndPlay(audio: Audio, resumeAtMs: Long = 0) {
        positionTicker?.cancel()
        _state.value = PlayerUiState(
            current = audio,
            phase = PlaybackPhase.LOADING,
            hasPrevious = queueIndex > 0,
            hasNext = queueIndex in 0 until queue.size - 1,
        )
        scope.launch {
            val c = controller
            if (c == null) {
                _state.update { it.copy(phase = PlaybackPhase.ERROR, errorMessage = "Player isn't ready yet — try again in a moment.") }
                return@launch
            }
            // Offline-first: a downloaded copy plays straight from disk (works
            // with no connection at all and never re-spends bandwidth), same
            // idea as the web app's offlineDownloads.js local-blob shortcut.
            val local = downloadRepository.getDownload(audio.id)
            val urlResult = if (local != null) Result.success(Uri.fromFile(java.io.File(local.localPath)).toString()) else audioRepository.resolvePlaybackUrl(audio)

            urlResult.fold(
                onSuccess = { url ->
                    val artworkUri = Uri.parse("android.resource://${appContext.packageName}/${R.mipmap.ic_launcher}")
                    val mediaItem = MediaItem.Builder()
                        .setUri(url)
                        .setMediaId(audio.id)
                        .setMediaMetadata(
                            MediaMetadata.Builder()
                                .setTitle(audio.title)
                                .setArtist(audio.speaker)
                                .setArtworkUri(artworkUri)
                                .build(),
                        )
                        .build()
                    c.setMediaItem(mediaItem)
                    c.prepare()
                    if (resumeAtMs > 0) c.seekTo(resumeAtMs)
                    c.play()
                },
                onFailure = { error ->
                    _state.update {
                        it.copy(
                            phase = PlaybackPhase.ERROR,
                            errorMessage = error.message ?: "This recording couldn't be loaded. Tap to retry.",
                        )
                    }
                },
            )
        }
    }

    private fun startPositionTicker() {
        positionTicker?.cancel()
        progressTickCount = 0
        positionTicker = scope.launch {
            while (true) {
                val c = controller
                if (c != null) {
                    _state.update {
                        it.copy(
                            positionMs = c.currentPosition.coerceAtLeast(0),
                            durationMs = c.duration.takeIf { d -> d != androidx.media3.common.C.TIME_UNSET } ?: it.durationMs,
                        )
                    }
                }
                delay(500)
                // Every ~15s of actual playing time, not every 500ms tick —
                // frequent enough to resume close to where you left off,
                // rare enough not to spam Firestore writes.
                progressTickCount++
                if (progressTickCount % 30 == 0) saveProgressNow()
            }
        }
    }

    private fun saveProgressNow() {
        val audio = _state.value.current ?: return
        val positionSeconds = _state.value.positionMs / 1000
        val durationSeconds = _state.value.durationMs / 1000
        if (positionSeconds <= 0) return
        scope.launch { listenProgressRepository.saveProgress(audio.id, positionSeconds, durationSeconds) }
    }

    fun release() {
        positionTicker?.cancel()
        controller?.removeListener(playerListener)
        controller?.release()
        controller = null
    }
}
