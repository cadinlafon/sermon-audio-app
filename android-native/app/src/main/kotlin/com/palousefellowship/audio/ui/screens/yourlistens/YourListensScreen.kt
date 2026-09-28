package com.palousefellowship.audio.ui.screens.yourlistens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.ListenHistoryItem
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState
import com.palousefellowship.audio.util.formatDuration

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun YourListensScreen(onPlay: (Audio) -> Unit) {
    val viewModel = pfaViewModel { c -> YourListensViewModel(c.listenProgressRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Your Listens", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                if (s.data.isEmpty()) {
                    EmptyView(icon = "🎧", title = "Nothing here yet", message = "Start listening and your progress will show up here.", modifier = Modifier.padding(padding).fillMaxSize())
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(s.data, key = { it.audioId }) { item ->
                            HistoryRow(item, onClick = { onPlay(Audio(id = item.audioId, title = item.title, speaker = item.speaker, duration = item.durationSeconds)) })
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HistoryRow(item: ListenHistoryItem, onClick: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(14.dp)) {
            Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(item.title, style = MaterialTheme.typography.titleMedium, modifier = Modifier.weight(1f))
                StatusChip(item.status)
            }
            if (item.speaker.isNotBlank()) {
                Text(item.speaker, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            LinearProgressIndicator(
                progress = { item.progress },
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            )
            Text(
                "${formatDuration(item.positionSeconds)} of ${formatDuration(item.durationSeconds)}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 4.dp),
            )
        }
    }
}

@Composable
private fun StatusChip(status: String) {
    val label = when (status) { "completed" -> "Completed"; "in-progress" -> "In progress"; else -> "Not started" }
    AssistChip(onClick = {}, enabled = false, label = { Text(label, style = MaterialTheme.typography.labelSmall) }, colors = AssistChipDefaults.assistChipColors())
}
