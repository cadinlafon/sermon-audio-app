package com.palousefellowship.audio.player

import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.tasks.await
import java.util.Calendar

/** Port of src/utils/listenTracker.js: every play is logged for the admin Audio
 * Stats page, and a signed-in listener's totals / per-day seconds feed their own
 * Stats, Goals and Year in Review. Failures are swallowed — tracking must never
 * get in the way of listening. */
class ListenTracker(private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance()) {
    private val best = HashMap<String, Long>()

    private fun stats(uid: String) = firestore.collection("userStats").document(uid)

    /** One row per play (guests included — userId is null for a guest). */
    suspend fun recordListen(sermonId: String, uid: String?) {
        runCatching {
            firestore.collection("appUsage").add(mapOf("sermonId" to sermonId, "userId" to uid, "createdAt" to FieldValue.serverTimestamp())).await()
        }
    }

    suspend fun trackPlay(uid: String, sermonId: String, title: String, speaker: String) {
        runCatching {
            stats(uid).set(
                mapOf(
                    "totalPlays" to FieldValue.increment(1),
                    "sermons" to mapOf(sermonId to mapOf(
                        "title" to title.ifBlank { "Untitled" }, "speaker" to speaker.ifBlank { "Unknown" },
                        "count" to FieldValue.increment(1), "lastPlayedAt" to FieldValue.serverTimestamp(),
                    )),
                    "updatedAt" to FieldValue.serverTimestamp(),
                ),
                SetOptions.merge(),
            ).await()
        }
    }

    fun dayKey(): String {
        val c = Calendar.getInstance()
        return "%04d-%02d-%02d".format(c.get(Calendar.YEAR), c.get(Calendar.MONTH) + 1, c.get(Calendar.DAY_OF_MONTH))
    }

    suspend fun trackListenTime(uid: String, sermonId: String, title: String, speaker: String, seconds: Long, type: String, isDoctrine: Boolean) {
        if (seconds <= 0) return
        runCatching {
            val sermon = mutableMapOf<String, Any>(
                "title" to title.ifBlank { "Untitled" }, "speaker" to speaker.ifBlank { "Unknown" },
                "seconds" to FieldValue.increment(seconds), "lastPlayedAt" to FieldValue.serverTimestamp(),
            )
            if (type.isNotEmpty()) sermon["type"] = type
            if (isDoctrine) sermon["doctrine"] = true
            val day = mutableMapOf<String, Any>("seconds" to FieldValue.increment(seconds))
            if (isDoctrine) day["doctrineSeconds"] = FieldValue.increment(seconds)
            stats(uid).set(
                mapOf(
                    "totalSeconds" to FieldValue.increment(seconds),
                    "sermons" to mapOf(sermonId to sermon),
                    "daily" to mapOf(dayKey() to day),
                    "updatedAt" to FieldValue.serverTimestamp(),
                ),
                SetOptions.merge(),
            ).await()
        }
    }

    /** Longest unbroken listening session, kept as the best seen so far. */
    suspend fun noteSession(uid: String, seconds: Long) {
        if (seconds <= 0) return
        runCatching {
            if (uid !in best) best[uid] = stats(uid).get().await().getLong("longestSessionSeconds") ?: 0L
            if (seconds > best.getValue(uid)) {
                best[uid] = seconds
                stats(uid).set(mapOf("longestSessionSeconds" to seconds), SetOptions.merge()).await()
            }
        }
    }
}
