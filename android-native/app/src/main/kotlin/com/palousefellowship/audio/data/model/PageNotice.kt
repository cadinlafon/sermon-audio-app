package com.palousefellowship.audio.data.model

import java.util.Calendar

/** `pageNotices/{id}` — messages the admin shows on the audio pages (Audio
 * Page Manager → Notices). See src/utils/pageNotices.js. */
data class PageNotice(
    val id: String = "", // set from the doc id by the repository
    val title: String = "",
    val message: String = "",
    val enabled: Boolean = true,
    val page: String = "all",          // sermons | sundayschool | all
    val placement: String? = null,     // pageTop | aboveFilters | aboveList | belowList
    val position: String? = null,      // legacy "top" | "bottom"
    val type: String = "info",         // info | warning | announcement | important
    val startDate: String? = null,
    val endDate: String? = null,
    val linkUrl: String? = null,
    val linkText: String? = null,
    val dismissible: Boolean = false,
    val categories: List<String> = emptyList(),
) {
    val resolvedPlacement: String
        get() = if (placement in listOf("pageTop", "aboveFilters", "aboveList", "belowList")) placement!! else if (position == "bottom") "belowList" else "aboveList"

    fun isActive(today: String = todayString()): Boolean {
        if (!enabled) return false
        if (!startDate.isNullOrEmpty() && today < startDate) return false
        if (!endDate.isNullOrEmpty() && today > endDate) return false
        return true
    }

    fun applies(pageKey: String, pageCategories: List<String>, typeFilter: String): Boolean {
        if (!isActive()) return false
        if (page != pageKey && page != "all") return false
        if (categories.isEmpty()) return true
        return if (typeFilter == "all") pageCategories.any { it in categories } else typeFilter in categories
    }

    /** Safe link target: http(s) URLs (external) or an in-app "/path". */
    fun link(): NoticeLink? {
        val url = linkUrl?.trim().orEmpty()
        if (url.isEmpty()) return null
        val text = linkText?.trim()?.ifEmpty { null } ?: "Learn more"
        return when {
            Regex("^https?://", RegexOption.IGNORE_CASE).containsMatchIn(url) -> NoticeLink(url, true, text)
            url.startsWith("/") && !url.startsWith("//") -> NoticeLink(url, false, text)
            else -> null
        }
    }

    /** Editing a notice's text brings it back for people who dismissed the old one. */
    val fingerprint: String
        get() = "$id:${title.length}:${message.length}:${title.firstOrNull()?.code ?: 0}:${message.firstOrNull()?.code ?: 0}"
}

data class NoticeLink(val href: String, val external: Boolean, val text: String)

fun todayString(): String {
    val c = Calendar.getInstance()
    return "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
}
