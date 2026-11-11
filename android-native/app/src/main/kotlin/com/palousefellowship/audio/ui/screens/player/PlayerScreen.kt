package com.palousefellowship.audio.ui.screens.player

import android.content.Intent
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.R
import com.palousefellowship.audio.data.config.resolveAudioConfig
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.NoteDoc
import com.palousefellowship.audio.player.PlaybackPhase
import com.palousefellowship.audio.ui.components.DEEP_LINK_BASE
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.ui.theme.PfaTheme
import com.palousefellowship.audio.util.RelatedMatch
import com.palousefellowship.audio.util.formatDuration
import com.palousefellowship.audio.util.pickRelated
import com.palousefellowship.audio.util.rankBySimilarity
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private val SPEEDS = listOf(0.75f, 1f, 1.25f, 1.5f, 2f)

/** Port of src/pages/Player.jsx — artwork, now playing, seek bar, controls, speed, timestamp tools,
 * queue / sleep timer / notes, plus Bookmarks, Recently Played and Related. */
@OptIn(ExperimentalLayoutApi::class, androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun PlayerScreen(onBack: () -> Unit, onTranscript: (String) -> Unit = {}) {
    val context = LocalContext.current
    val container = (context.applicationContext as PfaApplication).container
    val player = container.playerRepository
    val state by player.state.collectAsStateWithLifecycle()
    val session by container.sessionRepository.session.collectAsStateWithLifecycle()
    val status by container.remoteConfig.status.collectAsStateWithLifecycle()
    val settings by container.playerSettings.settings.collectAsStateWithLifecycle()
    val playback = remember(status.audioPages) { resolveAudioConfig(status.audioPages).playback }
    val scope = rememberCoroutineScope()
    val clipboard = LocalClipboardManager.current
    val colors = MaterialTheme.colorScheme
    val x = PfaTheme.extras

    var dragMs by remember { mutableStateOf<Float?>(null) }
    var showQueue by remember { mutableStateOf(false) }
    var showSleep by remember { mutableStateOf(false) }
    var showSettings by remember { mutableStateOf(false) }
    var showNotes by remember { mutableStateOf(false) }
    var flash by remember { mutableStateOf("") }
    var linkCopied by remember { mutableStateOf(false) }
    var timeCopied by remember { mutableStateOf(false) }
    var note by remember { mutableStateOf(NoteDoc()) }
    var noteTick by remember { mutableStateOf(0) }
    LaunchedEffect(flash) { if (flash.isNotEmpty()) { delay(2200); flash = "" } }
    LaunchedEffect(linkCopied) { if (linkCopied) { delay(1500); linkCopied = false } }
    LaunchedEffect(timeCopied) { if (timeCopied) { delay(1500); timeCopied = false } }

    val current = state.current
    val realId = current?.id
    LaunchedEffect(realId, noteTick, session.uid) { note = if (realId != null && session.signedIn) container.notesRepository.getNote(realId) else NoteDoc() }

    Column(Modifier.fillMaxSize().background(colors.background).statusBarsPadding().navigationBarsPadding().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp, vertical = 14.dp)) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text("← Back", fontSize = 14.sp, color = colors.primary, modifier = Modifier.clickable(onClick = onBack).padding(vertical = 8.dp))
            Box(
                Modifier.size(36.dp).clip(CircleShape).background(colors.surface).border(1.dp, colors.outline, CircleShape).clickable { showSettings = true },
                contentAlignment = Alignment.Center,
            ) { Text("⚙", fontSize = 16.sp, color = x.buttonText) }
        }

        if (current == null) {
            Column(
                Modifier.padding(top = 16.dp).fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(colors.surface).border(1.dp, colors.outline, RoundedCornerShape(24.dp)).padding(vertical = 60.dp, horizontal = 28.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("🎧", fontSize = 40.sp)
                Text("No audio playing", fontFamily = FontFamily.Serif, fontSize = 22.sp, color = colors.onBackground, modifier = Modifier.padding(top = 16.dp))
                Text("Pick a sermon to start listening.", fontSize = 14.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
            }
            return@Column
        }

        val durationMs = state.durationMs.coerceAtLeast(1)
        val positionMs = dragMs ?: state.positionMs.toFloat()
        val posSec = (positionMs / 1000).toLong()
        val loading = state.phase == PlaybackPhase.LOADING
        val deepLink = DEEP_LINK_BASE + current.id
        val atLabel = formatDuration(posSec)

        // ── main card ──
        Column(
            Modifier.padding(top = 12.dp).fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(colors.surface).border(1.dp, colors.outline, RoundedCornerShape(24.dp)).padding(horizontal = 22.dp, vertical = 26.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            if (playback.playerStyle != "minimal") {
                val ring = if (playback.playerStyle == "compact") 110.dp else 168.dp
                val inner = if (playback.playerStyle == "compact") 94.dp else 144.dp
                val img = if (playback.playerStyle == "compact") 64.dp else 96.dp
                Box(Modifier.padding(bottom = 20.dp).size(ring).clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFFE08930), AccentBrownDark))), contentAlignment = Alignment.Center) {
                    Box(Modifier.size(inner).clip(CircleShape).background(Color(0xFFFFFDF9)), contentAlignment = Alignment.Center) {
                        Image(painterResource(R.drawable.pf_logo), "Palouse Fellowship", Modifier.size(img), contentScale = ContentScale.Fit)
                    }
                }
            }
            Text(
                if (loading) "LOADING…" else if (state.isPlaying) "NOW PLAYING" else "PAUSED", fontSize = 11.sp, letterSpacing = 1.4.sp, color = colors.onSurfaceVariant,
            )
            Text(current.title, fontFamily = FontFamily.Serif, fontSize = 22.sp, lineHeight = 28.sp, color = colors.onBackground, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
            Text(if (state.isOutro) "App outro" else current.speaker, fontSize = 14.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp, bottom = 14.dp))

            if (state.phase == PlaybackPhase.ERROR) {
                Row(Modifier.fillMaxWidth().padding(bottom = 12.dp).clip(RoundedCornerShape(12.dp)).background(colors.errorContainer).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                    Text("⚠ ${state.errorMessage ?: "This audio couldn't be loaded."}", fontSize = 13.sp, color = colors.error, modifier = Modifier.weight(1f))
                    Text("Tap to retry", fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = colors.error, modifier = Modifier.clickable { player.retry() }.padding(start = 8.dp))
                }
            }

            // notes near this moment
            if (settings.showNotesWhilePlaying) {
                val peek = (note.entries.map { it.t to it.text } + note.bookmarks.map { it.t to it.label.ifBlank { "Bookmark" } }).filter { posSec >= it.first && posSec < it.first + 12 }.take(2)
                peek.forEach { (t, text) ->
                    Row(Modifier.fillMaxWidth().padding(bottom = 8.dp).clip(RoundedCornerShape(10.dp)).background(x.selectedBg).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text(formatDuration(t.toLong()), fontSize = 11.sp, color = x.buttonText); Text(text, fontSize = 13.sp, color = colors.onBackground)
                    }
                }
            }

            // seek bar
            Slider(
                value = positionMs.coerceIn(0f, durationMs.toFloat()), valueRange = 0f..durationMs.toFloat(),
                onValueChange = { dragMs = it }, onValueChangeFinished = { dragMs?.let { player.seekTo(it.toLong()) }; dragMs = null },
                colors = SliderDefaults.colors(thumbColor = x.gold, activeTrackColor = x.gold, inactiveTrackColor = colors.outline),
                thumb = { Box(Modifier.size(18.dp).clip(CircleShape).background(Color.White).border(3.dp, x.gold, CircleShape)) },
                modifier = Modifier.fillMaxWidth(),
            )
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                Text(atLabel, fontSize = 12.sp, color = colors.onSurfaceVariant)
                Text(
                    if (settings.showRemaining) "-${formatDuration(((durationMs - positionMs) / 1000).toLong().coerceAtLeast(0))}" else formatDuration(durationMs / 1000),
                    fontSize = 12.sp, color = colors.onSurfaceVariant,
                    modifier = Modifier.clickable { container.playerSettings.update { it.copy(showRemaining = !it.showRemaining) } },
                )
            }

            // main controls
            Row(Modifier.fillMaxWidth().padding(top = 14.dp), horizontalArrangement = Arrangement.SpaceEvenly, verticalAlignment = Alignment.CenterVertically) {
                Text("⏮", fontSize = 24.sp, color = x.buttonText, modifier = Modifier.clickable { player.previous() }.padding(8.dp))
                SkipButton("⟲", state.skipBackSeconds) { player.skipBack() }
                Box(
                    Modifier.size(68.dp).clip(CircleShape).background(Brush.linearGradient(listOf(AccentOrange, AccentBrownDark))).clickable { player.togglePlayPause() },
                    contentAlignment = Alignment.Center,
                ) {
                    if (loading && !state.isPlaying) CircularProgressIndicator(Modifier.size(26.dp), color = Color(0xFFFFF8EE), strokeWidth = 2.5.dp)
                    else Text(if (state.isPlaying) "❚❚" else "▶", fontSize = 24.sp, color = Color(0xFFFFF8EE))
                }
                SkipButton("⟳", state.skipForwardSeconds) { player.skipForward() }
                Text("⏭", fontSize = 24.sp, color = x.buttonText, modifier = Modifier.alpha(if (state.hasNext) 1f else 0.35f).clickable(enabled = state.hasNext) { player.next() }.padding(8.dp))
            }

            // speed + share
            Column(Modifier.fillMaxWidth().padding(top = 18.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text("Speed", fontSize = 12.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(end = 4.dp, top = 8.dp))
                    SPEEDS.forEach { s -> PillChip("${trim(s)}x", state.speed == s) { player.setSpeed(s) } }
                }
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    ExtraButton(if (linkCopied) "✓ Copied" else "🔗 Copy Link") { clipboard.setText(AnnotatedString(deepLink)); linkCopied = true }
                    ExtraButton("↑ Share") {
                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, current.title); putExtra(Intent.EXTRA_TEXT, "${current.title} — ${current.speaker}\n$deepLink") }, null))
                    }
                }
            }

            // timestamp tools
            FlowRow(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ExtraButton("🔖 Bookmark $atLabel") {
                    if (!session.signedIn) flash = "Sign in to save bookmarks."
                    else scope.launch { container.notesRepository.addBookmark(current.id, posSec.toDouble(), "", current); noteTick++; flash = "Bookmarked $atLabel" }
                }
                ExtraButton(if (timeCopied) "✓ Copied" else "⧉ Copy $atLabel") { clipboard.setText(AnnotatedString(atLabel)); timeCopied = true }
                ExtraButton("↑ Share at $atLabel") {
                    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, "${current.title} ($atLabel)"); putExtra(Intent.EXTRA_TEXT, "$deepLink?t=$posSec") }, null))
                }
            }
            if (flash.isNotEmpty()) Text(flash, fontSize = 12.sp, color = x.greenFg, modifier = Modifier.padding(top = 8.dp))

            // extras
            FlowRow(Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!state.isOutro) ExtraButton("📜 Transcript") { onTranscript(current.id) }
                ExtraButton("⟲ Start from Beginning") { player.seekTo(0); if (!state.isPlaying) player.togglePlayPause() }
                ExtraButton("📋 Playing Next${if (state.queue.isNotEmpty()) " (${state.queue.size})" else ""}") { showQueue = true }
                ExtraButton("🌙 " + when (state.sleepMode) { "duration" -> "%d:%02d".format(state.sleepRemainingSeconds / 60, state.sleepRemainingSeconds % 60); "endOfTrack" -> "End of track"; else -> "Sleep Timer" }) { showSleep = true }
                if (session.signedIn && !state.isOutro) ExtraButton("📝 ${if (note.text.isNotBlank() || note.entries.isNotEmpty()) "Notes" else "Take Notes"}") { showNotes = true }
            }
        }

        // ── sections ──
        Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Collapsible("🔖 Bookmarks${if (note.bookmarks.isNotEmpty()) " (${note.bookmarks.size})" else ""}", settings.sectionBookmarks, { container.playerSettings.update { it.copy(sectionBookmarks = !it.sectionBookmarks) } }) {
                if (note.bookmarks.isEmpty()) Text(if (session.signedIn) "No bookmarks yet — tap Bookmark while listening." else "Sign in to save bookmarks.", fontSize = 13.sp, color = colors.onSurfaceVariant)
                note.bookmarks.forEach { b ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text(formatDuration(b.t.toLong()), fontSize = 13.sp, color = x.buttonText, modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(x.selectedBg).clickable { player.seekTo((b.t * 1000).toLong()); if (!state.isPlaying) player.togglePlayPause() }.padding(horizontal = 10.dp, vertical = 5.dp))
                        Text(b.label.ifBlank { "Bookmark" }, fontSize = 14.sp, color = colors.onBackground, modifier = Modifier.weight(1f))
                        Text("✕", color = colors.onSurfaceVariant, modifier = Modifier.clickable { scope.launch { container.notesRepository.removeBookmark(current.id, b.id); noteTick++ } }.padding(6.dp))
                    }
                }
            }
            Collapsible("🕘 Recently Played", settings.sectionRecent, { container.playerSettings.update { it.copy(sectionRecent = !it.sectionRecent) } }) {
                val recent = state.history.filter { it.id != current.id }.take(6)
                if (recent.isEmpty()) Text("Nothing else yet.", fontSize = 13.sp, color = colors.onSurfaceVariant)
                recent.forEach { h ->
                    Column(Modifier.fillMaxWidth().clickable { player.play(h) }.padding(vertical = 6.dp)) {
                        Text(h.title, fontFamily = FontFamily.Serif, fontSize = 14.sp, color = colors.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(h.speaker, fontSize = 12.sp, color = colors.onSurfaceVariant)
                    }
                }
            }
            Collapsible("✨ Related", settings.sectionRelated, { container.playerSettings.update { it.copy(sectionRelated = !it.sectionRelated) } }) {
                RelatedSection(current, onPlay = { player.play(it) })
            }
        }
    }

    if (showQueue) QueueSheet(state, player) { showQueue = false }
    if (showSleep) SleepSheet(state, player) { showSleep = false }
    if (showSettings) PlayerSettingsSheet(state, player) { showSettings = false }
    if (showNotes && current != null) {
        NotesSheet(
            audio = current, repository = container.notesRepository, positionSeconds = { (state.positionMs / 1000) },
            showWhilePlaying = settings.showNotesWhilePlaying, onToggleShow = { v -> container.playerSettings.update { it.copy(showNotesWhilePlaying = v) } },
            onSeek = { player.seekTo(it * 1000) }, onDismiss = { showNotes = false }, onChanged = { noteTick++ },
        )
    }
}

