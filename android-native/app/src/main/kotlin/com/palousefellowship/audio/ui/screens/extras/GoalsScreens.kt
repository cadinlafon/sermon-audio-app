package com.palousefellowship.audio.ui.screens.extras

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Shader
import android.graphics.Typeface
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.foundation.text.KeyboardOptions
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.repository.GoalData
import com.palousefellowship.audio.ui.screens.player.PillChip
import com.palousefellowship.audio.ui.theme.PfaTheme
import com.palousefellowship.audio.util.Goal
import com.palousefellowship.audio.util.METRICS
import com.palousefellowship.audio.util.PERIODS
import com.palousefellowship.audio.util.SERIES_TYPES
import com.palousefellowship.audio.util.computeStreaks
import com.palousefellowship.audio.util.fmtMinutes
import com.palousefellowship.audio.util.goalProgress
import kotlinx.coroutines.launch
import java.io.File

private val MONTHS = listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")
private val TYPE_NAME = mapOf("sermon" to "Sermons", "homily" to "Homilies", "sundayschool" to "Sunday School")

@Composable
private fun SignInPrompt(title: String, text: String, onSignIn: () -> Unit) {
    val c = MaterialTheme.colorScheme
    Column(Modifier.fillMaxSize().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(title, fontFamily = FontFamily.Serif, fontSize = 28.sp, color = c.onBackground)
        Text("🔒", fontSize = 36.sp, modifier = Modifier.padding(top = 16.dp))
        Text(text, fontSize = 14.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(vertical = 10.dp))
        Button(onClick = onSignIn) { Text("Sign in") }
    }
}

@Composable
private fun Stat(label: String, value: String, icon: String, modifier: Modifier) {
    val c = MaterialTheme.colorScheme
    Column(modifier.clip(RoundedCornerShape(14.dp)).background(c.surface).border(1.dp, c.outline, RoundedCornerShape(14.dp)).padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(icon, fontSize = 20.sp); Text(value, fontFamily = FontFamily.Serif, fontSize = 17.sp, color = c.onBackground, textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 2.dp)); Text(label, fontSize = 11.sp, color = c.onSurfaceVariant, textAlign = TextAlign.Center)
    }
}

