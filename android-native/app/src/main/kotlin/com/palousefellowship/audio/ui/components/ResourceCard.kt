package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil.compose.AsyncImage
import com.palousefellowship.audio.data.model.EXTERNAL_LINK_TYPES
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.data.model.actionLabel
import com.palousefellowship.audio.data.model.typeIcon
import com.palousefellowship.audio.data.model.typeLabel
import com.palousefellowship.audio.ui.theme.PfaTheme

private fun fmtDate(v: String): String {
    val p = v.split("-").mapNotNull { it.toIntOrNull() }
    if (p.size < 3) return ""
    return "${com.palousefellowship.audio.data.config.MONTHS[p[1] - 1].take(3)} ${p[2]}, ${p[0]}"
}

/** Port of ResourceCard.jsx: thumbnail with type + featured badges, title, description, author · date · category, action. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ResourceCard(resource: Resource, categoryName: String?, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val c = MaterialTheme.colorScheme
    val x = PfaTheme.extras
    Column(modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp)).background(c.surface).border(1.dp, c.outline, RoundedCornerShape(16.dp)).clickable(onClick = onClick)) {
        Box(Modifier.fillMaxWidth().height(140.dp).background(x.chipBg)) {
            if (resource.thumbnailUrl.isNotBlank()) AsyncImage(resource.thumbnailUrl, null, Modifier.fillMaxSize(), contentScale = ContentScale.Crop)
            else Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { Text(resource.typeIcon(), fontSize = 30.sp) }
            Text(
                "${resource.typeIcon()} ${resource.typeLabel()}", fontSize = 11.sp, fontWeight = FontWeight.SemiBold, color = Color(0xFF7A4F10),
                modifier = Modifier.align(Alignment.TopStart).padding(10.dp).background(Color(0xEBFFFDF9), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 4.dp),
            )
            if (resource.featured) Text(
                "★ Featured", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFF7A5A10),
                modifier = Modifier.align(Alignment.TopEnd).padding(10.dp).background(Color(0xFFF6E4B0), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 4.dp),
            )
        }
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(resource.title, fontFamily = FontFamily.Serif, fontSize = 16.sp, lineHeight = 21.sp, color = c.onBackground)
            if (resource.description.isNotBlank()) Text(resource.description, fontSize = 13.sp, lineHeight = 19.sp, color = x.bodyMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                if (resource.author.isNotBlank()) Text(resource.author, fontSize = 12.sp, color = c.onSurfaceVariant)
                if (resource.date.isNotBlank()) fmtDate(resource.date).takeIf { it.isNotEmpty() }?.let { Text(it, fontSize = 12.sp, color = c.onSurfaceVariant) }
                if (!categoryName.isNullOrBlank()) Text(categoryName, fontSize = 11.sp, color = x.buttonText, modifier = Modifier.background(x.chipBg, RoundedCornerShape(999.dp)).padding(horizontal = 8.dp, vertical = 2.dp))
            }
            Text(
                resource.actionLabel() + if (resource.type in EXTERNAL_LINK_TYPES) " ↗" else "", fontSize = 13.sp, color = x.buttonText,
                modifier = Modifier.padding(top = 2.dp).clip(RoundedCornerShape(999.dp)).border(1.dp, x.buttonBorder, RoundedCornerShape(999.dp)).padding(horizontal = 14.dp, vertical = 8.dp),
            )
        }
    }
}
