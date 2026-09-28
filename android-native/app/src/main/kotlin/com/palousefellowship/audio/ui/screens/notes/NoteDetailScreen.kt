package com.palousefellowship.audio.ui.screens.notes

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.NoteDoc
import com.palousefellowship.audio.util.formatDuration
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun NoteDetailScreen(audioId: String, onBack: () -> Unit) {
    val container = (LocalContext.current.applicationContext as PfaApplication).container
    var note by remember { mutableStateOf(NoteDoc(audioId = audioId)) }
    var text by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    LaunchedEffect(audioId) {
        note = container.notesRepository.getNote(audioId)
        text = note.text
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(note.title.ifBlank { "Note" }, style = MaterialTheme.typography.titleLarge, maxLines = 1) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.Filled.ArrowBack, contentDescription = "Back") } },
            )
        },
    ) { padding ->
        Column(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
            if (note.speaker.isNotBlank()) {
                Text(note.speaker, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            OutlinedTextField(
                value = text,
                onValueChange = { text = it },
                label = { Text("Your note") },
                modifier = Modifier.fillMaxWidth().weight(1f).padding(top = 10.dp),
            )
            Button(
                onClick = { scope.launch { container.notesRepository.saveText(audioId, text, Audio(id = audioId, title = note.title, speaker = note.speaker)) } },
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            ) { Text("Save") }

            if (note.entries.isNotEmpty()) {
                Text("Timestamped notes", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(top = 20.dp))
                note.entries.sortedBy { it.t }.forEach { entry ->
                    Text("${formatDuration(entry.t.toLong())} — ${entry.text}", style = MaterialTheme.typography.bodyMedium, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
    }
}
