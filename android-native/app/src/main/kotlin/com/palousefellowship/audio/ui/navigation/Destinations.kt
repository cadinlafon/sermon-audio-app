package com.palousefellowship.audio.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.MoreHoriz
import androidx.compose.material.icons.filled.RecordVoiceOver
import androidx.compose.material.icons.filled.School
import androidx.compose.ui.graphics.vector.ImageVector

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

    fun playlistDetail(id: String) = "playlists/$id"
    fun noteDetail(audioId: String) = "notes/$audioId"
}

data class BottomNavItem(val route: String, val label: String, val icon: ImageVector)

// Same order as the web app's PAGE_REGISTRY primary-slot defaultOrder
// (home, doctrine, sermons, sundayschool), with a fifth "More" tab for
// everything the web keeps in its top-bar "more" menu / account dropdown.
val BottomNavItems = listOf(
    BottomNavItem(Routes.HOME, "Home", Icons.Filled.Home),
    BottomNavItem(Routes.DOCTRINE, "Doctrine", Icons.Filled.MenuBook),
    BottomNavItem(Routes.SERMONS, "Sermons", Icons.Filled.RecordVoiceOver),
    BottomNavItem(Routes.SUNDAY_SCHOOL, "Sunday School", Icons.Filled.School),
    BottomNavItem(Routes.MORE, "More", Icons.Filled.MoreHoriz),
)
