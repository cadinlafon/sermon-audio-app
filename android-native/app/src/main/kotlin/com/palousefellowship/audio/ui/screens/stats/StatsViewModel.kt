package com.palousefellowship.audio.ui.screens.stats

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.UserStats
import com.palousefellowship.audio.data.repository.StatsRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class StatsViewModel(private val repository: StatsRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<UserStats>>(UiState.Loading)
    val state: StateFlow<UiState<UserStats>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = repository.getStats()
        }
    }
}
