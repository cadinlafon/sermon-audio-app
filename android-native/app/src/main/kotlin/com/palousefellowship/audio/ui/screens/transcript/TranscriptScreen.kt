package com.palousefellowship.audio.ui.screens.transcript

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.TranscriptData
import com.palousefellowship.audio.data.repository.TranscriptSegment
import com.palousefellowship.audio.ui.theme.PfaTheme
import com.palousefellowship.audio.util.formatDuration
import kotlinx.coroutines.launch

private data class Para(val index: Int, val start: Double, val end: Double, val segs: List<Pair<Int, TranscriptSegment>>)

/** Group short segments into readable paragraphs: break at long pauses, or at a sentence end once long. */
private fun toParagraphs(segments: List<TranscriptSegment>): List<Para> {
    val out = mutableListOf<Para>()
    var cur: Para? = null
    var chars = 0
    segments.forEachIndexed { i, seg ->
        val c = cur
        val gap = if (c != null) seg.start - c.end else 0.0
        val endsSentence = c != null && Regex("""[.!?]["')\]]*$""").containsMatchIn(c.segs.last().second.text.trim())
        val tooLong = c != null && (c.end - c.start > 50 || chars > 420)
        if (c == null || gap > 2.5 || (endsSentence && tooLong)) {
            val n = Para(i, seg.start, seg.end, listOf(i to seg)); out.add(n); cur = n; chars = seg.text.length
        } else {
            val n = c.copy(end = seg.end, segs = c.segs + (i to seg)); out[out.lastIndex] = n; cur = n; chars += seg.text.length
        }
    }
    return out
}

