package com.palousefellowship.audio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.compose.runtime.collectAsState
import com.palousefellowship.audio.data.model.Audio
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import com.palousefellowship.audio.data.config.PAGE_REGISTRY
import com.palousefellowship.audio.data.config.PageConfig
import com.palousefellowship.audio.data.config.effectivePage
import com.palousefellowship.audio.data.config.sortForNavigation
import com.palousefellowship.audio.data.prefs.ThemePreference
import com.palousefellowship.audio.ui.navigation.AVAILABLE_ROUTES
import com.palousefellowship.audio.ui.shell.AccountPanel
import com.palousefellowship.audio.ui.shell.MoreSheet
import com.palousefellowship.audio.ui.shell.PfaBottomBar
import com.palousefellowship.audio.ui.shell.PfaTopBar
import com.palousefellowship.audio.ui.shell.ShutdownScreen
import kotlinx.coroutines.delay
import com.palousefellowship.audio.ui.components.MiniPlayerBar
import com.palousefellowship.audio.ui.components.OfflineBanner
import com.palousefellowship.audio.ui.navigation.PfaNavHost
import com.palousefellowship.audio.ui.navigation.Routes
import com.palousefellowship.audio.ui.theme.PalouseFellowshipAudioTheme

class MainActivity : ComponentActivity() {
    // "Background playback" switched off in Audio Page Manager → Playback: stop when the app is sent away.
    override fun onStop() {
        super.onStop()
        (application as PfaApplication).container.playerRepository.onAppBackgrounded()
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        installSplashScreen()
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as PfaApplication).container
        setContent {
            val pref by container.themePrefs.preference.collectAsState()
            val dark = when (pref) {
                ThemePreference.LIGHT -> false
                ThemePreference.DARK -> true
                ThemePreference.SYSTEM -> isSystemInDarkTheme()
            }
            PalouseFellowshipAudioTheme(darkTheme = dark) {
                Surface(color = MaterialTheme.colorScheme.background) {
                    PfaApp()
                }
            }
        }
    }
}

