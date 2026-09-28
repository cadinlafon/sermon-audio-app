package com.palousefellowship.audio.data.model

/** Mirrors `notes/{uid}_{audioId}` (src/utils/notes.js) — one doc per
 * listener per recording, holding a general text note, timestamped
 * entries, and bookmarked moments. Parsed by hand (see NotesRepository)
 * for the same reason as Playlist: nested arrays of untyped maps don't
 * map cleanly through Firestore's automatic POJO conversion. */
data class NoteDoc(
    val audioId: String = "",
    val title: String = "",
    val speaker: String = "",
    val text: String = "",
    val entries: List<NoteEntry> = emptyList(),
    val bookmarks: List<Bookmark> = emptyList(),
)

data class NoteEntry(
    val id: String = "",
    val t: Double = 0.0,
    val text: String = "",
    val category: String = "general",
    val createdAt: Long = 0,
)

data class Bookmark(
    val id: String = "",
    val t: Double = 0.0,
    val label: String = "",
    val createdAt: Long = 0,
)

val NOTE_CATEGORIES = listOf(
    "general" to "General",
    "scripture" to "Scripture",
    "application" to "Application",
    "question" to "Question",
    "quote" to "Quote",
    "prayer" to "Prayer",
)
