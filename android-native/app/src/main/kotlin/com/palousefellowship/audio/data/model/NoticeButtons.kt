package com.palousefellowship.audio.data.model

import androidx.compose.ui.graphics.Color

/** A button an admin made (web: src/lib/actionButtons.js). Popups can't be opened natively yet,
 * so those buttons are left out of what the app shows. */
data class NoticeButton(
    val id: String = "",
    val text: String = "",
    val action: String = "url", // url | page | popup | email | phone | dismiss
    val value: String = "",
    val variant: String = "solid", // solid | outline | soft | link
    val bg: String = "",
    val color: String = "",
    val newTab: Boolean = true,
)

/** Colors an admin picked for a notice (web: src/lib/colors.js). Empty = follow the theme. */
data class NoticeStyle(
    val preset: String = "default",
    val bg: String = "",
    val border: String = "",
    val title: String = "",
    val text: String = "",
    val accent: String = "",
)

private data class Preset(val bg: String, val border: String, val title: String, val text: String, val accent: String)

private val PRESETS = mapOf(
    "amber" to Preset("#fffbee", "#f0d898", "#3d2600", "#6b4c20", "#c97c2e"),
    "blue" to Preset("#e8f0fe", "#b9cdf5", "#1f4a9a", "#345b91", "#2a5ab5"),
    "green" to Preset("#e3f5e6", "#bfe6c8", "#1f6b37", "#286a31", "#2f8a4a"),
    "red" to Preset("#fee2e2", "#fca5a5", "#991b1b", "#7f1d1d", "#dc2626"),
    "purple" to Preset("#f1ebff", "#d4c5f9", "#5b21b6", "#6547a5", "#7c3aed"),
    "rose" to Preset("#fdecf3", "#f6c5da", "#9d174d", "#a33b70", "#db2777"),
    "dark" to Preset("#2a1c0a", "#4a2a08", "#fff8ee", "#e8d9c0", "#e0a458"),
    "brand" to Preset("#a85e18", "#8a4f12", "#fff8ee", "#ffe9cc", "#fff8ee"),
)

fun parseHex(hex: String?): Color? {
    val h = hex?.trim().orEmpty()
    if (!Regex("^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$").matches(h)) return null
    return runCatching { Color(android.graphics.Color.parseColor(if (h.length == 4) "#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}" else h)) }.getOrNull()
}

data class ResolvedStyle(val bg: Color?, val border: Color?, val title: Color?, val text: Color?, val accent: Color?)

fun NoticeStyle?.resolve(): ResolvedStyle {
    val s = this ?: NoticeStyle()
    val p = PRESETS[s.preset]
    fun pick(own: String, preset: String?) = parseHex(own) ?: parseHex(preset)
    return ResolvedStyle(pick(s.bg, p?.bg), pick(s.border, p?.border), pick(s.title, p?.title), pick(s.text, p?.text), pick(s.accent, p?.accent))
}

/** The buttons to show: the new list, or the older single button read as one. */
fun buttonsFor(buttons: List<NoticeButton>, legacyEnabled: Boolean, legacyText: String?, legacyType: String?, legacyValue: String?): List<NoticeButton> {
    val list = if (buttons.isNotEmpty()) buttons
    else if (legacyEnabled && !legacyValue.isNullOrBlank()) listOf(NoticeButton("legacy", legacyText?.ifBlank { null } ?: "Learn More", if (legacyType == "page") "page" else "url", legacyValue, "outline"))
    else emptyList()
    return list.filter { it.text.isNotBlank() && it.action in setOf("url", "page", "email", "phone") && it.value.isNotBlank() }
}
