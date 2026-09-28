package com.palousefellowship.audio.ui.screens.home

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.Notice
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.components.NoticeCard
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onPlayLatest: (Audio) -> Unit,
    onNavigateRoute: (String) -> Unit,
) {
    val viewModel = pfaViewModel { c -> HomeViewModel(c.audioRepository, c.noticeRepository, c.authRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshing by viewModel.isRefreshing.collectAsState()
    val uriHandler = LocalUriHandler.current

    Scaffold(
        topBar = { TopAppBar(title = { Text("Palouse Fellowship Audio", style = MaterialTheme.typography.titleLarge) }) },
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
                    LazyColumn(
                        modifier = Modifier.fillMaxSize(),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp),
                    ) {
                        s.data.latestSermon?.let { latest ->
                            item {
                                Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f))) {
                                    Column(Modifier.padding(16.dp)) {
                                        Text("Latest Sermon", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                                        Text(latest.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 4.dp))
                                        Text(latest.speaker, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                        Button(onClick = { onPlayLatest(latest) }, modifier = Modifier.padding(top = 12.dp)) { Text("▶ Play") }
                                    }
                                }
                            }
                        }

                        if (s.data.notices.isNotEmpty()) {
                            item { Text("📌 Notices", style = MaterialTheme.typography.titleLarge) }
                            items(s.data.notices, key = { it.id }) { notice ->
                                NoticeCard(
                                    notice = notice,
                                    onButtonClick = { n ->
                                        when (n.buttonType) {
                                            "page" -> n.buttonValue?.let(onNavigateRoute)
                                            else -> n.buttonValue?.let { uriHandler.openUri(it) }
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
}
