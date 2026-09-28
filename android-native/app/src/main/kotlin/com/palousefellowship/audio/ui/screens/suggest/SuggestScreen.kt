package com.palousefellowship.audio.ui.screens.suggest

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.data.model.Suggestion
import com.palousefellowship.audio.ui.components.EmptyView
import com.palousefellowship.audio.ui.components.ErrorView
import com.palousefellowship.audio.ui.components.LoadingView
import com.palousefellowship.audio.ui.pfaViewModel
import com.palousefellowship.audio.util.UiState

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SuggestScreen() {
    val viewModel = pfaViewModel { c -> SuggestViewModel(c.suggestionRepository, c.authRepository) }
    val state by viewModel.state.collectAsStateWithLifecycle()
    var showForm by rememberSaveable { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Suggest a Feature", style = MaterialTheme.typography.titleLarge) }) },
        floatingActionButton = { FloatingActionButton(onClick = { showForm = true }) { Icon(Icons.Filled.Add, contentDescription = "New suggestion") } },
    ) { padding ->
        when (val s = state) {
            is UiState.Loading -> LoadingView(Modifier.padding(padding))
            is UiState.Error -> ErrorView(message = s.message, onRetry = { viewModel.load() }, modifier = Modifier.padding(padding))
            is UiState.Success -> {
                if (s.data.isEmpty()) {
                    EmptyView(icon = "💡", title = "No suggestions yet", message = "Be the first to suggest something.", modifier = Modifier.padding(padding).fillMaxSize())
                } else {
                    LazyColumn(
                        modifier = Modifier.fillMaxSize().padding(padding),
                        contentPadding = PaddingValues(16.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        items(s.data.sortedByDescending { it.votes }, key = { it.id }) { suggestion ->
                            SuggestionRow(suggestion, hasVoted = suggestion.voters.contains(viewModel.currentUid), onVote = { up -> viewModel.vote(suggestion, up) })
                        }
                    }
                }
            }
        }

        if (showForm) {
            SuggestionForm(
                onDismiss = { showForm = false },
                onSubmit = { title, details -> viewModel.submit(title, details) { showForm = false } },
                error = viewModel.submitError.collectAsStateWithLifecycle().value,
            )
        }
    }
}

@Composable
private fun SuggestionRow(suggestion: Suggestion, hasVoted: Boolean, onVote: (Boolean) -> Unit) {
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            Column(modifier = Modifier.weight(1f)) {
                Text(suggestion.title, style = MaterialTheme.typography.titleMedium)
                Text(suggestion.details, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3)
                if (suggestion.status != "none") {
                    AssistChip(onClick = {}, enabled = false, label = { Text(suggestion.status.replaceFirstChar { it.uppercase() }) }, modifier = Modifier.padding(top = 6.dp))
                }
            }
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Icon(
                    Icons.Filled.KeyboardArrowUp,
                    contentDescription = if (hasVoted) "Remove vote" else "Vote",
                    tint = if (hasVoted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(4.dp),
                )
                Text("${suggestion.votes}", style = MaterialTheme.typography.titleMedium)
                TextButton(onClick = { onVote(!hasVoted) }) { Text(if (hasVoted) "Unvote" else "Vote") }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SuggestionForm(onDismiss: () -> Unit, onSubmit: (String, String) -> Unit, error: String?) {
    var title by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(Modifier.padding(20.dp).padding(bottom = 24.dp)) {
            Text("New suggestion", style = MaterialTheme.typography.titleLarge)
            OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, singleLine = true, modifier = Modifier.fillMaxWidth().padding(top = 14.dp))
            OutlinedTextField(value = details, onValueChange = { details = it }, label = { Text("Details") }, minLines = 3, modifier = Modifier.fillMaxWidth().padding(top = 10.dp))
            error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 8.dp)) }
            Button(onClick = { onSubmit(title, details) }, modifier = Modifier.fillMaxWidth().padding(top = 16.dp)) { Text("Submit") }
        }
    }
}
