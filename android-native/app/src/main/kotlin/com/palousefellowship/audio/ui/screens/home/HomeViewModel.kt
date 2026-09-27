package com.palousefellowship.audio.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.Notice
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.data.repository.AuthRepository
import com.palousefellowship.audio.data.repository.NoticeRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class HomeData(val latestSermon: Audio?, val notices: List<Notice>)

class HomeViewModel(
    private val audioRepository: AudioRepository,
    private val noticeRepository: NoticeRepository,
    private val authRepository: AuthRepository,
) : ViewModel() {

    private val _state = MutableStateFlow<UiState<HomeData>>(UiState.Loading)
    val state: StateFlow<UiState<HomeData>> = _state.asStateFlow()

    private val _isRefreshing = MutableStateFlow(false)
    val isRefreshing: StateFlow<Boolean> = _isRefreshing.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = fetch()
        }
    }

    fun refresh() {
        viewModelScope.launch {
            _isRefreshing.value = true
            _state.value = fetch()
            _isRefreshing.value = false
        }
    }

    private suspend fun fetch(): UiState<HomeData> {
        val signedIn = authRepository.currentUser != null
        val latest = audioRepository.getLatestSermon()
        return when (val noticesState = noticeRepository.getNotices(signedIn)) {
            is UiState.Success -> UiState.Success(HomeData(latest, noticesState.data))
            is UiState.Error -> UiState.Success(HomeData(latest, emptyList())) // notices failing shouldn't blank the whole Home screen
            UiState.Loading -> UiState.Loading
        }
    }
}
