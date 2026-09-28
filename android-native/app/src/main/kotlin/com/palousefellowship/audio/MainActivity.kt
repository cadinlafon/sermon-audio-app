package com.palousefellowship.audio

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
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
import com.palousefellowship.audio.ui.components.MiniPlayerBar
import com.palousefellowship.audio.ui.components.OfflineBanner
import com.palousefellowship.audio.ui.navigation.BottomNavItems
import com.palousefellowship.audio.ui.navigation.PfaNavHost
import com.palousefellowship.audio.ui.navigation.Routes
import com.palousefellowship.audio.ui.theme.PalouseFellowshipAudioTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PalouseFellowshipAudioTheme {
                Surface(color = MaterialTheme.colorScheme.background) {
                    PfaApp()
                }
            }
        }
    }
}

// Screens where the bottom nav / mini player chrome would just get in the
// way — the full-screen player and the auth flow.
private val NO_CHROME_ROUTES = setOf(Routes.PLAYER, Routes.LOGIN, Routes.SIGN_UP)

@Composable
private fun PfaApp() {
    val context = LocalContext.current
    val container = (context.applicationContext as PfaApplication).container
    val navController = rememberNavController()
    val playerState by container.playerRepository.state.collectAsStateWithLifecycle()
    val isOnline by container.connectivityObserver.isOnline.collectAsState(initial = true)

    LaunchedEffect(Unit) { container.playerRepository.connect() }

    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route
    val showChrome = currentRoute !in NO_CHROME_ROUTES

    val playAndOpen: (Audio, List<Audio>, Long) -> Unit = { audio, list, resumeAtSeconds ->
        container.playerRepository.play(audio, list.ifEmpty { listOf(audio) }, resumeAtSeconds)
        navController.navigate(Routes.PLAYER)
    }

    Scaffold(
        topBar = { if (!isOnline) OfflineBanner("You're offline") },
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
                    NavigationBar {
                        val currentDestination = backStackEntry?.destination
                        BottomNavItems.forEach { item ->
                            val selected = currentDestination?.hierarchy?.any { it.route == item.route } == true
                            NavigationBarItem(
                                selected = selected,
                                onClick = {
                                    if (!selected) {
                                        navController.navigate(item.route) {
                                            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
                                            launchSingleTop = true
                                            restoreState = true
                                        }
                                    }
                                },
                                icon = { Icon(item.icon, contentDescription = item.label) },
                                label = { Text(item.label) },
                            )
                        }
                    }
                }
            }
        },
    ) { padding ->
        PfaNavHost(
            navController = navController,
            modifier = if (showChrome) Modifier.padding(padding) else Modifier,
            playerState = playerState,
            onPlay = playAndOpen,
        )
    }
}
