package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.data.model.PageNotice
import com.palousefellowship.audio.data.model.resolve
import com.palousefellowship.audio.util.RichText
import com.palousefellowship.audio.ui.theme.PfaTheme

/** Page notices from Audio Page Manager → Notices (PageNoticeList.jsx),
 * already filtered for this page and placement. */
@Composable
fun PageNoticeList(
    notices: List<PageNotice>,
    isDismissed: (PageNotice) -> Boolean,
    onDismiss: (PageNotice) -> Unit,
    onOpenRoute: (String) -> Unit,
    onOpenUrl: (String) -> Unit,
    preview: Boolean = false,
) {
    var bump by remember { mutableIntStateOf(0) }
    @Suppress("UNUSED_EXPRESSION") bump
    val visible = notices.filter { preview || !isDismissed(it) }
    if (visible.isEmpty()) return
    val x = PfaTheme.extras
    Column(Modifier.fillMaxWidth().padding(bottom = 14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        visible.forEach { n ->
            val (icon, baseBg, baseBorder, baseTitle, baseText) = when (n.type) {
                "warning" -> Palette("⚠️", x.warnBg, x.warnBorder, x.warnTitle, x.warnText)
                "announcement" -> Palette("📣", x.annBg, x.annBorder, x.annTitle, x.annText)
                "important" -> Palette("❗", x.impBg, x.impBorder, x.impTitle, x.impText)
                else -> Palette("ℹ️", x.infoBg, x.infoBorder, x.infoTitle, x.infoText)
            }
            val own = n.style.resolve()
            val bg = own.bg ?: baseBg
            val border = own.border ?: baseBorder
            val titleC = own.title ?: baseTitle
            val textC = own.text ?: baseText
            val buttons = n.resolvedButtons()
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(bg)
                    .border(1.dp, border, RoundedCornerShape(14.dp)).padding(horizontal = 16.dp, vertical = 14.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text(icon, fontSize = 18.sp)
                Column(Modifier.weight(1f)) {
                    RichText(n.title, style = androidx.compose.ui.text.TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.Bold, fontSize = 15.sp), color = titleC, linkColor = own.accent ?: titleC, onPage = onOpenRoute)
                    if (n.message.isNotBlank()) RichText(n.message, style = androidx.compose.ui.text.TextStyle(fontSize = 13.sp, lineHeight = 21.sp), color = textC, linkColor = own.accent ?: titleC, onPage = onOpenRoute, modifier = Modifier.padding(top = 4.dp))
                    NoticeButtonRow(buttons, own.accent ?: titleC, onClick = { b ->
                        if (!preview) when (b.action) {
                            "page" -> onOpenRoute(b.value)
                            "email" -> onOpenUrl("mailto:${b.value}")
                            "phone" -> onOpenUrl("tel:${b.value.replace(" ", "")}")
                            else -> onOpenUrl(b.value)
                        }
                    })
                }
                if (n.dismissible) {
                    Text("✕", fontSize = 13.sp, color = textC, modifier = Modifier.clickable { if (!preview) { onDismiss(n); bump++ } }.padding(2.dp))
                }
            }
        }
    }
}

private data class Palette(val icon: String, val bg: Color, val border: Color, val title: Color, val text: Color)
