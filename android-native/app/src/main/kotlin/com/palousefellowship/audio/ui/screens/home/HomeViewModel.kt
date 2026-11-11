package com.palousefellowship.audio.ui.screens.home

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Notice
import com.palousefellowship.audio.data.repository.AuthRepository
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.data.repository.NoticeRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** What Home.jsx shows today: notices + "Continue Listening". */
data class HomeData(
    val notices: List<Notice>,
    val continueListening: List<ListenProgressRepository.ContinueItem>,
)

class HomeViewModel(
    private val noticeRepository: NoticeRepository,
    private val authRepository: AuthRepository,
    private val progressRepository: ListenProgressRepository,
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

    private suspend fun fetch(): UiState<HomeData> = coroutineScope {
        val signedIn = authRepository.currentUser != null
        val notices = async { (noticeRepository.getNotices(signedIn) as? UiState.Success)?.data ?: emptyList() }
        val progress = async { progressRepository.getContinueListening(3) }
        UiState.Success(HomeData(notices.await(), progress.await()))
    }
}
