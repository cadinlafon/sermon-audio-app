package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.data.model.Notice

@Composable
fun NoticeCard(
    notice: Notice,
    onButtonClick: (Notice) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(16.dp),
    ) {
        Column(Modifier.padding(16.dp)) {
            if (notice.pinned) {
                AssistChip(onClick = {}, enabled = false, label = { Text("Pinned") })
            }
            Text(
                text = notice.title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(top = if (notice.pinned) 8.dp else 0.dp),
            )
            if (notice.details.isNotBlank()) {
                Text(
                    text = notice.details,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
            if (notice.buttonEnabled && !notice.buttonValue.isNullOrBlank()) {
                Row(Modifier.padding(top = 12.dp)) {
                    OutlinedButton(onClick = { onButtonClick(notice) }) {
                        Text((notice.buttonText?.takeIf { it.isNotBlank() } ?: "Learn More") + " →")
                    }
                }
            }
        }
    }
}
