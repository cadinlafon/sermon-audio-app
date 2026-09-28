package com.palousefellowship.audio.ui.components

import android.content.Intent
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.ui.screens.playlists.AddToPlaylistSheet
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.ui.theme.BorderTan
import com.palousefellowship.audio.ui.theme.CardBackground
import com.palousefellowship.audio.ui.theme.DarkBrown
import com.palousefellowship.audio.ui.theme.ErrorRed
import com.palousefellowship.audio.ui.theme.MutedBrown
import com.palousefellowship.audio.util.formatDuration
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

// Web's per-type tag + badge colors (src/components/AudioCard.jsx).
private val SermonTagBg = Color(0xFFF6E4B0)
private val SermonTagText = Color(0xFF7A5A10)
private val HomilyTagBg = Color(0xFFE8F0FE)
private val HomilyTagText = Color(0xFF2A5AB5)
private val SundaySchoolTagBg = Color(0xFFE9F5E8)
private val SundaySchoolTagText = Color(0xFF39763C)
private val NewBadgeBg = Color(0xFFFDE8B8)
private val NewBadgeText = Color(0xFF8A5A10)
private val DurationBadgeBg = Color(0xFFF0E4D0)
private val DurationBadgeText = Color(0xFF7A5530)
private val GreenBadgeBg = Color(0xFFE3F5E6)
private val GreenBadgeText = Color(0xFF2F8A4A)
private val GreenBorder = Color(0xFFBFE6C8)

private const val NEW_WINDOW_MS = 7L * 24 * 60 * 60 * 1000
private const val DEEP_LINK_BASE = "https://palousefellowshipsermonapp.web.app/listen/"

/**
 * A close port of src/components/AudioCard.jsx: like button, type/new/
 * duration/completed/downloaded badges, a resume progress bar, and the
 * same button row (Play, "+ Play Next", change status, copy link, share,
 * add to playlist, download toggle) with the same offline/sign-in hints.
 *
 * Unlike the web version, [isSaved]/[progress]/[isDownloaded] are looked
 * up once per screen (by the caller) rather than per-card — see
 * AudioListViewModel's doc comment.
 */
