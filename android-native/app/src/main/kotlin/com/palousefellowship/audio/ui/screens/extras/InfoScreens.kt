package com.palousefellowship.audio.ui.screens.extras

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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.google.firebase.firestore.FirebaseFirestore
import com.palousefellowship.audio.BuildConfig
import com.palousefellowship.audio.ui.theme.PfaTheme
import kotlinx.coroutines.tasks.await
import org.json.JSONArray
import org.json.JSONObject

private val MON = listOf("JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC")

@Composable
private fun PageTitle(title: String, subtitle: String) {
    val c = MaterialTheme.colorScheme
    Column(Modifier.fillMaxWidth().padding(bottom = 24.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(title, fontFamily = FontFamily.Serif, fontSize = 28.sp, color = c.onBackground, textAlign = TextAlign.Center)
        Text(subtitle, fontSize = 14.sp, color = c.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 6.dp))
    }
}

@Composable
private fun CardBox(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val c = MaterialTheme.colorScheme
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(c.surface).border(1.dp, c.outline, RoundedCornerShape(18.dp)).padding(horizontal = 22.dp, vertical = 20.dp)) { content() }
}

// ───────────────────────── What's New ─────────────────────────

private data class UpdateEntry(val id: String, val date: String, val title: String, val details: String, val minor: List<String>)

@Composable
fun WhatsNewScreen() {
    val context = LocalContext.current
    val entries = remember {
        runCatching {
            val arr = JSONArray(context.assets.open("whats_new.json").bufferedReader().readText())
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                UpdateEntry(o.getString("id"), o.getString("date"), o.getString("title"), o.optString("details"), o.optJSONArray("minor")?.let { m -> (0 until m.length()).map { m.getString(it) } } ?: emptyList())
            }
        }.getOrDefault(emptyList())
    }
    val c = MaterialTheme.colorScheme
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { PageTitle("What's New", "Updates and improvements to the app, newest first.") }
        items(entries, key = { it.id }) { e ->
            var expanded by remember { mutableStateOf(false) }
            val (y, m, d) = e.date.split("-").map { it.toInt() }
            CardBox {
                Row(horizontalArrangement = Arrangement.spacedBy(18.dp)) {
                    Column(Modifier.width(52.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(MON[m - 1], fontSize = 11.sp, fontWeight = FontWeight.Bold, letterSpacing = 0.7.sp, color = PfaTheme.extras.gold)
                        Text("$d", fontFamily = FontFamily.Serif, fontSize = 24.sp, color = c.onBackground)
                    }
                    Column(Modifier.weight(1f)) {
                        Text(e.title, fontFamily = FontFamily.Serif, fontSize = 17.sp, color = c.onBackground)
                        Text(e.details, fontSize = 14.sp, lineHeight = 22.sp, color = PfaTheme.extras.bodyMuted, modifier = Modifier.padding(top = 6.dp))
                        if (e.minor.isNotEmpty()) {
                            Text(
                                (if (expanded) "▴ Hide smaller updates" else "▾ ${e.minor.size} smaller update${if (e.minor.size == 1) "" else "s"} included"), fontSize = 12.5.sp, color = c.primary,
                                modifier = Modifier.padding(top = 10.dp).clickable { expanded = !expanded }.padding(vertical = 4.dp),
                            )
                            if (expanded) e.minor.forEach { Text("•  $it", fontSize = 13.sp, lineHeight = 20.sp, color = PfaTheme.extras.bodyMuted, modifier = Modifier.padding(top = 4.dp)) }
                        }
                    }
                }
            }
        }
    }
}

// ───────────────────────── Feedback ─────────────────────────

