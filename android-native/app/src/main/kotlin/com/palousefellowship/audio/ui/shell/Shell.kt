package com.palousefellowship.audio.ui.shell

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ColorFilter
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.palousefellowship.audio.R
import com.palousefellowship.audio.data.config.BADGE_COLORS
import com.palousefellowship.audio.data.config.PageConfig
import com.palousefellowship.audio.data.config.Session
import com.palousefellowship.audio.data.prefs.ThemePreference
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.AccentOrange

/** Page Manager icons are either a legacy "/navigation/..." image path or an emoji. */
private fun navDrawable(icon: String): Int? = when (icon) {
    "/navigation/home.png" -> R.drawable.nav_home
    "/navigation/sermons.png" -> R.drawable.nav_sermons
    "/navigation/sundayschool.png" -> R.drawable.nav_sundayschool
    "/navigation/more.png" -> R.drawable.nav_more
    else -> null
}

@Composable
fun PageIcon(icon: String, size: androidx.compose.ui.unit.Dp, tint: Color? = null, modifier: Modifier = Modifier) {
    val res = navDrawable(icon)
    if (res != null) {
        Image(
            painterResource(res), contentDescription = null,
            modifier = modifier.size(size),
            contentScale = ContentScale.Fit,
            colorFilter = tint?.let { ColorFilter.tint(it) },
        )
    } else {
        Box(modifier.size(size), contentAlignment = Alignment.Center) {
            Text(icon, fontSize = (size.value - 4).sp, lineHeight = size.value.sp, style = androidx.compose.ui.text.TextStyle(platformStyle = androidx.compose.ui.text.PlatformTextStyle(includeFontPadding = false)))
        }
    }
}

// ───────────────────────────── TOP BAR ─────────────────────────────

@Composable
fun PfaTopBar(
    session: Session,
    themePreference: ThemePreference,
    unreadReplies: Int,
    onSearch: () -> Unit,
    onCycleTheme: () -> Unit,
    onAccount: () -> Unit,
) {
    val border = MaterialTheme.colorScheme.outline
    Column(Modifier.background(MaterialTheme.colorScheme.surface).statusBarsPadding()) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text(
                "Palouse Fellowship",
                fontFamily = FontFamily.Serif,
                fontSize = 17.sp,
                letterSpacing = 0.17.sp,
                color = MaterialTheme.colorScheme.onBackground,
            )
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                RoundIconButton("🔍", "Search", onSearch)
                RoundIconButton(themePreference.icon, "Theme: ${themePreference.key}. Tap to change", onCycleTheme)
                Box(Modifier.clickable(onClick = onAccount)) {
                    if (session.signedIn) {
                        val initial = (session.email ?: session.displayName ?: "?").firstOrNull()?.uppercase() ?: "?"
                        Box(
                            Modifier.size(36.dp).clip(CircleShape)
                                .background(Brush.linearGradient(listOf(AccentOrange, AccentBrownDark))),
                            contentAlignment = Alignment.Center,
                        ) { Text(initial, color = Color(0xFFFFF8EE), fontWeight = FontWeight.SemiBold, fontSize = 15.sp) }
                    } else {
                        Image(
                            painterResource(R.drawable.account_icon), "Account",
                            Modifier.size(36.dp).clip(CircleShape), contentScale = ContentScale.Crop,
                        )
                    }
                    if (session.signedIn && unreadReplies > 0) {
                        Box(Modifier.align(Alignment.TopEnd).size(10.dp).clip(CircleShape).background(Color(0xFFDC2626)).border(2.dp, MaterialTheme.colorScheme.surface, CircleShape))
                    }
                }
            }
        }
        HorizontalDivider(color = border)
    }
}