@OptIn(ExperimentalLayoutApi::class, ExperimentalMaterial3Api::class)
@Composable
fun AudioCard(
    audio: Audio,
    isCurrent: Boolean,
    isPlaying: Boolean,
    isSaved: Boolean,
    isDownloaded: Boolean,
    progress: ListenProgressRepository.Entry?,
    currentPositionMs: Long,
    currentDurationMs: Long,
    isOnline: Boolean,
    isSignedIn: Boolean,
    onPlay: () -> Unit,
    onTogglePlayPause: () -> Unit,
    onPlayNext: () -> Unit,
    onToggleSave: suspend () -> Result<Boolean>,
    onSetStatus: (String) -> Unit,
    onToggleDownload: suspend () -> Result<Unit>,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()

    var queued by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    var downloading by remember { mutableStateOf(false) }
    var downloadError by remember { mutableStateOf("") }
    var saveError by remember { mutableStateOf("") }
    var statusMenuExpanded by remember { mutableStateOf(false) }
    var showPlaylistSheet by remember { mutableStateOf(false) }

    LaunchedEffect(queued) { if (queued) { delay(1800); queued = false } }
    LaunchedEffect(copied) { if (copied) { delay(1500); copied = false } }

    val status = progress?.status ?: "not-started"
    val isNew = audio.createdAt?.let { System.currentTimeMillis() - it.toDate().time < NEW_WINDOW_MS } == true
    val durationLabel = audio.duration.takeIf { it > 0 }?.let { formatDuration(it) }
    val offlineDisabled = !isOnline && !isDownloaded
    val deepLink = DEEP_LINK_BASE + audio.id

    val progressFraction = when {
        isCurrent && currentDurationMs > 0 -> (currentPositionMs.toFloat() / currentDurationMs).coerceIn(0f, 1f)
        progress != null && progress.durationSeconds > 0 -> (progress.positionSeconds.toFloat() / progress.durationSeconds).coerceIn(0f, 1f)
        else -> 0f
    }
    val showProgressBar = if (isCurrent) (isPlaying || currentPositionMs > 0) else status == "in-progress"

    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        border = BorderStroke(1.dp, BorderTan),
        shape = RoundedCornerShape(18.dp),
    ) {
        Box {
            Column(Modifier.padding(top = 20.dp, start = 20.dp, end = 20.dp, bottom = 16.dp)) {
                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                    modifier = Modifier.padding(end = 40.dp),
                ) {
                    TypeTag(audio.type)
                    if (isNew) Badge("✨ New", NewBadgeBg, NewBadgeText)
                    durationLabel?.let { Badge("⏱ $it", DurationBadgeBg, DurationBadgeText) }
                    if (status == "completed") Badge("✓ Completed", GreenBadgeBg, GreenBadgeText)
                    if (isDownloaded) Badge("⬇ Downloaded", GreenBadgeBg, GreenBadgeText)
                }

                Text(
                    audio.title,
                    style = MaterialTheme.typography.titleMedium,
                    color = DarkBrown,
                    modifier = Modifier.padding(top = 10.dp),
                )
                if (audio.speaker.isNotBlank()) {
                    Text(
                        audio.speaker,
                        style = MaterialTheme.typography.bodySmall,
                        color = MutedBrown,
                        modifier = Modifier.padding(top = 2.dp, bottom = 6.dp),
                    )
                }

                if (showProgressBar) {
                    LinearProgressIndicator(
                        progress = { progressFraction },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp).clip(RoundedCornerShape(999.dp)),
                        color = AccentOrange,
                        trackColor = BorderTan,
                    )
                }

                FlowRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.padding(top = 8.dp),
                ) {
                    Button(
                        onClick = { if (isCurrent) onTogglePlayPause() else onPlay() },
                        enabled = !offlineDisabled,
                        shape = RoundedCornerShape(999.dp),
                        colors = ButtonDefaults.buttonColors(containerColor = AccentBrownDark),
                    ) {
                        val label = if (isCurrent) {
                            if (isPlaying) "Pause" else "Play"
                        } else when (status) {
                            "completed" -> "Play Again"
                            "in-progress" -> "Resume"
                            else -> "Play"
                        }
                        Icon(
                            if (isCurrent && isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = null,
                            modifier = Modifier.size(15.dp),
                        )
                        Text(label, modifier = Modifier.padding(start = 4.dp), style = MaterialTheme.typography.labelLarge)
                    }

                    OutlinedButton(onClick = { onPlayNext(); queued = true }, enabled = !offlineDisabled, shape = RoundedCornerShape(999.dp)) {
                        Text(if (queued) "✓ Added" else "+ Play Next", style = MaterialTheme.typography.labelLarge)
                    }

                    Box {
                        OutlinedButton(onClick = { statusMenuExpanded = true }, shape = RoundedCornerShape(999.dp)) {
                            Text("Change ▾", style = MaterialTheme.typography.labelLarge)
                        }
                        DropdownMenu(expanded = statusMenuExpanded, onDismissRequest = { statusMenuExpanded = false }) {
                            DropdownMenuItem(text = { Text("Mark Completed") }, onClick = { onSetStatus("completed"); statusMenuExpanded = false })
                            DropdownMenuItem(text = { Text("Mark Not Started") }, onClick = { onSetStatus("not-started"); statusMenuExpanded = false })
                        }
                    }

                    IconOnlyButton(onClick = { clipboard.setText(AnnotatedString(deepLink)); copied = true }) {
                        Text(if (copied) "✓" else "🔗")
                    }
                    IconOnlyButton(onClick = {
                        val intent = Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_TEXT, "${audio.title} — $deepLink")
                        }
                        context.startActivity(Intent.createChooser(intent, null))
                    }) { Text("↗") }
                    IconOnlyButton(onClick = { showPlaylistSheet = true }) { Text("☰＋") }
                    IconOnlyButton(
                        active = isDownloaded,
                        onClick = {
                            scope.launch {
                                downloading = true
                                downloadError = ""
                                onToggleDownload().onFailure { downloadError = it.message ?: "Couldn't update this download." }
                                downloading = false
                            }
                        },
                    ) { Text(if (downloading) "…" else if (isDownloaded) "✓" else "⬇") }
                }

                if (offlineDisabled) {
                    Text(
                        "📴 You're offline — download this to listen without a connection.",
                        style = MaterialTheme.typography.labelSmall.copy(fontStyle = FontStyle.Italic),
                        color = MutedBrown,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                if (!isSignedIn) {
                    Text(
                        "🔒 Sign in to save your spot — it'll be right here to resume next time you open the app.",
                        style = MaterialTheme.typography.labelSmall.copy(fontStyle = FontStyle.Italic),
                        color = MutedBrown,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                }
                if (downloadError.isNotBlank()) {
                    Text(downloadError, style = MaterialTheme.typography.labelSmall, color = ErrorRed, modifier = Modifier.padding(top = 8.dp))
                }
                if (saveError.isNotBlank()) {
                    Text(saveError, style = MaterialTheme.typography.labelSmall, color = ErrorRed, modifier = Modifier.padding(top = 8.dp))
                }
            }

            IconButton(
                onClick = {
                    scope.launch {
                        onToggleSave().onFailure { saveError = it.message ?: "We couldn't update your liked sermons. Please try again." }
                            .onSuccess { saveError = "" }
                    }
                },
                modifier = Modifier.align(Alignment.TopEnd).padding(6.dp),
            ) {
                Text(if (isSaved) "❤️" else "🤍")
            }
        }
    }

    if (showPlaylistSheet) {
        val container = (context.applicationContext as PfaApplication).container
        AddToPlaylistSheet(audio = audio, repository = container.playlistRepository, onDismiss = { showPlaylistSheet = false })
    }
}

@Composable
private fun TypeTag(type: String) {
    val (bg, text, label) = when (type) {
        Audio.TYPE_HOMILY -> Triple(HomilyTagBg, HomilyTagText, "Homily")
        Audio.TYPE_SUNDAY_SCHOOL -> Triple(SundaySchoolTagBg, SundaySchoolTagText, "Sunday School")
        else -> Triple(SermonTagBg, SermonTagText, "Sermon")
    }
    Badge(label, bg, text)
}

@Composable
private fun Badge(text: String, bg: Color, textColor: Color) {
    Text(
        text,
        style = MaterialTheme.typography.labelSmall,
        color = textColor,
        modifier = Modifier.background(bg, RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

@Composable
private fun IconOnlyButton(onClick: () -> Unit, active: Boolean = false, content: @Composable () -> Unit) {
    Box(
        modifier = Modifier
            .size(34.dp)
            .clip(CircleShape)
            .background(if (active) GreenBadgeBg else CardBackground)
            .border(BorderStroke(1.dp, if (active) GreenBorder else BorderTan), CircleShape),
        contentAlignment = Alignment.Center,
    ) {
        IconButton(onClick = onClick, modifier = Modifier.size(34.dp)) {
            content()
        }
    }
}