@Composable
fun FeedbackScreen(onSuggest: () -> Unit) {
    val c = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    val uri = LocalUriHandler.current
    var tab by remember { mutableStateOf("review") }
    Column(Modifier.fillMaxSize().padding(horizontal = 20.dp, vertical = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Row(Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(c.surface).border(1.dp, c.outline, RoundedCornerShape(14.dp)).padding(6.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            listOf("review" to "App Review", "feedback" to "Feedback", "suggest" to "Suggest Feature").forEach { (id, label) ->
                Text(
                    label, fontFamily = FontFamily.Serif, fontSize = 14.sp, textAlign = TextAlign.Center, color = if (tab == id) x.buttonText else c.onSurfaceVariant,
                    fontWeight = if (tab == id) FontWeight.SemiBold else FontWeight.Normal,
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).background(if (tab == id) x.selectedBg else c.surface).clickable { tab = id }.padding(vertical = 10.dp, horizontal = 4.dp),
                )
            }
        }
        Column(Modifier.padding(top = 28.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            PageTitle(
                when (tab) { "review" -> "App Review"; "feedback" -> "Share Your Feedback"; else -> "Suggest a Feature" },
                when (tab) { "review" -> "We'd love to hear what you think. Your review helps us improve."; "feedback" -> "Have something to share? We're listening."; else -> "Got an idea? Tell us what you'd like to see." },
            )
            CardBox {
                Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                    when (tab) {
                        "review" -> {
                            Text("⭐", fontSize = 36.sp)
                            Text("The review form opens in your browser.", fontSize = 14.sp, color = c.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 12.dp))
                            Text("Open the review form", color = androidx.compose.ui.graphics.Color(0xFFFFF8EE), fontSize = 14.sp, modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(c.primary).clickable { uri.openUri("https://pf-feedback.lovable.app") }.padding(horizontal = 24.dp, vertical = 12.dp))
                        }
                        "feedback" -> { Text("🛠", fontSize = 36.sp); Text("Form Not Installed Yet", fontFamily = FontFamily.Serif, fontSize = 18.sp, color = c.onBackground, modifier = Modifier.padding(top = 8.dp)); Text("This form hasn't been set up yet. Check back soon!", fontSize = 14.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(top = 6.dp)) }
                        else -> {
                            Text("💡", fontSize = 36.sp)
                            Text("Send your idea straight to the team.", fontSize = 14.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(vertical = 12.dp))
                            Text("Suggest a feature", color = androidx.compose.ui.graphics.Color(0xFFFFF8EE), fontSize = 14.sp, modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(c.primary).clickable(onClick = onSuggest).padding(horizontal = 24.dp, vertical = 12.dp))
                        }
                    }
                }
            }
        }
    }
}

// ───────────────────────── Dev Info ─────────────────────────

private data class DevInfo(
    val appName: String, val license: String, val githubUrl: String, val liveUrl: String,
    val techStack: List<Pair<String, List<String>>>, val features: List<Pair<String, String>>, val backend: List<Pair<String, String>>, val support: String,
)

