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

class PlaylistDetailViewModel(private val repository: PlaylistRepository, private val playlistId: String) : ViewModel() {
    private val _state = MutableStateFlow<UiState<Playlist>>(UiState.Loading)
    val state: StateFlow<UiState<Playlist>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            val playlist = repository.getPlaylist(playlistId)
            _state.value = if (playlist != null) UiState.Success(playlist) else UiState.Error("This playlist couldn't be found.")
        }
    }

    fun removeItem(audioId: String) {
        viewModelScope.launch { repository.removeItem(playlistId, audioId); load() }
    }

    fun moveUp(index: Int) {
        if (index <= 0) return
        viewModelScope.launch { repository.moveItem(playlistId, index, index - 1); load() }
    }

    fun moveDown(index: Int, size: Int) {
        if (index >= size - 1) return
        viewModelScope.launch { repository.moveItem(playlistId, index, index + 1); load() }
    }

    fun rename(name: String) {
        viewModelScope.launch { repository.rename(playlistId, name); load() }
    }
}
