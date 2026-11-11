package com.palousefellowship.audio.ui.theme

import androidx.compose.runtime.Composable
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.graphics.Color

/** The web app's secondary palette (tags, badges, notices, chips…), each with
 * the light value and the exact dark value from src/theme-tokens.css. */
data class PfaExtras(
    val sermonTagBg: Color, val sermonTagFg: Color,
    val homilyTagBg: Color, val homilyTagFg: Color,
    val sundayTagBg: Color, val sundayTagFg: Color,
    val newBg: Color, val newFg: Color,
    val durationBg: Color, val durationFg: Color,
    val greenBg: Color, val greenFg: Color, val greenBorder: Color,
    val noticeBg: Color, val noticeBorder: Color, val noticeTitle: Color, val noticeBody: Color,
    val pinnedBg: Color, val pinnedFg: Color,
    val chipBg: Color, val selectedBg: Color, val selectedBorder: Color,
    val bodyMuted: Color, val buttonText: Color, val buttonBorder: Color,
    val navInactive: Color, val gold: Color, val trackBg: Color,
    val infoBg: Color, val infoBorder: Color, val infoTitle: Color, val infoText: Color,
    val annBg: Color, val annBorder: Color, val annTitle: Color, val annText: Color,
    val impBg: Color, val impBorder: Color, val impTitle: Color, val impText: Color,
    val warnBg: Color, val warnBorder: Color, val warnTitle: Color, val warnText: Color,
    val softBg: Color,
)

val LightExtras = PfaExtras(
    sermonTagBg = Color(0xFFF6E4B0), sermonTagFg = Color(0xFF7A5A10),
    homilyTagBg = Color(0xFFE8F0FE), homilyTagFg = Color(0xFF2A5AB5),
    sundayTagBg = Color(0xFFE9F5E8), sundayTagFg = Color(0xFF39763C),
    newBg = Color(0xFFFDE8B8), newFg = Color(0xFF8A5A10),
    durationBg = Color(0xFFF0E4D0), durationFg = Color(0xFF7A5530),
    greenBg = Color(0xFFE3F5E6), greenFg = Color(0xFF2F8A4A), greenBorder = Color(0xFFBFE6C8),
    noticeBg = Color(0xFFFFFBEE), noticeBorder = Color(0xFFF0D898), noticeTitle = Color(0xFF3D2600), noticeBody = Color(0xFF6B4C20),
    pinnedBg = Color(0xFFF6E4B0), pinnedFg = Color(0xFF7A5A10),
    chipBg = Color(0xFFF4E7D4), selectedBg = Color(0xFFFDE8B8), selectedBorder = Color(0xFFE5C27A),
    bodyMuted = Color(0xFF7A5530), buttonText = Color(0xFF7A4F10), buttonBorder = Color(0xFFC8922A),
    navInactive = Color(0xFFB08050), gold = Color(0xFFC97C2E), trackBg = Color(0xFFEDDFC8),
    infoBg = Color(0xFFE8F0FE), infoBorder = Color(0x472A5AB5), infoTitle = Color(0xFF2A5AB5), infoText = Color(0xFF345B91),
    annBg = Color(0xFFE3F5E6), annBorder = Color(0xFFBFE6C8), annTitle = Color(0xFF2F8A4A), annText = Color(0xFF286A31),
    impBg = Color(0xFFFEE2E2), impBorder = Color(0xFFFCA5A5), impTitle = Color(0xFF991B1B), impText = Color(0xFF3A120A),
    warnBg = Color(0xFFFFFBEE), warnBorder = Color(0xFFF0D898), warnTitle = Color(0xFF3D2200), warnText = Color(0xFF7A5530),
    softBg = Color(0xFFF0E4D0),
)

val DarkExtras = PfaExtras(
    sermonTagBg = Color(0xFF4A3E1C), sermonTagFg = Color(0xFFE7CC8D),
    homilyTagBg = Color(0xFF161E2D), homilyTagFg = Color(0xFF6388CF),
    sundayTagBg = Color(0xFF1B281A), sundayTagFg = Color(0xFF8EC190),
    newBg = Color(0xFF4A3C1C), newFg = Color(0xFFE6BD7E),
    durationBg = Color(0xFF433723), durationFg = Color(0xFFC9AA8B),
    greenBg = Color(0xFF192A1B), greenFg = Color(0xFF7CC993), greenBorder = Color(0xFF26402C),
    noticeBg = Color(0xFF2D2716), noticeBorder = Color(0xFF4A3D1C), noticeTitle = Color(0xFFE8E2D9), noticeBody = Color(0xFFD9BF9A),
    pinnedBg = Color(0xFF4A3E1C), pinnedFg = Color(0xFFE7CC8D),
    chipBg = Color(0xFF2C2316), selectedBg = Color(0xFF4A3C1C), selectedBorder = Color(0xFFE4C076),
    bodyMuted = Color(0xFFC9AA8B), buttonText = Color(0xFFE7C28D), buttonBorder = Color(0xFFE0B96D),
    navInactive = Color(0xFFCCAD8F), gold = Color(0xFFDFAA74), trackBg = Color(0xFF433723),
    infoBg = Color(0xFF161E2D), infoBorder = Color(0x476388CF), infoTitle = Color(0xFF6388CF), infoText = Color(0xFF7596C4),
    annBg = Color(0xFF192A1B), annBorder = Color(0xFF26402C), annTitle = Color(0xFF7CC993), annText = Color(0xFF9AD2A2),
    impBg = Color(0xFF2D1616), impBorder = Color(0xFF4A1C1C), impTitle = Color(0xFFDB6F6F), impText = Color(0xFFE6D7D4),
    warnBg = Color(0xFF2D2716), warnBorder = Color(0xFF4A3D1C), warnTitle = Color(0xFFE8E1D9), warnText = Color(0xFFC9AA8B),
    softBg = Color(0xFF433723),
)

val LocalPfaExtras = staticCompositionLocalOf { LightExtras }

object PfaTheme {
    val extras: PfaExtras @Composable get() = LocalPfaExtras.current
}
