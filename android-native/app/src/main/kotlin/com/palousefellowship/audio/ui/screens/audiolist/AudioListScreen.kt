package com.palousefellowship.audio.ui.screens.audiolist

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.config.AudioCategory
import com.palousefellowship.audio.data.config.AudioConfig
import com.palousefellowship.audio.data.config.MONTHS
import com.palousefellowship.audio.data.config.PAGE_META
import com.palousefellowship.audio.data.config.resolveAudioConfig
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.todayString
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.components.AudioCard
import com.palousefellowship.audio.ui.components.ConfigBanner
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.OfflineBanner
import com.palousefellowship.audio.ui.components.PageNoticeList
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.ui.theme.PfaTheme
import com.palousefellowship.audio.util.UiState

private data class Spacing(val pad: PaddingValues, val gap: Int, val section: Int)

private fun spacing(s: String) = when (s) {
    "tight" -> Spacing(PaddingValues(start = 14.dp, end = 14.dp, top = 20.dp, bottom = 40.dp), 10, 20)
    "relaxed" -> Spacing(PaddingValues(start = 28.dp, end = 28.dp, top = 44.dp, bottom = 80.dp), 24, 40)
    else -> Spacing(PaddingValues(start = 20.dp, end = 20.dp, top = 32.dp, bottom = 60.dp), 16, 28)
}

private data class Group(val key: String, val title: String, val order: Int, val items: List<Audio>, val category: AudioCategory?)
private data class Section(val key: String, val title: String, val items: List<Audio>)

