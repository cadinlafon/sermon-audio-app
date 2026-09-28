package com.palousefellowship.audio.ui.screens.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.BookmarkBorder
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.DownloadDone
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.PlaylistAdd
import androidx.compose.material.icons.filled.Replay30
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Forward30
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.player.PlaybackPhase
import com.palousefellowship.audio.ui.screens.playlists.AddToPlaylistSheet
import com.palousefellowship.audio.util.formatDuration
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(onBack: () -> Unit) {
    // PlayerRepository is a process-wide singleton (so the mini player and
    // this screen always agree) — it's owned by AppContainer, not a
    // per-screen ViewModel, so it's read straight from there rather than
    // through pfaViewModel.
    val container = (LocalContext.current.applicationContext as PfaApplication).container
    val player = container.playerRepository
    val state by player.state.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()

    // While the user is actively dragging the seek bar, show their drag
    // position instead of snapping back to the ticking playback position.
    var dragPositionMs by remember { mutableStateOf<Float?>(null) }

    var isSaved by remember { mutableStateOf(false) }
    var isDownloaded by remember { mutableStateOf(false) }
    var showAddToPlaylist by remember { mutableStateOf(false) }
    var showBookmarkDialog by remember { mutableStateOf(false) }
    var downloadBusy by remember { mutableStateOf(false) }

    LaunchedEffect(state.current?.id) {
        val audio = state.current
        isSaved = audio?.let { runCatching { container.savedRepository.isSaved(it.id) }.getOrDefault(false) } ?: false
        isDownloaded = audio?.let { container.downloadRepository.isDownloaded(it.id) } ?: false
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {},
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.background),
            )
        },
    ) { padding ->
        val current = state.current
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            if (current == null) {
                Text("Nothing is playing", style = MaterialTheme.typography.titleMedium)
            } else {
                Text(
                    text = "NOW PLAYING",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.primary,
                )
                Text(
                    text = current.title,
                    style = MaterialTheme.typography.headlineSmall,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Text(
                    text = current.speaker,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )

                Row(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 16.dp),
                ) {
                    IconButton(onClick = {
                        scope.launch {
                            runCatching { container.savedRepository.toggle(current) }.onSuccess { isSaved = it }
                        }
                    }) {
                        Icon(
                            if (isSaved) Icons.Filled.Favorite else Icons.Filled.FavoriteBorder,
                            contentDescription = if (isSaved) "Unlike" else "Like",
                            tint = if (isSaved) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    IconButton(onClick = { showBookmarkDialog = true }) {
                        Icon(Icons.Filled.BookmarkBorder, contentDescription = "Bookmark this moment", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(onClick = { showAddToPlaylist = true }) {
                        Icon(Icons.Filled.PlaylistAdd, contentDescription = "Add to playlist", tint = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    IconButton(
                        onClick = {
                            if (!isDownloaded && !downloadBusy) {
                                downloadBusy = true
                                scope.launch {
                                    container.downloadRepository.download(current)
                                    isDownloaded = container.downloadRepository.isDownloaded(current.id)
                                    downloadBusy = false
                                }
                            }
                        },
                        enabled = !downloadBusy,
                    ) {
                        Icon(
                            if (isDownloaded) Icons.Filled.DownloadDone else Icons.Filled.Download,
                            contentDescription = if (isDownloaded) "Downloaded" else "Download for offline",
                            tint = if (isDownloaded) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }

                Spacer(Modifier.height(16.dp))

                when (state.phase) {
                    PlaybackPhase.ERROR -> {
                        Text(
                            state.errorMessage ?: "This recording couldn't be played.",
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                            style = MaterialTheme.typography.bodyMedium,
                        )
                        FilledIconButton(onClick = { player.retry() }, modifier = Modifier.padding(top = 16.dp)) {
                            Icon(Icons.Filled.PlayArrow, contentDescription = "Retry")
                        }
                    }
                    PlaybackPhase.LOADING -> CircularProgressIndicator()
                    else -> {
                        val durationMs = state.durationMs.coerceAtLeast(1)
                        val positionMs = dragPositionMs ?: state.positionMs.toFloat()
                        Slider(
                            value = positionMs,
                            valueRange = 0f..durationMs.toFloat(),
                            onValueChange = { dragPositionMs = it },
                            onValueChangeFinished = {
                                dragPositionMs?.let { player.seekTo(it.toLong()) }
                                dragPositionMs = null
                            },
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(formatDuration((positionMs / 1000).toLong()), style = MaterialTheme.typography.labelSmall)
                            Text(formatDuration((durationMs / 1000).toLong()), style = MaterialTheme.typography.labelSmall)
                        }

                        Spacer(Modifier.height(20.dp))

                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                            IconButton(onClick = { player.previous() }, enabled = state.hasPrevious) {
                                Icon(Icons.Filled.SkipPrevious, contentDescription = "Previous", modifier = Modifier.size(28.dp))
                            }
                            IconButton(onClick = { player.skip(-30_000) }) {
                                Icon(Icons.Filled.Replay30, contentDescription = "Back 30 seconds", modifier = Modifier.size(32.dp))
                            }
                            FilledIconButton(onClick = { player.togglePlayPause() }, modifier = Modifier.size(72.dp)) {
                                Icon(
                                    imageVector = if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                                    contentDescription = if (state.isPlaying) "Pause" else "Play",
                                    modifier = Modifier.size(36.dp),
                                )
                            }
                            IconButton(onClick = { player.skip(30_000) }) {
                                Icon(Icons.Filled.Forward30, contentDescription = "Forward 30 seconds", modifier = Modifier.size(32.dp))
                            }
                            IconButton(onClick = { player.next() }, enabled = state.hasNext) {
                                Icon(Icons.Filled.SkipNext, contentDescription = "Next", modifier = Modifier.size(28.dp))
                            }
                        }
                    }
                }
            }

            if (current != null) {
                if (showAddToPlaylist) {
                    AddToPlaylistSheet(audio = current, repository = container.playlistRepository, onDismiss = { showAddToPlaylist = false })
                }
                if (showBookmarkDialog) {
                    BookmarkDialog(
                        atSeconds = (state.positionMs / 1000),
                        onDismiss = { showBookmarkDialog = false },
                        onSave = { label ->
                            scope.launch {
                                container.notesRepository.addBookmark(current.id, (state.positionMs / 1000).toDouble(), label, current)
                                showBookmarkDialog = false
                            }
                        },
                    )
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun BookmarkDialog(atSeconds: Long, onDismiss: () -> Unit, onSave: (String) -> Unit) {
    var label by remember { mutableStateOf("") }
    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
            Text("Bookmark at ${formatDuration(atSeconds)}", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(
                value = label,
                onValueChange = { label = it },
                label = { Text("Label (optional)") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(top = 14.dp),
            )
            Button(onClick = { onSave(label) }, modifier = Modifier.fillMaxWidth().padding(top = 14.dp)) { Text("Save Bookmark") }
        }
    }
}
