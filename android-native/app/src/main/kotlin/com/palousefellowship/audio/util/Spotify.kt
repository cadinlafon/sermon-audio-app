package com.palousefellowship.audio.util

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

data class SpotifyLink(val kind: String, val id: String)

private val URI_REGEX = Regex("""spotify:(episode|show|track|album|playlist):([A-Za-z0-9]+)""")
private val WEB_REGEX = Regex("""open\.spotify\.com/(?:intl-[a-z-]+/)?(episode|show|track|album|playlist)/([A-Za-z0-9]+)""")

/** Same parsing rules as the web app's src/lib/resourceTypes.js
 * `parseSpotifyLink` — matches open.spotify.com links (with or without
 * the intl-xx/ locale prefix or a share query string) and spotify:
 * URIs. */
fun parseSpotifyLink(url: String?): SpotifyLink? {
    if (url.isNullOrBlank()) return null
    URI_REGEX.find(url)?.let { return SpotifyLink(it.groupValues[1], it.groupValues[2]) }
    WEB_REGEX.find(url)?.let { return SpotifyLink(it.groupValues[1], it.groupValues[2]) }
    return null
}

private const val SPOTIFY_PACKAGE = "com.spotify.music"

private fun isSpotifyInstalled(context: Context): Boolean = try {
    context.packageManager.getPackageInfo(SPOTIFY_PACKAGE, 0)
    true
} catch (_: PackageManager.NameNotFoundException) {
    false
}

/** Prefers opening the Spotify app directly (spotify:// URI); falls back
 * to the normal https://open.spotify.com link in a browser when the app
 * isn't installed or the intent otherwise fails. */
fun openInSpotify(context: Context, url: String?) {
    val link = parseSpotifyLink(url)
    val target = if (link != null && isSpotifyInstalled(context)) {
        "spotify:${link.kind}:${link.id}"
    } else {
        url
    }
    if (target.isNullOrBlank()) return
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(target)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    } catch (_: ActivityNotFoundException) {
        url?.let {
            context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        }
    }
}
