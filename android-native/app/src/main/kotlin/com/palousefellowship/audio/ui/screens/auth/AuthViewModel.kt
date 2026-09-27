package com.palousefellowship.audio.ui.screens.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AuthUiState(
    val isLoading: Boolean = false,
    val errorMessage: String? = null,
)

class AuthViewModel(private val repository: AuthRepository) : ViewModel() {
    private val _state = MutableStateFlow(AuthUiState())
    val state: StateFlow<AuthUiState> = _state.asStateFlow()

    fun signIn(email: String, password: String, onSuccess: () -> Unit) {
        if (email.isBlank() || password.isBlank()) {
            _state.value = AuthUiState(errorMessage = "Please enter your email and password.")
            return
        }
        viewModelScope.launch {
            _state.value = AuthUiState(isLoading = true)
            repository.signInWithEmail(email, password).fold(
                onSuccess = { _state.value = AuthUiState(); onSuccess() },
                onFailure = { _state.value = AuthUiState(errorMessage = it.message) },
            )
        }
    }

    fun signUp(email: String, password: String, fullName: String, onSuccess: () -> Unit) {
        if (email.isBlank() || password.isBlank() || fullName.isBlank()) {
            _state.value = AuthUiState(errorMessage = "Please fill in every field.")
            return
        }
        viewModelScope.launch {
            _state.value = AuthUiState(isLoading = true)
            repository.signUpWithEmail(email, password, fullName).fold(
                onSuccess = { _state.value = AuthUiState(); onSuccess() },
                onFailure = { _state.value = AuthUiState(errorMessage = it.message) },
            )
        }
    }

    fun signInWithGoogle(idToken: String, fallbackName: String, fallbackEmail: String, onSuccess: () -> Unit) {
        viewModelScope.launch {
            _state.value = AuthUiState(isLoading = true)
            repository.signInWithGoogleIdToken(idToken, fallbackName, fallbackEmail).fold(
                onSuccess = { _state.value = AuthUiState(); onSuccess() },
                onFailure = { _state.value = AuthUiState(errorMessage = it.message) },
            )
        }
    }

    fun setError(message: String?) {
        _state.value = AuthUiState(errorMessage = message)
    }
}
