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
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Replay30
import androidx.compose.material.icons.filled.SkipNext
import androidx.compose.material.icons.filled.SkipPrevious
import androidx.compose.material.icons.filled.Forward30
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.player.PlaybackPhase
import com.palousefellowship.audio.util.formatDuration

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(onBack: () -> Unit) {
    // PlayerRepository is a process-wide singleton (so the mini player and
    // this screen always agree) — it's owned by AppContainer, not a
    // per-screen ViewModel, so it's read straight from there rather than
    // through pfaViewModel.
    val player = (LocalContext.current.applicationContext as PfaApplication).container.playerRepository
    val state by player.state.collectAsStateWithLifecycle()

    // While the user is actively dragging the seek bar, show their drag
    // position instead of snapping back to the ticking playback position.
    var dragPositionMs by remember { mutableStateOf<Float?>(null) }

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

                Spacer(Modifier.height(32.dp))

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
        }
    }
}
