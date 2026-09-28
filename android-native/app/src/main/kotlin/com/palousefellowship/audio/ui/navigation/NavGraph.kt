package com.palousefellowship.audio.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.DoctrineAudioFile
import com.palousefellowship.audio.data.model.DoctrineContent
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.player.PlayerUiState
import com.palousefellowship.audio.ui.screens.about.AboutScreen
import com.palousefellowship.audio.ui.screens.audiolist.AudioListScreen
import com.palousefellowship.audio.ui.screens.auth.LoginScreen
import com.palousefellowship.audio.ui.screens.auth.SignUpScreen
import com.palousefellowship.audio.ui.screens.contact.ContactScreen
import com.palousefellowship.audio.ui.screens.doctrine.DoctrineScreen
import com.palousefellowship.audio.ui.screens.downloads.DownloadsScreen
import com.palousefellowship.audio.ui.screens.home.HomeScreen
import com.palousefellowship.audio.ui.screens.more.MoreScreen
import com.palousefellowship.audio.ui.screens.notes.BookmarksScreen
import com.palousefellowship.audio.ui.screens.notes.NoteDetailScreen
import com.palousefellowship.audio.ui.screens.notes.NotesScreen
import com.palousefellowship.audio.ui.screens.player.PlayerScreen
import com.palousefellowship.audio.ui.screens.playlists.PlaylistDetailScreen
import com.palousefellowship.audio.ui.screens.playlists.PlaylistsScreen
import com.palousefellowship.audio.ui.screens.resources.ResourcesScreen
import com.palousefellowship.audio.ui.screens.saved.SavedScreen
import com.palousefellowship.audio.ui.screens.search.SearchScreen
import com.palousefellowship.audio.ui.screens.settings.SettingsScreen
import com.palousefellowship.audio.ui.screens.spotify.SpotifyScreen
import com.palousefellowship.audio.ui.screens.stats.StatsScreen
import com.palousefellowship.audio.ui.screens.suggest.SuggestScreen
import com.palousefellowship.audio.ui.screens.yourlistens.YourListensScreen
import com.palousefellowship.audio.util.openInSpotify

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

private fun DoctrineAudioFile.asAudio(content: DoctrineContent) = Audio(
    id = "doctrine_$id",
    title = label.ifBlank { content.title },
    speaker = content.speaker,
    type = "doctrine",
    duration = 0,
    audioStorageKey = audioStorageKey,
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
    "/resources" to Routes.RESOURCES,
    "/settings" to Routes.SETTINGS,
    "/about" to Routes.ABOUT,
    "/contact" to Routes.CONTACT,
    "/search" to Routes.SEARCH,
    "/saved" to Routes.SAVED,
    "/your-listens" to Routes.YOUR_LISTENS,
    "/stats" to Routes.STATS,
    "/suggest" to Routes.SUGGEST,
    "/playlists" to Routes.PLAYLISTS,
    "/notes" to Routes.NOTES,
    "/bookmarks" to Routes.BOOKMARKS,
    "/downloads" to Routes.DOWNLOADS,
)

@Composable
fun PfaNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    playerState: PlayerUiState,
    onPlay: (Audio, List<Audio>, Long) -> Unit,
) {
    fun play(audio: Audio, list: List<Audio> = emptyList()) = onPlay(audio, list, 0)

    NavHost(navController = navController, startDestination = Routes.HOME, modifier = modifier) {
        composable(Routes.HOME) {
            HomeScreen(
                onPlayLatest = { play(it) },
                onNavigate = { navController.navigate(it) },
                onNavigateRoute = { route -> WEB_ROUTE_TO_NATIVE[route]?.let(navController::navigate) },
            )
        }
        composable(Routes.DOCTRINE) {
            DoctrineScreen(onPlayDoctrineAudio = { file, content -> play(file.asAudio(content)) })
        }
        composable(Routes.SERMONS) {
            AudioListScreen(
                title = "Sermons",
                emptyIcon = "🎙️",
                emptyMessage = "No sermons have been posted yet.",
                types = listOf(Audio.TYPE_SERMON, Audio.TYPE_HOMILY),
                typeChips = listOf(Audio.TYPE_SERMON to "Sermons", Audio.TYPE_HOMILY to "Homilies"),
                playerState = playerState,
                onPlay = { audio, list -> play(audio, list) },
            )
        }
        composable(Routes.SUNDAY_SCHOOL) {
            AudioListScreen(
                title = "Sunday School",
                emptyIcon = "🏫",
                emptyMessage = "No Sunday School recordings have been posted yet.",
                types = listOf(Audio.TYPE_SUNDAY_SCHOOL),
                playerState = playerState,
                onPlay = { audio, list -> play(audio, list) },
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
                onPlayAudioResource = { play(it.asAudio()) },
            )
        }
        composable(Routes.SPOTIFY) {
            SpotifyScreen(onPlayAudioResource = { play(it.asAudio()) })
        }
        composable(Routes.SETTINGS) {
            SettingsScreen(onSignInRequired = { navController.navigate(Routes.LOGIN) })
        }
        composable(Routes.ABOUT) { AboutScreen() }
        composable(Routes.CONTACT) { ContactScreen() }
        composable(Routes.SAVED) {
            SavedScreen(playerState = playerState, onPlay = { audio, list -> play(audio, list) })
        }
        composable(Routes.YOUR_LISTENS) {
            YourListensScreen(onPlay = { play(it) })
        }
        composable(Routes.STATS) { StatsScreen() }
        composable(Routes.SUGGEST) { SuggestScreen() }
        composable(Routes.PLAYLISTS) {
            PlaylistsScreen(onOpenPlaylist = { id -> navController.navigate(Routes.playlistDetail(id)) })
        }
        composable(
            Routes.PLAYLIST_DETAIL,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id").orEmpty()
            PlaylistDetailScreen(playlistId = id, onBack = { navController.popBackStack() }, onPlay = { audio, list -> play(audio, list) })
        }
        composable(Routes.NOTES) {
            NotesScreen(onOpenNote = { audioId -> navController.navigate(Routes.noteDetail(audioId)) })
        }
        composable(
            Routes.NOTE_DETAIL,
            arguments = listOf(navArgument("audioId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val audioId = backStackEntry.arguments?.getString("audioId").orEmpty()
            NoteDetailScreen(audioId = audioId, onBack = { navController.popBackStack() })
        }
        composable(Routes.BOOKMARKS) {
            BookmarksScreen(onJumpTo = { audioId, title, speaker, seconds ->
                onPlay(Audio(id = audioId, title = title, speaker = speaker), emptyList(), seconds)
            })
        }
        composable(Routes.DOWNLOADS) {
            DownloadsScreen(onPlay = { play(it) })
        }
        composable(Routes.SEARCH) {
            val context = LocalContext.current
            val uriHandler = LocalUriHandler.current
            SearchScreen(
                onPlayAudio = { play(it) },
                onOpenResource = { resource ->
                    when {
                        resource.type == Resource.TYPE_AUDIO && !resource.audioStorageKey.isNullOrBlank() -> play(resource.asAudio())
                        resource.type == Resource.TYPE_SPOTIFY -> openInSpotify(context, resource.url)
                        resource.url.isNotBlank() -> uriHandler.openUri(resource.url)
                    }
                },
            )
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
