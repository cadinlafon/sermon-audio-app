package com.palousefellowship.audio.ui.navigation


/** Route constants used by NavGraph.kt. Screens reached only by tapping
 * into something (Player, Login, Sign Up, Resource) aren't listed here —
 * only the destinations that need a stable, referenceable route string. */
object Routes {
    const val HOME = "home"
    const val DOCTRINE = "doctrine"
    const val SERMONS = "sermons"
    const val SUNDAY_SCHOOL = "sunday_school"
    const val MORE = "more"
    const val RESOURCES = "resources"
    const val SPOTIFY = "spotify"
    const val SETTINGS = "settings"
    const val PLAYER = "player"
    const val LOGIN = "login"
    const val SIGN_UP = "sign_up"
    const val ABOUT = "about"
    const val CONTACT = "contact"
    const val SEARCH = "search"
    const val SAVED = "saved"
    const val YOUR_LISTENS = "your_listens"
    const val STATS = "stats"
    const val SUGGEST = "suggest"
    const val PLAYLISTS = "playlists"
    const val PLAYLIST_DETAIL = "playlists/{id}"
    const val NOTES = "notes"
    const val NOTE_DETAIL = "notes/{audioId}"
    const val BOOKMARKS = "bookmarks"
    const val DOWNLOADS = "downloads"
    const val FEEDBACK = "feedback"
    const val WHATS_NEW = "whats_new"
    const val GOALS = "goals"
    const val YEAR_IN_REVIEW = "year_in_review"
    const val NOTIFICATIONS = "notifications"
    const val DEV_INFO = "dev_info"
    const val MY_REPORTS = "my_reports"
    const val TRANSCRIPT = "transcript/{audioId}"

    fun playlistDetail(id: String) = "playlists/$id"
    fun noteDetail(audioId: String) = "notes/$audioId"
    fun transcript(audioId: String) = "transcript/$audioId"
}

/** Routes that have a native screen. Page Manager entries pointing anywhere
 * else are left out of the menus. */
val AVAILABLE_ROUTES = setOf(
    Routes.HOME, Routes.DOCTRINE, Routes.SERMONS, Routes.SUNDAY_SCHOOL, Routes.ABOUT, Routes.CONTACT,
    Routes.RESOURCES, Routes.YOUR_LISTENS, Routes.SAVED, Routes.NOTES, Routes.BOOKMARKS, Routes.PLAYLISTS,
    Routes.DOWNLOADS, Routes.STATS, Routes.SUGGEST, Routes.SETTINGS,
    Routes.FEEDBACK, Routes.WHATS_NEW, Routes.GOALS, Routes.YEAR_IN_REVIEW,
)