// ───────────────────────── Goals ─────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun GoalsScreen(onSignIn: () -> Unit, onYearInReview: () -> Unit) {
    val container = (LocalContext.current.applicationContext as PfaApplication).container
    val session by container.sessionRepository.session.collectAsStateWithLifecycle()
    val scope = rememberCoroutineScope()
    val c = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    var data by remember { mutableStateOf<GoalData?>(null) }
    var loading by remember { mutableStateOf(true) }
    var goals by remember { mutableStateOf<List<Goal>>(emptyList()) }
    var metric by remember { mutableStateOf("minutes") }
    var period by remember { mutableStateOf("week") }
    var seriesType by remember { mutableStateOf("sermon") }
    var target by remember { mutableStateOf("120") }
    var message by remember { mutableStateOf("") }

    LaunchedEffect(session.uid) {
        if (session.uid == null) { loading = false; return@LaunchedEffect }
        data = container.goalDataRepository.load(); goals = data?.goals.orEmpty(); loading = false
    }
    if (!session.signedIn && session.loaded) { SignInPrompt("Goals", "Sign in to set listening goals.", onSignIn); return }

    val d = data
    val streaks = d?.let { computeStreaks(it.daily) }
    fun save(next: List<Goal>) { goals = next; scope.launch { runCatching { container.goalDataRepository.saveGoals(next) }.onFailure { message = "Couldn't save the goal." } } }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Goals", fontFamily = FontFamily.Serif, fontSize = 28.sp, color = c.onBackground)
                Text("Set a target and watch it fill up as you listen.", fontSize = 14.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp, bottom = 16.dp))
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Stat("Current streak", "${streaks?.current ?: 0} day${if (streaks?.current == 1) "" else "s"}", "🔥", Modifier.weight(1f))
                Stat("Longest streak", "${streaks?.longest ?: 0} day${if (streaks?.longest == 1) "" else "s"}", "🏆", Modifier.weight(1f))
                Stat("Longest session", d?.longestSessionSeconds?.takeIf { it > 0 }?.let { fmtMinutes(it / 60) } ?: "—", "⏱", Modifier.weight(1f))
            }
        }
        if (loading) item { Text("Loading…", color = c.onSurfaceVariant) }
        else if (goals.isEmpty()) item {
            Column(Modifier.fillMaxWidth().padding(vertical = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("🎯", fontSize = 34.sp); Text("No goals yet", fontFamily = FontFamily.Serif, fontSize = 18.sp, color = c.onBackground, modifier = Modifier.padding(top = 6.dp))
                Text("Try “Listen 2 hours this week” below.", fontSize = 13.sp, color = c.onSurfaceVariant)
            }
        }
        goals.forEach { g ->
            item(key = g.id) {
                val p = goalProgress(g, d?.daily.orEmpty(), d?.completed.orEmpty(), d?.audioTypes.orEmpty(), d?.totals.orEmpty())
                val isMin = p.unit == "min"
                val describe = if (g.metric == "series") "Complete ${SERIES_TYPES.firstOrNull { it.first == g.seriesType }?.second ?: "a series"}" else "${METRICS.first { it.first == g.metric }.second} · ${PERIODS.first { it.first == g.period }.second}"
                Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.surface).border(1.dp, if (p.done) Color(0xFF86C99A) else c.outline, RoundedCornerShape(16.dp)).padding(16.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Column(Modifier.weight(1f)) {
                            Text(describe, fontFamily = FontFamily.Serif, fontSize = 16.sp, color = c.onBackground)
                            Text(if (p.done) "🎉 Goal reached!" else "${Math.max(0, Math.round(p.target - p.value))}${if (isMin) " min" else ""} to go", fontSize = 12.sp, color = c.onSurfaceVariant)
                        }
                        Text("✕", color = c.onSurfaceVariant, modifier = Modifier.clickable { save(goals.filter { it.id != g.id }) }.padding(4.dp))
                    }
                    Box(Modifier.padding(top = 10.dp).fillMaxWidth().height(8.dp).clip(RoundedCornerShape(999.dp)).background(c.outline)) {
                        Box(Modifier.fillMaxWidth((p.pct / 100).toFloat()).height(8.dp).background(if (p.done) x.greenFg else x.gold))
                    }
                    Text(if (isMin) "${fmtMinutes(p.value)} / ${fmtMinutes(p.target)}" else "${Math.round(p.value)} / ${Math.round(p.target)} recordings", fontSize = 12.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
        item {
            Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.surface).border(1.dp, c.outline, RoundedCornerShape(16.dp)).padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text("Add a goal", fontFamily = FontFamily.Serif, fontSize = 17.sp, color = c.onBackground)
                Text("I WANT TO", fontSize = 11.sp, color = c.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    METRICS.forEach { (v, l) -> PillChip(l, metric == v) { metric = v; target = if (v == "minutes" || v == "doctrine") "120" else if (v == "series") (d?.totals?.get(seriesType) ?: 3).toString() else "3" } }
                }
                if (metric != "series") {
                    Text("PERIOD", fontSize = 11.sp, color = c.onSurfaceVariant)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { PERIODS.forEach { (v, l) -> PillChip(l, period == v) { period = v } } }
                } else {
                    Text("SERIES", fontSize = 11.sp, color = c.onSurfaceVariant)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) { SERIES_TYPES.forEach { (v, l) -> PillChip(l, seriesType == v) { seriesType = v; target = (d?.totals?.get(v) ?: 3).toString() } } }
                }
                OutlinedTextField(target, { target = it.filter { ch -> ch.isDigit() } }, label = { Text(if (metric == "minutes" || metric == "doctrine") "Target (minutes)" else "Target (recordings)") }, singleLine = true, keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), modifier = Modifier.fillMaxWidth())
                Button(onClick = {
                    val t = target.toDoubleOrNull() ?: 0.0
                    if (t <= 0 && metric != "series") { message = "Enter a target above zero."; return@Button }
                    save(goals + Goal(Integer.toString((Math.random() * 1e9).toInt(), 36), period, metric, t, if (metric == "series") seriesType else null)); message = "Goal added"
                }) { Text("＋ Add goal") }
                if (message.isNotEmpty()) Text(message, fontSize = 12.sp, color = c.onSurfaceVariant)
            }
        }
        item {
            Text("🎁 See your Year in Review →", color = x.buttonText, fontSize = 14.sp, modifier = Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, c.outline, RoundedCornerShape(999.dp)).clickable(onClick = onYearInReview).padding(horizontal = 18.dp, vertical = 10.dp))
            Text("Daily listening is tracked from the day this feature was added, so earlier listening isn't counted toward time-based goals.", fontSize = 12.sp, lineHeight = 18.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(top = 14.dp))
        }
    }
}

