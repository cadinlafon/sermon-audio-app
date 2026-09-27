package com.palousefellowship.audio.ui.screens.doctrine

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.repository.DoctrineRepository
import com.palousefellowship.audio.data.repository.DoctrineScreenData
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class DoctrineViewModel(private val repository: DoctrineRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<DoctrineScreenData>>(UiState.Loading)
    val state: StateFlow<UiState<DoctrineScreenData>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = repository.getDoctrine()
        }
    }
}
