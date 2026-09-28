package com.palousefellowship.audio.ui.screens.search

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.data.repository.ResourceRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class SearchResults(val audio: List<Audio> = emptyList(), val resources: List<Resource> = emptyList())

/**
 * A lightweight client-side search across the same content the web app's
 * /search page indexes (audio + resources) — see src/utils/searchEngine.js.
 * There's no server-side search index (Algolia/etc.) on either platform,
 * so this fetches the same lists the list screens already fetch and
 * filters them by substring, same approach the web version's client-side
 * index uses.
 */
class SearchViewModel(
    private val audioRepository: AudioRepository,
    private val resourceRepository: ResourceRepository,
) : ViewModel() {
    private val _query = MutableStateFlow("")
    val query: StateFlow<String> = _query.asStateFlow()

    private val _state = MutableStateFlow<UiState<SearchResults>>(UiState.Success(SearchResults()))
    val state: StateFlow<UiState<SearchResults>> = _state.asStateFlow()

    private var allAudio: List<Audio> = emptyList()
    private var allResources: List<Resource> = emptyList()
    private var loaded = false
    private var searchJob: Job? = null

    fun onQueryChange(text: String) {
        _query.value = text
        searchJob?.cancel()
        if (text.isBlank()) {
            _state.value = UiState.Success(SearchResults())
            return
        }
        searchJob = viewModelScope.launch {
            delay(250) // debounce
            ensureLoaded()
            _state.value = UiState.Success(filter(text))
        }
    }

    private suspend fun ensureLoaded() {
        if (loaded) return
        val audioState = audioRepository.getAudio(listOf(Audio.TYPE_SERMON, Audio.TYPE_HOMILY, Audio.TYPE_SUNDAY_SCHOOL))
        allAudio = (audioState as? UiState.Success)?.data.orEmpty()
        val resourceState = resourceRepository.getResources()
        allResources = (resourceState as? UiState.Success)?.data.orEmpty()
        loaded = true
    }

    private fun filter(text: String): SearchResults {
        val q = text.trim().lowercase()
        return SearchResults(
            audio = allAudio.filter { it.title.lowercase().contains(q) || it.speaker.lowercase().contains(q) },
            resources = allResources.filter { it.title.lowercase().contains(q) || it.description.lowercase().contains(q) },
        )
    }
}
