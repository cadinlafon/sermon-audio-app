package com.palousefellowship.audio.ui.screens.audiolist

import com.palousefellowship.audio.data.config.DURATIONS
import com.palousefellowship.audio.data.config.MONTHS
import com.palousefellowship.audio.data.config.STATUSES
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import java.util.Calendar
import java.util.Date

/** Search / filter / sort state of one audio list (src/hooks/useAudioFilters.js). */
data class AudioFilters(
    val search: String = "",
    val speaker: String = "all",
    val type: String = "all",
    val series: String = "all",
    val sort: String = "newest",
    val duration: String = "any",
    val year: String = "all",
    val month: String = "all",
    val status: String = "all",
    val liked: Boolean = false,
    val downloaded: Boolean = false,
)

data class FilterChip(val key: String, val label: String, val clear: (AudioFilters) -> AudioFilters)

data class FilterOptions(val speakers: List<String>, val years: List<Int>, val series: List<String>)

data class YearMonth(val y: Int, val m: Int)

fun dateOf(a: Audio): YearMonth? {
    val d = a.date
    if (d != null && Regex("""^\d{4}-\d{2}-\d{2}""").containsMatchIn(d)) return YearMonth(d.substring(0, 4).toInt(), d.substring(5, 7).toInt())
    val ts = a.createdAt ?: return null
    val c = Calendar.getInstance().apply { time = Date(ts.seconds * 1000) }
    return YearMonth(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1)
}

fun createdMs(a: Audio): Long = a.createdAt?.let { it.seconds * 1000 }
    ?: a.date?.let { runCatching { java.time.LocalDate.parse(it.take(10)).atStartOfDay(java.time.ZoneId.systemDefault()).toInstant().toEpochMilli() }.getOrNull() }
    ?: 0L

private fun searchText(a: Audio, fields: Map<String, Boolean>): String {
    val parts = mutableListOf<String?>()
    if (fields["title"] != false) parts += a.title
    if (fields["speaker"] != false) parts += a.speaker
    if (fields["series"] == true) parts += a.series
    if (fields["summary"] == true) parts += a.aiSummary
    if (fields["date"] == true) {
        parts += a.date
        dateOf(a)?.let { parts += "${MONTHS[it.m - 1]} ${it.y}" }
    }
    return parts.filterNotNull().filter { it.isNotEmpty() }.joinToString(" ").lowercase()
}

private fun inDuration(seconds: Long, bucket: String): Boolean {
    if (bucket == "any") return true
    val m = seconds / 60.0
    if (m == 0.0) return false
    return when (bucket) { "short" -> m < 15; "medium" -> m in 15.0..<30.0; "long" -> m in 30.0..<60.0; else -> m >= 60 }
}

data class UserAudioState(
    val status: Map<String, ListenProgressRepository.Entry> = emptyMap(),
    val liked: Set<String> = emptySet(),
    val downloaded: Set<String> = emptySet(),
)

fun filterAudio(items: List<Audio>, f: AudioFilters, searchFields: Map<String, Boolean>, user: UserAudioState): List<Audio> {
    val q = f.search.trim().lowercase()
    var list = items.filter { i ->
        if (q.isNotEmpty() && !searchText(i, searchFields).contains(q)) return@filter false
        if (f.speaker != "all" && i.speaker != f.speaker) return@filter false
        if (f.type != "all" && i.type != f.type) return@filter false
        if (f.series != "all" && (i.series ?: "").trim() != f.series) return@filter false
        if (!inDuration(i.duration, f.duration)) return@filter false
        val d = dateOf(i)
        if (f.year != "all" && d?.y != f.year.toIntOrNull()) return@filter false
        if (f.month != "all" && d?.m != f.month.toIntOrNull()) return@filter false
        if (f.status != "all") {
            val s = user.status[i.id]?.status ?: "not-started"
            if (if (f.status == "unstarted") s != "not-started" else s != f.status) return@filter false
        }
        if (f.liked && i.id !in user.liked) return@filter false
        if (f.downloaded && i.id !in user.downloaded) return@filter false
        true
    }
    list = when (f.sort) {
        "oldest" -> list.sortedBy { it.order }
        "shortest" -> list.sortedBy { if (it.duration > 0) it.duration else Long.MAX_VALUE }
        "longest" -> list.sortedByDescending { it.duration }
        "title" -> list.sortedBy { it.title.lowercase() }
        "speaker" -> list.sortedWith(compareBy({ it.speaker.lowercase() }, { it.title.lowercase() }))
        else -> list.sortedByDescending { it.order }
    }
    return list
}

fun filterOptions(items: List<Audio>) = FilterOptions(
    speakers = items.map { it.speaker }.filter { it.isNotEmpty() }.distinct().sortedBy { it.lowercase() },
    years = items.mapNotNull { dateOf(it)?.y }.distinct().sortedDescending(),
    series = items.mapNotNull { it.series?.trim()?.ifEmpty { null } }.distinct().sortedBy { it.lowercase() },
)

fun filterChips(f: AudioFilters, typeLabel: (String) -> String): List<FilterChip> = buildList {
    if (f.search.isNotBlank()) add(FilterChip("search", "“${f.search.trim()}”") { it.copy(search = "") })
    if (f.speaker != "all") add(FilterChip("speaker", f.speaker) { it.copy(speaker = "all") })
    if (f.type != "all") add(FilterChip("type", typeLabel(f.type)) { it.copy(type = "all") })
    if (f.series != "all") add(FilterChip("series", "Series: ${f.series}") { it.copy(series = "all") })
    if (f.duration != "any") add(FilterChip("duration", DURATIONS.first { it.first == f.duration }.second) { it.copy(duration = "any") })
    if (f.year != "all") add(FilterChip("year", f.year) { it.copy(year = "all") })
    if (f.month != "all") add(FilterChip("month", MONTHS[f.month.toInt() - 1]) { it.copy(month = "all") })
    if (f.status != "all") add(FilterChip("status", STATUSES.first { it.first == f.status }.second) { it.copy(status = "all") })
    if (f.liked) add(FilterChip("liked", "Liked") { it.copy(liked = false) })
    if (f.downloaded) add(FilterChip("downloaded", "Downloaded") { it.copy(downloaded = false) })
}