@Composable
private fun SkipButton(glyph: String, seconds: Int, onClick: () -> Unit) {
    val x = PfaTheme.extras
    Box(Modifier.size(52.dp).clip(CircleShape).clickable(onClick = onClick), contentAlignment = Alignment.Center) {
        Text(glyph, fontSize = 34.sp, color = x.buttonText)
        Text("$seconds", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = x.buttonText)
    }
}

@Composable
private fun ExtraButton(text: String, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Text(
        text, fontSize = 12.5.sp, color = PfaTheme.extras.buttonText,
        modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(colors.background).border(1.dp, colors.outline, RoundedCornerShape(999.dp)).clickable(onClick = onClick).padding(horizontal = 12.dp, vertical = 8.dp),
    )
}

@Composable
private fun Collapsible(title: String, open: Boolean, onToggle: () -> Unit, content: @Composable () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(colors.surface).border(1.dp, colors.outline, RoundedCornerShape(16.dp))) {
        Row(Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(horizontal = 16.dp, vertical = 14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(title, fontFamily = FontFamily.Serif, fontSize = 15.sp, color = colors.onBackground)
            Text(if (open) "▴" else "▾", color = colors.onSurfaceVariant)
        }
        if (open) Column(Modifier.padding(start = 16.dp, end = 16.dp, bottom = 14.dp)) { content() }
    }
}

