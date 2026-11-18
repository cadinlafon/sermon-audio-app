package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.data.model.NoticeButton
import com.palousefellowship.audio.data.model.parseHex

private fun readableOn(c: Color): Color = if (0.2126f * c.red + 0.7152f * c.green + 0.0722f * c.blue > 0.45f) Color(0xFF2A1500) else Color.White

/** The buttons an admin made on a notice / page notice / Doctrine, each with its own look. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun NoticeButtonRow(buttons: List<NoticeButton>, accent: Color?, onClick: (NoticeButton) -> Unit, modifier: Modifier = Modifier) {
    if (buttons.isEmpty()) return
    FlowRow(modifier.padding(top = 10.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        buttons.forEach { b ->
            val base = parseHex(b.bg) ?: accent
            val textOverride = parseHex(b.color)
            val shape = RoundedCornerShape(999.dp)
            val label = b.text + if (b.action == "url" && b.variant != "link") " ↗" else ""
            when (b.variant) {
                "outline" -> OutlinedButton(onClick = { onClick(b) }, shape = shape, border = BorderStroke(1.dp, base ?: MaterialTheme.colorScheme.outline), colors = ButtonDefaults.outlinedButtonColors(contentColor = textOverride ?: base ?: MaterialTheme.colorScheme.primary), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) { Text(label) }
                "soft" -> Button(onClick = { onClick(b) }, shape = shape, colors = ButtonDefaults.buttonColors(containerColor = (base ?: MaterialTheme.colorScheme.primary).copy(alpha = 0.16f), contentColor = textOverride ?: base ?: MaterialTheme.colorScheme.primary), elevation = null, contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) { Text(label) }
                "link" -> TextButton(onClick = { onClick(b) }, colors = ButtonDefaults.textButtonColors(contentColor = textOverride ?: base ?: MaterialTheme.colorScheme.primary)) { Text(label) }
                else -> {
                    val bg = base ?: MaterialTheme.colorScheme.primary
                    Button(onClick = { onClick(b) }, shape = shape, colors = ButtonDefaults.buttonColors(containerColor = bg, contentColor = textOverride ?: readableOn(bg)), contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp)) { Text(label) }
                }
            }
        }
    }
}
