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

    private val _accountMessage = MutableStateFlow<String?>(null)
    val accountMessage: StateFlow<String?> = _accountMessage.asStateFlow()
    private val _accountError = MutableStateFlow<String?>(null)
    val accountError: StateFlow<String?> = _accountError.asStateFlow()
    private val _accountBusy = MutableStateFlow(false)
    val accountBusy: StateFlow<Boolean> = _accountBusy.asStateFlow()

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

    fun clearAccountFeedback() { _accountMessage.value = null; _accountError.value = null }

    fun updateDisplayName(name: String) = runAccountAction { authRepository.updateDisplayName(name) }
    fun changeEmail(currentPassword: String, newEmail: String) = runAccountAction { authRepository.changeEmail(currentPassword, newEmail) }
    fun changePassword(currentPassword: String, newPassword: String) = runAccountAction { authRepository.changePassword(currentPassword, newPassword) }
    fun deleteAccount(currentPassword: String, onDeleted: () -> Unit) = runAccountAction(onSuccess = onDeleted) { authRepository.deleteAccount(currentPassword) }

    private fun runAccountAction(onSuccess: () -> Unit = {}, action: suspend () -> Result<Unit>) {
        viewModelScope.launch {
            _accountBusy.value = true
            _accountError.value = null
            action().fold(
                onSuccess = { _accountMessage.value = "Done."; onSuccess() },
                onFailure = { _accountError.value = it.message ?: "Something went wrong." },
            )
            _accountBusy.value = false
        }
    }
}
