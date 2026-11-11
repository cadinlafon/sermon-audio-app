package com.palousefellowship.audio.ui.screens.audiolist

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.PageNotice
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.data.repository.DownloadRepository
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.data.repository.PageNoticeRepository
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
import org.json.JSONObject

/** Backs Sermons / Sunday School. One query fetches every [fetchTypes] up
 * front (like the web's pages) and the Audio Page Manager's search, filters
 * and sort are applied client-side — no extra Firestore reads for a filter
 * change. Filters are remembered per page (when the admin allows it). */
class AudioListViewModel(
    context: Context,
    val pageKey: String,
    private val repository: AudioRepository,
    private val fetchTypes: List<String>,
    private val savedRepository: SavedRepository,
    private val listenProgressRepository: ListenProgressRepository,
    private val downloadRepository: DownloadRepository,
    private val noticeRepository: PageNoticeRepository,
) : ViewModel() {

    private val prefs = context.getSharedPreferences("pf_audio_filters", Context.MODE_PRIVATE)

    private val _raw = MutableStateFlow<UiState<List<Audio>>>(UiState.Loading)
    val raw: StateFlow<UiState<List<Audio>>> = _raw.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    private val _filters = MutableStateFlow(AudioFilters())
    val filters: StateFlow<AudioFilters> = _filters.asStateFlow()

    private var chosenSort = false
    private var chosenType = false
    private var remember = true
    private var configured = false

    private val _notices = MutableStateFlow<List<PageNotice>>(emptyList())
    val notices: StateFlow<List<PageNotice>> = _notices.asStateFlow()

    private val _savedIds = MutableStateFlow<Set<String>>(emptySet())
    val savedIds: StateFlow<Set<String>> = _savedIds.asStateFlow()

    private val _progress = MutableStateFlow<Map<String, ListenProgressRepository.Entry>>(emptyMap())
    val progress: StateFlow<Map<String, ListenProgressRepository.Entry>> = _progress.asStateFlow()

    val downloadedIds: StateFlow<Set<String>> = downloadRepository.observeDownloads()
        .map { list -> list.map { it.audioId }.toSet() }
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptySet())

    init {
        load()
        viewModelScope.launch { _notices.value = noticeRepository.load() }
        viewModelScope.launch { _savedIds.value = (savedRepository.getSaved() as? UiState.Success)?.data?.map { it.sermonId }?.toSet().orEmpty() }
        viewModelScope.launch { _progress.value = listenProgressRepository.getProgressMap() }
    }

    /** The page's admin-set defaults (re)apply to anything the listener hasn't chosen
     * themselves. Called whenever the settings change; the first call restores remembered filters. */
    fun applyDefaults(defaultSort: String, defaultType: String, rememberFilters: Boolean) {
        remember = rememberFilters
        if (!configured) {
            configured = true
            var f = AudioFilters(sort = defaultSort, type = defaultType)
            if (rememberFilters) runCatching {
                val o = JSONObject(prefs.getString("filters:$pageKey", "{}") ?: "{}")
                val chosen = o.optJSONObject("chosen")
                chosenSort = chosen?.optBoolean("sort", false) ?: false
                chosenType = chosen?.optBoolean("type", false) ?: false
                f = f.copy(
                    speaker = o.optString("speaker", "all"), series = o.optString("series", "all"),
                    duration = o.optString("duration", "any"), year = o.optString("year", "all"), month = o.optString("month", "all"),
                    status = o.optString("status", "all"), liked = o.optBoolean("liked", false), downloaded = o.optBoolean("downloaded", false),
                    sort = if (chosenSort) o.optString("sort", defaultSort) else defaultSort,
                    type = if (chosenType) o.optString("type", defaultType) else defaultType,
                )
            }
            _filters.value = f
        } else {
            _filters.update { it.copy(sort = if (chosenSort) it.sort else defaultSort, type = if (chosenType) it.type else defaultType) }
        }
    }

    fun update(transform: (AudioFilters) -> AudioFilters) {
        val before = _filters.value
        val after = transform(before)
        if (after.sort != before.sort) chosenSort = true
        if (after.type != before.type) chosenType = true
        _filters.value = after
        persist()
    }

    fun reset(defaultSort: String, defaultType: String) {
        chosenSort = false; chosenType = false
        _filters.value = AudioFilters(sort = defaultSort, type = defaultType)
        persist()
    }

    private fun persist() {
        if (!remember) return
        val f = _filters.value
        val o = JSONObject().apply {
            put("speaker", f.speaker); put("series", f.series); put("sort", f.sort); put("type", f.type)
            put("duration", f.duration); put("year", f.year); put("month", f.month); put("status", f.status)
            put("liked", f.liked); put("downloaded", f.downloaded)
            put("chosen", JSONObject().put("sort", chosenSort).put("type", chosenType))
        }
        prefs.edit().putString("filters:$pageKey", o.toString()).apply()
    }

    fun dismissNotice(n: PageNotice) { noticeRepository.dismiss(n) }
    fun isNoticeDismissed(n: PageNotice) = noticeRepository.isDismissed(n)

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

    suspend fun toggleDownload(audio: Audio, isDownloaded: Boolean): Result<Unit> =
        if (isDownloaded) { downloadRepository.remove(audio.id); Result.success(Unit) } else downloadRepository.download(audio)

    /** A freshly generated (or deleted) AI summary, mirrored into the list. */
    fun summarySaved(id: String, summary: String?) {
        _raw.update { s -> if (s is UiState.Success) UiState.Success(s.data.map { if (it.id == id) it.copy(aiSummary = summary) else it }, s.fromCache) else s }
    }

    fun load() {
        viewModelScope.launch { _raw.value = UiState.Loading; _raw.value = repository.getAudio(fetchTypes) }
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _raw.value = repository.getAudio(fetchTypes)
            _isRefreshing.value = false
            _notices.value = noticeRepository.load()
        }
    }
}
