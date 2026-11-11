package com.palousefellowship.audio.ui.screens.resources

import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.data.repository.ResourceRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** [typeFilter] is what makes this the same ViewModel back both the
 * Resources screen (null = everything) and the Spotify screen ("spotify"
 * only) — see ResourceRepository's doc comment for why Spotify isn't its
 * own backend collection. */
class ResourcesViewModel(
    private val repository: ResourceRepository,
    private val typeFilter: String? = null,
) : ViewModel() {
    var categories by androidx.compose.runtime.mutableStateOf<List<com.palousefellowship.audio.data.model.ResourceCategory>>(emptyList()); private set
    var sections by androidx.compose.runtime.mutableStateOf<List<com.palousefellowship.audio.data.model.ResourceSection>>(emptyList()); private set
    private val _state = MutableStateFlow<UiState<List<Resource>>>(UiState.Loading)
    val state: StateFlow<UiState<List<Resource>>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            val (c, sec) = repository.getCategoriesAndSections()
            categories = c; sections = sec
            _state.value = repository.getResources(typeFilter)
        }
    }
}
