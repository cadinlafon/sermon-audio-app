package com.palousefellowship.audio.ui.screens.audiolist

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sort
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.components.AudioListItem
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.components.OfflineBanner
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState

/** [typeChips] is a list of (value, label) pairs shown as filter chips
 * above the list — pass an empty list to hide them (Sunday School, which
 * has only one type to begin with, same as the web app). */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AudioListScreen(
    title: String,
    emptyIcon: String,
    emptyMessage: String,
    types: List<String>,
    typeChips: List<Pair<String, String>> = emptyList(),
    playerState: PlayerUiState,
    onPlay: (Audio, List<Audio>) -> Unit,
) {
    val viewModel = pfaViewModel { container -> AudioListViewModel(container.audioRepository, types) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val search by viewModel.search.collectAsStateWithLifecycle()
    val typeFilter by viewModel.typeFilter.collectAsStateWithLifecycle()
    val sort by viewModel.sort.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text(title, style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            Row(
                modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                OutlinedTextField(
                    value = search,
                    onValueChange = { viewModel.search.value = it },
                    leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                    placeholder = { Text("Search title or speaker…") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                SortMenuButton(sort = sort, onSortChange = { viewModel.sort.value = it })
            }

            if (typeChips.isNotEmpty()) {
                LazyRow(
                    contentPadding = PaddingValues(horizontal = 16.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(bottom = 8.dp),
                ) {
                    item {
                        FilterChip(selected = typeFilter == "all", onClick = { viewModel.typeFilter.value = "all" }, label = { Text("All") })
                    }
                    items(typeChips) { (value, label) ->
                        FilterChip(selected = typeFilter == value, onClick = { viewModel.typeFilter.value = value }, label = { Text(label) })
                    }
                }
            }

            PullToRefreshBox(
                isRefreshing = refreshing,
                onRefresh = { viewModel.refresh() },
                modifier = Modifier.fillMaxSize(),
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
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SortMenuButton(sort: AudioSort, onSortChange: (AudioSort) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    IconButton(onClick = { expanded = true }) { Icon(Icons.Filled.Sort, contentDescription = "Sort: ${sort.label}") }
    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
        AudioSort.entries.forEach { option ->
            DropdownMenuItem(text = { Text(option.label) }, onClick = { onSortChange(option); expanded = false })
        }
    }
}
