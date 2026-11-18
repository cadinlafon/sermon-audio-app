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
import com.palousefellowship.audio.data.model.NoticeButton
import com.palousefellowship.audio.data.model.resolve
import com.palousefellowship.audio.util.RichText

// Same amber tones as the web app's `noticeItem`/`pinnedBadge` (src/pages/Home.jsx).

/** One notice's own box, nested inside the outer "📌 Notices" card on
 * Home — mirrors the web's `noticeItem` styling exactly (a lighter amber
 * card-within-a-card, not a separate elevated card of its own). */
@Composable
fun NoticeCard(
    notice: Notice,
    onButtonClick: (NoticeButton) -> Unit,
    onSubmitInput: suspend (String) -> Unit,
    modifier: Modifier = Modifier,
    onPage: (String) -> Unit = {},
) {
    val x = com.palousefellowship.audio.ui.theme.PfaTheme.extras
    val st = notice.style.resolve()
    val titleColor = st.title ?: x.noticeTitle
    val textColor = st.text ?: x.noticeBody
    Card(
        modifier = modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = st.bg ?: x.noticeBg),
        border = BorderStroke(1.dp, st.border ?: x.noticeBorder),
        shape = RoundedCornerShape(12.dp),
    ) {
        Column(Modifier.padding(14.dp)) {
            if (notice.pinned) {
                Text(
                    "PINNED",
                    style = MaterialTheme.typography.labelSmall,
                    color = x.pinnedFg,
                    modifier = Modifier
                        .background(x.pinnedBg, RoundedCornerShape(999.dp))
                        .padding(horizontal = 8.dp, vertical = 2.dp),
                )
            }
            if (notice.title.isNotBlank()) {
                RichText(
                    text = notice.title,
                    style = MaterialTheme.typography.titleSmall,
                    color = titleColor,
                    linkColor = st.accent ?: titleColor,
                    onPage = onPage,
                    modifier = Modifier.padding(top = if (notice.pinned) 6.dp else 0.dp),
                )
            }
            if (notice.details.isNotBlank()) {
                RichText(
                    text = notice.details,
                    style = MaterialTheme.typography.bodyMedium,
                    color = textColor,
                    linkColor = st.accent ?: MaterialTheme.colorScheme.primary,
                    onPage = onPage,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
            NoticeButtonRow(notice.resolvedButtons(), st.accent, onButtonClick)
            if (notice.inputEnabled) {
                NoticeInputForm(notice = notice, onSubmit = onSubmitInput)
            }
        }
    }
}
