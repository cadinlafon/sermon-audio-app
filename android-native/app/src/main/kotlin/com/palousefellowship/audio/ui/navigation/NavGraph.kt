package com.palousefellowship.audio.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.DoctrineAudioFile
import com.palousefellowship.audio.data.model.DoctrineContent
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.screens.audiolist.AudioListScreen
import com.palousefellowship.audio.ui.screens.auth.LoginScreen
import com.palousefellowship.audio.ui.screens.auth.SignUpScreen
import com.palousefellowship.audio.ui.screens.doctrine.DoctrineScreen
import com.palousefellowship.audio.ui.screens.home.HomeScreen
import com.palousefellowship.audio.ui.screens.more.MoreScreen
import com.palousefellowship.audio.ui.screens.player.PlayerScreen
import com.palousefellowship.audio.ui.screens.resources.ResourcesScreen
import com.palousefellowship.audio.ui.screens.settings.SettingsScreen
import com.palousefellowship.audio.ui.screens.spotify.SpotifyScreen

/** A resource with an audioStorageKey (type == "audio") is played through
 * the same in-app player as everything else — there is no `Audio`
 * Firestore doc backing it, so a lightweight synthetic one is built here. */
private fun Resource.asAudio() = Audio(
    id = "resource_$id",
    title = title,
    speaker = author,
    type = "resource",
    duration = duration ?: 0,
    audioStorageKey = audioStorageKey ?: "",
)

// Notices can carry an admin-configured "page" button pointing at one of
// the WEB app's routes (e.g. "/sundayschool"). Only a subset of those
// pages exist natively — an unrecognized one is ignored rather than
// crashing NavHost with an unknown-destination exception.
private val WEB_ROUTE_TO_NATIVE = mapOf(
    "/" to Routes.HOME,
    "/home" to Routes.HOME,
    "/doctrine" to Routes.DOCTRINE,
    "/sermons" to Routes.SERMONS,
    "/sundayschool" to Routes.SUNDAY_SCHOOL,
    "/homilies" to Routes.HOMILIES,
    "/resources" to Routes.RESOURCES,
    "/settings" to Routes.SETTINGS,
)

private fun DoctrineAudioFile.asAudio(content: DoctrineContent) = Audio(
    id = "doctrine_$id",
    title = label.ifBlank { content.title },
    speaker = content.speaker,
    type = "doctrine",
    duration = 0,
    audioStorageKey = audioStorageKey,
)

@Composable
fun PfaNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    playerState: PlayerUiState,
    onPlay: (Audio, List<Audio>) -> Unit,
) {
    NavHost(navController = navController, startDestination = Routes.HOME, modifier = modifier) {
        composable(Routes.HOME) {
            HomeScreen(
                onPlayLatest = { onPlay(it, listOf(it)) },
                onNavigateRoute = { route -> WEB_ROUTE_TO_NATIVE[route]?.let(navController::navigate) },
            )
        }
        composable(Routes.DOCTRINE) {
            DoctrineScreen(onPlayDoctrineAudio = { file, content -> onPlay(file.asAudio(content), emptyList()) })
        }
        composable(Routes.SERMONS) {
            AudioListScreen(
                title = "Sermons",
                emptyIcon = "🎙️",
                emptyMessage = "No sermons have been posted yet.",
                types = listOf(Audio.TYPE_SERMON),
                playerState = playerState,
                onPlay = onPlay,
            )
        }
        composable(Routes.SUNDAY_SCHOOL) {
            AudioListScreen(
                title = "Sunday School",
                emptyIcon = "🏫",
                emptyMessage = "No Sunday School recordings have been posted yet.",
                types = listOf(Audio.TYPE_SUNDAY_SCHOOL),
                playerState = playerState,
                onPlay = onPlay,
            )
        }
        composable(Routes.HOMILIES) {
            AudioListScreen(
                title = "Homilies",
                emptyIcon = "📜",
                emptyMessage = "No homilies have been posted yet.",
                types = listOf(Audio.TYPE_HOMILY),
                playerState = playerState,
                onPlay = onPlay,
            )
        }
        composable(Routes.MORE) {
            MoreScreen(onNavigate = { navController.navigate(it) })
        }
        composable(Routes.RESOURCES) {
            ResourcesScreen(
                title = "Resources",
                typeFilter = null,
                emptyIcon = "📚",
                emptyMessage = "No resources have been added yet.",
                onPlayAudioResource = { onPlay(it.asAudio(), emptyList()) },
            )
        }
        composable(Routes.SPOTIFY) {
            SpotifyScreen(onPlayAudioResource = { onPlay(it.asAudio(), emptyList()) })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(onSignInRequired = { navController.navigate(Routes.LOGIN) })
        }
        composable(Routes.PLAYER) {
            PlayerScreen(onBack = { navController.popBackStack() })
        }
        composable(Routes.LOGIN) {
            LoginScreen(
                onSignedIn = { navController.popBackStack() },
                onGoToSignUp = { navController.navigate(Routes.SIGN_UP) },
            )
        }
        composable(Routes.SIGN_UP) {
            SignUpScreen(
                onSignedUp = { navController.popBackStack() },
                onGoToLogin = { navController.popBackStack() },
            )
        }
    }
}
