package com.palousefellowship.audio.data.config

import com.google.firebase.Timestamp
import com.palousefellowship.audio.ui.navigation.Routes

/**
 * Port of src/pageRegistry.js + src/lib/pageManager.js. The registry is the
 * single source of truth for which pages the admin Page Manager controls;
 * Firestore `pages/{id}` only stores overrides on top of these defaults.
 *
 * `nativeRoute` is where the page lives in this app (null = the web page has
 * no native screen yet, so it's left out of the menus).
 */
data class PageRegistryEntry(
    val id: String,
    val nativeRoute: String?,
    val defaultName: String,
    val defaultIcon: String,
    val description: String,
    val navSlot: String?,       // primary | more | account | null
    val defaultOrder: Int,
    val defaultRequireLogin: Boolean = false,
)

val PAGE_REGISTRY = listOf(
    PageRegistryEntry("home", Routes.HOME, "Home", "/navigation/home.png", "The main landing page with notices and quick links.", "primary", 0),
    PageRegistryEntry("doctrine", Routes.DOCTRINE, "Doctrine", "📖", "Weekly memorization, recordings, and doctrine campaign info.", "primary", 1),
    PageRegistryEntry("sermons", Routes.SERMONS, "Sermons", "/navigation/sermons.png", "Browse and listen to sermon recordings.", "primary", 2),
    PageRegistryEntry("sundayschool", Routes.SUNDAY_SCHOOL, "Sunday School", "/navigation/sundayschool.png", "Sunday school recordings and materials.", "primary", 3),
    PageRegistryEntry("about", Routes.ABOUT, "About", "ℹ️", "About the app and Palouse Fellowship.", "more", 0),
    PageRegistryEntry("feedback", Routes.FEEDBACK, "Feedback", "💬", "Send feedback about the app.", "more", 1),
    PageRegistryEntry("contact", Routes.CONTACT, "Contact", "✉️", "Contact information for the church.", "more", 2),
    PageRegistryEntry("resources", Routes.RESOURCES, "Resources", "📚", "A library of sermons, studies, and helpful content.", "more", 3),
    PageRegistryEntry("whats-new", Routes.WHATS_NEW, "What's New", "🆕", "Recent updates and improvements to the app.", "more", 4),
    PageRegistryEntry("your-listens", Routes.YOUR_LISTENS, "Your Listens", "🎧", "A history of what you've listened to.", "account", 0, true),
    PageRegistryEntry("saved", Routes.SAVED, "Liked Sermons", "❤️", "Sermons and recordings you've liked.", "account", 1, true),
    PageRegistryEntry("goals", Routes.GOALS, "Goals", "🎯", "Listening goals and streaks.", "account", 2, true),
    PageRegistryEntry("year-in-review", Routes.YEAR_IN_REVIEW, "Year in Review", "🎁", "Your year of listening, with a shareable card.", "account", 2, true),
    PageRegistryEntry("notes", Routes.NOTES, "Notes", "📝", "Everything you've written while listening.", "account", 2, true),
    PageRegistryEntry("bookmarks", Routes.BOOKMARKS, "Bookmarks", "🔖", "Moments you've saved in recordings.", "account", 2, true),
    PageRegistryEntry("playlists", Routes.PLAYLISTS, "Playlists", "🎶", "Your own collections of recordings.", "account", 2, true),
    PageRegistryEntry("downloads", Routes.DOWNLOADS, "Downloads", "⬇️", "Audio saved on this device for offline listening.", "account", 2, true),
    PageRegistryEntry("stats", Routes.STATS, "Stats", "📊", "Your personal listening stats.", "account", 2, true),
    PageRegistryEntry("suggest", Routes.SUGGEST, "Suggest Feature", "💡", "Suggest a new feature for the app.", "account", 3, true),
    PageRegistryEntry("settings", Routes.SETTINGS, "Settings", "⚙️", "Account and app settings.", "account", 4, true),
)

data class BadgeColors(val bg: Long, val fg: Long)

val BADGE_COLORS = mapOf(
    "amber" to BadgeColors(0xFFF6E4B0, 0xFF7A5A10),
    "green" to BadgeColors(0xFFDCFCE7, 0xFF166534),
    "red" to BadgeColors(0xFFFEE2E2, 0xFF991B1B),
    "blue" to BadgeColors(0xFFE8F0FE, 0xFF2A5AB5),
    "purple" to BadgeColors(0xFFEEE8FF, 0xFF6547A5),
    "gray" to BadgeColors(0xFFE9E4D9, 0xFF4B5563),
)

data class PageSchedule(val type: String, val value: String?, val runAtMillis: Long?)

/** The effective (schedules applied) configuration of one page. */
data class PageConfig(
    val id: String,
    val nativeRoute: String?,
    val defaultName: String,
    val name: String,
    val navLabel: String,
    val description: String,
    val icon: String,
    val navSlot: String?,
    val enabled: Boolean,
    val status: String,
    val showInNavigation: Boolean,
    val badgeEnabled: Boolean,
    val badgeText: String,
    val badgeColor: String,
    val pinned: Boolean,
    val order: Int,
    val accessLevel: String,
    val requiredRole: String,
    val requireLogin: Boolean,
    val allowUids: Set<String>,
    val denyUids: Set<String>,
    val maintenanceTitle: String,
    val maintenanceMessage: String,
    val comingSoonTitle: String,
    val comingSoonMessage: String,
    val comingSoonBadge: String,
    val maintenanceUntilMillis: Long?,
    val releaseDateMillis: Long?,
    val schedules: List<PageSchedule>,
) {
    val displayName: String get() = navLabel.trim().ifEmpty { name.trim() }.ifEmpty { defaultName }
    val isVisibleInNav: Boolean get() = enabled && status != "hidden" && showInNavigation
    val locked: Boolean get() = status == "locked"
}