@Composable
private fun RoundIconButton(glyph: String, description: String, onClick: () -> Unit) {
    Box(
        Modifier.size(36.dp).clip(CircleShape)
            .background(MaterialTheme.colorScheme.background)
            .border(1.dp, MaterialTheme.colorScheme.outline, CircleShape)
            .clickable(onClickLabel = description, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(glyph, fontSize = 15.sp) }
}

// ───────────────────────────── BOTTOM BAR ─────────────────────────────

@Composable
fun PfaBottomBar(
    primaryPages: List<PageConfig>,
    currentRoute: String?,
    onNavigate: (PageConfig) -> Unit,
    onMore: () -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    Column(Modifier.background(colors.surface).navigationBarsPadding()) {
        HorizontalDivider(color = colors.outline)
        Row(Modifier.fillMaxWidth().padding(top = 8.dp, bottom = 8.dp), horizontalArrangement = Arrangement.SpaceAround) {
            primaryPages.forEach { p ->
                NavButton(
                    icon = p.icon, label = p.displayName, active = p.nativeRoute == currentRoute,
                    badgeText = p.badgeText.takeIf { p.badgeEnabled }, badgeColor = p.badgeColor, locked = p.locked,
                    onClick = { onNavigate(p) },
                )
            }
            NavButton(icon = "/navigation/more.png", label = "More", active = false, onClick = onMore)
        }
    }
}

@Composable
private fun NavButton(
    icon: String, label: String, active: Boolean, onClick: () -> Unit,
    badgeText: String? = null, badgeColor: String = "amber", locked: Boolean = false,
) {
    val dark = MaterialTheme.colorScheme.background.luminance() < 0.5f
    val activeColor = MaterialTheme.colorScheme.primary
    val inactiveColor = if (dark) Color(0xFFCCAD8F) else Color(0xFFB08050)
    Column(
        Modifier.clickable(onClick = onClick, indication = null, interactionSource = androidx.compose.runtime.remember { androidx.compose.foundation.interaction.MutableInteractionSource() })
            .padding(horizontal = 6.dp).widthIn(min = 56.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Box {
            Box(Modifier.alpha(if (active) 1f else 0.45f)) {
                PageIcon(icon, 22.dp, tint = if (navDrawable(icon) != null) (if (dark) Color(0xFFCCAD8F) else if (active) MaterialTheme.colorScheme.onSurfaceVariant else null) else null)
            }
            if (locked) Text("🔒", fontSize = 9.sp, modifier = Modifier.align(Alignment.BottomEnd).padding(start = 18.dp, top = 14.dp))
            if (!badgeText.isNullOrBlank()) {
                val c = BADGE_COLORS[badgeColor] ?: BADGE_COLORS.getValue("amber")
                Text(
                    badgeText, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color(c.fg), maxLines = 1,
                    modifier = Modifier.align(Alignment.TopEnd).padding(start = 18.dp, bottom = 12.dp)
                        .background(Color(c.bg), RoundedCornerShape(999.dp)).padding(horizontal = 5.dp, vertical = 1.dp),
                )
            }
        }
        Text(
            label, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis,
            color = if (active) activeColor else inactiveColor,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Normal,
            textAlign = TextAlign.Center, modifier = Modifier.widthIn(max = 64.dp),
        )
    }
}

private fun Color.luminance(): Float = 0.2126f * red + 0.7152f * green + 0.0722f * blue

// ───────────────────────────── MORE SHEET ─────────────────────────────

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MoreSheet(
    morePages: List<PageConfig>,
    session: Session,
    showSettings: Boolean,
    onPage: (PageConfig) -> Unit,
    onSettings: () -> Unit,
    onDevInfo: () -> Unit,
    onDismiss: () -> Unit,
) {
    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(topStart = 22.dp, topEnd = 22.dp),
    ) {
        Column(Modifier.padding(horizontal = 20.dp).padding(bottom = 24.dp).navigationBarsPadding()) {
            Text(
                "More", fontFamily = FontFamily.Serif, fontSize = 15.sp, textAlign = TextAlign.Center,
                color = MaterialTheme.colorScheme.onBackground, modifier = Modifier.fillMaxWidth().padding(bottom = 16.dp),
            )
            if (morePages.isNotEmpty()) {
                SheetGrid {
                    morePages.forEach { p ->
                        SheetButton(p.icon, p.displayName, onClick = { onPage(p) }, badgeText = p.badgeText.takeIf { p.badgeEnabled }, badgeColor = p.badgeColor, locked = p.locked)
                    }
                }
                HorizontalDivider(Modifier.padding(vertical = 14.dp), color = MaterialTheme.colorScheme.outline)
            }
            SheetGrid {
                if (showSettings) SheetButton("⚙️", "Settings", onClick = onSettings, muted = !session.signedIn)
                SheetButton("🧑‍💻", "Dev Info", onClick = onDevInfo)
            }
            TextButton(
                onClick = onDismiss,
                modifier = Modifier.padding(top = 18.dp).fillMaxWidth().height(48.dp)
                    .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(12.dp)),
            ) { Text("Close", color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
    }
}

@Composable
private fun SheetGrid(content: @Composable () -> Unit) {
    // Three equal columns, wrapping — a tiny stand-in for CSS grid 3×N.
    androidx.compose.ui.layout.Layout(content = content) { measurables, constraints ->
        val gap = 10.dp.roundToPx()
        val w = (constraints.maxWidth - gap * 2) / 3
        val placeables = measurables.map { it.measure(constraints.copy(minWidth = w, maxWidth = w, minHeight = 0)) }
        val rows = placeables.chunked(3)
        val rowHeights = rows.map { r -> r.maxOf { it.height } }
        val height = rowHeights.sum() + gap * (rows.size - 1).coerceAtLeast(0)
        layout(constraints.maxWidth, height) {
            var y = 0
            rows.forEachIndexed { i, r ->
                r.forEachIndexed { c, p -> p.placeRelative(c * (w + gap), y) }
                y += rowHeights[i] + gap
            }
        }
    }
}

@Composable
private fun SheetButton(
    icon: String, label: String, onClick: () -> Unit,
    muted: Boolean = false, badgeText: String? = null, badgeColor: String = "amber", locked: Boolean = false,
) {
    Column(
        Modifier.alpha(if (muted) 0.45f else 1f)
            .clip(RoundedCornerShape(14.dp))
            .background(MaterialTheme.colorScheme.background)
            .border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 8.dp, vertical = 14.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Box {
            PageIcon(icon, 24.dp)
            if (locked) Text("🔒", fontSize = 9.sp, modifier = Modifier.align(Alignment.BottomEnd))
            if (!badgeText.isNullOrBlank()) {
                val c = BADGE_COLORS[badgeColor] ?: BADGE_COLORS.getValue("amber")
                Text(
                    badgeText, fontSize = 8.sp, fontWeight = FontWeight.Bold, color = Color(c.fg), maxLines = 1,
                    modifier = Modifier.align(Alignment.TopEnd).padding(start = 22.dp, bottom = 14.dp)
                        .background(Color(c.bg), RoundedCornerShape(999.dp)).padding(horizontal = 5.dp, vertical = 1.dp),
                )
            }
        }
        Text(label, fontSize = 12.sp, maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onBackground.copy(alpha = 0.9f))
    }
}
