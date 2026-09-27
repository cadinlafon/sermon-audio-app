package com.palousefellowship.audio.util

/** "125" -> "2:05", "3725" -> "1:02:05" — same rule as the web app's
 * formatDuration helpers. */
fun formatDuration(totalSeconds: Long): String {
    if (totalSeconds <= 0) return "0:00"
    val h = totalSeconds / 3600
    val m = (totalSeconds % 3600) / 60
    val s = totalSeconds % 60
    return if (h > 0) "%d:%02d:%02d".format(h, m, s) else "%d:%02d".format(m, s)
}
