package com.palousefellowship.audio.ui.screens.playlists

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.PlaylistItem
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState
import com.palousefellowship.audio.util.formatDuration

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlaylistDetailScreen(playlistId: String, onBack: () -> Unit, onPlay: (Audio, List<Audio>) -> Unit) {
    val viewModel = pfaViewModel { c -> PlaylistDetailViewModel(c.playlistRepository, playlistId) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text((state as? UiState.Success)?.data?.name ?: "Playlist", style = MaterialTheme.typography.titleLarge) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
            )
        },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                val playlist = s.data
                if (playlist.items.isEmpty()) {
                    EmptyView(icon = "🎶", title = "No recordings yet", message = "Add recordings to this playlist from the player.", modifier = Modifier.padding(padding).fillMaxSize())
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        item {
                            Button(
                                onClick = { onPlay(playlist.items.first().toAudio(), playlist.items.map { it.toAudio() }) },
                                modifier = Modifier.fillMaxWidth(),
                            ) {
                                Icon(Icons.Filled.PlayArrow, contentDescription = null)
                                Text(" Play all", modifier = Modifier.padding(start = 4.dp))
                            }
                        }
                        itemsIndexed(playlist.items) { index, item ->
                            PlaylistItemRow(
                                item = item,
                                onClick = { onPlay(item.toAudio(), playlist.items.map { it.toAudio() }) },
                                onRemove = { viewModel.removeItem(item.id) },
                                onMoveUp = { viewModel.moveUp(index) },
                                onMoveDown = { viewModel.moveDown(index, playlist.items.size) },
                                canMoveUp = index > 0,
                                canMoveDown = index < playlist.items.size - 1,
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun PlaylistItemRow(
    item: PlaylistItem,
    onClick: () -> Unit,
    onRemove: () -> Unit,
    onMoveUp: () -> Unit,
    onMoveDown: () -> Unit,
    canMoveUp: Boolean,
    canMoveDown: Boolean,
) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
        Row(Modifier.padding(10.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(item.title, style = MaterialTheme.typography.titleSmall, maxLines = 2)
                Text(
                    listOfNotNull(item.speaker.takeIf { it.isNotBlank() }, item.duration.takeIf { it > 0 }?.let { formatDuration(it) }).joinToString("  ·  "),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onMoveUp, enabled = canMoveUp) { Icon(Icons.Filled.KeyboardArrowUp, contentDescription = "Move up") }
            IconButton(onClick = onMoveDown, enabled = canMoveDown) { Icon(Icons.Filled.KeyboardArrowDown, contentDescription = "Move down") }
            IconButton(onClick = onRemove) { Icon(Icons.Filled.Close, contentDescription = "Remove") }
        }
    }
}
