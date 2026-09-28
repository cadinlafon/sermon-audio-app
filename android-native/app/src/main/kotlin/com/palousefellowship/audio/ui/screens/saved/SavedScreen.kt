package com.palousefellowship.audio.ui.screens.saved

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
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
import com.palousefellowship.audio.ui.components.AudioListItem
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SavedScreen(playerState: PlayerUiState, onPlay: (Audio, List<Audio>) -> Unit) {
    val viewModel = pfaViewModel { c -> SavedViewModel(c.savedRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Liked Sermons", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                if (s.data.isEmpty()) {
                    EmptyView(icon = "❤️", title = "Nothing liked yet", message = "Tap the heart on any recording to save it here.", modifier = Modifier.padding(padding).fillMaxSize())
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(s.data, key = { it.sermonId }) { saved ->
                            val audio = saved.toAudio()
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                AudioListItem(
                                    audio = audio,
                                    isCurrent = playerState.current?.id == audio.id,
                                    isPlaying = playerState.isPlaying,
                                    onClick = { onPlay(audio, s.data.map { it.toAudio() }) },
                                    modifier = Modifier.weight(1f),
                                )
                                IconButton(onClick = { viewModel.unsave(saved.sermonId) }) {
                                    Icon(Icons.Filled.Favorite, contentDescription = "Unlike", tint = MaterialTheme.colorScheme.primary)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
