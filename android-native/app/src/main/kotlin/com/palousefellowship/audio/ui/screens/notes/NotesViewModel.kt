package com.palousefellowship.audio.ui.screens.notes

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.palousefellowship.audio.data.model.NoteDoc
import com.palousefellowship.audio.data.repository.NotesRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

class NotesViewModel(private val repository: NotesRepository) : ViewModel() {
    private val _state = MutableStateFlow<UiState<List<NoteDoc>>>(UiState.Loading)
    val state: StateFlow<UiState<List<NoteDoc>>> = _state.asStateFlow()

    init { load() }

    fun load() {
        viewModelScope.launch {
            _state.value = UiState.Loading
            _state.value = repository.getAllNotes()
        }
    }
}

/** Notes with a non-blank general text field — the Notes screen. */
fun List<NoteDoc>.withText() = filter { it.text.isNotBlank() }

/** Notes with at least one bookmark — the Bookmarks screen. */
fun List<NoteDoc>.withBookmarks() = filter { it.bookmarks.isNotEmpty() }
