package com.palousefellowship.audio.ui.screens.downloads

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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.Card
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
import com.palousefellowship.audio.data.local.DownloadEntity
import com.palousefellowship.audio.data.local.toAudio
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.formatDuration

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DownloadsScreen(onPlay: (Audio) -> Unit) {
    val viewModel = pfaViewModel { c -> DownloadsViewModel(c.downloadRepository) }
    val downloads by viewModel.downloads.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Downloads", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        if (downloads.isEmpty()) {
            EmptyView(
                icon = "⬇️",
                title = "Nothing downloaded",
                message = "Tap the download button on any recording to make it available offline.",
                modifier = Modifier.padding(padding).fillMaxSize(),
            )
        } else {
            Column(Modifier.fillMaxSize().padding(padding)) {
                val totalMb = downloads.sumOf { it.fileSizeBytes } / (1024.0 * 1024.0)
                Text(
                    "${downloads.size} of ${viewModel.maxDownloads} downloads used · %.1f MB".format(totalMb),
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(16.dp),
                )
                LazyColumn(
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 4.dp),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    items(downloads, key = { it.audioId }) { entity ->
                        DownloadRow(entity, onClick = { onPlay(entity.toAudio()) }, onRemove = { viewModel.remove(entity.audioId) })
                    }
                }
            }
        }
    }
}

@Composable
private fun DownloadRow(entity: DownloadEntity, onClick: () -> Unit, onRemove: () -> Unit) {
    Card(onClick = onClick, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(entity.title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
                Text(
                    listOfNotNull(
                        entity.speaker.takeIf { it.isNotBlank() },
                        entity.duration.takeIf { it > 0 }?.let { formatDuration(it) },
                        "%.1f MB".format(entity.fileSizeBytes / (1024.0 * 1024.0)),
                    ).joinToString("  ·  "),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            IconButton(onClick = onRemove) { Icon(Icons.Filled.Delete, contentDescription = "Remove download") }
        }
    }
}
