package com.palousefellowship.audio.ui.screens.yourlistens

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.ListenHistoryItem
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class YourListensViewModel(private val repository: ListenProgressRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<List<ListenHistoryItem>>>(UiState.Loading)
    val state: StateFlow<UiState<List<ListenHistoryItem>>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = try {
                UiState.Success(repository.getHistory())
            } catch (e: Exception) {
                UiState.Error(e.message ?: "Couldn't load your listen history.")
            }
        }
    }
}
