package com.palousefellowship.audio.data.config

/**
 * Port of src/data/audioPageDefaults.js: everything the admin "Audio Page
 * Manager" controls, stored as ONE `audioPages` map on appConfig/status.
 * Whatever is stored (older, partial, hand-edited) is coerced into a valid,
 * complete object, so a bad value can never break a page — and nothing saved
 * reproduces the pages as they looked before the manager existed.
 */
val SORT_OPTIONS = listOf(
    "newest" to "Newest first", "oldest" to "Oldest first", "shortest" to "Shortest → longest",
    "longest" to "Longest → shortest", "title" to "Title A–Z", "speaker" to "Speaker A–Z",
)
val DURATIONS = listOf("any" to "Any length", "short" to "Under 15 min", "medium" to "15–30 min", "long" to "30–60 min", "xl" to "Over 60 min")
val STATUSES = listOf("all" to "Any progress", "unstarted" to "Not started", "in-progress" to "In progress", "completed" to "Completed")
val MONTHS = listOf("January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December")

val PRIMARY_BUTTON_IDS = listOf("play", "playNext", "more")
val MORE_BUTTON_IDS = listOf("transcript", "copyLink", "share", "playlist", "download")
val CARD_DETAIL_IDS = listOf("categoryTag", "newBadge", "durationBadge", "downloadedBadge", "speaker", "date", "series", "progressBar", "likeButton", "aiSummary")
val SEARCH_FIELD_IDS = listOf("title", "speaker", "series", "summary", "date")
val FILTER_IDS = listOf("category", "speaker", "date", "series", "length", "progress", "liked", "downloaded")
val PAGE_SIZES = listOf(10, 20, 30, 50)
val SKIP_CHOICES = listOf(10, 15, 30, 45, 60)
val SPEED_CHOICES = listOf(0.75, 1.0, 1.25, 1.5, 1.75, 2.0)

val PAGE_KEYS = listOf("sermons", "sundayschool")

data class PageMeta(val label: String, val categories: List<String>, val defaultTitle: String, val defaultSort: String)

val PAGE_META = mapOf(
    "sermons" to PageMeta("Sermons & Homilies", listOf("sermon", "homily"), "Sermons & Homilies", "newest"),
    "sundayschool" to PageMeta("Sunday School", listOf("sundayschool"), "Sunday School", "oldest"),
)

data class AudioCategory(
    val id: String, val name: String, val plural: String, val icon: String,
    val description: String, val visible: Boolean, val defaultSort: String,
)

val DEFAULT_CATEGORIES = listOf(
    AudioCategory("sermon", "Sermon", "Sermons", "", "", true, ""),
    AudioCategory("homily", "Homily", "Homilies", "", "", true, ""),
    AudioCategory("sundayschool", "Sunday School", "Sunday School", "", "", true, ""),
)

data class PinnedItem(val id: String, val expiresAt: String)
data class FeaturedSeries(val enabled: Boolean, val name: String, val title: String)
data class FeaturedRecent(val enabled: Boolean, val title: String, val count: Int, val days: Int)
data class FeaturedPopular(val enabled: Boolean, val title: String, val count: Int, val ids: List<String>)
data class FeaturedCollection(val id: String, val title: String, val ids: List<String>, val enabled: Boolean, val expiresAt: String)
data class FeaturedConfig(
    val enabled: Boolean, val title: String, val pinned: List<PinnedItem>,
    val series: FeaturedSeries, val recent: FeaturedRecent, val popular: FeaturedPopular, val collections: List<FeaturedCollection>,
)

data class LayoutConfig(val defaultSort: String, val defaultView: String, val cardLayout: String, val defaultExpanded: Boolean, val groupBy: String)
data class CardConfig(
    val buttonOrder: List<String>, val moreOrder: List<String>,
    val buttons: Map<String, Boolean>, val details: Map<String, Boolean>,
)
data class BannerConfig(val url: String, val focusX: Float, val focusY: Float, val zoom: Float, val height: Int, val size: Int, val align: String)
data class AppearanceConfig(
    val title: String, val subtitle: String, val banner: BannerConfig, val headerStyle: String, val headerAlign: String,
    val showCategoryDescriptions: Boolean, val defaultCategory: String,
    val emptyMessage: String, val noResultsMessage: String, val loadingMessage: String, val spacing: String,
)
data class SearchConfig(
    val enabled: Boolean, val placeholder: String, val fields: Map<String, Boolean>, val filters: Map<String, Boolean>,
    val rememberFilters: Boolean, val filtersOpenByDefault: Boolean,
)
data class PaginationConfig(val mode: String, val size: Int)