/** "Related": other recordings whose AI summaries are close to this one's, with the shared words. */
@Composable
private fun RelatedSection(current: Audio, onPlay: (Audio) -> Unit) {
    val container = (LocalContext.current.applicationContext as PfaApplication).container
    val colors = MaterialTheme.colorScheme
    var matches by remember(current.id) { mutableStateOf<List<RelatedMatch>?>(null) }
    var message by remember(current.id) { mutableStateOf("Finding related recordings…") }
    LaunchedEffect(current.id) {
        val supported = current.type in setOf("sermon", "homily", "sundayschool") && !current.id.startsWith("doctrine_") && !current.id.startsWith("resource_")
        if (!supported) { message = "Related recordings aren't available for this one."; return@LaunchedEffect }
        val me = current.aiSummary?.takeIf { it.isNotBlank() } ?: container.audioRepository.getAudioById(current.id)?.aiSummary
        if (me.isNullOrBlank()) { message = "No AI summary for this recording yet, so there's nothing to compare. Tap “Summarize with AI” on its card."; return@LaunchedEffect }
        val all = (container.audioRepository.getAudio(listOf("sermon", "homily", "sundayschool")) as? com.palousefellowship.audio.util.UiState.Success)?.data.orEmpty()
        val picked = pickRelated(rankBySimilarity(current.title, me, all.filter { it.id != current.id && !it.aiSummary.isNullOrBlank() }))
        matches = picked
        if (picked.isEmpty()) message = "No results found."
    }
    val list = matches
    if (list.isNullOrEmpty()) { Text(message, fontSize = 13.sp, lineHeight = 20.sp, color = colors.onSurfaceVariant); return }
    list.forEach { m ->
        Column(Modifier.fillMaxWidth().clickable { onPlay(m.item) }.padding(vertical = 6.dp)) {
            Text(m.item.title, fontFamily = FontFamily.Serif, fontSize = 14.sp, color = colors.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${m.item.speaker} · ${when (m.strength) { "strong" -> "Strong match"; "moderate" -> "Moderate match"; else -> "Loose match" }}", fontSize = 12.sp, color = colors.onSurfaceVariant)
            if (m.terms.isNotEmpty()) Text("Shared: ${m.terms.joinToString(", ")}", fontSize = 11.5.sp, fontStyle = FontStyle.Italic, color = PfaTheme.extras.navInactive)
        }
    }
}
