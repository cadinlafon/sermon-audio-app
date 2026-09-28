package com.palousefellowship.audio.ui.screens.search

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.ui.components.AudioListItem
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ResourceCard
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SearchScreen(
    onPlayAudio: (Audio) -> Unit,
    onOpenResource: (Resource) -> Unit,
) {
    val viewModel = pfaViewModel { c -> SearchViewModel(c.audioRepository, c.resourceRepository) }
    val query by viewModel.query.collectAsStateWithLifecycle()
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Search", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding)) {
            OutlinedTextField(
                value = query,
                onValueChange = viewModel::onQueryChange,
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
                placeholder = { Text("Sermons, speakers, resources…") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth().padding(16.dp),
            )

            val results = (state as? UiState.Success)?.data
            when {
                query.isBlank() -> EmptyView(icon = "🔍", title = "Search everything", message = "Titles, speakers, and resources.", modifier = Modifier.fillMaxSize())
                results != null && results.audio.isEmpty() && results.resources.isEmpty() -> EmptyView(icon = "🔍", title = "No results", message = "Try a different search.", modifier = Modifier.fillMaxSize())
                results != null -> LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    if (results.audio.isNotEmpty()) {
                        item { Text("🎧 Audio", style = MaterialTheme.typography.titleMedium) }
                        items(results.audio, key = { "a_${it.id}" }) { audio ->
                            AudioListItem(audio = audio, isCurrent = false, isPlaying = false, onClick = { onPlayAudio(audio) })
                        }
                    }
                    if (results.resources.isNotEmpty()) {
                        item { Text("📚 Resources", style = MaterialTheme.typography.titleMedium) }
                        items(results.resources, key = { "r_${it.id}" }) { resource ->
                            ResourceCard(resource = resource, onClick = { onOpenResource(resource) })
                        }
                    }
                }
            }
        }
    }
}
