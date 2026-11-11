package com.palousefellowship.audio.player

import com.palousefellowship.audio.data.model.Audio

enum class PlaybackPhase { IDLE, LOADING, READY, ERROR }

data class PlayerUiState(
    /** The recording shown in the player. While the outro plays this is a stand-in
     * (title = the admin's outro title, [isOutro] = true), like the web's shownCurrent. */
    val current: Audio? = null,
    val phase: PlaybackPhase = PlaybackPhase.IDLE,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val hasPrevious: Boolean = false,
    val hasNext: Boolean = false,
    val errorMessage: String? = null,
    /** "Play Next" queue — what plays after the current recording. */
    val queue: List<Audio> = emptyList(),
    /** Recently played, most recent first (index 0 is the current one). */
    val history: List<Audio> = emptyList(),
    val speed: Float = 1f,
    val skipBackSeconds: Int = 30,
    val skipForwardSeconds: Int = 30,
    val repeat: String = "off",
    val shuffle: Boolean = false,
    /** null (off) | "duration" | "endOfTrack" */
    val sleepMode: String? = null,
    val sleepRemainingSeconds: Int = 0,
    val isOutro: Boolean = false,
)
