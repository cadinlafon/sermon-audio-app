package com.palousefellowship.audio.ui.screens.playlists

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.Playlist
import com.palousefellowship.audio.data.repository.PlaylistRepository
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.launch

/** Bottom sheet used from the Player screen's "Add to playlist" button —
 * lists existing playlists to add [audio] to, plus a quick "create new and
 * add" field, mirroring the web app's ☰＋ button on every recording card. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AddToPlaylistSheet(audio: Audio, repository: PlaylistRepository, onDismiss: () -> Unit) {
    var playlists by remember { mutableStateOf<List<Playlist>>(emptyList()) }
    var newName by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(Unit) {
        (repository.getPlaylists() as? UiState.Success)?.let { playlists = it.data }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp)) {
            Text("Add “${audio.title}” to a playlist", style = MaterialTheme.typography.titleMedium)
            LazyColumn(Modifier.padding(top = 12.dp)) {
                items(playlists, key = { it.id }) { playlist ->
                    Card(
                        onClick = { scope.launch { repository.addItem(playlist.id, audio); onDismiss() } },
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    ) {
                        Row(Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            PlaylistCoverBox(playlist, size = 36.dp)
                            Text(playlist.name, modifier = Modifier.padding(start = 10.dp))
                        }
                    }
                }
            }
            OutlinedTextField(value = newName, onValueChange = { newName = it }, label = { Text("New playlist name") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 8.dp))
            TextButton(
                onClick = {
                    scope.launch {
                        val pl = repository.create(newName)
                        repository.addItem(pl.id, audio)
                        onDismiss()
                    }
                },
                modifier = Modifier.padding(top = 4.dp),
            ) { Text("Create & add") }
        }
    }
}