data class AudioPageConfig(
    val layout: LayoutConfig, val card: CardConfig, val appearance: AppearanceConfig,
    val featured: FeaturedConfig, val search: SearchConfig, val pagination: PaginationConfig,
)

data class PlaybackConfig(
    val defaultSpeed: Double, val rememberSpeed: Boolean, val rememberPosition: Boolean, val autoPlayNext: Boolean,
    val showProgress: Boolean, val backgroundPlayback: Boolean, val playerStyle: String, val skipBack: Int, val skipForward: Int,
    val outroEnabled: Boolean, val outroAudioUrl: String, val outroStorageKey: String, val outroFileName: String, val outroTitle: String,
)

data class AdvancedConfig(
    val downloadsEnabled: Boolean, val downloadsUser: Boolean, val downloadsAdmin: Boolean,
    val quality: String, val sharingEnabled: Boolean, val sharingText: String, val favorites: Boolean, val animations: String,
)

/** Resolved config for one audio page — what screens read. */
data class AudioConfig(
    val pageKey: String,
    val page: AudioPageConfig,
    val categories: List<AudioCategory>,
    val featuredCategory: String,
    val playback: PlaybackConfig,
    val advanced: AdvancedConfig,
) {
    fun category(id: String) = categories.firstOrNull { it.id == id }
}

// ─────────────────────────── sanitizing helpers ───────────────────────────

private fun Any?.obj(): Map<*, *> = (this as? Map<*, *>) ?: emptyMap<Any?, Any?>()
private fun Map<*, *>.str(k: String, fallback: String = "", max: Int = 300): String = (this[k] as? String)?.take(max) ?: fallback
private fun Map<*, *>.bool(k: String, fallback: Boolean): Boolean = (this[k] as? Boolean) ?: fallback
private fun Map<*, *>.num(k: String, lo: Double, hi: Double, fallback: Double): Double {
    val n = (this[k] as? Number)?.toDouble() ?: (this[k] as? String)?.toDoubleOrNull()
    return if (n != null && n.isFinite()) n.coerceIn(lo, hi) else fallback
}
private fun Map<*, *>.oneOf(k: String, allowed: Collection<String>, fallback: String): String = (this[k] as? String)?.takeIf { it in allowed } ?: fallback
private fun Map<*, *>.boolMap(defaults: Map<String, Boolean>): Map<String, Boolean> = defaults.mapValues { (k, d) -> bool(k, d) }
private fun dateStr(v: Any?): String = (v as? String)?.takeIf { Regex("""^\d{4}-\d{2}-\d{2}$""").matches(it) } ?: ""
private fun idList(v: Any?, max: Int = 60): List<String> = ((v as? List<*>) ?: emptyList<Any?>()).filterIsInstance<String>().filter { it.isNotEmpty() }.take(max)

/** Keep a saved ordering, drop unknown ids, append any new ids at the end. */
private fun orderOf(stored: Any?, allIds: List<String>): List<String> {
    val seen = LinkedHashSet<String>()
    ((stored as? List<*>) ?: emptyList<Any?>()).forEach { if (it is String && it in allIds) seen.add(it) }
    allIds.forEach { seen.add(it) }
    return seen.toList()
}

private fun defaultPage(key: String): AudioPageConfig = sanitizePage(key, null)

private val DEFAULT_BUTTONS = mapOf("playNext" to true, "more" to true, "transcript" to true, "copyLink" to true, "share" to true, "playlist" to true, "download" to true)
private val DEFAULT_DETAILS = mapOf(
    "categoryTag" to true, "newBadge" to true, "durationBadge" to true, "downloadedBadge" to true, "speaker" to true, "date" to false,
    "series" to false, "progressBar" to true, "likeButton" to true, "aiSummary" to true,
)
private val DEFAULT_FIELDS = mapOf("title" to true, "speaker" to true, "series" to false, "summary" to false, "date" to false)
private val DEFAULT_FILTERS = FILTER_IDS.associateWith { true }