// ───────────────────────── Year in Review ─────────────────────────

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun YearInReviewScreen(onSignIn: () -> Unit) {
    val context = LocalContext.current
    val container = (context.applicationContext as PfaApplication).container
    val session by container.sessionRepository.session.collectAsStateWithLifecycle()
    val c = MaterialTheme.colorScheme
    val thisYear = java.util.Calendar.getInstance().get(java.util.Calendar.YEAR)
    var year by remember { mutableStateOf(thisYear) }
    var data by remember { mutableStateOf<GoalData?>(null) }
    LaunchedEffect(session.uid) { if (session.uid != null) data = container.goalDataRepository.load() }
    if (!session.signedIn && session.loaded) { SignInPrompt("Year in Review", "Sign in to see your year.", onSignIn); return }
    val d = data

    val rows: List<Triple<String, String, String>> = remember(d, year) {
        if (d == null) return@remember emptyList()
        val yearDays = d.daily.filter { it.key.startsWith(year.toString()) }
        val dailySeconds = yearDays.values.sumOf { it["seconds"] ?: 0.0 }
        val seconds = if (yearDays.isNotEmpty()) dailySeconds else if (year == thisYear) d.totalSeconds else 0.0
        val byMonth = DoubleArray(12)
        yearDays.forEach { (k, v) -> byMonth[k.substring(5, 7).toInt() - 1] += v["seconds"] ?: 0.0 }
        val topMonth = if (byMonth.any { it > 0 }) byMonth.indices.maxBy { byMonth[it] } else -1
        val bySpeaker = HashMap<String, Double>(); val byType = HashMap<String, Double>()
        d.sermons.forEach { s -> bySpeaker[s.speaker] = (bySpeaker[s.speaker] ?: 0.0) + s.seconds; s.type?.let { byType[it] = (byType[it] ?: 0.0) + s.seconds } }
        val completedYear = d.completed.count { it.atMillis > 0 && java.util.Calendar.getInstance().apply { timeInMillis = it.atMillis }.get(java.util.Calendar.YEAR) == year }
        val doneSeries = d.totals.keys.count { t -> (d.totals[t] ?: 0) > 0 && d.completed.count { d.audioTypes[it.audioId] == t } >= (d.totals[t] ?: 0) }
        val mostPlayed = d.sermons.sortedWith(compareByDescending<com.palousefellowship.audio.data.repository.SermonStatEntry> { it.count }.thenByDescending { it.seconds }).firstOrNull()
        val doctrineTop = d.sermons.filter { it.doctrine }.maxByOrNull { it.seconds }
        listOf(
            Triple("⏱", "Hours listened", if (seconds > 0) "%.1f h".format(seconds / 3600) else "—"),
            Triple("✅", "Recordings completed", completedYear.toString()),
            Triple("🎙️", "Favorite speaker", bySpeaker.maxByOrNull { it.value }?.key ?: "—"),
            Triple("⭐", "Most-played recording", mostPlayed?.takeIf { it.count > 0 }?.title ?: "—"),
            Triple("📅", "Most active month", if (topMonth >= 0) MONTHS[topMonth] else "—"),
            Triple("🗂️", "Favorite category", byType.maxByOrNull { it.value }?.key?.let { TYPE_NAME[it] ?: it } ?: "—"),
            Triple("🚀", "Series started", byType.size.toString()),
            Triple("🏁", "Series completed", doneSeries.toString()),
            Triple("📖", "Top Doctrine recording", doctrineTop?.title ?: "—"),
            Triple("🌟", "Longest listening session", if (d.longestSessionSeconds > 0) fmtMinutes(d.longestSessionSeconds / 60) else "—"),
        )
    }

    fun shareCard() {
        val W = 1080; val H = 1350
        val bmp = Bitmap.createBitmap(W, H, Bitmap.Config.ARGB_8888)
        val cv = Canvas(bmp)
        val p = Paint(Paint.ANTI_ALIAS_FLAG)
        p.shader = LinearGradient(0f, 0f, W.toFloat(), H.toFloat(), 0xFF3D2200.toInt(), 0xFFA85E18.toInt(), Shader.TileMode.CLAMP); cv.drawRect(0f, 0f, W.toFloat(), H.toFloat(), p); p.shader = null
        p.color = 0x0FFFFFFF; cv.drawCircle(W - 120f, 160f, 320f, p)
        p.color = 0xFFFDE8B8.toInt(); p.textSize = 34f; p.typeface = Typeface.DEFAULT_BOLD; cv.drawText("PF AUDIO", 80f, 110f, p)
        p.color = 0xFFFFF8EE.toInt(); p.textSize = 84f; p.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD); cv.drawText("Your $year", 80f, 220f, p); cv.drawText("in listening", 80f, 315f, p)
        var y = 430f
        rows.take(8).forEach { (icon, label, value) ->
            p.color = 0xFFFDE8B8.toInt(); p.textSize = 28f; p.typeface = Typeface.DEFAULT; cv.drawText("$icon  $label", 80f, y, p)
            p.color = 0xFFFFF8EE.toInt(); p.textSize = 40f; p.typeface = Typeface.create(Typeface.SERIF, Typeface.BOLD)
            cv.drawText(if (value.length > 28) value.take(27) + "…" else value, 80f, y + 48f, p); y += 110f
        }
        val dir = File(context.cacheDir, "share").apply { mkdirs() }
        val file = File(dir, "my-$year-in-review.png")
        file.outputStream().use { bmp.compress(Bitmap.CompressFormat.PNG, 100, it) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply { type = "image/png"; putExtra(Intent.EXTRA_STREAM, uri); addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION) }, "Share your year"))
    }

    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("Year in Review", fontFamily = FontFamily.Serif, fontSize = 28.sp, color = c.onBackground)
                Text("Your year of listening, with a shareable card.", fontSize = 14.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp, bottom = 12.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { (thisYear downTo thisYear - 2).forEach { y -> PillChip(y.toString(), year == y) { year = y } } }
            }
        }
        if (d == null) item { Text("Loading…", color = c.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp)) }
        rows.forEach { (icon, label, value) ->
            item {
                Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.surface).border(1.dp, c.outline, RoundedCornerShape(14.dp)).padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(icon, fontSize = 22.sp)
                    Column(Modifier.weight(1f)) { Text(label, fontSize = 12.sp, color = c.onSurfaceVariant); Text(value, fontFamily = FontFamily.Serif, fontSize = 17.sp, color = c.onBackground) }
                }
            }
        }
        if (d != null) item { Button(onClick = { shareCard() }, modifier = Modifier.padding(top = 8.dp)) { Text("↑ Share my year") } }
    }
}
