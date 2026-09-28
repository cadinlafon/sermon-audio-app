package com.palousefellowship.audio.ui.screens.audiolist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.components.OfflineBanner
import com.palousefellowship.audio.ui.components.AudioListItem
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AudioListScreen(
    title: String,
    emptyIcon: String,
    emptyMessage: String,
    types: List<String>,
    playerState: PlayerUiState,
    onPlay: (Audio, List<Audio>) -> Unit,
) {
    val viewModel = pfaViewModel { container -> AudioListViewModel(container.audioRepository, types) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshing by viewModel.isRefreshing.collectAsState()

    Scaffold(
        topBar = { TopAppBar(title = { Text(title, style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when (val s = state) {
                is UiState.Loading -> LoadingView()
                is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() })
                is UiState.Success -> {
                    if (s.data.isEmpty()) {
                        Column(Modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
                            EmptyView(icon = emptyIcon, title = "Nothing here yet", message = emptyMessage)
                        }
                    } else {
                        Column(Modifier.fillMaxSize()) {
                            if (s.fromCache) {
                                OfflineBanner("You're offline — showing the last saved list.")
                            }
                            LazyColumn(
                                modifier = Modifier.fillMaxSize(),
                                contentPadding = PaddingValues(16.dp),
                                verticalArrangement = Arrangement.spacedBy(10.dp),
                            ) {
                                items(s.data, key = { it.id }) { audio ->
                                    AudioListItem(
                                        audio = audio,
                                        isCurrent = playerState.current?.id == audio.id,
                                        isPlaying = playerState.isPlaying,
                                        onClick = { onPlay(audio, s.data) },
                                    )
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}
