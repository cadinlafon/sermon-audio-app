package com.palousefellowship.audio.ui.screens.more

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bookmark
import androidx.compose.material.icons.filled.ChevronRight
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Email
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Feedback
import androidx.compose.material.icons.filled.Headphones
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.LibraryBooks
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlaylistPlay
import androidx.compose.material.icons.filled.QueryStats
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.StickyNote2
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.ui.navigation.Routes

private data class MoreItem(val label: String, val icon: ImageVector, val route: String)

private val BROWSE_ITEMS = listOf(
    MoreItem("Search", Icons.Filled.Search, Routes.SEARCH),
    MoreItem("Resources", Icons.Filled.LibraryBooks, Routes.RESOURCES),
    MoreItem("Spotify", Icons.Filled.MusicNote, Routes.SPOTIFY),
)

private val ACCOUNT_ITEMS = listOf(
    MoreItem("Your Listens", Icons.Filled.Headphones, Routes.YOUR_LISTENS),
    MoreItem("Liked Sermons", Icons.Filled.Favorite, Routes.SAVED),
    MoreItem("Playlists", Icons.Filled.PlaylistPlay, Routes.PLAYLISTS),
    MoreItem("Notes", Icons.Filled.StickyNote2, Routes.NOTES),
    MoreItem("Bookmarks", Icons.Filled.Bookmark, Routes.BOOKMARKS),
    MoreItem("Downloads", Icons.Filled.Download, Routes.DOWNLOADS),
    MoreItem("Stats", Icons.Filled.QueryStats, Routes.STATS),
    MoreItem("Suggest a Feature", Icons.Filled.Feedback, Routes.SUGGEST),
)

private val INFO_ITEMS = listOf(
    MoreItem("Settings & About", Icons.Filled.Settings, Routes.SETTINGS),
    MoreItem("About This App", Icons.Filled.Info, Routes.ABOUT),
    MoreItem("Contact", Icons.Filled.Email, Routes.CONTACT),
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreScreen(onNavigate: (String) -> Unit) {
    Scaffold(
        topBar = { TopAppBar(title = { Text("More", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            item { SectionLabel("Browse") }
            items(BROWSE_ITEMS) { MoreRow(it, onNavigate) }
            item { SectionLabel("Your Account") }
            items(ACCOUNT_ITEMS) { MoreRow(it, onNavigate) }
            item { SectionLabel("About") }
            items(INFO_ITEMS) { MoreRow(it, onNavigate) }
        }
    }
}

@Composable
private fun SectionLabel(text: String) {
    Text(
        text.uppercase(),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(top = 14.dp, bottom = 2.dp),
    )
}

@Composable
private fun MoreRow(item: MoreItem, onNavigate: (String) -> Unit) {
    Card(onClick = { onNavigate(item.route) }, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(14.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(item.icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text(item.label, modifier = Modifier.weight(1f).padding(start = 14.dp), style = MaterialTheme.typography.bodyLarge)
            Icon(Icons.Filled.ChevronRight, contentDescription = null, tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
