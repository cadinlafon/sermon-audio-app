package com.palousefellowship.audio.ui.screens.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.google.firebase.auth.FirebaseUser
import com.palousefellowship.audio.data.repository.AuthRepository
import com.palousefellowship.audio.data.repository.PushRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class SettingsViewModel(
    private val authRepository: AuthRepository,
    private val pushRepository: PushRepository,
) : ViewModel() {
    val user: StateFlow<FirebaseUser?> = authRepository.authState
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), authRepository.currentUser)

    private val _pushError = MutableStateFlow<String?>(null)
    val pushError: StateFlow<String?> = _pushError.asStateFlow()

    fun signOut() = authRepository.signOut()

    /** Called once notification permission is confirmed granted (or on
     * API < 33, where no runtime prompt is needed at all). */
    fun onNotificationPermissionGranted() {
        viewModelScope.launch {
            pushRepository.registerCurrentToken().onFailure {
                _pushError.value = it.message ?: "Couldn't enable notifications."
            }
        }
    }
}
