package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.ui.theme.PfaTheme
import kotlinx.coroutines.launch

private val SECTION = mapOf(
    "main topic" to ("Main topic" to "✨"), "key points" to ("Key points" to "💛"),
    "scripture references" to ("Scripture references" to "📖"), "takeaway" to ("Takeaway" to "🌿"),
)

private fun clean(s: String) = s.replace(Regex("\\*{1,3}"), "").replace("`", "").trimEnd()

/** The "✦ Summarize with AI" control + summary panel from AiSummary.jsx. A
 * saved summary is only shown after the listener asks for one this visit. */
@OptIn(androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun AiSummary(
    audio: Audio,
    repository: AudioRepository,
    signedIn: Boolean,
    isAdmin: Boolean,
    aiEnabled: Boolean,
    audiences: List<String>,
    onSummarySaved: (String, String?) -> Unit,
) {
    val role = if (!signedIn) "guest" else if (isAdmin) "admin" else "user"
    if (!aiEnabled || role !in audiences) return

    val scope = rememberCoroutineScope()
    var summary by remember(audio.id) { mutableStateOf("") }
    var expanded by remember(audio.id) { mutableStateOf(false) }
    var loading by remember(audio.id) { mutableStateOf(false) }
    var deleting by remember(audio.id) { mutableStateOf(false) }
    var error by remember(audio.id) { mutableStateOf("") }
    var confirmDelete by remember { mutableStateOf(false) }
    val x = PfaTheme.extras

    fun generate(force: Boolean) {
        if (!signedIn) { error = "Login/Signup to use this feature"; return }
        if (loading) return
        error = ""; loading = true
        scope.launch {
            repository.summarize(audio, force).fold(
                onSuccess = { summary = it; expanded = true; onSummarySaved(audio.id, it) },
                onFailure = { error = it.message ?: "We couldn't generate the summary right now. Please try again." },
            )
            loading = false
        }
    }

    @Composable fun Pill(label: String, onClick: () -> Unit, dashed: Boolean = false) {
        Text(
            label, fontSize = 12.sp, color = x.buttonText,
            modifier = Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, if (dashed) x.gold else MaterialTheme.colorScheme.outline, RoundedCornerShape(999.dp))
                .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 7.dp),
        )
    }

    Column(Modifier.fillMaxWidth().padding(top = 12.dp)) {
        if (summary.isEmpty() || !signedIn) {
            Row { Pill(if (loading) "◌ Summarizing..." else "✦ Summarize with AI", { generate(false) }, dashed = true) }
        } else {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Pill((if (expanded) "✦ Hide AI summary" else "✦ Show AI summary"), { expanded = !expanded })
                Pill(if (deleting) "⌫ Deleting..." else "⌫ Delete summary", { if (!loading && !deleting) confirmDelete = true })
                Pill(if (loading) "↻ Summarizing..." else "↻ Re-summarize", { generate(true) })
            }
        }
        if (error.isNotEmpty()) Text(error, color = MaterialTheme.colorScheme.error, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        if (expanded && summary.isNotEmpty()) {
            Column(
                Modifier.padding(top = 10.dp).fillMaxWidth().clip(RoundedCornerShape(14.dp)).border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp)).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text("✦ AI Summary", fontWeight = FontWeight.SemiBold, fontSize = 13.sp, color = x.buttonText)
                SummaryText(summary)
            }
        }
    }

    if (confirmDelete) {
        AlertDialog(
            onDismissRequest = { confirmDelete = false },
            title = { Text("Delete this AI summary?") },
            text = { Text("This can't be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDelete = false; deleting = true; error = ""
                    scope.launch {
                        repository.deleteSummary(audio.id).fold(
                            onSuccess = { summary = ""; expanded = false; onSummarySaved(audio.id, null) },
                            onFailure = { error = it.message ?: "We couldn't delete the summary. Please try again." },
                        )
                        deleting = false
                    }
                }) { Text("Delete") }
            },
            dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun SummaryText(text: String) {
    val c = MaterialTheme.colorScheme.onBackground
    var paragraph = mutableListOf<String>()
    var bullets = mutableListOf<String>()
    val blocks = mutableListOf<@Composable () -> Unit>()
    fun flushP() { if (paragraph.isNotEmpty()) { val t = clean(paragraph.joinToString(" ")); blocks += { Text(t, fontSize = 14.sp, lineHeight = 22.sp, color = c) }; paragraph = mutableListOf() } }
    fun flushB() { if (bullets.isNotEmpty()) { val items = bullets.map(::clean); blocks += { Column(verticalArrangement = Arrangement.spacedBy(4.dp)) { items.forEach { Text("•  $it", fontSize = 14.sp, lineHeight = 21.sp, color = c) } } }; bullets = mutableListOf() } }
    text.lines().forEach { raw ->
        val line = raw.trim()
        val normalized = clean(line.replace(Regex("^#+\\s*"), "")).removeSuffix(":").trim().lowercase()
        val section = SECTION[normalized]
        when {
            section != null -> { flushP(); flushB(); blocks += { Text("${section.second} ${section.first}", fontWeight = FontWeight.SemiBold, fontSize = 14.sp, color = c, modifier = Modifier.padding(top = 4.dp)) } }
            Regex("^[-*•]\\s+").containsMatchIn(line) -> { flushP(); bullets.add(line.replace(Regex("^[-*•]\\s+"), "")) }
            line.isEmpty() -> { flushP(); flushB() }
            else -> { flushB(); paragraph.add(line) }
        }
    }
    flushP(); flushB()
    blocks.forEach { it() }
}