fun sanitizePage(key: String, stored: Any?): AudioPageConfig {
    val s = stored.obj()
    val L = s["layout"].obj(); val C = s["card"].obj(); val A = s["appearance"].obj(); val B = A["banner"].obj()
    val F = s["featured"].obj(); val S = s["search"].obj(); val P = s["pagination"].obj()
    val sortIds = SORT_OPTIONS.map { it.first }
    val meta = PAGE_META.getValue(key)

    val pinned = ((F["pinned"] as? List<*>) ?: emptyList<Any?>()).mapNotNull { p ->
        val m = p.obj(); val id = m["id"] as? String
        if (id.isNullOrEmpty()) null else PinnedItem(id, dateStr(m["expiresAt"]))
    }.take(30)
    val fs = F["series"].obj(); val fr = F["recent"].obj(); val fp = F["popular"].obj()
    val collections = ((F["collections"] as? List<*>) ?: emptyList<Any?>()).mapNotNull { c ->
        val m = c.obj(); val id = m["id"] as? String ?: return@mapNotNull null
        FeaturedCollection(id, m.str("title", "Collection", 60).ifEmpty { "Collection" }, idList(m["ids"], 30), m.bool("enabled", true), dateStr(m["expiresAt"]))
    }.take(6)

    return AudioPageConfig(
        layout = LayoutConfig(
            defaultSort = L.oneOf("defaultSort", sortIds, meta.defaultSort),
            defaultView = L.oneOf("defaultView", listOf("list", "grid"), "list"),
            cardLayout = L.oneOf("cardLayout", listOf("compact", "comfortable", "spacious"), "comfortable"),
            defaultExpanded = L.bool("defaultExpanded", false),
            groupBy = L.oneOf("groupBy", listOf("none", "category", "year", "month"), "none"),
        ),
        card = CardConfig(
            buttonOrder = orderOf(C["buttonOrder"], PRIMARY_BUTTON_IDS),
            moreOrder = orderOf(C["moreOrder"], MORE_BUTTON_IDS),
            buttons = C["buttons"].obj().boolMap(DEFAULT_BUTTONS),
            details = C["details"].obj().boolMap(DEFAULT_DETAILS),
        ),
        appearance = AppearanceConfig(
            title = A.str("title", "", 80),
            subtitle = A.str("subtitle", "", 200),
            banner = BannerConfig(
                url = (B["url"] as? String)?.takeIf { Regex("^(https?://|/)").containsMatchIn(it) }?.take(600) ?: "",
                focusX = B.num("focusX", 0.0, 100.0, 50.0).toFloat(),
                focusY = B.num("focusY", 0.0, 100.0, 50.0).toFloat(),
                zoom = B.num("zoom", 1.0, 3.0, 1.0).toFloat(),
                height = B.num("height", 120.0, 360.0, 200.0).toInt(),
                size = B.num("size", 30.0, 100.0, 100.0).toInt(),
                align = B.oneOf("align", listOf("left", "center", "right"), "center"),
            ),
            headerStyle = A.oneOf("headerStyle", listOf("plain", "underline", "band", "pill"), "plain"),
            headerAlign = A.oneOf("headerAlign", listOf("left", "center"), "left"),
            showCategoryDescriptions = A.bool("showCategoryDescriptions", true),
            defaultCategory = A.str("defaultCategory", "all", 30).ifEmpty { "all" },
            emptyMessage = A.str("emptyMessage", "", 200),
            noResultsMessage = A.str("noResultsMessage", "", 200),
            loadingMessage = A.str("loadingMessage", "", 120),
            spacing = A.oneOf("spacing", listOf("tight", "normal", "relaxed"), "normal"),
        ),
        featured = FeaturedConfig(
            enabled = F.bool("enabled", false),
            title = F.str("title", "Featured", 60).ifEmpty { "Featured" },
            pinned = pinned,
            series = FeaturedSeries(fs.bool("enabled", false), fs.str("name", "", 100), fs.str("title", "", 60)),
            recent = FeaturedRecent(fr.bool("enabled", false), fr.str("title", "Recently added", 60).ifEmpty { "Recently added" }, fr.num("count", 1.0, 12.0, 3.0).toInt(), fr.num("days", 1.0, 365.0, 30.0).toInt()),
            popular = FeaturedPopular(fp.bool("enabled", false), fp.str("title", "Most played", 60).ifEmpty { "Most played" }, fp.num("count", 1.0, 12.0, 3.0).toInt(), idList(fp["ids"], 12)),
            collections = collections,
        ),
        search = SearchConfig(
            enabled = S.bool("enabled", true),
            placeholder = S.str("placeholder", "", 80),
            fields = S["fields"].obj().boolMap(DEFAULT_FIELDS),
            filters = S["filters"].obj().boolMap(DEFAULT_FILTERS),
            rememberFilters = S.bool("rememberFilters", true),
            filtersOpenByDefault = S.bool("filtersOpenByDefault", false),
        ),
        pagination = PaginationConfig(
            mode = P.oneOf("mode", listOf("all", "loadMore"), "all"),
            size = (P["size"] as? Number)?.toInt()?.takeIf { it in PAGE_SIZES } ?: 20,
        ),
    )
}

