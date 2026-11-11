package com.palousefellowship.audio.ui.screens.player

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.NOTE_CATEGORIES
import com.palousefellowship.audio.data.model.NoteDoc
import com.palousefellowship.audio.data.prefs.REPEAT_MODES
import com.palousefellowship.audio.data.prefs.SKIP_OPTIONS
import com.palousefellowship.audio.data.prefs.SPEED_OPTIONS
import com.palousefellowship.audio.data.repository.NotesRepository
import com.palousefellowship.audio.player.PlayerRepository
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.theme.PfaTheme
import com.palousefellowship.audio.util.formatDuration
import kotlinx.coroutines.launch

private val REPEAT_LABELS = mapOf("off" to "Off", "track" to "Repeat track", "queue" to "Repeat queue")

@Composable
private fun SheetTitle(text: String, trailing: (@Composable () -> Unit)? = null) {
    Row(Modifier.fillMaxWidth().padding(bottom = 12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Text(text, fontFamily = FontFamily.Serif, fontSize = 18.sp, color = MaterialTheme.colorScheme.onBackground)
        trailing?.invoke()
    }
}

@Composable
fun PillChip(text: String, on: Boolean, onClick: () -> Unit) {
    val x = PfaTheme.extras
    val colors = MaterialTheme.colorScheme
    Text(
        text, fontSize = 13.sp, color = x.buttonText, fontWeight = if (on) FontWeight.SemiBold else FontWeight.Normal,
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(if (on) x.selectedBg else colors.background)
            .border(1.dp, if (on) x.selectedBorder else colors.outline, RoundedCornerShape(999.dp)).clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp),
    )
}

// ───────────────────────── Playing Next ─────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QueueSheet(state: PlayerUiState, player: PlayerRepository, onDismiss: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = colors.surface) {
        Column(Modifier.padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 20.dp).verticalScroll(rememberScrollState())) {
            SheetTitle("Playing Next") {
                if (state.queue.isNotEmpty()) Text("Clear All", fontSize = 13.sp, color = colors.primary, modifier = Modifier.clickable { player.clearQueue() }.padding(4.dp))
            }
            state.current?.let { cur ->
                Row(Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(12.dp)).background(x.selectedBg).padding(12.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(if (state.isPlaying) "▮▮▮" else "▮▮▮", fontSize = 10.sp, color = x.gold)
                    Column {
                        Text(if (state.isPlaying) "NOW PLAYING" else "PAUSED", fontSize = 10.sp, letterSpacing = 0.8.sp, color = colors.onSurfaceVariant)
                        Text(cur.title, fontFamily = FontFamily.Serif, fontSize = 14.sp, color = colors.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            @OptIn(ExperimentalLayoutApi::class)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                PillChip("🔀 Shuffle${if (state.shuffle) " on" else ""}", state.shuffle) { player.setShuffle(!state.shuffle) }
                val next = mapOf("off" to "track", "track" to "queue", "queue" to "off")
                val icon = mapOf("off" to "🔁 Repeat off", "track" to "🔂 Repeat track", "queue" to "🔁 Repeat queue")
                PillChip(icon.getValue(state.repeat), state.repeat != "off") { player.setRepeat(next.getValue(state.repeat)) }
                if (state.queue.size > 1) PillChip("Shuffle order", false) { player.shuffleQueueNow() }
            }
            if (state.queue.isNotEmpty()) {
                val secs = state.queue.sumOf { it.duration }
                val h = secs / 3600; val m = Math.round((secs % 3600) / 60.0)
                Text("${state.queue.size} recording${if (state.queue.size == 1) "" else "s"}${if (secs > 0) " · ${if (h > 0) "${h}h " else ""}${m}m" else ""}", fontSize = 12.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp, bottom = 4.dp))
            }
            if (state.queue.isEmpty()) {
                Text("Nothing queued yet — use \"Play Next\" or \"Add all to queue\" on any list.", fontSize = 14.sp, lineHeight = 21.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(vertical = 16.dp))
            } else {
                state.queue.forEachIndexed { i, a ->
                    HorizontalDivider(color = colors.outline.copy(alpha = 0.6f))
                    Row(Modifier.fillMaxWidth().padding(vertical = 8.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Column(Modifier.weight(1f).clickable { player.removeFromQueue(i); player.play(a); onDismiss() }) {
                            Text(a.title, fontFamily = FontFamily.Serif, fontSize = 14.sp, color = colors.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            Text(a.speaker, fontSize = 12.sp, color = colors.onSurfaceVariant)
                        }
                        Text("↑", fontSize = 18.sp, color = if (i > 0) x.buttonText else colors.outline, modifier = Modifier.clickable(enabled = i > 0) { player.moveQueueItem(i, i - 1) }.padding(8.dp))
                        Text("↓", fontSize = 18.sp, color = if (i < state.queue.lastIndex) x.buttonText else colors.outline, modifier = Modifier.clickable(enabled = i < state.queue.lastIndex) { player.moveQueueItem(i, i + 1) }.padding(8.dp))
                        Text("✕", fontSize = 14.sp, color = colors.onSurfaceVariant, modifier = Modifier.clickable { player.removeFromQueue(i) }.padding(8.dp))
                    }
                }
            }
        }
    }
}

// ───────────────────────── Sleep timer ─────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SleepSheet(state: PlayerUiState, player: PlayerRepository, onDismiss: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    var selected by remember { mutableStateOf<Int?>(null) }
    ModalBottomSheet(onDismissRequest = onDismiss, containerColor = colors.surface) {
        Column(Modifier.padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 20.dp)) {
            SheetTitle("Sleep Timer")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                listOf(5, 10, 15, 30, 45, 60).forEach { m ->
                    PillChip("$m min", state.sleepMode == "duration" && selected == m) { selected = m; player.setSleepTimer(m); onDismiss() }
                }
                PillChip("End of track", state.sleepMode == "endOfTrack") { player.setSleepTimer(null, endOfTrack = true); onDismiss() }
            }
            Text("Turn Off", fontSize = 14.sp, color = colors.primary, modifier = Modifier.padding(top = 14.dp).clickable { player.setSleepTimer(null); onDismiss() }.padding(vertical = 6.dp))
        }
    }
}

