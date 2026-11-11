package com.palousefellowship.audio.ui.screens.resources

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
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.model.RESOURCE_TYPE_LABELS
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.components.ResourceCard
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.ui.screens.audiolist.Dropdown
import com.palousefellowship.audio.ui.theme.PfaTheme
import com.palousefellowship.audio.util.UiState
import com.palousefellowship.audio.util.openInSpotify

private fun sortResources(list: List<Resource>, by: String) = when (by) {
    "oldest" -> list.sortedBy { it.date }
    "title" -> list.sortedBy { it.title }
    "type" -> list.sortedBy { it.type }
    else -> list.sortedByDescending { it.date }
}

/** Port of Resources.jsx: search + filters, "Featured" and the admin's curated rows (or
 * "Search Results" while searching / filtering). */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun ResourcesScreen(
    title: String,
    typeFilter: String?,
    emptyIcon: String,
    emptyMessage: String,
    onPlayAudioResource: (Resource) -> Unit,
) {
    val vm = pfaViewModel { c -> ResourcesViewModel(c.resourceRepository, typeFilter) }
    val state by vm.state.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val uri = LocalUriHandler.current
    val c = MaterialTheme.colorScheme
    val x = PfaTheme.extras

    var search by remember { mutableStateOf("") }
    var type by remember { mutableStateOf("all") }
    var category by remember { mutableStateOf("all") }
    var sortBy by remember { mutableStateOf("newest") }
    var showFilters by remember { mutableStateOf(false) }
    val catById = vm.categories.associateBy { it.id }

    val open: (Resource) -> Unit = { r ->
        when {
            r.type == Resource.TYPE_AUDIO && !r.audioStorageKey.isNullOrBlank() -> onPlayAudioResource(r)
            r.type == Resource.TYPE_SPOTIFY -> openInSpotify(context, r.url)
            r.url.isNotBlank() -> uri.openUri(r.url)
        }
    }

    Column(Modifier.fillMaxSize().background(c.background)) {
        when (val s = state) {
            is UiState.Loading -> LoadingView()
            is UiState.Error -> ErrorView(message = s.message, onRetry = { vm.load() })
            is UiState.Success -> {
                val all = s.data
                val featured = all.filter { it.featured }.sortedBy { it.order }
                val searching = search.isNotBlank() || type != "all" || category != "all"
                val filtered = run {
                    var l = all
                    if (type != "all") l = l.filter { it.type == type }
                    if (category != "all") l = l.filter { it.categoryId == category }
                    if (search.isNotBlank()) { val q = search.trim().lowercase(); l = l.filter { r -> listOf(r.title, r.description, r.author, r.type, catById[r.categoryId]?.name).filterNotNull().any { it.lowercase().contains(q) } } }
                    sortResources(l, sortBy)
                }
                val activeFilters = (if (type != "all") 1 else 0) + (if (category != "all") 1 else 0) + (if (sortBy != "newest") 1 else 0)
                PullToRefreshBox(isRefreshing = false, onRefresh = { vm.load() }, modifier = Modifier.fillMaxSize()) {
                    LazyColumn(Modifier.fillMaxSize(), contentPadding = PaddingValues(start = 20.dp, end = 20.dp, top = 32.dp, bottom = 60.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                        item {
                            Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
                                Text(title, fontFamily = FontFamily.Serif, fontSize = 28.sp, color = c.onBackground)
                                Text("Sermons, studies, and helpful content from Palouse Fellowship.", fontSize = 14.sp, color = c.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
                            }
                        }
                        if (all.isEmpty()) item { Text(emptyMessage, fontSize = 14.sp, color = c.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(24.dp)) }
                        else {
                            item {
                                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                    Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
                                        Box(Modifier.weight(1f).height(42.dp).clip(RoundedCornerShape(999.dp)).background(c.surface).border(1.dp, c.outline, RoundedCornerShape(999.dp)).padding(horizontal = 16.dp), contentAlignment = Alignment.CenterStart) {
                                            if (search.isEmpty()) Text("Search resources…", fontSize = 14.sp, color = c.onSurfaceVariant)
                                            BasicTextField(search, { search = it }, singleLine = true, textStyle = TextStyle(fontSize = 14.sp, color = c.onBackground), cursorBrush = SolidColor(c.primary), modifier = Modifier.fillMaxWidth())
                                        }
                                        Text(
                                            "⚙ Filters" + if (activeFilters > 0) " ($activeFilters)" else "", fontSize = 13.sp, color = x.buttonText,
                                            modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(if (showFilters || activeFilters > 0) x.selectedBg else c.surface).border(1.dp, if (activeFilters > 0) x.selectedBorder else c.outline, RoundedCornerShape(999.dp)).clickable { showFilters = !showFilters }.padding(horizontal = 14.dp, vertical = 11.dp),
                                        )
                                    }
                                    if (showFilters) FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                        Dropdown(type, listOf("all" to "All types") + RESOURCE_TYPE_LABELS.map { it.key to it.value.first }, { type = it })
                                        if (vm.categories.isNotEmpty()) Dropdown(category, listOf("all" to "All categories") + vm.categories.map { it.id to it.name }, { category = it })
                                        Dropdown(sortBy, listOf("newest" to "Newest first", "oldest" to "Oldest first", "title" to "Title A–Z", "type" to "By type"), { sortBy = it })
                                    }
                                }
                            }
                            if (searching) {
                                item { SectionTitle("Search Results") }
                                if (filtered.isEmpty()) item { Text("No resources match your search or filters.", fontSize = 14.sp, color = c.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(16.dp)) }
                                filtered.forEach { r -> item(key = "f-${r.id}") { ResourceCard(r, catById[r.categoryId]?.name, { open(r) }) } }
                            } else {
                                if (featured.isNotEmpty()) { item { SectionTitle("Featured") }; featured.forEach { r -> item(key = "ft-${r.id}") { ResourceCard(r, catById[r.categoryId]?.name, { open(r) }) } } }
                                vm.sections.forEach { sec ->
                                    val rows = all.filter { sec.id in it.sectionIds }
                                    if (rows.isNotEmpty()) { item(key = "st-${sec.id}") { SectionTitle(sec.name) }; rows.forEach { r -> item(key = "s-${sec.id}-${r.id}") { ResourceCard(r, catById[r.categoryId]?.name, { open(r) }) } } }
                                }
                                if (featured.isEmpty() && vm.sections.none { s2 -> all.any { s2.id in it.sectionIds } }) item { Text("Nothing featured yet — search above to browse everything.", fontSize = 14.sp, color = c.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(16.dp)) }
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, fontFamily = FontFamily.Serif, fontSize = 18.sp, color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.padding(top = 8.dp))
}
