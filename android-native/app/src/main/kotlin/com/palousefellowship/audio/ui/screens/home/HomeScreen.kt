package com.palousefellowship.audio.ui.screens.home

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.R
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.components.NoticeCard
import com.palousefellowship.audio.ui.navigation.Routes
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import com.palousefellowship.audio.util.UiState
import com.palousefellowship.audio.util.formatDuration

private val SidePadding = 20.dp

/** Port of src/pages/Home.jsx: hero photo, the Sermons / Sunday School tiles,
 * "Continue Listening" (last three unfinished recordings, signed-in only) and
 * the Notices card. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(
    onResume: (Audio, Long) -> Unit,
    onNavigate: (String) -> Unit,
    onNavigateRoute: (String) -> Unit,
) {
    val viewModel = pfaViewModel { c -> HomeViewModel(c.noticeRepository, c.authRepository, c.listenProgressRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    val refreshing by viewModel.isRefreshing.collectAsState()
    val uriHandler = LocalUriHandler.current
    val container = (LocalContext.current.applicationContext as PfaApplication).container

    Scaffold(contentWindowInsets = WindowInsets(0, 0, 0, 0), containerColor = MaterialTheme.colorScheme.background) { padding ->
        PullToRefreshBox(
            isRefreshing = refreshing,
            onRefresh = { viewModel.refresh() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
            val heroHeight = (LocalConfiguration.current.screenHeightDp * 0.34f).coerceAtLeast(200f).dp
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                item {
                    Image(
                        painter = painterResource(R.drawable.hero), contentDescription = null, contentScale = ContentScale.Crop,
                        modifier = Modifier.fillMaxWidth().height(heroHeight),
                    )
                }
                item { Spacer32() }
                item {
                    Row(Modifier.padding(horizontal = SidePadding).padding(bottom = 16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        HomeNavButton("🎧", "Sermons", Modifier.weight(1f)) { onNavigate(Routes.SERMONS) }
                        HomeNavButton("📖", "Sunday School", Modifier.weight(1f)) { onNavigate(Routes.SUNDAY_SCHOOL) }
                    }
                }
                when (val s = state) {
                    is UiState.Loading -> item { Box(Modifier.fillMaxWidth().height(160.dp)) { LoadingView() } }
                    is UiState.Error -> item { ErrorView(message = s.message, onRetry = { viewModel.load() }) }
                    is UiState.Success -> {
                        if (s.data.continueListening.isNotEmpty()) {
                            item {
                                HomeCard("⏯️", "Continue Listening") {
                                    s.data.continueListening.forEachIndexed { i, item ->
                                        ContinueRow(item, last = i == s.data.continueListening.lastIndex) { container.eventLogger.log("continue_listening_resume", mapOf("audioId" to item.audio.id)); onResume(item.audio, item.positionSeconds) }
                                    }
                                }
                            }
                        }
                        if (s.data.notices.isNotEmpty()) {
                            item {
                                HomeCard("📌", "Notices") {
                                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                                        s.data.notices.forEach { notice ->
                                            androidx.compose.runtime.LaunchedEffect(notice.id) { container.eventLogger.log("notice_view", mapOf("noticeId" to notice.id, "noticeTitle" to notice.title)) }
                                            NoticeCard(
                                                notice = notice,
                                                onButtonClick = { n ->
                                                    container.eventLogger.log("notice_click", mapOf("noticeId" to notice.id, "noticeTitle" to notice.title))
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
                    }
                }
                item {
                    Box(Modifier.fillMaxWidth().padding(top = 20.dp, bottom = 40.dp), contentAlignment = Alignment.Center) {
                        Text(
                            "Audio app info", fontSize = 11.sp, color = Color(0xFFB08050).copy(alpha = 0.7f),
                            modifier = Modifier.clickable { uriHandler.openUri("https://palousefellowshipsermonapp.web.app/audio-app") },
                        )
                    }
                }
            }
        }
    }
}

@Composable private fun Spacer32() = Box(Modifier.height(32.dp))

@Composable
private fun HomeCard(icon: String, title: String, content: @Composable () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(
        modifier = Modifier.fillMaxWidth().padding(horizontal = SidePadding, vertical = 0.dp).padding(bottom = 24.dp),
        colors = CardDefaults.cardColors(containerColor = colors.surface),
        shape = RoundedCornerShape(18.dp),
        border = BorderStroke(1.dp, colors.outline),
    ) {
        Column(Modifier.padding(top = 24.dp, start = 24.dp, end = 24.dp, bottom = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(icon, fontSize = 20.sp)
                Text(title, fontFamily = FontFamily.Serif, fontSize = 17.sp, color = colors.onBackground.copy(alpha = 0.85f), modifier = Modifier.padding(start = 10.dp))
            }
            HorizontalDivider(Modifier.padding(top = 14.dp, bottom = 18.dp), color = colors.outline)
            content()
        }
    }
}

@Composable
private fun ContinueRow(item: ListenProgressRepository.ContinueItem, last: Boolean, onResume: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    val pct = if (item.durationSeconds > 0) (item.positionSeconds.toFloat() / item.durationSeconds).coerceIn(0f, 1f) else 0f
    Column {
        Row(Modifier.fillMaxWidth().padding(vertical = 12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            Column(Modifier.weight(1f)) {
                Text(item.audio.title, fontFamily = FontFamily.Serif, fontSize = 15.sp, color = colors.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(item.audio.speaker, fontSize = 12.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
                Box(Modifier.fillMaxWidth().height(5.dp).clip(RoundedCornerShape(999.dp)).background(colors.outline)) {
                    Box(Modifier.fillMaxWidth(pct).height(5.dp).background(Brush.horizontalGradient(listOf(Color(0xFFE08930), AccentOrange))))
                }
                Text("${formatDuration(item.positionSeconds)} of ${formatDuration(item.durationSeconds)}", fontSize = 11.sp, color = Color(0xFFB08050), modifier = Modifier.padding(top = 5.dp))
            }
            Row(
                Modifier.clip(RoundedCornerShape(999.dp)).background(Brush.linearGradient(listOf(AccentOrange, AccentBrownDark)))
                    .clickable(onClick = onResume).padding(horizontal = 16.dp, vertical = 9.dp),
                verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                Text("▶", fontSize = 12.sp, color = Color(0xFFFFF8EE))
                Text("Resume", fontSize = 13.sp, color = Color(0xFFFFF8EE))
            }
        }
        if (!last) HorizontalDivider(color = colors.outline.copy(alpha = 0.6f))
    }
}

@Composable
private fun HomeNavButton(icon: String, label: String, modifier: Modifier, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Card(
        onClick = onClick, modifier = modifier,
        colors = CardDefaults.cardColors(containerColor = colors.surface), shape = RoundedCornerShape(14.dp), border = BorderStroke(1.dp, colors.outline),
    ) {
        Row(Modifier.padding(horizontal = 14.dp, vertical = 18.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(icon, fontSize = 20.sp)
            Text(label, fontFamily = FontFamily.Serif, fontSize = 15.sp, color = colors.onBackground, modifier = Modifier.weight(1f), lineHeight = 19.sp)
            Text("→", fontSize = 18.sp, color = Color(0xFFC08040))
        }
    }
}