// ───────────────────────── Player settings ─────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PlayerSettingsSheet(state: PlayerUiState, player: PlayerRepository, onDismiss: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = colors.surface) {
        Column(Modifier.padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            SheetTitle("Player Settings")
            Section("Skip back", "How far the back button jumps.") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { SKIP_OPTIONS.forEach { PillChip("${it}s", state.skipBackSeconds == it) { player.setSkipBack(it) } } }
            }
            Section("Skip forward", "How far the forward button jumps.") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { SKIP_OPTIONS.forEach { PillChip("${it}s", state.skipForwardSeconds == it) { player.setSkipForward(it) } } }
            }
            Section("Playback speed", "Remembered — every recording starts at this speed.") {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { SPEED_OPTIONS.forEach { PillChip("${trim(it)}×", state.speed == it) { player.setSpeed(it) } } }
            }
            Section("Repeat", null) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { REPEAT_MODES.forEach { PillChip(REPEAT_LABELS.getValue(it), state.repeat == it) { player.setRepeat(it) } } }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text("Shuffle queue", fontFamily = FontFamily.Serif, fontSize = 15.sp, color = colors.onBackground)
                    Text("Pick the next recording at random.", fontSize = 12.sp, color = colors.onSurfaceVariant)
                }
                Switch(state.shuffle, onCheckedChange = { player.setShuffle(it) })
            }
        }
    }
}

fun trim(f: Float): String = if (f == f.toInt().toFloat()) f.toInt().toString() else f.toString()

@Composable
private fun Section(title: String, hint: String?, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontFamily = FontFamily.Serif, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
        if (hint != null) Text(hint, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        content()
    }
}

// ───────────────────────── Notes ─────────────────────────

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun NotesSheet(
    audio: Audio,
    repository: NotesRepository,
    positionSeconds: () -> Long,
    showWhilePlaying: Boolean,
    onToggleShow: (Boolean) -> Unit,
    onSeek: (Long) -> Unit,
    onDismiss: () -> Unit,
    onChanged: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    val scope = rememberCoroutineScope()
    var note by remember { mutableStateOf<NoteDoc?>(null) }
    var text by remember { mutableStateOf("") }
    var draft by remember { mutableStateOf("") }
    var category by remember { mutableStateOf("general") }
    var error by remember { mutableStateOf("") }
    var saving by remember { mutableStateOf(false) }
    suspend fun reload() { note = repository.getNote(audio.id); text = note?.text.orEmpty() }
    LaunchedEffect(audio.id) { reload() }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true), containerColor = colors.surface) {
        Column(Modifier.padding(horizontal = 20.dp).navigationBarsPadding().padding(bottom = 24.dp).verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            SheetTitle("📝 Notes")
            Text(audio.title, fontSize = 13.sp, color = colors.onSurfaceVariant)
            OutlinedTextField(
                text, { text = it }, label = { Text("General notes") }, minLines = 3, modifier = Modifier.fillMaxWidth(),
            )
            Button(onClick = {
                saving = true
                scope.launch { runCatching { repository.saveText(audio.id, text, audio) }.onFailure { error = it.message ?: "Couldn't save." }; saving = false; onChanged() }
            }, enabled = !saving) { Text(if (saving) "Saving…" else "Save notes") }
            HorizontalDivider(color = colors.outline)
            Text("Add a note at ${formatDuration(positionSeconds())}", fontFamily = FontFamily.Serif, fontSize = 15.sp, color = colors.onBackground)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                NOTE_CATEGORIES.forEach { (id, label) -> PillChip(label, category == id) { category = id } }
            }
            OutlinedTextField(draft, { draft = it }, placeholder = { Text("What stood out?") }, minLines = 2, modifier = Modifier.fillMaxWidth())
            Button(onClick = {
                if (draft.isBlank()) return@Button
                scope.launch {
                    runCatching { repository.addEntry(audio.id, positionSeconds().toDouble(), draft, category, audio) }
                        .onSuccess { draft = ""; reload(); onChanged() }.onFailure { error = it.message ?: "Couldn't save." }
                }
            }) { Text("Add note") }
            if (error.isNotEmpty()) Text(error, color = colors.error, fontSize = 12.sp)
            note?.entries.orEmpty().forEach { e ->
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(colors.background).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
                    Column(Modifier.weight(1f).clickable { onSeek(e.t.toLong()) }) {
                        Text("${formatDuration(e.t.toLong())} · ${NOTE_CATEGORIES.firstOrNull { it.first == e.category }?.second ?: "General"}", fontSize = 11.sp, color = x.buttonText)
                        Text(e.text, fontSize = 14.sp, color = colors.onBackground)
                    }
                    Text("✕", color = colors.onSurfaceVariant, modifier = Modifier.clickable { scope.launch { repository.removeEntry(audio.id, e.id); reload(); onChanged() } }.padding(4.dp))
                }
            }
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text("Show my notes while playing", fontSize = 13.sp, color = colors.onBackground, modifier = Modifier.weight(1f))
                Switch(showWhilePlaying, onCheckedChange = onToggleShow)
            }
        }
    }
}
