package com.palousefellowship.audio.player

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Owns the single ExoPlayer + MediaSession instance for the whole app.
 * Runs independently of any Activity (Step 5: background playback, lock
 * screen, notification, Bluetooth/headset buttons) — MediaSessionService
 * handles the foreground-service promotion, the system media-style
 * notification, and routing hardware media-button events to the session
 * automatically; none of that needs to be written by hand.
 */
class PlaybackService : MediaSessionService() {

    private lateinit var player: ExoPlayer
    private lateinit var mediaSession: MediaSession

    override fun onCreate() {
        super.onCreate()

        player = ExoPlayer.Builder(this)
            // `true` = ExoPlayer requests/abandons audio focus itself and
            // pauses/ducks for calls, other media apps, etc. (Step 5:
            // "proper audio focus handling").
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_SPEECH)
                    .build(),
                true,
            )
            // Pause (rather than silently keep "playing" with no sound)
            // when headphones are unplugged or Bluetooth disconnects.
            .setHandleAudioBecomingNoisy(true)
            // Keep a wake lock while buffering/playing so playback survives
            // Doze/App Standby during a long sermon with the screen off.
            .build()
            .apply { setWakeMode(C.WAKE_MODE_NETWORK) }

        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession = mediaSession

    // If the whole app task is swiped away while nothing is actively
    // playing, let the service (and its notification) go away too rather
    // than lingering.
    override fun onTaskRemoved(rootIntent: Intent?) {
        val p = mediaSession.player
        if (!p.playWhenReady || p.mediaItemCount == 0 || p.playbackState == androidx.media3.common.Player.STATE_ENDED) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        mediaSession.run {
            player.release()
            release()
        }
        super.onDestroy()
    }
}
