package com.palousefellowship.audio.ui.screens.playlists

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.PLAYLIST_COVER_COLORS
import com.palousefellowship.audio.data.model.Playlist
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState
import com.palousefellowship.audio.util.formatDuration

@Composable
fun PlaylistCoverBox(playlist: Playlist, size: androidx.compose.ui.unit.Dp = 52.dp) {
    val pair = PLAYLIST_COVER_COLORS.getOrElse(playlist.coverColorIndex) { PLAYLIST_COVER_COLORS[0] }
    Box(
        modifier = Modifier.size(size).background(Brush.linearGradient(listOf(Color(pair.first), Color(pair.second))), RoundedCornerShape(14.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text(playlist.coverEmoji, style = MaterialTheme.typography.titleLarge)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaylistsScreen(onOpenPlaylist: (String) -> Unit) {
    val viewModel = pfaViewModel { c -> PlaylistsViewModel(c.playlistRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showCreate by rememberSaveable { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Playlists", style = MaterialTheme.typography.titleLarge) }) },
        floatingActionButton = { FloatingActionButton(onClick = { showCreate = true }) { Icon(Icons.Filled.Add, contentDescription = "New playlist") } },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                if (s.data.isEmpty()) {
                    EmptyView(icon = "🎶", title = "No playlists yet", message = "Tap + to create your first one.", modifier = Modifier.padding(padding).fillMaxSize())
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(s.data, key = { it.id }) { playlist ->
                            Card(onClick = { onOpenPlaylist(playlist.id) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
                                Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                                    PlaylistCoverBox(playlist)
                                    Column(Modifier.weight(1f).padding(start = 14.dp)) {
                                        Text(playlist.name, style = MaterialTheme.typography.titleMedium)
                                        val durationText = playlist.totalSeconds.takeIf { it > 0 }?.let { " · ${formatDuration(it)}" } ?: ""
                                        Text("${playlist.items.size} recording${if (playlist.items.size == 1) "" else "s"}$durationText", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                    }
                                    IconButton(onClick = { viewModel.delete(playlist.id) }) {
                                        Icon(Icons.Filled.Delete, contentDescription = "Delete playlist")
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        if (showCreate) {
            CreatePlaylistSheet(
                onDismiss = { showCreate = false },
                onCreate = { name -> viewModel.create(name) { id -> showCreate = false; onOpenPlaylist(id) } },
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreatePlaylistSheet(onDismiss: () -> Unit, onCreate: (String) -> Unit) {
    var name by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(20.dp).padding(bottom = 24.dp)) {
            Text("New playlist", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(value = name, onValueChange = { name = it }, label = { Text("Name") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 14.dp))
            TextButton(onClick = { onCreate(name) }, modifier = Modifier.padding(top = 12.dp)) { Text("Create") }
        }
    }
}
