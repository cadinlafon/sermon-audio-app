package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.data.model.typeIcon

@Composable
fun ResourceCard(resource: Resource, onClick: () -> Unit, modifier: Modifier = Modifier) {
    Card(onClick = onClick, modifier = modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
        Row(Modifier.padding(14.dp), verticalAlignment = Alignment.CenterVertically) {
            if (resource.thumbnailUrl.isNotBlank()) {
                AsyncImage(
                    model = resource.thumbnailUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Crop,
                    modifier = Modifier.size(52.dp).padding(end = 12.dp),
                )
            } else {
                Text(resource.typeIcon(), style = MaterialTheme.typography.headlineSmall, modifier = Modifier.padding(end = 12.dp))
            }
            Column(Modifier.weight(1f)) {
                Text(resource.title, style = MaterialTheme.typography.titleMedium, maxLines = 2)
                if (resource.description.isNotBlank()) {
                    Text(
                        resource.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                    )
                }
                if (resource.author.isNotBlank()) {
                    Text(resource.author, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
                }
            }
        }
    }
}
