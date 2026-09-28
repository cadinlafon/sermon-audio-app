package com.palousefellowship.audio.ui.screens.notes

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState
import com.palousefellowship.audio.util.formatDuration

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BookmarksScreen(onJumpTo: (String, String, String, Long) -> Unit) {
    val viewModel = pfaViewModel { c -> NotesViewModel(c.notesRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Bookmarks", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                val notes = s.data.withBookmarks()
                if (notes.isEmpty()) {
                    EmptyView(icon = "🔖", title = "No bookmarks yet", message = "Tap \"Bookmark\" on the player page to save a moment.", modifier = Modifier.padding(padding).fillMaxSize())
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        notes.forEach { note ->
                            item {
                                Text(note.title.ifBlank { "Untitled" }, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 4.dp))
                            }
                            items(note.bookmarks.sortedBy { it.t }, key = { "${note.audioId}_${it.id}" }) { bookmark ->
                                Card(
                                    onClick = { onJumpTo(note.audioId, note.title, note.speaker, bookmark.t.toLong()) },
                                    modifier = Modifier.fillMaxWidth(),
                                    shape = RoundedCornerShape(14.dp),
                                ) {
                                    Column(Modifier.padding(12.dp)) {
                                        Text(
                                            bookmark.label.ifBlank { "Bookmark at ${formatDuration(bookmark.t.toLong())}" },
                                            style = MaterialTheme.typography.bodyMedium,
                                        )
                                        Text(formatDuration(bookmark.t.toLong()), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
