package com.palousefellowship.audio.data.model

/** Mirrors `doctrineWeeks/current`. */
data class DoctrineContent(
    val title: String = "",
    val speaker: String = "",
    val details: String = "",
    val imageURL: String = "",
    val questions: List<String> = emptyList(),
    val audioFiles: List<DoctrineAudioFile> = emptyList(),
    val docsLink: String = "",
    val memorization: String = "",
    val notes: String = "",
    // Legacy single-file shape some older docs still carry.
    val audioStorageKey: String? = null,
    val audioFileName: String? = null,
) {
    /** [audioFiles] if present, else falls back to the legacy single file —
     * same rule the web app's Doctrine.jsx applies. */
    fun resolvedAudioFiles(): List<DoctrineAudioFile> = when {
        audioFiles.isNotEmpty() -> audioFiles
        !audioStorageKey.isNullOrBlank() -> listOf(
            DoctrineAudioFile(id = "legacy", label = audioFileName ?: "", audioStorageKey = audioStorageKey)
        )
        else -> emptyList()
    }
}

data class DoctrineAudioFile(
    val id: String = "",
    val label: String = "",
    val audioStorageKey: String = "",
)

/** Mirrors `doctrineWeeks/topics`. */
data class DoctrineTopics(
    val weeks: List<DoctrineWeek> = emptyList(),
    val defaultWeekId: String = "",
) {
    fun publishedWeeks(): List<DoctrineWeek> = weeks.filter { it.published }
}

data class DoctrineWeek(
    val id: String = "",
    val label: String = "",
    val topic: String = "",
    val dateRange: String = "",
    val memoryText: String = "",
    val details: String = "",
    val published: Boolean = true,
)
