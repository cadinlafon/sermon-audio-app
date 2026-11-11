package com.palousefellowship.audio.ui.components

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.TextUnit
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.config.AudioConfig
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.ui.screens.audiolist.dateOf
import com.palousefellowship.audio.ui.screens.playlists.AddToPlaylistSheet
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.ui.theme.PfaTheme
import com.palousefellowship.audio.util.formatDuration
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val NEW_WINDOW_MS = 7L * 24 * 60 * 60 * 1000
const val DEEP_LINK_BASE = "https://palousefellowshipsermonapp.web.app/listen/"

private data class Density(val pad: Dp, val gap: Dp, val title: TextUnit, val titleMb: Dp, val speakerMb: Dp, val btnH: Dp, val btnFont: TextUnit, val radius: Dp, val progressMb: Dp, val tagMb: Dp)

// Sizes for the three card layouts (Audio Page Manager → Layout & Cards).
private fun density(layout: String) = when (layout) {
    "compact" -> Density(14.dp, 6.dp, 15.sp, 3.dp, 9.dp, 30.dp, 12.sp, 14.dp, 9.dp, 6.dp)
    "spacious" -> Density(26.dp, 10.dp, 19.sp, 7.dp, 18.dp, 40.dp, 14.sp, 20.dp, 18.dp, 12.dp)
    else -> Density(20.dp, 8.dp, 17.sp, 5.dp, 14.dp, 36.dp, 13.sp, 18.dp, 14.dp, 10.dp)
}

private fun formatDate(a: Audio): String {
    val d = dateOf(a) ?: return ""
    val day = a.date?.takeIf { Regex("""^\d{4}-\d{2}-\d{2}""").containsMatchIn(it) }?.substring(8, 10)?.toIntOrNull()
        ?: a.createdAt?.let { java.util.Calendar.getInstance().apply { time = java.util.Date(it.seconds * 1000) }.get(java.util.Calendar.DAY_OF_MONTH) }
    val mon = com.palousefellowship.audio.data.config.MONTHS[d.m - 1].take(3)
    return "$mon ${day ?: ""}, ${d.y}".replace(" ,", ",")
}