/**
 * Port of src/components/AudioListView.jsx: the whole audio list page —
 * title, banner, notices, search & filters, featured sections, grouped /
 * paginated cards — driven by the Audio Page Manager settings.
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun AudioListScreen(
    pageKey: String,
    fetchTypes: List<String>,
    playerState: PlayerUiState,
    onPlay: (Audio, List<Audio>, Long) -> Unit,
    onPlayNext: (Audio) -> Unit,
    onPlayAll: (List<Audio>) -> Int,
    onAddAll: (List<Audio>) -> Int,
    onAddRemaining: (List<Audio>) -> Int,
    onTogglePlayPause: () -> Unit,
    onTranscript: (Audio) -> Unit,
    onOpenRoute: (String) -> Unit,
) {
    val context = LocalContext.current
    val container = (context.applicationContext as PfaApplication).container
    val viewModel = pfaViewModel { c ->
        AudioListViewModel(context.applicationContext, pageKey, c.audioRepository, fetchTypes, c.savedRepository, c.listenProgressRepository, c.downloadRepository, c.pageNoticeRepository)
    }
    val raw by viewModel.raw.collectAsStateWithLifecycle()
    val refreshing by viewModel.isRefreshing.collectAsStateWithLifecycle()
    val filters by viewModel.filters.collectAsStateWithLifecycle()
    val notices by viewModel.notices.collectAsStateWithLifecycle()
    val savedIds by viewModel.savedIds.collectAsStateWithLifecycle()
    val downloadedIds by viewModel.downloadedIds.collectAsStateWithLifecycle()
    val progressByAudioId by viewModel.progress.collectAsStateWithLifecycle()
    val isOnline by container.connectivityObserver.isOnline.collectAsStateWithLifecycle(initialValue = true)
    val session by container.sessionRepository.session.collectAsStateWithLifecycle()
    val status by container.remoteConfig.status.collectAsStateWithLifecycle()
    val uriHandler = LocalUriHandler.current
    val x = PfaTheme.extras
    val colors = MaterialTheme.colorScheme

    val cfg = remember(status.audioPages, pageKey) { resolveAudioConfig(status.audioPages, pageKey) }
    val page = cfg.page
    val meta = PAGE_META.getValue(cfg.pageKey)
    val sp = spacing(page.appearance.spacing)

    // ── categories on this page: visible ones, in the admin's order ──
    val pageCategories = remember(cfg) { cfg.categories.filter { it.id in meta.categories && it.visible } }
    val visibleIds = remember(pageCategories) { pageCategories.map { it.id }.toSet() }
    val items = (raw as? UiState.Success)?.data.orEmpty()
    val fromCache = (raw as? UiState.Success)?.fromCache == true
    val visibleItems = remember(items, visibleIds) { items.filter { it.type in visibleIds } }

    // ── defaults: category selection and sort ──
    val defaultType = run {
        val want = page.appearance.defaultCategory
        if (want == "featured") (if (cfg.featuredCategory in visibleIds) cfg.featuredCategory else "all") else if (want != "all" && want in visibleIds) want else "all"
    }
    val defaultSort = run {
        fun forCategory(id: String) = pageCategories.firstOrNull { it.id == id }?.defaultSort?.takeIf { it.isNotEmpty() }
        if (defaultType != "all" && forCategory(defaultType) != null) forCategory(defaultType)!!
        else if (pageCategories.size == 1 && forCategory(pageCategories[0].id) != null) forCategory(pageCategories[0].id)!!
        else page.layout.defaultSort
    }
    LaunchedEffect(defaultSort, defaultType, page.search.rememberFilters) { viewModel.applyDefaults(defaultSort, defaultType, page.search.rememberFilters) }

    val typeLabel = { id: String -> pageCategories.firstOrNull { it.id == id }?.plural ?: id }
    val userState = remember(progressByAudioId, savedIds, downloadedIds) { UserAudioState(progressByAudioId, savedIds, downloadedIds) }
    val result = remember(visibleItems, filters, userState, page.search.fields) { filterAudio(visibleItems, filters, page.search.fields, userState) }
    val options = remember(visibleItems) { filterOptions(visibleItems) }
    val chips = remember(filters) { filterChips(filters, typeLabel) }
    val filtering = chips.isNotEmpty()

    // ── view (list / grid): the admin's default until the listener picks ──
    val viewPrefs = remember { context.getSharedPreferences("pf_audio_view", android.content.Context.MODE_PRIVATE) }
    var viewChoice by remember { mutableStateOf(viewPrefs.getString("view:${cfg.pageKey}", null)) }
    val view = viewChoice ?: page.layout.defaultView
    val grid = view == "grid"

    // ── pinned items float up; featured sections ──
    val today = todayString()
    val byId = remember(visibleItems) { visibleItems.associateBy { it.id } }
    val pinnedItems = page.featured.pinned.filter { it.expiresAt.isEmpty() || it.expiresAt >= today }.mapNotNull { byId[it.id] }
    val pinnedIds = pinnedItems.map { it.id }.toSet()
    val sections = buildList {
        if (!filtering) {
            if (page.featured.enabled && pinnedItems.isNotEmpty()) add(Section("featured", page.featured.title, pinnedItems))
            val fs = page.featured.series
            if (fs.enabled && fs.name.isNotEmpty()) {
                val list = visibleItems.filter { (it.series ?: "").trim() == fs.name }.sortedBy { it.order }
                if (list.isNotEmpty()) add(Section("series", fs.title.ifEmpty { "Series: ${fs.name}" }, list))
            }
            val fr = page.featured.recent
            if (fr.enabled) {
                val cutoff = System.currentTimeMillis() - fr.days * 86400000L
                val list = visibleItems.filter { createdMs(it) >= cutoff }.sortedWith(compareByDescending<Audio> { createdMs(it) }.thenByDescending { it.order }).take(fr.count)
                if (list.isNotEmpty()) add(Section("recent", fr.title, list))
            }
            val fp = page.featured.popular
            if (fp.enabled) {
                val list = fp.ids.mapNotNull { byId[it] }.take(fp.count)
                if (list.isNotEmpty()) add(Section("popular", fp.title, list))
            }
            page.featured.collections.forEach { c ->
                if (!c.enabled || (c.expiresAt.isNotEmpty() && c.expiresAt < today)) return@forEach
                val list = c.ids.mapNotNull { byId[it] }
                if (list.isNotEmpty()) add(Section("col-${c.id}", c.title, list))
            }
        }
    }
    val pinnedInSection = page.featured.enabled && !filtering
    val mainList = remember(result, filtering, pinnedItems, pinnedInSection) {
        if (!filtering && pinnedItems.isNotEmpty()) {
            val inList = result.filter { it.id in pinnedIds }
            val rest = result.filter { it.id !in pinnedIds }
            if (pinnedInSection) rest else pinnedItems.filter { p -> inList.any { it.id == p.id } } + rest
        } else result
    }

    // ── pagination ──
    val pageSize = if (page.pagination.mode == "loadMore") page.pagination.size else Int.MAX_VALUE
    var shown by remember { mutableIntStateOf(pageSize) }
    LaunchedEffect(filters, pageSize) { shown = pageSize }
    val slice = mainList.take(shown)
    val hasMore = mainList.size > slice.size

    // ── grouping ──
    val groups: List<Group> = run {
        val mode = page.layout.groupBy
        if (mode == "none") listOf(Group("all", "", 0, slice, null)) else {
            val map = LinkedHashMap<String, Group>()
            slice.forEach { item ->
                val key: String; val title: String; val order: Int
                if (mode == "category") {
                    key = item.type
                    val c = pageCategories.firstOrNull { it.id == item.type }
                    title = c?.let { (if (it.icon.isNotEmpty()) "${it.icon} " else "") + it.plural } ?: item.type
                    order = pageCategories.indexOfFirst { it.id == item.type }.let { if (it < 0) 999 else it }
                } else {
                    val d = dateOf(item)
                    key = if (d != null) (if (mode == "year") d.y.toString() else "%d-%02d".format(d.y, d.m)) else "unknown"
                    title = if (d != null) (if (mode == "year") d.y.toString() else "${MONTHS[d.m - 1]} ${d.y}") else "Undated"
                    order = if (d != null) d.y * 100 + (if (mode == "year") 0 else d.m) else 0
                }
                val existing = map[key]
                map[key] = if (existing == null) Group(key, title, order, listOf(item), if (mode == "category") pageCategories.firstOrNull { it.id == item.type } else null)
                else existing.copy(items = existing.items + item)
            }
            val out = map.values.toList()
            if (mode == "category") out.sortedBy { it.order } else out.sortedWith(if (filters.sort == "oldest") compareBy { it.order } else compareByDescending { it.order })
        }
    }

    // ── notices by placement ──
    val pageCategoryIds = pageCategories.map { it.id }
    fun noticesAt(placement: String) = notices.filter { it.resolvedPlacement == placement && it.applies(cfg.pageKey, pageCategoryIds, filters.type) }

    val describedCategories = if (!page.appearance.showCategoryDescriptions || page.layout.groupBy == "category") emptyList()
    else (if (filters.type != "all") pageCategories.filter { it.id == filters.type } else pageCategories).filter { it.description.isNotEmpty() }

    val title = page.appearance.title.ifEmpty { meta.defaultTitle }
    val banner = page.appearance.banner

    val noticeList: @Composable (String) -> Unit = { placement ->
        PageNoticeList(
            notices = noticesAt(placement), isDismissed = viewModel::isNoticeDismissed, onDismiss = viewModel::dismissNotice,
            onOpenRoute = onOpenRoute, onOpenUrl = { uriHandler.openUri(it) },
        )
    }

    @Composable
    fun Card(audio: Audio, fill: Boolean, modifier: Modifier = Modifier) {
        val isCurrent = playerState.current?.id == audio.id
        AudioCard(
            audio = audio, config = cfg, isCurrent = isCurrent, isPlaying = playerState.isPlaying,
            isSaved = audio.id in savedIds, isDownloaded = audio.id in downloadedIds, progress = progressByAudioId[audio.id],
            currentPositionMs = if (isCurrent) playerState.positionMs else 0, currentDurationMs = if (isCurrent) playerState.durationMs else 0,
            isOnline = isOnline, isSignedIn = session.signedIn, isAdmin = session.isAdmin,
            aiEnabled = status.audioAiEnabled, aiAudiences = status.audioAiAudiences,
            onPlay = { resumeAt -> onPlay(audio, mainList, resumeAt) },
            onTogglePlayPause = onTogglePlayPause, onPlayNext = { onPlayNext(audio) },
            onToggleSave = { viewModel.toggleSaved(audio) },
            onToggleDownload = { viewModel.toggleDownload(audio, audio.id in downloadedIds) },
            onTranscript = { onTranscript(audio) }, onSummarySaved = viewModel::summarySaved,
            modifier = modifier, fill = fill,
        )
    }

    BoxWithConstraints(Modifier.fillMaxSize()) {
        val columns = if (grid) (((maxWidth - sp.pad.calculateLeftPadding(androidx.compose.ui.unit.LayoutDirection.Ltr) * 2) / 260.dp).toInt()).coerceAtLeast(1) else 1
        val renderCards: androidx.compose.foundation.lazy.LazyListScope.(List<Audio>, String) -> Unit = { list, prefix ->
            if (columns == 1) {
                items(list.size, key = { "$prefix-${list[it].id}" }) { i -> Box(Modifier.padding(bottom = sp.gap.dp)) { Card(list[i], false) } }
            } else {
                val rows = list.chunked(columns)
                items(rows.size, key = { "$prefix-row-${rows[it].first().id}" }) { r ->
                    Row(Modifier.fillMaxWidth().padding(bottom = sp.gap.dp), horizontalArrangement = Arrangement.spacedBy(sp.gap.dp)) {
                        rows[r].forEach { a -> Box(Modifier.weight(1f).fillMaxHeight()) { Card(a, true) } }
                        repeat(columns - rows[r].size) { Box(Modifier.weight(1f)) }
                    }
                }
            }
        }

        PullToRefreshBox(isRefreshing = refreshing, onRefresh = { viewModel.refresh() }, modifier = Modifier.fillMaxSize()) {
            LazyColumn(Modifier.fillMaxSize(), contentPadding = sp.pad) {
                if (fromCache) item { OfflineBanner("You're offline — showing the last saved list.", Modifier.padding(bottom = 12.dp)) }
                item { noticeList("pageTop") }
                if (banner.url.isNotEmpty()) {
                    item { ConfigBanner(banner, Modifier.padding(bottom = 20.dp)) }
                }
                item {
                    Text(title, fontFamily = FontFamily.Serif, fontSize = 28.sp, color = colors.onBackground, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = if (page.appearance.subtitle.isEmpty()) 28.dp else 8.dp))
                    if (page.appearance.subtitle.isNotEmpty()) Text(page.appearance.subtitle, fontSize = 14.sp, lineHeight = 21.sp, color = colors.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 24.dp))
                    if (describedCategories.isNotEmpty()) {
                        Column(Modifier.fillMaxWidth().padding(bottom = 20.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                            describedCategories.forEach { c ->
                                val prefix = if (describedCategories.size > 1) "${if (c.icon.isNotEmpty()) c.icon + " " else ""}${c.plural}: " else ""
                                Text(prefix + c.description, fontSize = 13.sp, lineHeight = 20.sp, color = x.bodyMuted, textAlign = TextAlign.Center, modifier = Modifier.padding(vertical = 2.dp))
                            }
                        }
                    }
                }
                item { noticeList("aboveFilters") }
                item {
                    AudioFilterBar(
                        filters = filters, onChange = { viewModel.update(it) }, onReset = { viewModel.reset(defaultSort, defaultType) },
                        options = options, chips = chips, resultCount = result.size, total = visibleItems.size,
                        loading = raw is UiState.Loading, searchCfg = page.search, categories = pageCategories,
                        view = view, onView = { v -> viewChoice = v; viewPrefs.edit().putString("view:${cfg.pageKey}", v).apply() },
                        showLiked = cfg.advanced.favorites,
                    )
                }
                item { noticeList("aboveList") }

                sections.forEach { s ->
                    item(key = "sec-${s.key}") { SectionHeader(s.title, null, cfg, Modifier.padding(bottom = 14.dp)) }
                    renderCards(s.items, "sec-${s.key}")
                    item(key = "sec-gap-${s.key}") { Box(Modifier.height((sp.section - sp.gap).coerceAtLeast(0).dp)) }
                }

                when (val r = raw) {
                    is UiState.Loading -> if (items.isEmpty()) {
                        item {
                            if (page.appearance.loadingMessage.isNotEmpty()) Text(page.appearance.loadingMessage, fontSize = 13.sp, color = colors.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp))
                            repeat(3) { Box(Modifier.padding(bottom = 16.dp).fillMaxWidth().height(120.dp).clip(RoundedCornerShape(18.dp)).background(x.softBg.copy(alpha = 0.6f))) }
                        }
                    }
                    is UiState.Error -> item { ErrorView(message = r.message, onRetry = { viewModel.load() }) }
                    is UiState.Success -> if (result.isEmpty()) {
                        item {
                            NoResults(chips, filters.search, offlineNothing = !isOnline && items.isEmpty(), emptyMessage = page.appearance.emptyMessage, noResultsMessage = page.appearance.noResultsMessage,
                                onClear = { c -> viewModel.update(c.clear) }, onReset = { viewModel.reset(defaultSort, defaultType) })
                        }
                    }
                }

                if (result.isNotEmpty()) {
                    item {
                        PlayAllBar(result, filtering, playerState, onPlayAll, onAddAll, onAddRemaining)
                    }
                }

                groups.forEachIndexed { gi, g ->
                    if (g.title.isNotEmpty()) item(key = "grp-${g.key}") { SectionHeader(g.title, if (page.appearance.showCategoryDescriptions) g.category?.description else null, cfg, Modifier.padding(bottom = 14.dp)) }
                    renderCards(g.items, "grp-${g.key}")
                    if (g.title.isNotEmpty()) item(key = "grp-gap-${g.key}") { Box(Modifier.height((sp.section - sp.gap).coerceAtLeast(0).dp)) }
                }

                if (hasMore) {
                    item {
                        Box(Modifier.fillMaxWidth().padding(top = 18.dp), contentAlignment = Alignment.Center) {
                            Text(
                                "Show more (${mainList.size - slice.size} left)", fontSize = 13.sp, color = x.buttonText,
                                modifier = Modifier.clip(RoundedCornerShape(999.dp)).border(1.dp, x.buttonBorder, RoundedCornerShape(999.dp)).clickable { shown += pageSize }.padding(horizontal = 22.dp, vertical = 10.dp),
                            )
                        }
                    }
                }
                item { noticeList("belowList") }
            }
        }
    }
}

// Heading above a group of cards (a category, year, featured section…).
@Composable
private fun SectionHeader(title: String, description: String?, cfg: AudioConfig, modifier: Modifier = Modifier) {
    val a = cfg.page.appearance
    val x = PfaTheme.extras
    val colors = MaterialTheme.colorScheme
    val center = a.headerAlign == "center"
    Column(modifier.fillMaxWidth(), horizontalAlignment = if (center) Alignment.CenterHorizontally else Alignment.Start) {
        when (a.headerStyle) {
            "underline" -> Column {
                Text(title, fontFamily = FontFamily.Serif, fontSize = 18.sp, color = colors.onBackground, modifier = Modifier.padding(bottom = 6.dp))
                Box(Modifier.fillMaxWidth().height(2.dp).background(x.gold))
            }
            "band" -> Text(title, fontFamily = FontFamily.Serif, fontSize = 18.sp, color = colors.onBackground, modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(10.dp)).background(x.chipBg).padding(horizontal = 14.dp, vertical = 9.dp))
            "pill" -> Text(title, fontFamily = FontFamily.Serif, fontSize = 14.sp, color = Color(0xFFFFF8EE), modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Brush.linearGradient(listOf(AccentOrange, AccentBrownDark))).padding(horizontal = 18.dp, vertical = 7.dp))
            else -> Text(title, fontFamily = FontFamily.Serif, fontSize = 18.sp, color = colors.onBackground)
        }
        if (!description.isNullOrEmpty()) Text(description, fontSize = 13.sp, lineHeight = 20.sp, color = x.bodyMuted, textAlign = if (center) TextAlign.Center else TextAlign.Start, modifier = Modifier.padding(top = 6.dp))
    }
}

/** "Play all" / "Add all to queue" / "Add remaining" for whatever list is on screen (PlayAllBar.jsx). */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PlayAllBar(
    items: List<Audio>, filtered: Boolean, player: PlayerUiState,
    onPlayAll: (List<Audio>) -> Int, onAddAll: (List<Audio>) -> Int, onAddRemaining: (List<Audio>) -> Int,
) {
    val x = PfaTheme.extras
    val colors = MaterialTheme.colorScheme
    var message by remember { mutableStateOf("") }
    LaunchedEffect(message) { if (message.isNotEmpty()) { kotlinx.coroutines.delay(2200); message = "" } }
    FlowRow(Modifier.fillMaxWidth().padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "▶ Play all${if (filtered) " filtered" else ""} (${items.size})", fontSize = 13.sp, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold, color = Color(0xFFFFF8EE),
            modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(Brush.linearGradient(listOf(AccentOrange, AccentBrownDark)))
                .clickable { onPlayAll(items); message = "Playing ${items.size}${if (filtered) " filtered" else ""} recording${if (items.size == 1) "" else "s"}" }.padding(horizontal = 16.dp, vertical = 9.dp),
        )
        Text(
            "＋ Add all to queue", fontSize = 13.sp, color = x.buttonText,
            modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(colors.background).border(1.dp, colors.outline, RoundedCornerShape(999.dp))
                .clickable { val n = onAddAll(items); message = if (n > 0) "Added $n to queue" else "Already in your queue" }.padding(horizontal = 14.dp, vertical = 9.dp),
        )
        if (player.current != null) {
            Text(
                "＋ Add remaining", fontSize = 13.sp, color = x.buttonText,
                modifier = Modifier.clip(RoundedCornerShape(999.dp)).background(colors.background).border(1.dp, colors.outline, RoundedCornerShape(999.dp))
                    .clickable { val n = onAddRemaining(items); message = if (n > 0) "Added $n to queue" else "Nothing left to add" }.padding(horizontal = 14.dp, vertical = 9.dp),
            )
        }
        if (message.isNotEmpty()) Text(message, fontSize = 12.sp, color = x.greenFg)
    }
}
