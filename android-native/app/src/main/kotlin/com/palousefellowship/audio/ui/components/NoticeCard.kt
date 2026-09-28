package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.data.model.Notice

// Same amber tones as the web app's `noticeItem`/`pinnedBadge` (src/pages/Home.jsx).
private val NoticeItemBg = Color(0xFFFFFBEE)
private val NoticeItemBorder = Color(0xFFF0D898)
private val PinnedBg = Color(0xFFF6E4B0)
private val PinnedText = Color(0xFF7A5A10)
private val NoticeTitleColor = Color(0xFF3D2600)
private val NoticeBodyColor = Color(0xFF6B4C20)

/** One notice's own box, nested inside the outer "📌 Notices" card on
 * Home — mirrors the web's `noticeItem` styling exactly (a lighter amber
 * card-within-a-card, not a separate elevated card of its own). */
@Composable
fun NoticeCard(
    notice: Notice,
    onButtonClick: (Notice) -> Unit,
    onSubmitInput: suspend (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = NoticeItemBg),
        border = BorderStroke(1.dp, NoticeItemBorder),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            if (notice.pinned) {
                Text(
                    "PINNED",
                    style = MaterialTheme.typography.labelSmall,
                    color = PinnedText,
                    modifier = Modifier
                        .background(PinnedBg, RoundedCornerShape(999.dp))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
            Text(
                text = notice.title,
                style = MaterialTheme.typography.titleSmall,
                color = NoticeTitleColor,
                modifier = Modifier.padding(top = if (notice.pinned) 6.dp else 0.dp),
            )
            if (notice.details.isNotBlank()) {
                Text(
                    text = notice.details,
                    style = MaterialTheme.typography.bodyMedium,
                    color = NoticeBodyColor,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            if (notice.buttonEnabled && !notice.buttonValue.isNullOrBlank()) {
                Row(Modifier.padding(top = 10.dp)) {
                    OutlinedButton(onClick = { onButtonClick(notice) }) {
                        Text((notice.buttonText?.takeIf { it.isNotBlank() } ?: "Learn More") + " →")
                    }
                }
            }
            if (notice.inputEnabled) {
                NoticeInputForm(notice = notice, onSubmit = onSubmitInput)
            }
        }
    }
}
