package com.palousefellowship.audio.util

/** One shape every screen's ViewModel exposes, so every screen handles
 * loading/success/error the same way (Step 12: no blank screens). */
sealed interface UiState<out T> {
    data object Loading : UiState<Nothing>
    data class Success<T>(val data: T, val fromCache: Boolean = false) : UiState<T>
    data class Error(val message: String) : UiState<Nothing>
}

inline fun <T> UiState<T>.dataOrNull(): T? = (this as? UiState.Success)?.data
