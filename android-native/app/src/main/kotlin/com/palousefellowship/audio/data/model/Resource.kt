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
    val categoryId: String? = null,
    val sectionIds: List<String> = emptyList(),
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

data class ResourceCategory(val id: String, val name: String)
data class ResourceSection(val id: String, val name: String)

val RESOURCE_TYPE_LABELS = mapOf(
    "audio" to ("Audio" to "Play Audio"), "youtube" to ("YouTube Video" to "Watch Video"), "spotify" to ("Spotify Podcast" to "Listen on Spotify"),
    "document" to ("Document" to "Open Document"), "website" to ("Website / Web Link" to "Visit Website"), "podcast" to ("Podcast" to "Listen"),
    "book" to ("Book" to "View Book"), "article" to ("Article" to "Read Article"), "image" to ("Image / Gallery" to "View Image"),
    "presentation" to ("Presentation" to "Open Presentation"), "download" to ("Download" to "Download"), "scripture" to ("Scripture / Bible Study" to "Open"),
    "course" to ("Course / Study" to "Start Course"), "playlist" to ("Playlist" to "Open Playlist"), "app" to ("App" to "Get the App"),
)
val EXTERNAL_LINK_TYPES = setOf("website", "book", "article", "presentation", "app")
fun Resource.typeLabel() = RESOURCE_TYPE_LABELS[type]?.first ?: "Document"
fun Resource.actionLabel() = RESOURCE_TYPE_LABELS[type]?.second ?: "Open Document"

private val TYPE_ICON = mapOf(
    "audio" to "🎧", "youtube" to "▶️", "spotify" to "🎵", "document" to "📄",
    "website" to "🌐", "podcast" to "🎙️", "book" to "📖", "article" to "📰",
    "image" to "🖼️", "presentation" to "📊", "download" to "⬇️",
    "scripture" to "📖", "course" to "🎓", "playlist" to "📋", "app" to "📱",
)

fun Resource.typeIcon(): String = TYPE_ICON[type] ?: "📄"
