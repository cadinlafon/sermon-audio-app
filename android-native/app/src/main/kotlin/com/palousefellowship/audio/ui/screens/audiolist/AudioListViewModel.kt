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

enum class AudioSort(val label: String) {
    NEWEST("Newest first"), OLDEST("Oldest first"),
    SHORTEST("Shortest → longest"), LONGEST("Longest → shortest"),
    TITLE("Title A–Z"), SPEAKER("Speaker A–Z"),
}

/** Backs Sermons / Sunday School / Homilies — one query fetches every
 * [fetchTypes] up front (matching the web app's Sermons page, which
 * queries `type in [sermon, homily]` once), and search/type-filter/sort
 * are applied client-side, same as the web app's useAudioFilters.js —
 * no extra Firestore reads for switching a filter tab. */
class AudioListViewModel(
    private val repository: AudioRepository,
    private val fetchTypes: List<String>,
) : ViewModel() {

    private val _rawState = MutableStateFlow<UiState<List<Audio>>>(UiState.Loading)
    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    val search = MutableStateFlow("")
    val typeFilter = MutableStateFlow("all") // "all" | one of fetchTypes
    val sort = MutableStateFlow(AudioSort.NEWEST)

    private val _state = MutableStateFlow<UiState<List<Audio>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Audio>>> = _state.asStateFlow()

    init {
        load()
        viewModelScope.launch {
            kotlinx.coroutines.flow.combine(_rawState, search, typeFilter, sort) { raw, q, type, s ->
                when (raw) {
                    is UiState.Loading -> UiState.Loading
                    is UiState.Error -> raw
                    is UiState.Success -> UiState.Success(applyFilters(raw.data, q, type, s), raw.fromCache)
                }
            }.collect { _state.value = it }
        }
    }

    private fun applyFilters(items: List<Audio>, query: String, type: String, sortMode: AudioSort): List<Audio> {
        var result = items
        if (type != "all") result = result.filter { it.type == type }
        if (query.isNotBlank()) {
            val q = query.trim().lowercase()
            result = result.filter { it.title.lowercase().contains(q) || it.speaker.lowercase().contains(q) }
        }
        result = when (sortMode) {
            AudioSort.NEWEST -> result.sortedByDescending { it.order }
            AudioSort.OLDEST -> result.sortedBy { it.order }
            AudioSort.SHORTEST -> result.sortedBy { it.duration }
            AudioSort.LONGEST -> result.sortedByDescending { it.duration }
            AudioSort.TITLE -> result.sortedBy { it.title.lowercase() }
            AudioSort.SPEAKER -> result.sortedBy { it.speaker.lowercase() }
        }
        return result
    }

    fun load() {
        viewModelScope.launch {
            _rawState.value = UiState.Loading
            _rawState.value = repository.getAudio(fetchTypes)
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _rawState.update { repository.getAudio(fetchTypes) }
            _isRefreshing.value = false
        }
    }
}