/** Port of src/pages/Transcript.jsx (viewing, searching, following playback, generating, sharing as text;
 * admin corrections stay on the web). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun TranscriptScreen(audioId: String, onBack: () -> Unit) {
    val context = LocalContext.current
    val container = (context.applicationContext as PfaApplication).container
    val player = container.playerRepository
    val state by player.state.collectAsStateWithLifecycle()
    val session by container.sessionRepository.session.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val colors = MaterialTheme.colorScheme
    val x = PfaTheme.extras

    var audio by remember { mutableStateOf<Audio?>(null) }
    var loaded by remember { mutableStateOf(false) }
    var data by remember { mutableStateOf<TranscriptData?>(null) }
    var generating by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var query by remember { mutableStateOf("") }
    var hit by remember { mutableStateOf(0) }
    var autoScroll by remember { mutableStateOf(true) }
    val listState = rememberLazyListState()

    LaunchedEffect(audioId) {
        audio = container.audioRepository.getAudioById(audioId)
        data = container.audioRepository.fetchTranscript(audioId)
        loaded = true
    }

    val paragraphs = remember(data) { data?.let { toParagraphs(it.segments) }.orEmpty() }
    fun textOf(p: Para) = data?.edits?.get(p.index.toString()) ?: p.segs.joinToString(" ") { it.second.text }
    fun labelOf(p: Para) = data?.speakerLabels?.get(p.index.toString()) ?: audio?.speaker.orEmpty()

    val isCurrent = state.current?.id == audioId
    val nowSec = state.positionMs / 1000.0
    val activePara = if (isCurrent && data != null) paragraphs.indexOfFirst { p -> nowSec >= p.start && nowSec < p.end + 1.5 } else -1
    LaunchedEffect(activePara, autoScroll, state.isPlaying) { if (autoScroll && state.isPlaying && activePara >= 0) listState.animateScrollToItem(activePara + 2) }

    val term = query.trim().lowercase()
    val matches = remember(term, paragraphs) { if (term.isEmpty()) emptyList() else paragraphs.indices.filter { textOf(paragraphs[it]).lowercase().contains(term) } }
    LaunchedEffect(term) { hit = 0 }
    LaunchedEffect(hit, matches) { if (matches.isNotEmpty()) listState.animateScrollToItem(matches[hit % matches.size] + 2) }

    fun jump(t: Double) {
        if (isCurrent) { player.seekTo((t * 1000).toLong()); if (!state.isPlaying) player.togglePlayPause() }
        else audio?.let { player.play(it, listOf(it), t.toLong()) }
    }

    fun generate() {
        val a = audio ?: return
        generating = true; error = ""
        scope.launch {
            container.audioRepository.generateTranscript(a).fold(
                onSuccess = { data = container.audioRepository.fetchTranscript(audioId) },
                onFailure = { error = it.message ?: "Couldn't generate the transcript." },
            )
            generating = false
        }
    }

    val missing = loaded && (data == null || data!!.segments.isEmpty())
    LazyColumn(Modifier.fillMaxSize().background(colors.background), state = listState, contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Text("← Back", fontSize = 14.sp, color = colors.primary, modifier = Modifier.clickable(onClick = onBack).padding(vertical = 6.dp))
            Text(audio?.title ?: "Transcript", fontFamily = FontFamily.Serif, fontSize = 26.sp, lineHeight = 32.sp, color = colors.onBackground)
            Text((audio?.speaker?.takeIf { it.isNotBlank() }?.let { "$it · " } ?: "") + "Transcript", fontSize = 14.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
        }
        if (!loaded) item { Text("Loading…", color = colors.onSurfaceVariant) }
        else if (missing) item {
            Column(Modifier.fillMaxWidth().padding(vertical = 30.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("📜", fontSize = 36.sp)
                Text(if (generating) "Creating Transcript…" else "No transcript yet", fontFamily = FontFamily.Serif, fontSize = 18.sp, color = colors.onBackground, modifier = Modifier.padding(top = 8.dp, bottom = 6.dp))
                Text(
                    if (generating) "This takes a minute or two for a long recording — keep this screen open, it only happens once."
                    else "Transcripts are created automatically with AI. It takes a minute or two for a long recording, and only needs to happen once.",
                    fontSize = 14.sp, lineHeight = 21.sp, textAlign = TextAlign.Center, color = colors.onSurfaceVariant, modifier = Modifier.padding(bottom = 14.dp),
                )
                Button(onClick = { generate() }, enabled = !generating && audio != null && session.signedIn) { Text(if (generating) "Creating Transcript…" else "✨ Generate transcript") }
                Text(if (session.signedIn) "Summaries and transcripts share one transcription, so an AI summary will appear too." else "Requires a signed-in account.", fontSize = 12.sp, color = colors.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 12.dp))
                if (error.isNotEmpty()) Text(error, fontSize = 13.sp, color = colors.error, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 10.dp))
            }
        } else {
            item {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(query, { query = it }, placeholder = { Text("Search this transcript…") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    if (term.isNotEmpty()) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Text(if (matches.isNotEmpty()) "${(hit % matches.size) + 1}/${matches.size}" else "0 matches", fontSize = 12.sp, color = colors.onSurfaceVariant)
                        Text("↑", fontSize = 18.sp, color = x.buttonText, modifier = Modifier.clickable(enabled = matches.isNotEmpty()) { hit = (hit - 1 + matches.size) % matches.size }.padding(6.dp))
                        Text("↓", fontSize = 18.sp, color = x.buttonText, modifier = Modifier.clickable(enabled = matches.isNotEmpty()) { hit += 1 }.padding(6.dp))
                    }
                    Row(verticalAlignment = Alignment.CenterVertically) { Checkbox(autoScroll, { autoScroll = it }); Text("Auto-scroll", fontSize = 13.sp, color = colors.onBackground) }
                    val topics = data!!.topics
                    if (topics.isNotEmpty()) FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        topics.forEach { t -> Text(t, fontSize = 12.sp, color = x.buttonText, modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(x.chipBg).clickable { query = t }.padding(horizontal = 10.dp, vertical = 5.dp)) }
                    }
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        fun full() = buildString {
                            append(audio?.title ?: "Transcript"); audio?.speaker?.takeIf { it.isNotBlank() }?.let { append(" — $it") }; append("\n\n")
                            append(paragraphs.joinToString("\n\n") { "[${formatDuration(it.start.toLong())}] ${labelOf(it).takeIf { l -> l.isNotBlank() }?.let { l -> "$l: " } ?: ""}${textOf(it)}" })
                        }
                        Text("⬇ Share text", fontSize = 13.sp, color = x.buttonText, modifier = Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, colors.outline, RoundedCornerShape(999.dp)).clickable {
                            context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "text/plain"; putExtra(Intent.EXTRA_SUBJECT, audio?.title ?: "Transcript"); putExtra(Intent.EXTRA_TEXT, full()) }, null))
                        }.padding(horizontal = 14.dp, vertical = 8.dp))
                    }
                }
            }
            itemsIndexed(paragraphs) { i, p ->
                val active = i == activePara
                val isHit = matches.isNotEmpty() && matches[hit % matches.size] == i
                Column(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(12.dp)).background(if (active) x.selectedBg else if (isHit) x.noticeBg else colors.surface)
                        .border(1.dp, if (active) x.selectedBorder else colors.outline, RoundedCornerShape(12.dp)).clickable { jump(p.start) }.padding(14.dp),
                ) {
                    Text("${formatDuration(p.start.toLong())}${labelOf(p).takeIf { it.isNotBlank() }?.let { " · $it" } ?: ""}", fontSize = 11.5.sp, color = x.buttonText)
                    Text(textOf(p), fontSize = 15.sp, lineHeight = 24.sp, color = colors.onBackground, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}
