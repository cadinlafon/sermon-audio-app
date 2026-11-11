package com.palousefellowship.audio.ui.screens.audiolist

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
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.Checkbox
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.data.config.AudioCategory
import com.palousefellowship.audio.data.config.DURATIONS
import com.palousefellowship.audio.data.config.MONTHS
import com.palousefellowship.audio.data.config.SORT_OPTIONS
import com.palousefellowship.audio.data.config.SearchConfig
import com.palousefellowship.audio.data.config.STATUSES
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.ui.theme.PfaTheme

/** Search + sort + filters with chips, a result count and reset — port of AudioFilterBar.jsx. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun AudioFilterBar(
    filters: AudioFilters,
    onChange: ((AudioFilters) -> AudioFilters) -> Unit,
    onReset: () -> Unit,
    options: FilterOptions,
    chips: List<FilterChip>,
    resultCount: Int,
    total: Int,
    loading: Boolean,
    searchCfg: SearchConfig,
    categories: List<AudioCategory>,
    view: String,
    onView: (String) -> Unit,
    showLiked: Boolean,
) {
    val colors = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    var open by remember { mutableStateOf(searchCfg.filtersOpenByDefault) }
    val advancedActive = chips.count { it.key != "search" }
    fun on(k: String) = searchCfg.filters[k] != false
    val showTypeFilter = on("category") && categories.size > 1
    val showSeries = on("series") && options.series.isNotEmpty()
    val anyFilterOn = on("speaker") || showTypeFilter || showSeries || on("length") || on("date") || on("progress") || (on("liked") && showLiked) || on("downloaded")

    Column(Modifier.fillMaxWidth().padding(bottom = 18.dp)) {
        FlowRow(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(10.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            if (searchCfg.enabled) {
                Box(
                    Modifier.widthIn(min = 200.dp, max = 340.dp).height(40.dp).clip(RoundedCornerShape(999.dp)).background(colors.surface)
                        .border(1.dp, colors.outline, RoundedCornerShape(999.dp)).padding(horizontal = 16.dp),
                    contentAlignment = Alignment.CenterStart,
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Box(Modifier.weight(1f)) {
                            if (filters.search.isEmpty()) Text(searchCfg.placeholder.ifEmpty { "Search title or speaker…" }, fontSize = 13.sp, color = colors.onSurfaceVariant)
                            BasicTextField(
                                value = filters.search, onValueChange = { v -> onChange { it.copy(search = v) } }, singleLine = true,
                                textStyle = TextStyle(fontSize = 13.sp, color = colors.onBackground), cursorBrush = SolidColor(colors.primary),
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                        if (filters.search.isNotEmpty()) {
                            Box(
                                Modifier.padding(start = 6.dp).height(26.dp).widthIn(min = 26.dp).clip(RoundedCornerShape(999.dp)).background(x.softBg).clickable { onChange { it.copy(search = "") } },
                                contentAlignment = Alignment.Center,
                            ) { Text("✕", fontSize = 12.sp, color = x.buttonText) }
                        }
                    }
                }
            }
            Dropdown(value = filters.sort, options = SORT_OPTIONS, onSelect = { v -> onChange { it.copy(sort = v) } })
            if (anyFilterOn) {
                Text(
                    "⚙ Filters" + if (advancedActive > 0) " ($advancedActive)" else "", fontSize = 13.sp, color = x.buttonText,
                    fontWeight = if (advancedActive > 0) FontWeight.SemiBold else FontWeight.Normal,
                    modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(if (advancedActive > 0) x.selectedBg else colors.surface)
                        .border(1.dp, if (advancedActive > 0) x.selectedBorder else colors.outline, RoundedCornerShape(999.dp))
                        .clickable { open = !open }.padding(horizontal = 16.dp, vertical = 10.dp),
                )
            }
            Row(Modifier.clip(RoundedCornerShape(999.dp)).background(colors.surface).border(1.dp, colors.outline, RoundedCornerShape(999.dp))) {
                listOf("list" to "☰ List", "grid" to "▦ Grid").forEach { (v, l) ->
                    Text(
                        l, fontSize = 13.sp, color = x.buttonText, fontWeight = if (view == v) FontWeight.SemiBold else FontWeight.Normal,
                        modifier = Modifier.background(if (view == v) x.selectedBg else colors.surface).clickable { onView(v) }.padding(horizontal = 14.dp, vertical = 10.dp),
                    )
                }
            }
        }

        if (open && anyFilterOn) {
            Column(
                Modifier.padding(top = 12.dp).fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(colors.surface)
                    .border(1.dp, colors.outline, RoundedCornerShape(16.dp)).padding(14.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp), maxItemsInEachRow = 2) {
                    if (on("speaker")) Field("Speaker") { Dropdown(filters.speaker, listOf("all" to "All speakers") + options.speakers.map { it to it }, { v -> onChange { it.copy(speaker = v) } }, Modifier.fillMaxWidth()) }
                    if (showTypeFilter) Field("Category") { Dropdown(filters.type, listOf("all" to "All categories") + categories.map { it.id to it.plural }, { v -> onChange { it.copy(type = v) } }, Modifier.fillMaxWidth()) }
                    if (showSeries) Field("Series") { Dropdown(filters.series, listOf("all" to "All series") + options.series.map { it to it }, { v -> onChange { it.copy(series = v) } }, Modifier.fillMaxWidth()) }
                    if (on("length")) Field("Length") { Dropdown(filters.duration, DURATIONS, { v -> onChange { it.copy(duration = v) } }, Modifier.fillMaxWidth()) }
                    if (on("date")) {
                        Field("Year") { Dropdown(filters.year, listOf("all" to "Any year") + options.years.map { it.toString() to it.toString() }, { v -> onChange { it.copy(year = v) } }, Modifier.fillMaxWidth()) }
                        Field("Month") { Dropdown(filters.month, listOf("all" to "Any month") + MONTHS.mapIndexed { i, m -> (i + 1).toString() to m }, { v -> onChange { it.copy(month = v) } }, Modifier.fillMaxWidth()) }
                    }
                    if (on("progress")) Field("Progress") { Dropdown(filters.status, STATUSES, { v -> onChange { it.copy(status = v) } }, Modifier.fillMaxWidth()) }
                }
                if (on("liked") && showLiked) CheckRow("Liked only", filters.liked) { v -> onChange { it.copy(liked = v) } }
                if (on("downloaded")) CheckRow("Downloaded only (works offline)", filters.downloaded) { v -> onChange { it.copy(downloaded = v) } }
            }
        }

        if (chips.isNotEmpty() || !loading) {
            FlowRow(
                Modifier.fillMaxWidth().padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                Text(
                    if (loading) "Loading…" else if (chips.isNotEmpty()) "$resultCount of $total recordings" else "$total recording${if (total == 1) "" else "s"}",
                    fontSize = 12.sp, color = colors.onSurfaceVariant,
                )
                chips.forEach { c ->
                    Text("${c.label} ✕", fontSize = 12.sp, color = x.buttonText, modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(x.chipBg).clickable { onChange(c.clear) }.padding(horizontal = 10.dp, vertical = 5.dp))
                }
                if (chips.isNotEmpty()) Text("Reset filters", fontSize = 12.sp, color = colors.primary, modifier = Modifier.clickable(onClick = onReset).padding(horizontal = 6.dp, vertical = 5.dp))
            }
        }
    }
}

@Composable
private fun Field(label: String, content: @Composable () -> Unit) {
    Column(Modifier.widthIn(min = 140.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(label.uppercase(), fontSize = 11.sp, letterSpacing = 0.55.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        content()
    }
}

@Composable
private fun CheckRow(label: String, checked: Boolean, onChange: (Boolean) -> Unit) {
    Row(Modifier.clickable { onChange(!checked) }, verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked, onCheckedChange = onChange)
        Text(label, fontSize = 13.sp, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.9f))
    }
}

/** A pill-shaped single-choice menu (the web's styled <select>). */
@Composable
fun Dropdown(value: String, options: List<Pair<String, String>>, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    val colors = MaterialTheme.colorScheme
    var expanded by remember { mutableStateOf(false) }
    Box(modifier) {
        Row(
            Modifier.then(if (modifier == Modifier) Modifier else Modifier.fillMaxWidth()).clip(RoundedCornerShape(999.dp)).background(colors.surface)
                .border(1.dp, colors.outline, RoundedCornerShape(999.dp)).clickable { expanded = true }.padding(horizontal = 14.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text(options.firstOrNull { it.first == value }?.second ?: value, fontSize = 13.sp, color = colors.onBackground, maxLines = 1, modifier = Modifier.weight(1f, fill = modifier != Modifier))
            Text("▾", fontSize = 10.sp, color = colors.onSurfaceVariant)
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            options.forEach { (v, l) -> DropdownMenuItem(text = { Text(l, fontSize = 14.sp) }, onClick = { onSelect(v); expanded = false }) }
        }
    }
}

/** Shown when filters leave nothing: says why and offers one-tap fixes. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NoResults(chips: List<FilterChip>, search: String, offlineNothing: Boolean, emptyMessage: String, noResultsMessage: String, onClear: (FilterChip) -> Unit, onReset: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    Column(Modifier.fillMaxWidth().padding(vertical = 30.dp, horizontal = 10.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        if (offlineNothing) {
            Text("📴", fontSize = 34.sp)
            Text("You're offline", fontFamily = FontFamily.Serif, fontSize = 18.sp, color = colors.onBackground, modifier = Modifier.padding(top = 8.dp, bottom = 4.dp))
            Text("Nothing has been downloaded yet. Download audio while you're online to listen without a connection.", fontSize = 14.sp, textAlign = TextAlign.Center, color = colors.onSurfaceVariant)
            return@Column
        }
        Text("🔍", fontSize = 34.sp)
        Text(if (chips.isNotEmpty()) "No matches" else "Nothing here yet", fontFamily = FontFamily.Serif, fontSize = 18.sp, color = colors.onBackground, modifier = Modifier.padding(top = 8.dp, bottom = 4.dp))
        if (chips.isNotEmpty()) {
            Text(
                "${noResultsMessage.ifEmpty { "Nothing fits ${if (chips.size == 1) "this filter" else "all of these filters"}." }} Try one of these:",
                fontSize = 14.sp, lineHeight = 21.sp, textAlign = TextAlign.Center, color = colors.onSurfaceVariant, modifier = Modifier.padding(bottom = 12.dp),
            )
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                chips.forEach { c -> SugButton("Remove ${c.label}", false) { onClear(c) } }
                if (chips.size > 1) SugButton("Clear everything", true, onReset)
            }
            if (search.isNotEmpty()) Text("Tip: search matches titles and speakers — try a shorter or different word.", fontSize = 12.sp, fontStyle = FontStyle.Italic, color = x.navInactive, modifier = Modifier.padding(top = 12.dp))
        } else {
            Text(emptyMessage.ifEmpty { "Check back soon for new recordings." }, fontSize = 14.sp, textAlign = TextAlign.Center, color = colors.onSurfaceVariant)
        }
    }
}

@Composable
private fun SugButton(text: String, primary: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    Text(
        text, fontSize = 13.sp, color = if (primary) androidx.compose.ui.graphics.Color(0xFFFFF8EE) else x.buttonText,
        modifier = Modifier.clip(RoundedCornerShape(999.dp))
            .then(if (primary) Modifier.background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(AccentOrange, AccentBrownDark))) else Modifier.background(colors.background).border(1.dp, colors.outline, RoundedCornerShape(999.dp)))
            .clickable(onClick = onClick).padding(horizontal = 14.dp, vertical = 8.dp),
    )
}
