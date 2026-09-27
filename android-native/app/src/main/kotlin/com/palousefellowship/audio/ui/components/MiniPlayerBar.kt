package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.IconButton
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.player.PlaybackPhase
import com.palousefellowship.audio.player.PlayerUiState

/** Persists across every screen except the full Player screen itself —
 * same role as the web app's MiniPlayer component. */
@Composable
fun MiniPlayerBar(
    state: PlayerUiState,
    onTogglePlayPause: () -> Unit,
    onOpenPlayer: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val current = state.current ?: return

    Surface(
        modifier = modifier.fillMaxWidth().clickable(onClick = onOpenPlayer),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 4.dp,
    ) {
        Column {
            val progress = if (state.durationMs > 0) (state.positionMs.toFloat() / state.durationMs).coerceIn(0f, 1f) else 0f
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().size(2.dp),
            )
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = current.title,
                        style = MaterialTheme.typography.titleSmall,
                        maxLines = 1,
                    )
                    Text(
                        text = when (state.phase) {
                            PlaybackPhase.LOADING -> "Loading…"
                            PlaybackPhase.ERROR -> state.errorMessage ?: "Playback error"
                            else -> current.speaker
                        },
                        style = MaterialTheme.typography.labelSmall,
                        color = if (state.phase == PlaybackPhase.ERROR) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
                IconButton(onClick = onTogglePlayPause) {
                    when (state.phase) {
                        PlaybackPhase.LOADING -> CircularProgressIndicator(modifier = Modifier.size(22.dp), strokeWidth = 2.dp)
                        else -> Icon(
                            imageVector = if (state.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = if (state.isPlaying) "Pause" else "Play",
                        )
                    }
                }
            }
        }
    }
}
