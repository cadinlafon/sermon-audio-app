package com.palousefellowship.audio.ui.screens.audiolist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.data.repository.DownloadRepository
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.data.repository.SavedRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.flow.stateIn
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
    private val savedRepository: SavedRepository,
    private val listenProgressRepository: ListenProgressRepository,
    private val downloadRepository: DownloadRepository,
) : ViewModel() {

    private val _rawState = MutableStateFlow<UiState<List<Audio>>>(UiState.Loading)
    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    val search = MutableStateFlow("")
    val typeFilter = MutableStateFlow("all") // "all" | one of fetchTypes
    val sort = MutableStateFlow(AudioSort.NEWEST)

    private val _state = MutableStateFlow<UiState<List<Audio>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Audio>>> = _state.asStateFlow()

    // Bulk-loaded once per screen (not per-card, unlike the web app's
    // AudioCard.jsx, which does its own useEffect fetch per card) — a lot
    // fewer Firestore/Room round-trips for a long list, same end result.
    private val _savedIds = MutableStateFlow<Set<String>>(emptySet())
    val savedIds: StateFlow<Set<String>> = _savedIds.asStateFlow()

    private val _progress = MutableStateFlow<Map<String, ListenProgressRepository.Entry>>(emptyMap())
    val progress: StateFlow<Map<String, ListenProgressRepository.Entry>> = _progress.asStateFlow()

    val downloadedIds: StateFlow<Set<String>> = downloadRepository.observeDownloads()
        .map { list -> list.map { it.audioId }.toSet() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptySet())

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
        viewModelScope.launch {
            _savedIds.value = (savedRepository.getSaved() as? UiState.Success)?.data?.map { it.sermonId }?.toSet().orEmpty()
        }
        viewModelScope.launch {
            _progress.value = listenProgressRepository.getProgressMap()
        }
    }

    /** Plain suspend, not launched internally, so the calling card can
     * show "Please sign in to like audio." itself on failure — same
     * shape as [toggleDownload]. */
    suspend fun toggleSaved(audio: Audio): Result<Boolean> =
        runCatching { savedRepository.toggle(audio) }.onSuccess { nowSaved ->
            _savedIds.update { if (nowSaved) it + audio.id else it - audio.id }
        }

    fun setStatus(audioId: String, status: String) {
        viewModelScope.launch {
            runCatching { listenProgressRepository.setStatus(audioId, status) }.onSuccess {
                _progress.update { current ->
                    val existing = current[audioId]
                    current + (audioId to ListenProgressRepository.Entry(
                        status = status,
                        positionSeconds = if (status == "not-started") 0 else existing?.positionSeconds ?: 0,
                        durationSeconds = existing?.durationSeconds ?: 0,
                    ))
                }
            }
        }
    }

    /** Left as a plain suspend call (not launched internally) so the
     * calling card can show its own "downloading…" state and surface any
     * failure message itself — same shape as AudioCard.jsx's own
     * try/catch around handleToggleDownload. */
    suspend fun toggleDownload(audio: Audio, isDownloaded: Boolean): Result<Unit> =
        if (isDownloaded) {
            downloadRepository.remove(audio.id)
            Result.success(Unit)
        } else {
            downloadRepository.download(audio)
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
