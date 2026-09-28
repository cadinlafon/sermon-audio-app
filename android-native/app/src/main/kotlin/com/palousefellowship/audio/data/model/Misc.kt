package com.palousefellowship.audio.data.model

import com.google.firebase.firestore.DocumentId

/** One recording the listener has ever made progress on — combines a
 * `listenProgress/{uid}_{audioId}` doc with the resolved `audio` doc's
 * title/speaker (listenProgress itself only stores the id; see
 * ListenHistoryRepository's doc comment for why this powers "Your
 * Listens" instead of the web app's own (currently unpopulated) query). */
data class ListenHistoryItem(
    val audioId: String = "",
    val title: String = "",
    val speaker: String = "",
    val positionSeconds: Long = 0,
    val durationSeconds: Long = 0,
    val status: String = "in-progress", // "not-started" | "in-progress" | "completed"
    val updatedAtMillis: Long = 0,
) {
    val progress: Float get() = if (durationSeconds > 0) (positionSeconds.toFloat() / durationSeconds).coerceIn(0f, 1f) else 0f
}

/** Mirrors `saved/{uid}_{audioId}` (src/utils/saveSermon.js) — a liked
 * recording, storing the full audio record so it can be played/listed
 * without a second lookup. */
data class SavedAudio(
    val sermonId: String = "",
    val title: String = "",
    val speaker: String = "",
    val type: String = "",
    val duration: Long = 0,
    val audioStorageKey: String = "",
    val savedAtMillis: Long = 0,
) {
    fun toAudio() = Audio(id = sermonId, title = title, speaker = speaker, type = type, duration = duration, audioStorageKey = audioStorageKey)
}

/** Mirrors `suggestions/{id}` (src/pages/SuggestFeature.jsx). */
data class Suggestion(
    @DocumentId val id: String = "",
    val title: String = "",
    val details: String = "",
    val userId: String = "",
    val votes: Long = 0,
    val voters: List<String> = emptyList(),
    val status: String = "none", // "none" | "planned" | "in progress" | "complete"
)

/** Mirrors `userStats/{uid}` (src/pages/Stats.jsx / src/utils/listenTracker.js). */
data class UserStats(
    val totalSeconds: Long = 0,
    val sermons: Map<String, SermonStat> = emptyMap(),
)

data class SermonStat(
    val title: String = "",
    val speaker: String = "",
    val count: Long = 0,
    val seconds: Long = 0,
)

data class StatsBadge(val name: String, val icon: String, val hours: Int)

val STATS_BADGES = listOf(
    StatsBadge("Newbie", "🌱", 0),
    StatsBadge("Novice", "📖", 4),
    StatsBadge("Pro", "🎙️", 8),
    StatsBadge("Scholar", "🏛️", 14),
    StatsBadge("Master", "⭐", 20),
)