/**
 * Port of src/components/AudioCard.jsx — what a card shows (tag, New /
 * length / Downloaded badges, speaker / date / series, progress bar, the
 * like heart, AI summary) and which buttons it has (and in what order) is set
 * by the Audio Page Manager's [config].
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AudioCard(
    audio: Audio,
    config: AudioConfig,
    isCurrent: Boolean,
    isPlaying: Boolean,
    isSaved: Boolean,
    isDownloaded: Boolean,
    progress: ListenProgressRepository.Entry?,
    currentPositionMs: Long,
    currentDurationMs: Long,
    isOnline: Boolean,
    isSignedIn: Boolean,
    isAdmin: Boolean,
    aiEnabled: Boolean,
    aiAudiences: List<String>,
    onPlay: (resumeAtSeconds: Long) -> Unit,
    onTogglePlayPause: () -> Unit,
    onPlayNext: () -> Unit,
    onToggleSave: suspend () -> Result<Boolean>,
    onToggleDownload: suspend () -> Result<Unit>,
    onTranscript: () -> Unit,
    onSummarySaved: (String, String?) -> Unit,
    modifier: Modifier = Modifier,
    fill: Boolean = false,
) {
    val context = LocalContext.current
    val container = (context.applicationContext as PfaApplication).container
    val clipboard = LocalClipboardManager.current
    val scope = rememberCoroutineScope()
    val x = PfaTheme.extras
    val colors = MaterialTheme.colorScheme

    val cardCfg = config.page.card
    val det = cardCfg.details
    val adv = config.advanced
    val dens = density(config.page.layout.cardLayout)

    var queued by remember { mutableStateOf(false) }
    var copied by remember { mutableStateOf(false) }
    var downloading by remember { mutableStateOf(false) }
    var downloadError by remember { mutableStateOf("") }
    var saveError by remember { mutableStateOf("") }
    var showMore by remember(config.page.layout.defaultExpanded) { mutableStateOf(config.page.layout.defaultExpanded) }
    var showPlaylistSheet by remember { mutableStateOf(false) }

    LaunchedEffect(queued) { if (queued) { delay(1800); queued = false } }
    LaunchedEffect(copied) { if (copied) { delay(1500); copied = false } }

    val rememberPosition = config.playback.rememberPosition
    val status = if (!rememberPosition) "not-started" else (progress?.status ?: "not-started")
    val isNew = audio.createdAt?.let { System.currentTimeMillis() - it.seconds * 1000 < NEW_WINDOW_MS } == true
    val durationLabel = audio.duration.takeIf { it > 0 }?.let { formatDuration(it) }
    val dateLabel = formatDate(audio)
    val offlineDisabled = !isOnline && !isDownloaded
    val deepLink = DEEP_LINK_BASE + audio.id
    val category = config.category(audio.type)
    val fallbackLabel = when (audio.type) { "sundayschool" -> "Sunday School"; "homily" -> "Homily"; else -> "Sermon" }
    val label = (category?.icon?.takeIf { it.isNotEmpty() }?.let { "$it " } ?: "") + (category?.name ?: fallbackLabel)
    val canShare = adv.sharingEnabled
    val canDownload = adv.downloadsEnabled && isSignedIn && (if (isAdmin) adv.downloadsAdmin else adv.downloadsUser)
    val showLike = adv.favorites && det["likeButton"] == true
    val shareText = adv.sharingText.replace("{title}", audio.title).replace("{speaker}", audio.speaker).replace("{series}", audio.series ?: "").replace(Regex("\\s+"), " ").trim()

    val progressFraction = when {
        isCurrent && currentDurationMs > 0 -> (currentPositionMs.toFloat() / currentDurationMs).coerceIn(0f, 1f)
        progress != null && progress.durationSeconds > 0 -> (progress.positionSeconds.toFloat() / progress.durationSeconds).coerceIn(0f, 1f)
        else -> 0f
    }
    val showProgressBar = det["progressBar"] == true && config.playback.showProgress &&
        (if (isCurrent) (isPlaying || currentPositionMs > 0) else status == "in-progress")

    val shape = RoundedCornerShape(dens.radius)
    Box(
        modifier.fillMaxWidth().then(if (fill) Modifier.fillMaxHeight() else Modifier)
            .alpha(if (offlineDisabled) 0.55f else 1f)
            .clip(shape).background(colors.surface).border(1.dp, colors.outline, shape),
    ) {
        Column(Modifier.padding(dens.pad)) {
            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(dens.tagMb),
                modifier = Modifier.padding(end = if (showLike) 44.dp else 0.dp),
            ) {
                if (det["categoryTag"] == true) {
                    val (bg, fg) = when (audio.type) {
                        "homily" -> x.homilyTagBg to x.homilyTagFg
                        "sundayschool" -> x.sundayTagBg to x.sundayTagFg
                        else -> x.sermonTagBg to x.sermonTagFg
                    }
                    Badge(label, bg, fg)
                }
                if (det["newBadge"] == true && isNew) Badge("✨ New", x.newBg, x.newFg, bold = true)
                if (det["durationBadge"] == true && durationLabel != null) Badge("⏱ $durationLabel", x.durationBg, x.durationFg)
                if (det["downloadedBadge"] == true && isDownloaded) Badge("⬇ Downloaded", x.greenBg, x.greenFg, bold = true)
            }

            Text(
                audio.title, fontFamily = FontFamily.Serif, fontSize = dens.title, lineHeight = dens.title * 1.3f,
                color = colors.onBackground, modifier = Modifier.padding(top = dens.tagMb.coerceAtLeast(4.dp), bottom = dens.titleMb),
            )
            val meta = listOfNotNull(
                audio.speaker.takeIf { det["speaker"] == true && it.isNotBlank() },
                dateLabel.takeIf { det["date"] == true && it.isNotBlank() },
                audio.series?.takeIf { det["series"] == true && it.isNotBlank() }?.let { "Series: $it" },
            ).joinToString(" · ")
            if (meta.isNotEmpty()) Text(meta, fontSize = 13.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(bottom = dens.speakerMb))

            if (showProgressBar) {
                Box(Modifier.padding(bottom = dens.progressMb).fillMaxWidth().height(5.dp).clip(RoundedCornerShape(999.dp)).background(colors.outline)) {
                    Box(Modifier.fillMaxWidth(progressFraction).height(5.dp).background(Brush.horizontalGradient(listOf(Color(0xFFE08930), x.gold))))
                }
            }

            val primary: Map<String, @Composable () -> Unit> = mapOf(
                "play" to {
                    val (icon, text) = if (isCurrent) (if (isPlaying) "❚❚" else "▶") to (if (isPlaying) "Pause" else "Play")
                    else (if (status == "completed") "↻" else "▶") to (when (status) { "completed" -> "Play Again"; "in-progress" -> "Resume"; else -> "Play" })
                    Row(
                        Modifier.height(dens.btnH).clip(RoundedCornerShape(999.dp)).alpha(if (offlineDisabled) 0.5f else 1f)
                            .background(Brush.linearGradient(listOf(AccentOrange, AccentBrownDark)))
                            .clickable(enabled = !offlineDisabled) {
                                if (isCurrent) onTogglePlayPause()
                                else onPlay(if (rememberPosition && status == "in-progress") progress?.positionSeconds ?: 0 else 0)
                            }.padding(horizontal = 18.dp),
                        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        Text(icon, fontSize = 11.sp, color = Color(0xFFFFF8EE)); Text(text, fontSize = dens.btnFont, color = Color(0xFFFFF8EE))
                    }
                },
                "playNext" to {
                    if (cardCfg.buttons["playNext"] == true) Pill(if (queued) "✓ Added" else "+ Play Next", dens, enabled = !offlineDisabled) { onPlayNext(); queued = true }
                },
                "more" to {
                    if (cardCfg.buttons["more"] == true) Pill("More ${if (showMore) "▴" else "▾"}", dens) { showMore = !showMore }
                },
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(dens.gap), verticalArrangement = Arrangement.spacedBy(dens.gap)) {
                cardCfg.buttonOrder.forEach { id -> primary[id]?.invoke() }
            }

            val moreOpen = if (cardCfg.buttons["more"] == true) showMore else true
            val moreItems: Map<String, (@Composable () -> Unit)?> = mapOf(
                "transcript" to if (cardCfg.buttons["transcript"] == true) ({ Pill("View Transcript", dens) { onTranscript() } }) else null,
                "copyLink" to if (cardCfg.buttons["copyLink"] == true && canShare) ({ Pill(if (copied) "Link copied" else "Copy link", dens) { clipboard.setText(AnnotatedString(deepLink)); copied = true } }) else null,
                "share" to if (cardCfg.buttons["share"] == true && canShare) ({
                    Pill("Share", dens) {
                        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                            type = "text/plain"
                            putExtra(Intent.EXTRA_SUBJECT, audio.title)
                            putExtra(Intent.EXTRA_TEXT, (shareText.ifEmpty { audio.speaker } + "\n" + deepLink).trim())
                        }, null))
                    }
                }) else null,
                "playlist" to if (cardCfg.buttons["playlist"] == true) ({ Pill("Add to playlist", dens) { showPlaylistSheet = true } }) else null,
                "download" to if (cardCfg.buttons["download"] == true && canDownload) ({
                    Pill(if (downloading) "Working…" else if (isDownloaded) "Remove download" else "Download", dens, active = isDownloaded, enabled = !downloading) {
                        scope.launch {
                            downloading = true; downloadError = ""
                            onToggleDownload().onFailure { downloadError = it.message ?: "Couldn't update this download." }
                            downloading = false
                        }
                    }
                }) else null,
            )
            val moreList = cardCfg.moreOrder.mapNotNull { moreItems[it] }
            if (moreOpen && moreList.isNotEmpty()) {
                FlowRow(Modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(dens.gap), verticalArrangement = Arrangement.spacedBy(dens.gap)) {
                    moreList.forEach { it() }
                }
            }

            if (offlineDisabled) Hint("📴 You're offline — download this to listen without a connection.")
            if (!isSignedIn) Hint("🔒 Sign in to save your spot — it'll be right here to resume next time you open the app.")
            if (saveError.isNotBlank()) Text(saveError, fontSize = 13.sp, color = colors.error, modifier = Modifier.padding(top = 10.dp))
            if (downloadError.isNotBlank()) Text(downloadError, fontSize = 13.sp, color = colors.error, modifier = Modifier.padding(top = 10.dp))
            if (det["aiSummary"] == true) {
                AiSummary(audio, container.audioRepository, isSignedIn, isAdmin, aiEnabled, aiAudiences, onSummarySaved)
            }
        }

        if (showLike) {
            Box(
                Modifier.align(Alignment.TopEnd).padding(top = 14.dp, end = 14.dp).size(36.dp).clip(CircleShape)
                    .background(colors.surface).border(1.dp, colors.outline, CircleShape)
                    .clickable {
                        scope.launch {
                            onToggleSave().fold(
                                onSuccess = { saveError = "" },
                                onFailure = { saveError = if (!isSignedIn) "Please sign in to like audio." else "We couldn't update your liked sermons. Please try again." },
                            )
                        }
                    },
                contentAlignment = Alignment.Center,
            ) { Text(if (isSaved) "❤️" else "🤍", fontSize = 17.sp) }
        }
    }

    if (showPlaylistSheet) {
        AddToPlaylistSheet(audio = audio, repository = container.playlistRepository, onDismiss = { showPlaylistSheet = false })
    }
}

@Composable
private fun Hint(text: String) {
    Text(text, fontSize = 12.sp, fontStyle = FontStyle.Italic, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 10.dp))
}

@Composable
private fun Badge(text: String, bg: Color, fg: Color, bold: Boolean = false) {
    Text(
        text, fontSize = 11.sp, color = fg, fontWeight = if (bold) FontWeight.SemiBold else FontWeight.Normal, letterSpacing = 0.4.sp,
        modifier = Modifier.background(bg, RoundedCornerShape(999.dp)).padding(horizontal = 10.dp, vertical = 3.dp),
    )
}

@Composable
private fun Pill(text: String, dens: Density, active: Boolean = false, enabled: Boolean = true, onClick: () -> Unit) {
    val x = PfaTheme.extras
    val colors = MaterialTheme.colorScheme
    val bg = if (active) x.greenBg else colors.background
    val fg = if (active) x.greenFg else x.buttonText
    val border = if (active) x.greenBorder else colors.outline
    Box(
        Modifier.height(dens.btnH).clip(RoundedCornerShape(999.dp)).alpha(if (enabled) 1f else 0.5f).background(bg)
            .border(1.dp, border, RoundedCornerShape(999.dp)).clickable(enabled = enabled, onClick = onClick).padding(horizontal = 14.dp),
        contentAlignment = Alignment.Center,
    ) { Text(text, fontSize = dens.btnFont, color = fg) }
}
