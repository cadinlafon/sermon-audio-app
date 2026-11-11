package com.palousefellowship.audio.util

import java.util.Calendar

/** Port of src/utils/goals.js. A goal is { id, period: week|month|year, metric, target, seriesType? }. */
data class Goal(val id: String, val period: String, val metric: String, val target: Double, val seriesType: String?, val extra: Map<String, Any?> = emptyMap()) {
    fun toMap(): Map<String, Any?> = extra + buildMap {
        put("id", id); put("period", period); put("metric", metric); put("target", target)
        if (seriesType != null) put("seriesType", seriesType)
    }
}

val PERIODS = listOf("week" to "This week", "month" to "This month", "year" to "This year")
val METRICS = listOf("minutes" to "Listening minutes", "recordings" to "Recordings finished", "doctrine" to "Doctrine minutes", "series" to "Complete a series")
val SERIES_TYPES = listOf("sermon" to "Sermons", "homily" to "Homilies", "sundayschool" to "Sunday School")

fun dayKey(c: Calendar): String = "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))

data class Range(val start: Calendar, val end: Calendar)

/** Weeks run Sunday → Saturday. */
fun periodRange(period: String, now: Calendar = Calendar.getInstance()): Range {
    val start = Calendar.getInstance().apply { clear(); set(now.get(Calendar.YEAR), now.get(Calendar.MONTH), now.get(Calendar.DAY_OF_MONTH)) }
    val end: Calendar
    when (period) {
        "week" -> { start.add(Calendar.DAY_OF_MONTH, -(start.get(Calendar.DAY_OF_WEEK) - 1)); end = (start.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, 7) } }
        "month" -> { start.set(Calendar.DAY_OF_MONTH, 1); end = (start.clone() as Calendar).apply { add(Calendar.MONTH, 1) } }
        else -> { start.set(Calendar.MONTH, 0); start.set(Calendar.DAY_OF_MONTH, 1); end = (start.clone() as Calendar).apply { add(Calendar.YEAR, 1) } }
    }
    return Range(start, end)
}

fun sumDaily(daily: Map<String, Map<String, Double>>, range: Range, field: String = "seconds"): Double {
    val a = dayKey(range.start); val b = dayKey(range.end)
    return daily.entries.sumOf { (day, v) -> if (day >= a && day < b) v[field] ?: 0.0 else 0.0 }
}

data class Streaks(val current: Int, val longest: Int)

fun computeStreaks(daily: Map<String, Map<String, Double>>): Streaks {
    val days = daily.filter { (it.value["seconds"] ?: 0.0) > 0 }.keys
    fun step(c: Calendar, n: Int) = (c.clone() as Calendar).apply { add(Calendar.DAY_OF_MONTH, n) }
    var cursor = Calendar.getInstance()
    if (dayKey(cursor) !in days) cursor = step(cursor, -1) // today may not have happened yet
    var current = 0
    while (dayKey(cursor) in days) { current++; cursor = step(cursor, -1) }
    var longest = 0; var run = 0; var prev: Calendar? = null
    for (d in days.sorted()) {
        val parts = d.split("-").map { it.toInt() }
        val cal = Calendar.getInstance().apply { clear(); set(parts[0], parts[1] - 1, parts[2]) }
        run = if (prev != null && dayKey(step(prev, 1)) == d) run + 1 else 1
        longest = maxOf(longest, run); prev = cal
    }
    return Streaks(current, longest)
}

data class CompletedItem(val audioId: String, val atMillis: Long)
data class GoalProgress(val value: Double, val target: Double, val unit: String, val pct: Double, val done: Boolean)

fun goalProgress(goal: Goal, daily: Map<String, Map<String, Double>>, completed: List<CompletedItem>, audioTypes: Map<String, String>, totals: Map<String, Int>): GoalProgress {
    val range = periodRange(goal.period)
    val inPeriod = { ms: Long -> ms >= range.start.timeInMillis && ms < range.end.timeInMillis }
    var value = 0.0; var target = goal.target; var unit = "min"
    when (goal.metric) {
        "minutes" -> value = sumDaily(daily, range) / 60
        "doctrine" -> value = sumDaily(daily, range, "doctrineSeconds") / 60
        "recordings" -> { value = completed.count { inPeriod(it.atMillis) }.toDouble(); unit = "recordings" }
        "series" -> {
            value = completed.count { audioTypes[it.audioId] == goal.seriesType }.toDouble()
            if (target <= 0) target = (totals[goal.seriesType] ?: 1).toDouble()
            unit = "recordings"
        }
    }
    val pct = if (target > 0) minOf(100.0, value / target * 100) else 0.0
    return GoalProgress(value, target, unit, pct, target > 0 && value >= target)
}

fun fmtMinutes(m: Double): String { val total = Math.round(m); val h = total / 60; return if (h > 0) "${h}h ${total % 60}m" else "${total}m" }
