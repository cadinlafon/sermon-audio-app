package com.palousefellowship.audio.ui.screens.audiolist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/** Backs Sermons / Sunday School / Homilies — same screen shape, just a
 * different `type` filter, mirroring how the web app's three pages all
 * run the same kind of `audio` query. */
class AudioListViewModel(
    private val repository: AudioRepository,
    private val types: List<String>,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<List<Audio>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Audio>>> = _state.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = repository.getAudio(types)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _state.update { repository.getAudio(types) }
            _isRefreshing.value = false
        }
    }
}