private fun Any?.str(): String = (this as? String) ?: ""
private fun Any?.bool(default: Boolean): Boolean = (this as? Boolean) ?: default
private fun Any?.int(default: Int): Int = (this as? Number)?.toInt() ?: default

private fun Any?.millis(): Long? = when (this) {
    is Timestamp -> toDate().time
    is java.util.Date -> time
    is Number -> toLong()
    else -> null
}

@Suppress("UNCHECKED_CAST")
private fun Any?.uidSet(): Set<String> =
    (this as? List<Map<String, Any?>>)?.mapNotNull { it["uid"] as? String }?.toSet() ?: emptySet()

/** buildDefaultConfig + mergeBaseConfig + applySchedules in one pass. */
@Suppress("UNCHECKED_CAST")
fun effectivePage(entry: PageRegistryEntry, data: Map<String, Any?>?, now: Long = System.currentTimeMillis()): PageConfig {
    val d = data ?: emptyMap()
    val overrides = d["userOverrides"] as? Map<String, Any?>
    val schedules = (d["schedules"] as? List<Map<String, Any?>>)?.map {
        PageSchedule(it["type"].str(), it["value"] as? String, it["runAt"].millis())
    } ?: emptyList()

    var enabled = d["enabled"].bool(true)
    var status = d["status"].str().ifEmpty { "active" }
    var showInNav = d["showInNavigation"].bool(entry.navSlot != null)
    var badgeEnabled = d["badgeEnabled"].bool(false)
    var badgeText = d["badgeText"].str()

    schedules.filter { it.runAtMillis != null && it.runAtMillis <= now }
        .sortedBy { it.runAtMillis }
        .forEach { s ->
            when (s.type) {
                "status" -> if (!s.value.isNullOrEmpty()) status = s.value
                "lock" -> status = "locked"
                "unlock" -> status = "active"
                "enable" -> enabled = true
                "disable" -> enabled = false
                "show-nav" -> showInNav = true
                "hide-nav" -> showInNav = false
                "add-badge" -> { badgeEnabled = true; if (!s.value.isNullOrEmpty()) badgeText = s.value }
                "remove-badge" -> badgeEnabled = false
            }
        }

    val defaultAccess = if (entry.defaultRequireLogin) "loggedIn" else "public"
    return PageConfig(
        id = entry.id,
        nativeRoute = entry.nativeRoute,
        defaultName = entry.defaultName,
        name = d["name"].str().ifEmpty { entry.defaultName },
        navLabel = d["navLabel"].str(),
        description = d["description"].str().ifEmpty { entry.description },
        icon = d["icon"].str().ifEmpty { entry.defaultIcon },
        navSlot = entry.navSlot,
        enabled = enabled,
        status = status,
        showInNavigation = showInNav,
        badgeEnabled = badgeEnabled,
        badgeText = badgeText,
        badgeColor = d["badgeColor"].str().ifEmpty { "amber" },
        pinned = d["pinned"].bool(false),
        order = d["order"].int(entry.defaultOrder),
        accessLevel = d["accessLevel"].str().ifEmpty { defaultAccess },
        requiredRole = d["requiredRole"].str(),
        requireLogin = d["requireLogin"].bool(entry.defaultRequireLogin),
        allowUids = overrides?.get("allow").uidSet() ?: emptySet(),
        denyUids = overrides?.get("deny").uidSet() ?: emptySet(),
        maintenanceTitle = d["maintenanceTitle"].str(),
        maintenanceMessage = d["maintenanceMessage"].str(),
        comingSoonTitle = d["comingSoonTitle"].str(),
        comingSoonMessage = d["comingSoonMessage"].str(),
        comingSoonBadge = d["comingSoonBadge"].str(),
        maintenanceUntilMillis = d["maintenanceUntil"].millis(),
        releaseDateMillis = d["releaseDate"].millis(),
        schedules = schedules,
    )
}

fun sortForNavigation(pages: List<PageConfig>): List<PageConfig> =
    pages.sortedWith(
        compareByDescending<PageConfig> { it.pinned }
            .thenBy { it.order }
            .thenBy { it.defaultName },
    )

enum class PageDecision { OK, LOGIN_REQUIRED, ACCESS_DENIED, DISABLED, MAINTENANCE, COMING_SOON, LOCKED }

/** resolvePageAccess from pageManager.js — used by both the nav and the route guard. */
fun resolvePageAccess(config: PageConfig?, uid: String?, role: String?, isAdmin: Boolean): PageDecision {
    if (config == null || isAdmin) return PageDecision.OK
    if (uid != null && uid in config.denyUids) return PageDecision.ACCESS_DENIED
    val individualAllow = uid != null && uid in config.allowUids
    val needsLogin = config.requireLogin || config.accessLevel != "public"
    if (needsLogin && uid == null && !individualAllow) return PageDecision.LOGIN_REQUIRED
    if (!individualAllow && config.accessLevel == "role") {
        val required = config.requiredRole.ifEmpty { "admin" }.lowercase()
        if ((role ?: "").lowercase() != required) return PageDecision.ACCESS_DENIED
    }
    if (!config.enabled) return PageDecision.DISABLED
    return when (config.status) {
        "maintenance" -> PageDecision.MAINTENANCE
        "coming-soon" -> PageDecision.COMING_SOON
        "locked" -> PageDecision.LOCKED
        else -> PageDecision.OK
    }
}
