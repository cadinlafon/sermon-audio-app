package com.palousefellowship.audio.ui.navigation

import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.composable
import com.palousefellowship.audio.data.config.PageConfig
import com.palousefellowship.audio.data.config.Session
import com.palousefellowship.audio.ui.shell.PageGate
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
import com.palousefellowship.audio.ui.screens.extras.DevInfoScreen
import com.palousefellowship.audio.ui.screens.extras.FeedbackScreen
import com.palousefellowship.audio.ui.screens.extras.GoalsScreen
import com.palousefellowship.audio.ui.screens.extras.WhatsNewScreen
import com.palousefellowship.audio.ui.screens.extras.YearInReviewScreen
import com.palousefellowship.audio.ui.screens.reports.MyReportsScreen
import com.palousefellowship.audio.ui.screens.resources.ResourcesScreen
import com.palousefellowship.audio.ui.screens.saved.SavedScreen
import com.palousefellowship.audio.ui.screens.search.SearchScreen
import com.palousefellowship.audio.ui.screens.settings.SettingsScreen
import com.palousefellowship.audio.ui.screens.spotify.SpotifyScreen
import com.palousefellowship.audio.ui.screens.stats.StatsScreen
import com.palousefellowship.audio.ui.screens.suggest.SuggestScreen
import com.palousefellowship.audio.ui.screens.transcript.TranscriptScreen
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
    "/feedback" to Routes.FEEDBACK,
    "/whats-new" to Routes.WHATS_NEW,
    "/goals" to Routes.GOALS,
    "/year-in-review" to Routes.YEAR_IN_REVIEW,
    "/dev-info" to Routes.DEV_INFO,
)

@Composable
private fun AudioListRoute(
    pageKey: String,
    types: List<String>,
    playerState: PlayerUiState,
    onPlay: (Audio, List<Audio>, Long) -> Unit,
    navController: NavHostController,
) {
    val container = (LocalContext.current.applicationContext as PfaApplication).container
    val player = container.playerRepository
    AudioListScreen(
        pageKey = pageKey,
        fetchTypes = types,
        playerState = playerState,
        onPlay = onPlay,
        onPlayNext = { player.playNext(it) },
        onPlayAll = { list -> player.playAll(list); list.size },
        onAddAll = { list -> player.addAllToQueue(list) },
        onAddRemaining = { list -> player.addRemainingToQueue(list) },
        onTogglePlayPause = { player.togglePlayPause() },
        onTranscript = { navController.navigate(Routes.transcript(it.id)) },
        onOpenRoute = { route -> WEB_ROUTE_TO_NATIVE[route]?.let { navController.navigate(it) } },
    )
}