fun sanitizeCategories(stored: Any?): List<AudioCategory> {
    val list = (stored as? List<*>) ?: emptyList<Any?>()
    val byId = list.mapNotNull { c -> c.obj().let { m -> (m["id"] as? String)?.let { it to m } } }.toMap()
    val ids = orderOf(list.map { (it.obj()["id"]) }, DEFAULT_CATEGORIES.map { it.id })
    val sortIds = SORT_OPTIONS.map { it.first }
    return ids.map { id ->
        val d = DEFAULT_CATEGORIES.first { it.id == id }
        val c = byId[id] ?: emptyMap<Any?, Any?>()
        AudioCategory(
            id = id,
            name = c.str("name", d.name, 40).ifEmpty { d.name },
            plural = c.str("plural", d.plural, 40).ifEmpty { d.plural },
            icon = c.str("icon", "", 8),
            description = c.str("description", "", 300),
            visible = c.bool("visible", true),
            defaultSort = c.oneOf("defaultSort", listOf("") + sortIds, ""),
        )
    }
}

fun sanitizePlayback(stored: Any?): PlaybackConfig {
    val s = stored.obj()
    return PlaybackConfig(
        defaultSpeed = (s["defaultSpeed"] as? Number)?.toDouble()?.takeIf { it in SPEED_CHOICES } ?: 1.0,
        rememberSpeed = s.bool("rememberSpeed", true),
        rememberPosition = s.bool("rememberPosition", true),
        autoPlayNext = s.bool("autoPlayNext", true),
        showProgress = s.bool("showProgress", true),
        backgroundPlayback = s.bool("backgroundPlayback", true),
        playerStyle = s.oneOf("playerStyle", listOf("standard", "compact", "minimal"), "standard"),
        skipBack = (s["skipBack"] as? Number)?.toInt()?.takeIf { it in SKIP_CHOICES } ?: 30,
        skipForward = (s["skipForward"] as? Number)?.toInt()?.takeIf { it in SKIP_CHOICES } ?: 30,
        outroEnabled = s.bool("outroEnabled", false),
        outroAudioUrl = (s["outroAudioUrl"] as? String)?.takeIf { Regex("^(https?://|/)").containsMatchIn(it) }?.take(600) ?: "",
        outroStorageKey = (s["outroStorageKey"] as? String)?.takeIf { Regex("^images/[A-Za-z0-9._/-]{1,500}$").matches(it) && !it.contains("..") } ?: "",
        outroFileName = s.str("outroFileName", "", 160),
        outroTitle = s.str("outroTitle", "Thank You – PF Audio App", 80).ifEmpty { "Thank You – PF Audio App" },
    )
}

fun sanitizeAdvanced(stored: Any?): AdvancedConfig {
    val s = stored.obj(); val d = s["downloads"].obj(); val dr = d["roles"].obj(); val sh = s["sharing"].obj()
    return AdvancedConfig(
        downloadsEnabled = d.bool("enabled", true),
        downloadsUser = dr.bool("user", true),
        downloadsAdmin = dr.bool("admin", true),
        quality = s.oneOf("quality", listOf("high", "saver"), "high"),
        sharingEnabled = sh.bool("enabled", true),
        sharingText = sh.str("text", "Listen to “{title}” by {speaker} — Palouse Fellowship", 200).ifEmpty { "Listen to “{title}” by {speaker} — Palouse Fellowship" },
        favorites = s.bool("favorites", true),
        animations = s.oneOf("animations", listOf("none", "subtle", "lively"), "subtle"),
    )
}

fun resolveAudioConfig(stored: Map<String, Any?>?, pageKey: String = "sermons"): AudioConfig {
    val s: Map<*, *> = stored ?: emptyMap<Any?, Any?>()
    val categories = sanitizeCategories(s["categories"])
    val featuredCategory = (s["featuredCategory"] as? String)?.takeIf { id -> categories.any { it.id == id } } ?: ""
    val key = if (pageKey in PAGE_KEYS) pageKey else "sermons"
    return AudioConfig(
        pageKey = key,
        page = sanitizePage(key, s["pages"].obj()[key]),
        categories = categories,
        featuredCategory = featuredCategory,
        playback = sanitizePlayback(s["playback"]),
        advanced = sanitizeAdvanced(s["advanced"]),
    )
}
