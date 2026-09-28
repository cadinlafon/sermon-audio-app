package com.palousefellowship.audio.ui.screens.resources

import androidx.compose.foundation.layout.Arrangement
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.components.ResourceCard
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState
import com.palousefellowship.audio.util.openInSpotify

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ResourcesScreen(
    title: String,
    typeFilter: String?,
    emptyIcon: String,
    emptyMessage: String,
    onPlayAudioResource: (Resource) -> Unit,
) {
    val viewModel = pfaViewModel { c -> ResourcesViewModel(c.resourceRepository, typeFilter) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current

    Scaffold(
        topBar = { TopAppBar(title = { Text(title, style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                if (s.data.isEmpty()) {
                    EmptyView(icon = emptyIcon, title = "Nothing here yet", message = emptyMessage, modifier = Modifier.padding(padding).fillMaxSize())
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(s.data, key = { it.id }) { resource ->
                            ResourceCard(
                                resource = resource,
                                onClick = {
                                    when {
                                        resource.type == Resource.TYPE_AUDIO && !resource.audioStorageKey.isNullOrBlank() ->
                                            onPlayAudioResource(resource)
                                        resource.type == Resource.TYPE_SPOTIFY -> openInSpotify(context, resource.url)
                                        resource.url.isNotBlank() -> uriHandler.openUri(resource.url)
                                    }
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}
