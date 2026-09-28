package com.palousefellowship.audio.ui.screens.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.R
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.components.NoticeCard
import com.palousefellowship.audio.ui.navigation.Routes
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.ui.theme.BorderTan
import com.palousefellowship.audio.ui.theme.CardBackground
import com.palousefellowship.audio.ui.theme.DarkBrown
import com.palousefellowship.audio.ui.theme.MutedBrown
import com.palousefellowship.audio.util.UiState

private val SidePadding = 20.dp
private val CardTitleColor = Color(0xFF5C3A1E) // web's `cardTitle` color — distinct from body/heading brown

/**
 * A close, section-by-section port of src/pages/Home.jsx: same hero photo,
 * same "📌 Notices" card (only shown when there are any, pinned first),
 * same "🎙️ Latest Sermon" card (always shown, with the same empty-state
 * copy), and the same two Sermons/Sunday School nav rows + small footer
 * link — same colors (reusing this app's existing brand tokens, which are
 * the same palette as the web's raw hex) and roughly the same px→dp
 * spacing.
 *
 * One deliberate behavior change from the web: tapping "Play" there just
 * navigates to /sermons and stashes the sermon in a `continueListening`
 * localStorage key that — confirmed by grepping the whole web app —
 * nothing else ever reads. It's dead code, not a real "continue
 * listening" feature. Here, "Play" actually plays the sermon and opens
 * the player, which is what the button visually promises.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onPlayLatest: (Audio) -> Unit,
    onNavigate: (String) -> Unit,
    onNavigateRoute: (String) -> Unit,
) {
    val viewModel = pfaViewModel { c -> HomeViewModel(c.audioRepository, c.noticeRepository, c.authRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshing by viewModel.isRefreshing.collectAsState()
    val uriHandler = LocalUriHandler.current
    val container = (LocalContext.current.applicationContext as PfaApplication).container

    // No page title bar here on purpose — the web app has no header at all
    // on Home either, it goes straight into the hero photo. contentWindowInsets
    // is zeroed because MainActivity's outer Scaffold (which this screen's
    // content sits inside, via NavHost) already reserves the status-bar
    // inset in the padding it hands down — without this, Home would get
    // that same inset applied a second time here, pushing the hero photo
    // down by an extra status-bar's worth of blank space.
    Scaffold(contentWindowInsets = WindowInsets(0, 0, 0, 0)) { padding ->
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            when (val s = state) {
                is UiState.Loading -> LoadingView()
                is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() })
                is UiState.Success -> {
                    val screenHeightDp = LocalConfiguration.current.screenHeightDp
                    val heroHeight = (screenHeightDp * 0.34f).coerceAtLeast(200f).dp

                    LazyColumn(modifier = Modifier.fillMaxSize()) {
                        // HERO — full-bleed, no side padding, matching the web's photo band.
                        item {
                            Image(
                                painter = painterResource(R.drawable.hero),
                                contentDescription = null,
                                contentScale = ContentScale.Crop,
                                modifier = Modifier.fillMaxWidth().height(heroHeight),
                            )
                        }

                        item { Spacer(Modifier.height(32.dp)) }

                        // NOTICES — only rendered when there are any, pinned first
                        // (already sorted that way by NoticeRepository).
                        if (s.data.notices.isNotEmpty()) {
                            item {
                                HomeCard(icon = "📌", title = "Notices") {
                                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        s.data.notices.forEach { notice ->
                                            NoticeCard(
                                                notice = notice,
                                                onButtonClick = { n ->
                                                    when (n.buttonType) {
                                                        "page" -> n.buttonValue?.let(onNavigateRoute)
                                                        else -> n.buttonValue?.let { uriHandler.openUri(it) }
                                                    }
                                                },
                                                onSubmitInput = { value -> container.noticeRepository.submitInput(notice.id, value) },
                                            )
                                        }
                                    }
                                }
                            }
                        }

                        // LATEST SERMON — always shown, same as the web.
                        item {
                            HomeCard(icon = "🎙️", title = "Latest Sermon") {
                                val latest = s.data.latestSermon
                                if (latest != null) {
                                    Column(
                                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp, bottom = 6.dp),
                                        horizontalAlignment = Alignment.CenterHorizontally,
                                    ) {
                                        Text(latest.title, style = MaterialTheme.typography.headlineSmall, color = DarkBrown, textAlign = TextAlign.Center)
                                        Text(
                                            latest.speaker,
                                            style = MaterialTheme.typography.bodyMedium,
                                            color = MutedBrown,
                                            modifier = Modifier.padding(top = 6.dp, bottom = 20.dp),
                                        )
                                        Button(
                                            onClick = { onPlayLatest(latest) },
                                            shape = RoundedCornerShape(999.dp),
                                            colors = ButtonDefaults.buttonColors(containerColor = AccentBrownDark),
                                        ) {
                                            Text("▶", fontSize = 12.sp)
                                            Text("  Play", fontSize = 15.sp)
                                        }
                                    }
                                } else {
                                    Text(
                                        "No sermons uploaded yet — check back soon.",
                                        style = MaterialTheme.typography.bodyMedium.copy(fontStyle = FontStyle.Italic),
                                        color = MutedBrown,
                                        textAlign = TextAlign.Center,
                                        modifier = Modifier.fillMaxWidth().padding(vertical = 12.dp),
                                    )
                                }
                            }
                        }

                        // NAV BUTTONS
                        item {
                            Column(Modifier.padding(horizontal = SidePadding).padding(top = 4.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                                HomeNavButton("🎧", "Sermons") { onNavigate(Routes.SERMONS) }
                                HomeNavButton("📖", "Sunday School") { onNavigate(Routes.SUNDAY_SCHOOL) }
                            }
                        }

                        // FOOTER
                        item {
                            Box(
                                modifier = Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 40.dp),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text(
                                    "Audio app info",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MutedBrown.copy(alpha = 0.7f),
                                    modifier = Modifier.clickable {
                                        uriHandler.openUri("https://palousefellowshipsermonapp.web.app/audio-app")
                                    },
                                )
                            }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun HomeCard(icon: String, title: String, content: @Composable () -> Unit) {
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = SidePadding, vertical = 7.dp),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, BorderTan),
    ) {
        Column(Modifier.padding(top = 24.dp, start = 24.dp, end = 24.dp, bottom = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(icon, style = MaterialTheme.typography.titleLarge)
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    color = CardTitleColor,
                    modifier = Modifier.padding(start = 10.dp),
                )
            }
            HorizontalDivider(Modifier.padding(top = 14.dp, bottom = 16.dp), color = BorderTan)
            content()
        }
    }
}

@Composable
private fun HomeNavButton(icon: String, label: String, onClick: () -> Unit) {
    Card(
        onClick = onClick,
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, BorderTan),
    ) {
        Row(Modifier.padding(18.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(icon, style = MaterialTheme.typography.titleLarge)
            Text(label, style = MaterialTheme.typography.bodyLarge, color = DarkBrown, modifier = Modifier.padding(start = 12.dp).weight(1f))
            Text("→", style = MaterialTheme.typography.titleLarge, color = AccentOrange)
        }
    }
}
