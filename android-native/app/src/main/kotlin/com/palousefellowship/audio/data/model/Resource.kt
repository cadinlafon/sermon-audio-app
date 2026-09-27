package com.palousefellowship.audio.data.model

import com.google.firebase.firestore.DocumentId

/** Mirrors the `resources` collection (src/lib/resourceTypes.js lists every
 * type; we render the ones that make sense as a native card — audio plays
 * inline through the app player, everything else opens externally). */
data class Resource(
    @DocumentId val id: String = "",
    val title: String = "",
    val description: String = "",
    val type: String = "document",
    val url: String = "",
    val thumbnailUrl: String = "",
    val author: String = "",
    val date: String = "",
    val featured: Boolean = false,
    val published: Boolean = true,
    val order: Long = 0,
    // Only present when type == "audio".
    val audioStorageKey: String? = null,
    val duration: Long? = null,
) {
    companion object {
        const val TYPE_AUDIO = "audio"
        const val TYPE_SPOTIFY = "spotify"
        const val TYPE_YOUTUBE = "youtube"
    }
}

private val TYPE_ICON = mapOf(
    "audio" to "🎧", "youtube" to "▶️", "spotify" to "🎵", "document" to "📄",
    "website" to "🌐", "podcast" to "🎙️", "book" to "📖", "article" to "📰",
    "image" to "🖼️", "presentation" to "📊", "download" to "⬇️",
    "scripture" to "📖", "course" to "🎓", "playlist" to "📋",
)

fun Resource.typeIcon(): String = TYPE_ICON[type] ?: "📄"
