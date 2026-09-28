package com.palousefellowship.audio.data.model

/**
 * Mirrors the web app's playlist shape exactly (src/context/PlaylistContext.jsx)
 * — playlists live as an array field on `users/{uid}.playlists`, not their
 * own top-level collection, so there is no @DocumentId here; these are
 * parsed by hand out of the user doc (see PlaylistRepository) rather than
 * through Firestore's automatic POJO mapping, which doesn't cope well with
 * a raw untyped nested-array field.
 */
data class Playlist(
    val id: String = "",
    val name: String = "",
    val description: String = "",
    val coverEmoji: String = "🎧",
    val coverColorIndex: Int = 0,
    val items: List<PlaylistItem> = emptyList(),
    val public: Boolean = false,
    val createdAt: Long = 0,
    val updatedAt: Long = 0,
) {
    val totalSeconds: Long get() = items.sumOf { it.duration }
}

/** The "slim track" shape the web app stores inside a playlist/queue/history
 * (src/utils/playerSettings.js's `slimTrack`) — enough to list and replay an
 * item without re-fetching its full `audio` doc. */
data class PlaylistItem(
    val id: String = "",
    val title: String = "",
    val speaker: String = "",
    val type: String = "",
    val duration: Long = 0,
    val audioStorageKey: String = "",
    val order: Long = 0,
) {
    fun toAudio() = Audio(id = id, title = title, speaker = speaker, type = type, duration = duration, audioStorageKey = audioStorageKey, order = order)
}

fun Audio.toPlaylistItem() = PlaylistItem(id = id, title = title, speaker = speaker, type = type, duration = duration, audioStorageKey = audioStorageKey, order = order)

val PLAYLIST_COVER_COLORS = listOf(
    0xFFC97C2E to 0xFFA85E18,
    0xFF3B6EA8 to 0xFF274B78,
    0xFF4F8A5B to 0xFF35633F,
    0xFF8A4F8A to 0xFF663866,
    0xFFB3432C to 0xFF8F2E1A,
    0xFF4A4A4A to 0xFF2B2B2B,
)
val PLAYLIST_STARTER_NAMES = listOf("Sunday listening", "Morning sermons", "Doctrine study", "Favorites", "Bible study", "Listen while driving")