@Composable
fun PfaNavHost(
    navController: NavHostController,
    modifier: Modifier = Modifier,
    playerState: PlayerUiState,
    onPlay: (Audio, List<Audio>, Long) -> Unit,
    pages: List<PageConfig>,
    session: Session,
    pagesReady: Boolean,
) {
    fun play(audio: Audio, list: List<Audio> = emptyList()) = onPlay(audio, list, 0)

    // Page Manager route guard (the web's <PageGate id="...">).
    val gate: @Composable (String, @Composable () -> Unit) -> Unit = { id, content ->
        PageGate(
            config = pages.firstOrNull { it.id == id },
            session = session,
            ready = pagesReady,
            onLogin = { navController.navigate(Routes.LOGIN) },
            onHome = { navController.navigate(Routes.HOME) { popUpTo(navController.graph.findStartDestination().id) } },
            content = content,
        )
    }

    NavHost(navController = navController, startDestination = Routes.HOME, modifier = modifier) {
        composable(Routes.HOME) { gate("home") {
            HomeScreen(
                onResume = { audio, pos -> onPlay(audio, listOf(audio), pos) },
                onNavigate = { navController.navigate(it) },
                onNavigateRoute = { route -> WEB_ROUTE_TO_NATIVE[route]?.let(navController::navigate) },
            )
        }}
        composable(Routes.DOCTRINE) { gate("doctrine") {
            val context = LocalContext.current
            val container = (context.applicationContext as PfaApplication).container
            DoctrineScreen(
                playerState = playerState,
                onPlayDoctrineAudio = { file, content -> play(file.asAudio(content)) },
                onPlayNextDoctrineAudio = { file, content -> container.playerRepository.playNext(file.asAudio(content)) },
                onTogglePlayPause = { container.playerRepository.togglePlayPause() },
            )
        }}
        composable(Routes.SERMONS) { gate("sermons") { AudioListRoute("sermons", listOf(Audio.TYPE_SERMON, Audio.TYPE_HOMILY), playerState, onPlay, navController) } }
        composable(Routes.SUNDAY_SCHOOL) { gate("sundayschool") { AudioListRoute("sundayschool", listOf(Audio.TYPE_SUNDAY_SCHOOL), playerState, onPlay, navController) } }
        composable(Routes.MORE) {
            MoreScreen(onNavigate = { navController.navigate(it) })
        }
        composable(Routes.RESOURCES) { gate("resources") {
            ResourcesScreen(
                title = "Resources",
                typeFilter = null,
                emptyIcon = "📚",
                emptyMessage = "No resources have been added yet.",
                onPlayAudioResource = { play(it.asAudio()) },
            )
        }}
        composable(Routes.SPOTIFY) {
            SpotifyScreen(onPlayAudioResource = { play(it.asAudio()) })
        }
        composable(Routes.SETTINGS) { gate("settings") {
            SettingsScreen(onSignInRequired = { navController.navigate(Routes.LOGIN) })
        }}
        composable(Routes.ABOUT) { gate("about") { AboutScreen() }}
        composable(Routes.CONTACT) { gate("contact") { ContactScreen() }}
        composable(Routes.SAVED) { gate("saved") {
            SavedScreen(playerState = playerState, onPlay = { audio, list -> play(audio, list) })
        }}
        composable(Routes.YOUR_LISTENS) { gate("your-listens") {
            YourListensScreen(onPlay = { play(it) })
        }}
        composable(Routes.STATS) { gate("stats") { StatsScreen() }}
        composable(Routes.SUGGEST) { gate("suggest") { SuggestScreen() }}
        composable(Routes.PLAYLISTS) { gate("playlists") {
            PlaylistsScreen(onOpenPlaylist = { id -> navController.navigate(Routes.playlistDetail(id)) })
        }}
        composable(
            Routes.PLAYLIST_DETAIL,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id").orEmpty()
            PlaylistDetailScreen(playlistId = id, onBack = { navController.popBackStack() }, onPlay = { audio, list -> play(audio, list) })
        }
        composable(Routes.NOTES) { gate("notes") {
            NotesScreen(onOpenNote = { audioId -> navController.navigate(Routes.noteDetail(audioId)) })
        }}
        composable(
            Routes.NOTE_DETAIL,
            arguments = listOf(navArgument("audioId") { type = NavType.StringType }),
        ) { backStackEntry ->
            val audioId = backStackEntry.arguments?.getString("audioId").orEmpty()
            NoteDetailScreen(audioId = audioId, onBack = { navController.popBackStack() })
        }
        composable(Routes.BOOKMARKS) { gate("bookmarks") {
            BookmarksScreen(onJumpTo = { audioId, title, speaker, seconds ->
                onPlay(Audio(id = audioId, title = title, speaker = speaker), emptyList(), seconds)
            })
        }}
        composable(Routes.DOWNLOADS) { gate("downloads") {
            DownloadsScreen(onPlay = { play(it) })
        }}
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
        composable(Routes.WHATS_NEW) { gate("whats-new") { WhatsNewScreen() } }
        composable(Routes.FEEDBACK) { gate("feedback") { FeedbackScreen(onSuggest = { navController.navigate(Routes.SUGGEST) }) } }
        composable(Routes.GOALS) { gate("goals") { GoalsScreen(onSignIn = { navController.navigate(Routes.LOGIN) }, onYearInReview = { navController.navigate(Routes.YEAR_IN_REVIEW) }) } }
        composable(Routes.YEAR_IN_REVIEW) { gate("year-in-review") { YearInReviewScreen(onSignIn = { navController.navigate(Routes.LOGIN) }) } }
        composable(Routes.DEV_INFO) { DevInfoScreen() }
        composable(Routes.MY_REPORTS) { MyReportsScreen(onBack = { navController.popBackStack() }) }
        composable(Routes.TRANSCRIPT, arguments = listOf(navArgument("audioId") { type = NavType.StringType })) { entry ->
            TranscriptScreen(audioId = entry.arguments?.getString("audioId").orEmpty(), onBack = { navController.popBackStack() })
        }
        composable(Routes.PLAYER) {
            PlayerScreen(onBack = { navController.popBackStack() }, onTranscript = { navController.navigate(Routes.transcript(it)) })
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