// Screens where the top bar / bottom nav / mini player chrome would just get
// in the way — the full-screen player and the auth flow.
private val NO_CHROME_ROUTES = setOf(Routes.PLAYER, Routes.LOGIN, Routes.SIGN_UP)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PfaApp() {
    val context = LocalContext.current
    val container = (context.applicationContext as PfaApplication).container
    val navController = rememberNavController()
    val playerState by container.playerRepository.state.collectAsStateWithLifecycle()
    val isOnline by container.connectivityObserver.isOnline.collectAsState(initial = true)
    val session by container.sessionRepository.session.collectAsStateWithLifecycle()
    val status by container.remoteConfig.status.collectAsStateWithLifecycle()
    val pageDocs by container.remoteConfig.pageDocs.collectAsStateWithLifecycle()
    val themePref by container.themePrefs.preference.collectAsState()
    val unreadReplies by remember(session.uid) { container.reportsRepository.myReports(session.uid) }
        .collectAsStateWithLifecycle(initialValue = emptyList())

    // Scheduled Page Manager changes are re-evaluated every minute, like the web's PagesContext.
    var tick by remember { mutableIntStateOf(0) }
    LaunchedEffect(Unit) { while (true) { delay(60_000); tick++ } }
    val pages = remember(pageDocs, tick) { PAGE_REGISTRY.map { effectivePage(it, pageDocs[it.id]) } }
    val available = { p: PageConfig -> p.nativeRoute != null && p.nativeRoute in AVAILABLE_ROUTES }
    val visible = pages.filter { it.isVisibleInNav && available(it) }
    val primaryPages = sortForNavigation(visible.filter { it.navSlot == "primary" })
    val morePages = sortForNavigation(visible.filter { it.navSlot == "more" })
    val accountPages = sortForNavigation(visible.filter { it.navSlot == "account" })
    val settingsHidden = pages.firstOrNull { it.id == "settings" }?.let { !it.isVisibleInNav } ?: false

    LaunchedEffect(Unit) { container.playerRepository.connect() }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val showChrome = currentRoute !in NO_CHROME_ROUTES

    // page_visit for every screen, as the web's RouteLogger does (using the web-equivalent path).
    LaunchedEffect(currentRoute) {
        val r = currentRoute ?: return@LaunchedEffect
        val path = when (r) {
            Routes.HOME -> "/"; Routes.SUNDAY_SCHOOL -> "/sundayschool"; Routes.PLAYER -> "/player"; Routes.YOUR_LISTENS -> "/your-listens"
            Routes.WHATS_NEW -> "/whats-new"; Routes.DEV_INFO -> "/dev-info"; Routes.YEAR_IN_REVIEW -> "/year-in-review"; Routes.MY_REPORTS -> "/my-reports"
            Routes.SIGN_UP -> "/signup"
            else -> "/" + r.substringBefore("/{").replace('_', '-')
        }
        container.eventLogger.pageVisit(path)
    }

    var showMore by remember { mutableStateOf(false) }
    var showAccount by remember { mutableStateOf(false) }

    val goPage: (PageConfig) -> Unit = { p ->
        showMore = false; showAccount = false
        p.nativeRoute?.let { route ->
            if (p.navSlot == "primary") {
                navController.navigate(route) {
                    popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                    launchSingleTop = true
                    restoreState = true
                }
            } else {
                navController.navigate(route) { launchSingleTop = true }
            }
        }
    }
    val goRoute: (String) -> Unit = { route ->
        showMore = false; showAccount = false
        navController.navigate(route) { launchSingleTop = true }
    }

    // Whole-app maintenance switch (appConfig/status.shutdown); admins still get in.
    if (status.shutdown && !session.isAdmin && session.loaded) {
        ShutdownScreen(status.message, status.returnDateMillis)
        return
    }

    val playAndOpen: (Audio, List<Audio>, Long) -> Unit = { audio, list, resumeAtSeconds ->
        container.playerRepository.play(audio, list.ifEmpty { listOf(audio) }, resumeAtSeconds)
        navController.navigate(Routes.PLAYER)
    }

    Scaffold(
        topBar = {
            if (showChrome) {
                Column {
                    if (!isOnline) OfflineBanner("You're offline")
                    PfaTopBar(
                        session = session,
                        themePreference = themePref,
                        unreadReplies = unreadReplies.count { it.userUnread },
                        onSearch = { goRoute(Routes.SEARCH) },
                        onCycleTheme = { container.themePrefs.cycle() },
                        onAccount = { showAccount = true },
                    )
                }
            } else if (!isOnline) OfflineBanner("You're offline")
        },
        bottomBar = {
            if (showChrome) {
                Column {
                    if (playerState.current != null) {
                        MiniPlayerBar(
                            state = playerState,
                            onTogglePlayPause = { container.playerRepository.togglePlayPause() },
                            onOpenPlayer = { navController.navigate(Routes.PLAYER) },
                        )
                    }
                    PfaBottomBar(
                        primaryPages = primaryPages,
                        currentRoute = currentRoute,
                        onNavigate = goPage,
                        onMore = { showMore = true },
                    )
                }
            }
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { padding ->
        PfaNavHost(
            navController = navController,
            modifier = if (showChrome) Modifier.padding(padding).consumeWindowInsets(padding) else Modifier,
            playerState = playerState,
            onPlay = playAndOpen,
            pages = pages,
            session = session,
            pagesReady = session.loaded && pageDocsReady(container),
        )
    }

    if (showMore) {
        MoreSheet(
            morePages = morePages,
            session = session,
            showSettings = !settingsHidden,
            onPage = goPage,
            onSettings = {
                if (!session.signedIn) {
                    android.widget.Toast.makeText(context, "Create an account to access settings", android.widget.Toast.LENGTH_SHORT).show()
                    goRoute(Routes.SIGN_UP)
                } else goRoute(Routes.SETTINGS)
            },
            onDevInfo = { goRoute(Routes.DEV_INFO) },
            onDismiss = { showMore = false },
        )
    }
    if (showAccount) {
        AccountPanel(
            container = container, session = session, accountPages = accountPages,
            unreadReplies = unreadReplies.count { it.userUnread },
            onDismiss = { showAccount = false }, onGoRoute = goRoute, onGoPage = goPage,
        )
    }
}

@Composable
private fun pageDocsReady(container: com.palousefellowship.audio.AppContainer): Boolean =
    container.remoteConfig.pagesLoaded.collectAsStateWithLifecycle().value
