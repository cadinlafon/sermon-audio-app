package com.palousefellowship.audio.player

import com.palousefellowship.audio.data.model.Audio

enum class PlaybackPhase { IDLE, LOADING, READY, ERROR }

data class PlayerUiState(
    val current: Audio? = null,
    val phase: PlaybackPhase = PlaybackPhase.IDLE,
    val isPlaying: Boolean = false,
    val positionMs: Long = 0,
    val durationMs: Long = 0,
    val hasPrevious: Boolean = false,
    val hasNext: Boolean = false,
    val errorMessage: String? = null,
)
