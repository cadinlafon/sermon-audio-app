package com.palousefellowship.audio.ui.screens.doctrine

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ChevronLeft
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.palousefellowship.audio.data.model.DoctrineAudioFile
import com.palousefellowship.audio.data.model.DoctrineContent
import com.palousefellowship.audio.data.model.DoctrineWeek
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.util.UiState
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import kotlinx.coroutines.delay

// Web's `dropdownHeader` / dot-row tones (src/pages/Doctrine.jsx).
private val DropdownHeaderBg = Color(0xFFFDF1DE)
private val DotInactive = Color(0xFFE4D3B8)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DoctrineScreen(
    playerState: PlayerUiState,
    onPlayDoctrineAudio: (DoctrineAudioFile, DoctrineContent) -> Unit,
    onPlayNextDoctrineAudio: (DoctrineAudioFile, DoctrineContent) -> Unit,
    onTogglePlayPause: () -> Unit,
) {
    val viewModel = pfaViewModel { c -> DoctrineViewModel(c.doctrineRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()

    Scaffold(
        topBar = { TopAppBar(title = { Text("Doctrine Campaign", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                val content = s.data.content
                val weeks = s.data.topics.publishedWeeks()
                if (content == null && weeks.isEmpty()) {
                    EmptyView(
                        icon = "📖",
                        title = "Nothing here yet",
                        message = "Check back soon.",
                        modifier = Modifier.padding(padding).fillMaxSize(),
                    )
                    return@Scaffold
                }

                LazyColumn(
                    modifier = Modifier.fillMaxSize().padding(padding),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                ) {
                    if (weeks.isNotEmpty()) {
                        item {
                            ExpandableSection(title = "Weekly Topic", startExpanded = true) {
                                WeeklyTopicSlider(weeks, s.data.topics.defaultWeekId)
                            }
                        }
                    }

                    if (content != null) {
                        item {
                            Column {
                                if (content.imageURL.isNotBlank()) {
                                    AsyncImage(
                                        model = content.imageURL,
                                        contentDescription = null,
                                        contentScale = ContentScale.Crop,
                                        modifier = Modifier.fillMaxWidth().height(160.dp).padding(bottom = 10.dp),
                                    )
                                }
                                Text(content.title.ifBlank { "Untitled" }, style = MaterialTheme.typography.headlineSmall)
                                if (content.speaker.isNotBlank()) {
                                    Text("Speaker: ${content.speaker}", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                }
                                if (content.details.isNotBlank()) {
                                    Text(content.details, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
                                }
                            }
                        }

                        item {
                            ExpandableSection(title = "Schedule") {
                                ScheduleTable()
                            }
                        }

                        val questions = content.questions
                        item {
                            ExpandableSection(title = "Questions") {
                                if (questions.isEmpty()) EmptySectionText("No questions added yet.")
                                else Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                                    questions.forEachIndexed { i, q -> Text("${i + 1}. $q", style = MaterialTheme.typography.bodyMedium) }
                                }
                            }
                        }

                        val audioFiles = content.resolvedAudioFiles()
                        item {
                            ExpandableSection(title = "Audio") {
                                if (audioFiles.isEmpty()) EmptySectionText("No audio uploaded yet.")
                                else Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                                    audioFiles.forEachIndexed { i, file ->
                                        DoctrineAudioRow(
                                            file = file,
                                            index = i,
                                            content = content,
                                            playerState = playerState,
                                            onPlay = { onPlayDoctrineAudio(file, content) },
                                            onTogglePlayPause = onTogglePlayPause,
                                            onPlayNext = { onPlayNextDoctrineAudio(file, content) },
                                        )
                                    }
                                }
                            }
                        }

                        if (content.docsLink.isNotBlank()) {
                            item {
                                ExpandableSection(title = "Docs") {
                                    val uriHandler = androidx.compose.ui.platform.LocalUriHandler.current
                                    androidx.compose.material3.TextButton(onClick = { uriHandler.openUri(content.docsLink) }) {
                                        Text("Open Docs →")
                                    }
                                }
                            }
                        }

                        if (content.memorization.isNotBlank()) {
                            item {
                                ExpandableSection(title = "Weekly Memorization") {
                                    Text(content.memorization, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                        if (content.notes.isNotBlank()) {
                            item {
                                ExpandableSection(title = "Notes") {
                                    Text(content.notes, style = MaterialTheme.typography.bodyMedium)
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun EmptySectionText(text: String) {
    Text(text, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun ExpandableSection(title: String, startExpanded: Boolean = false, content: @Composable () -> Unit) {
    var expanded by rememberSaveable { mutableStateOf(startExpanded) }
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth()
                    .clickable { expanded = !expanded }
                    .background(DropdownHeaderBg)
                    .padding(horizontal = 16.dp, vertical = 13.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = androidx.compose.ui.Alignment.CenterVertically,
            ) {
                Text(title, style = MaterialTheme.typography.titleSmall)
                Icon(
                    if (expanded) Icons.Filled.ExpandLess else Icons.Filled.ExpandMore,
                    contentDescription = null,
                    tint = AccentBrownDark,
                )
            }
            if (expanded) {
                Column(Modifier.padding(16.dp)) { content() }
            }
        }
    }
}

/** One audio track's row inside the "Audio" section — mirrors the web's
 * AudioPlayerRow: a pill Play/Pause button, a "+ Play Next" button that
 * splices the track in without interrupting what's currently playing,
 * and a "Now playing." caption when this is the loaded track. Uses
 * FlowRow (not Row) so "+ Play Next" wraps to its own line for a long
 * label instead of being squeezed, matching the web's
 * `flexWrap: "wrap"` on `audioRowButtons`. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DoctrineAudioRow(
    file: DoctrineAudioFile,
    index: Int,
    content: DoctrineContent,
    playerState: PlayerUiState,
    onPlay: () -> Unit,
    onTogglePlayPause: () -> Unit,
    onPlayNext: () -> Unit,
) {
    val trackId = "doctrine_${file.id}"
    val isCurrent = playerState.current?.id == trackId
    val label = file.label.ifBlank { "Track ${index + 1}" }
    var queued by remember { mutableStateOf(false) }

    LaunchedEffect(queued) {
        if (queued) {
            delay(1800)
            queued = false
        }
    }

    Column {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(
                onClick = { if (isCurrent) onTogglePlayPause() else onPlay() },
                shape = RoundedCornerShape(999.dp),
                colors = ButtonDefaults.buttonColors(containerColor = AccentBrownDark),
            ) {
                Icon(
                    if (isCurrent && playerState.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp),
                )
                Text(
                    if (isCurrent && playerState.isPlaying) "Pause" else label,
                    modifier = Modifier.padding(start = 4.dp),
                    style = MaterialTheme.typography.labelLarge,
                )
            }
            OutlinedButton(
                onClick = { onPlayNext(); queued = true },
                shape = RoundedCornerShape(999.dp),
            ) {
                Text(if (queued) "✓ Added" else "+ Play Next", style = MaterialTheme.typography.labelLarge)
            }
        }
        if (isCurrent) {
            Text(
                "Now playing.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

/** "‹ Week 2 ›" slider — same interaction as the web app's WeeklyTopic
 * component, opening on the admin-chosen default week. */
@Composable
private fun WeeklyTopicSlider(weeks: List<DoctrineWeek>, defaultWeekId: String) {
    var index by rememberSaveable { mutableIntStateOf(weeks.indexOfFirst { it.id == defaultWeekId }.coerceAtLeast(0)) }
    val week = weeks[index.coerceIn(0, weeks.size - 1)]
    val isDefault = week.id == defaultWeekId

    Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
        IconButton(onClick = { if (index > 0) index-- }, enabled = index > 0) {
            Icon(Icons.Filled.ChevronLeft, contentDescription = "Previous week")
        }
        Column(horizontalAlignment = androidx.compose.ui.Alignment.CenterHorizontally) {
            Text(week.label, style = MaterialTheme.typography.titleSmall)
            Text(
                "${index + 1} of ${weeks.size}${if (isDefault) " · Current" else ""}",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(onClick = { if (index < weeks.size - 1) index++ }, enabled = index < weeks.size - 1) {
            Icon(Icons.Filled.ChevronRight, contentDescription = "Next week")
        }
    }

    if (weeks.size > 1) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            horizontalArrangement = Arrangement.Center,
        ) {
            weeks.forEachIndexed { i, w ->
                val active = i == index
                Box(
                    modifier = Modifier
                        .padding(horizontal = 3.5.dp)
                        .size(width = if (active) 18.dp else 8.dp, height = 8.dp)
                        .clip(CircleShape)
                        .background(if (active) AccentOrange else DotInactive)
                        .clickable { index = i },
                )
            }
        }
    }

    val hasBody = week.topic.isNotBlank() || week.dateRange.isNotBlank() || week.memoryText.isNotBlank() || week.details.isNotBlank()
    if (hasBody) {
        Column(Modifier.padding(top = 10.dp)) {
            if (week.topic.isNotBlank()) Text(week.topic, style = MaterialTheme.typography.titleMedium)
            if (week.dateRange.isNotBlank()) Text(week.dateRange, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (week.memoryText.isNotBlank()) {
                Card(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.08f))) {
                    Column(Modifier.padding(10.dp)) {
                        Text("Memory text", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                        Text(week.memoryText, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }
            if (week.details.isNotBlank()) Text(week.details, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 8.dp))
        }
    } else {
        EmptySectionText("Nothing added for this week yet.")
    }
}

/** The full-year curriculum schedule — static content on both platforms
 * (src/data/doctrineSchedule.js), not admin-editable. */
@Composable
private fun ScheduleTable() {
    Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
        com.palousefellowship.audio.data.model.DOCTRINE_SCHEDULE.forEach { row ->
            if (row.isBreak) {
                Text(
                    "${row.date} — ${row.topic}",
                    style = MaterialTheme.typography.labelMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 6.dp),
                )
            } else {
                Row(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                    Text(
                        "Wk ${row.week}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary,
                        modifier = Modifier.padding(end = 8.dp),
                    )
                    Column(Modifier.weight(1f)) {
                        Text(row.topic, style = MaterialTheme.typography.bodyMedium)
                        Text(
                            listOfNotNull(row.date, row.memoryText.takeIf { it.isNotBlank() }).joinToString("  ·  "),
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                }
            }
        }
    }
}
