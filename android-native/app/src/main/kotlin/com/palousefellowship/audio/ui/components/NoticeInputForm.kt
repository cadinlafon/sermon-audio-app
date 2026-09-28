package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.data.model.Notice
import kotlinx.coroutines.launch

private const val PREFS_NAME = "notice_submissions"

/** One free-text reply per notice per device — mirrors
 * src/components/NoticeInputForm.jsx, including remembering that this
 * notice was already answered (there: localStorage; here: SharedPreferences,
 * the same "small per-device flag" idea). */
@Composable
fun NoticeInputForm(notice: Notice, onSubmit: suspend (String) -> Unit) {
    val context = LocalContext.current
    val prefs = remember { context.getSharedPreferences(PREFS_NAME, 0) }
    val storageKey = "notice:${notice.id}"

    var value by rememberSaveable { mutableStateOf("") }
    var submitting by remember { mutableStateOf(false) }
    var submitted by rememberSaveable { mutableStateOf(prefs.getBoolean(storageKey, false)) }
    var error by remember { mutableStateOf("") }
    val scope = rememberCoroutineScope()

    if (submitted) {
        Row(Modifier.padding(top = 12.dp)) {
            Text("✓ Submitted!", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.bodyMedium)
        }
        return
    }

    Column(Modifier.padding(top = 12.dp)) {
        notice.inputMessage?.takeIf { it.isNotBlank() }?.let {
            Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(bottom = 8.dp))
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = value,
                onValueChange = { value = it; error = "" },
                placeholder = { Text(notice.inputPlaceholder?.takeIf { it.isNotBlank() } ?: "Enter value") },
                singleLine = true,
                enabled = !submitting,
                modifier = Modifier.weight(1f),
            )
            Button(
                onClick = {
                    val trimmed = value.trim()
                    if (trimmed.isEmpty()) { error = "Please enter a value."; return@Button }
                    submitting = true
                    scope.launch {
                        runCatching { onSubmit(trimmed) }
                            .onSuccess {
                                submitted = true
                                prefs.edit().putBoolean(storageKey, true).apply()
                            }
                            .onFailure { error = "Something went wrong. Please try again." }
                        submitting = false
                    }
                },
                enabled = !submitting,
                modifier = Modifier.padding(start = 8.dp),
            ) {
                if (submitting) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                else Text(notice.inputButtonText?.takeIf { it.isNotBlank() } ?: "Submit")
            }
        }
        if (error.isNotBlank()) {
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
        }
    }
}
