package com.palousefellowship.audio.ui.screens.saved

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.SavedAudio
import com.palousefellowship.audio.data.repository.SavedRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

class SavedViewModel(private val repository: SavedRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<List<SavedAudio>>>(UiState.Loading)
    val state: StateFlow<UiState<List<SavedAudio>>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = repository.getSaved()
        }
    }

    fun unsave(sermonId: String) {
        viewModelScope.launch {
            runCatching { repository.toggle(com.palousefellowship.audio.data.model.Audio(id = sermonId)) }
            _state.update { s -> (s as? UiState.Success)?.let { UiState.Success(it.data.filterNot { row -> row.sermonId == sermonId }) } ?: s }
        }
    }
}
