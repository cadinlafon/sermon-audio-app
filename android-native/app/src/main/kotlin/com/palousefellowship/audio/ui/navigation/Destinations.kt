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
    const val HOMILIES = "homilies"
    const val RESOURCES = "resources"
    const val SPOTIFY = "spotify"
    const val SETTINGS = "settings"
    const val PLAYER = "player"
    const val LOGIN = "login"
    const val SIGN_UP = "sign_up"
}

data class BottomNavItem(val route: String, val label: String, val icon: ImageVector)

// Same order as the web app's PAGE_REGISTRY primary-slot defaultOrder
// (home, doctrine, sermons, sundayschool), with a fifth "More" tab for
// everything the web keeps in its top-bar "more" menu.
val BottomNavItems = listOf(
    BottomNavItem(Routes.HOME, "Home", Icons.Filled.Home),
    BottomNavItem(Routes.DOCTRINE, "Doctrine", Icons.Filled.MenuBook),
    BottomNavItem(Routes.SERMONS, "Sermons", Icons.Filled.RecordVoiceOver),
    BottomNavItem(Routes.SUNDAY_SCHOOL, "Sunday School", Icons.Filled.School),
    BottomNavItem(Routes.MORE, "More", Icons.Filled.MoreHoriz),
)
