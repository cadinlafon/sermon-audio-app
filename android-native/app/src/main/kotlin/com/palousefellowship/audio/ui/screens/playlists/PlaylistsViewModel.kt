package com.palousefellowship.audio.ui.screens.playlists

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Playlist
import com.palousefellowship.audio.data.repository.PlaylistRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class PlaylistsViewModel(private val repository: PlaylistRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<List<Playlist>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Playlist>>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = repository.getPlaylists()
        }
    }

    fun create(name: String, onCreated: (String) -> Unit) {
        viewModelScope.launch {
            runCatching { repository.create(name) }
                .onSuccess { onCreated(it.id); load() }
        }
    }

    fun delete(id: String) {
        viewModelScope.launch { repository.delete(id); load() }
    }
}
