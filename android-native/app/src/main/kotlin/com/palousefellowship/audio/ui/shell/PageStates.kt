package com.palousefellowship.audio.ui.shell

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.data.config.PageConfig
import com.palousefellowship.audio.data.config.PageDecision
import com.palousefellowship.audio.data.config.Session
import com.palousefellowship.audio.data.config.resolvePageAccess
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private fun fmtDateTime(ms: Long?): String? = ms?.let { SimpleDateFormat("EEEE, MMMM d, h:mm a", Locale.US).format(Date(it)) }
private fun fmtDate(ms: Long?): String? = ms?.let { SimpleDateFormat("EEEE, MMMM d, yyyy", Locale.US).format(Date(it)) }

/** Port of PageGate.jsx — enforces Page Manager status/access rules on a route.
 * Pages with no registry entry (config == null) render unchanged. */
@Composable
fun PageGate(
    config: PageConfig?,
    session: Session,
    ready: Boolean,
    onLogin: () -> Unit,
    onHome: () -> Unit,
    content: @Composable () -> Unit,
) {
    if (!ready) return
    val decision = resolvePageAccess(config, session.uid, session.role, session.isAdmin)
    if (decision == PageDecision.LOGIN_REQUIRED) {
        LaunchedEffect(Unit) { onLogin() }
        return
    }
    when (decision) {
        PageDecision.OK, PageDecision.LOGIN_REQUIRED -> content()
        PageDecision.ACCESS_DENIED -> StateScreen("🚫", "You don't have access", "You don't have permission to view this page.", onHome = onHome)
        PageDecision.DISABLED -> StateScreen("⛔", "${config?.name ?: "This page"} is unavailable", "This page has been temporarily turned off. Please check back later.", onHome = onHome)
        PageDecision.LOCKED -> StateScreen("🔒", "${config?.name ?: "This page"} is locked", config?.description?.ifBlank { null } ?: "This page isn't available to you right now. Check back later.", onHome = onHome)
        PageDecision.MAINTENANCE -> StateScreen(
            "🔧",
            config?.maintenanceTitle?.ifBlank { null } ?: "${config?.name ?: "This page"} is under maintenance",
            config?.maintenanceMessage?.ifBlank { null } ?: "We're making some improvements here. Please check back soon.",
            infoLabel = "Expected return", infoValue = fmtDateTime(config?.maintenanceUntilMillis), onHome = onHome,
        )
        PageDecision.COMING_SOON -> StateScreen(
            "🚀",
            config?.comingSoonTitle?.ifBlank { null } ?: "${config?.name ?: "This page"} is coming soon",
            config?.comingSoonMessage?.ifBlank { null } ?: "${config?.name ?: "This page"} isn't available quite yet. Check back soon!",
            badge = config?.comingSoonBadge?.ifBlank { null },
            infoLabel = "Planned release", infoValue = fmtDate(config?.releaseDateMillis), onHome = onHome,
        )
    }
}

/** The whole-app "Down for Maintenance" page (ShutdownPage.jsx). */
@Composable
fun ShutdownScreen(message: String, returnDateMillis: Long?) {
    StateScreen(
        "🔧", "Down for Maintenance",
        message.ifBlank { "We're making some improvements. We'll be back shortly." },
        infoLabel = "Expected return", infoValue = fmtDateTime(returnDateMillis) ?: "Soon",
        onHome = null,
        footer = "Questions? Contact cadinlafon@gmail.com",
    )
}

@Composable
fun StateScreen(
    icon: String, title: String, subtitle: String,
    badge: String? = null, infoLabel: String? = null, infoValue: String? = null,
    onHome: (() -> Unit)?, footer: String? = null,
) {
    val colors = MaterialTheme.colorScheme
    Column(
        Modifier.fillMaxSize().background(colors.background).padding(horizontal = 24.dp, vertical = 48.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Box(
            Modifier.size(80.dp).clip(CircleShape).background(Brush.linearGradient(listOf(Color(0xFFE08930), AccentBrownDark))),
            contentAlignment = Alignment.Center,
        ) { Text(icon, fontSize = 34.sp) }
        Text(
            title, fontFamily = FontFamily.Serif, fontSize = 26.sp, color = colors.onBackground, textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 24.dp, bottom = 12.dp),
        )
        Text(subtitle, fontSize = 16.sp, lineHeight = 27.sp, color = colors.onSurfaceVariant, textAlign = TextAlign.Center, modifier = Modifier.padding(bottom = 24.dp))
        if (badge != null) {
            Text(
                badge, fontSize = 12.sp, color = Color(0xFF6547A5),
                modifier = Modifier.padding(bottom = 24.dp).background(Color(0xFFEEE8FF), RoundedCornerShape(999.dp)).padding(horizontal = 12.dp, vertical = 4.dp),
            )
        }
        if (infoLabel != null && infoValue != null) {
            Column(
                Modifier.padding(bottom = 28.dp).clip(RoundedCornerShape(16.dp)).background(colors.surface)
                    .border(1.dp, colors.outline, RoundedCornerShape(16.dp)).padding(horizontal = 32.dp, vertical = 20.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(infoLabel.uppercase(), fontSize = 11.sp, letterSpacing = 1.1.sp, color = Color(0xFFB08050), modifier = Modifier.padding(bottom = 6.dp))
                Text(infoValue, fontFamily = FontFamily.Serif, fontSize = 18.sp, color = colors.onBackground, textAlign = TextAlign.Center)
            }
        }
        if (onHome != null) {
            Text(
                "← Back to Home", color = Color(0xFFFFF8EE), fontSize = 14.sp,
                modifier = Modifier.clip(RoundedCornerShape(999.dp))
                    .background(Brush.linearGradient(listOf(AccentOrange, AccentBrownDark)))
                    .clickable(onClick = onHome).padding(horizontal = 24.dp, vertical = 12.dp),
            )
        }
        if (footer != null) Text(footer, fontSize = 13.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 28.dp))
    }
}