private fun parseDevInfo(o: JSONObject, base: DevInfo?): DevInfo {
    fun text(k: String, f: String) = o.optString(k).takeIf { it.isNotBlank() } ?: f
    fun arr(k: String): JSONArray? = o.optJSONArray(k)
    fun <T> list(k: String, f: List<T>, map: (JSONObject) -> T): List<T> = arr(k)?.let { a -> (0 until a.length()).map { map(a.getJSONObject(it)) } } ?: f
    return DevInfo(
        text("appName", base?.appName ?: ""), text("license", base?.license ?: ""), text("githubUrl", base?.githubUrl ?: ""), text("liveUrl", base?.liveUrl ?: ""),
        list("techStack", base?.techStack ?: emptyList()) { g -> g.optString("group") to (g.optJSONArray("items")?.let { i -> (0 until i.length()).map { i.getString(it) } } ?: emptyList()) },
        list("features", base?.features ?: emptyList()) { f -> f.optString("icon") to f.optString("label") },
        list("backendFunctions", base?.backend ?: emptyList()) { f -> f.optString("name") to f.optString("desc") },
        if (o.has("supportText")) o.optString("supportText") else base?.support ?: "",
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DevInfoScreen() {
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val c = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    val defaults = remember { parseDevInfo(JSONObject(context.assets.open("dev_info.json").bufferedReader().readText()), null) }
    var info by remember { mutableStateOf(defaults) }
    // Editable in Admin → Dev Info (appConfig/devInfo); shows the built-in copy first, swaps in the saved one.
    LaunchedEffect(Unit) {
        runCatching {
            val snap = FirebaseFirestore.getInstance().collection("appConfig").document("devInfo").get().await()
            if (snap.exists()) info = parseDevInfo(JSONObject(snap.data ?: emptyMap<String, Any>()), defaults)
        }
    }
    @Composable fun Header(icon: String, title: String) {
        Row(Modifier.padding(bottom = 14.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(icon, fontSize = 20.sp); Text(title, fontFamily = FontFamily.Serif, fontSize = 17.sp, color = c.onBackground.copy(alpha = 0.85f))
        }
    }
    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
        item { PageTitle("Dev Info", "Everything about how this app is built.") }
        item {
            CardBox {
                Header("📱", "App Info")
                listOf("Name" to info.appName, "Version" to BuildConfig.VERSION_NAME, "License" to info.license).forEach { (l, v) ->
                    Row(Modifier.fillMaxWidth().padding(vertical = 6.dp), horizontalArrangement = Arrangement.SpaceBetween) { Text(l, fontSize = 13.sp, color = c.onSurfaceVariant); Text(v, fontSize = 13.sp, color = c.onBackground) }
                    HorizontalDivider(color = c.outline.copy(alpha = 0.6f))
                }
                Row(Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    listOf("💻 GitHub Repo" to info.githubUrl, "🌐 Live Demo" to info.liveUrl).forEach { (l, u) ->
                        Text(l, fontSize = 13.sp, color = x.buttonText, modifier = Modifier.clip(RoundedCornerShape(10.dp)).border(1.dp, c.outline, RoundedCornerShape(10.dp)).clickable { if (u.startsWith("http")) uri.openUri(u) }.padding(horizontal = 14.dp, vertical = 9.dp))
                    }
                }
            }
        }
        item {
            CardBox {
                Header("🛠️", "Tech Stack")
                info.techStack.forEach { (g, items) ->
                    Text(g.uppercase(), fontSize = 11.sp, letterSpacing = 0.8.sp, color = c.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp, bottom = 6.dp))
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                        items.forEach { Text(it, fontSize = 12.sp, color = x.buttonText, modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(x.chipBg).padding(horizontal = 10.dp, vertical = 5.dp)) }
                    }
                }
            }
        }
        item {
            CardBox {
                Header("🎯", "Features")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 2) {
                    info.features.forEach { (icon, label) ->
                        Row(Modifier.weight(1f).clip(RoundedCornerShape(12.dp)).background(c.background).border(1.dp, c.outline, RoundedCornerShape(12.dp)).padding(10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Text(icon, fontSize = 16.sp); Text(label, fontSize = 12.5.sp, color = c.onBackground)
                        }
                    }
                }
            }
        }
        item {
            CardBox {
                Header("⚙️", "Backend Functions")
                info.backend.forEachIndexed { i, (n, d) ->
                    Column(Modifier.padding(vertical = 8.dp)) { Text(n, fontSize = 13.sp, fontWeight = FontWeight.SemiBold, color = x.buttonText); Text(d, fontSize = 12.5.sp, lineHeight = 19.sp, color = c.onSurfaceVariant) }
                    if (i < info.backend.lastIndex) HorizontalDivider(color = c.outline.copy(alpha = 0.6f))
                }
            }
        }
        item {
            CardBox {
                Header("📞", "Support")
                Text(info.support, fontSize = 14.sp, lineHeight = 22.sp, color = x.bodyMuted)
                Text("View on GitHub", fontSize = 14.sp, color = c.primary, modifier = Modifier.padding(top = 8.dp).clickable { uri.openUri(info.githubUrl) })
            }
        }
    }
}
