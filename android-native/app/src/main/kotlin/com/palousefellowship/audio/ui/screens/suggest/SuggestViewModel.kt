package com.palousefellowship.audio.ui.screens.suggest

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Suggestion
import com.palousefellowship.audio.data.repository.AuthRepository
import com.palousefellowship.audio.data.repository.SuggestionRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class SuggestViewModel(
    private val repository: SuggestionRepository,
    private val authRepository: AuthRepository,
) : ViewModel() {
    private val _state = MutableStateFlow<UiState<List<Suggestion>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Suggestion>>> = _state.asStateFlow()
    val currentUid: String? get() = authRepository.currentUser?.uid

    private val _submitError = MutableStateFlow<String?>(null)
    val submitError: StateFlow<String?> = _submitError.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = repository.getSuggestions()
        }
    }

    fun submit(title: String, details: String, onDone: () -> Unit) {
        if (title.isBlank() || details.isBlank()) {
            _submitError.value = "Please fill in both fields."
            return
        }
        viewModelScope.launch {
            runCatching { repository.submit(title, details) }
                .onSuccess { _submitError.value = null; onDone(); load() }
                .onFailure { _submitError.value = it.message ?: "Couldn't submit your suggestion." }
        }
    }

    fun vote(suggestion: Suggestion, upvote: Boolean) {
        viewModelScope.launch {
            runCatching { repository.vote(suggestion, upvote) }
            load()
        }
    }
}
