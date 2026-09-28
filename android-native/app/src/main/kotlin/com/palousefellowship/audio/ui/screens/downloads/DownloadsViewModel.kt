package com.palousefellowship.audio.ui.screens.downloads

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.local.DownloadEntity
import com.palousefellowship.audio.data.repository.DownloadRepository
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class DownloadsViewModel(private val repository: DownloadRepository) : ViewModel() {
    val downloads: StateFlow<List<DownloadEntity>> = repository.observeDownloads()
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5000), emptyList())

    fun remove(audioId: String) {
        viewModelScope.launch { repository.remove(audioId) }
    }

    val maxDownloads = DownloadRepository.MAX_DOWNLOADS
}
