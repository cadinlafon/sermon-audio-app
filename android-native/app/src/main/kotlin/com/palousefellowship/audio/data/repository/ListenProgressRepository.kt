package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.ListenHistoryItem
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

// A card reads as "not started" below this many seconds in, and "completed"
// past this fraction — same thresholds as src/utils/listenProgress.js.
private const val RESUME_THRESHOLD_SECONDS = 5
private const val COMPLETE_RATIO = 0.95

/**
 * Mirrors `listenProgress/{uid}_{audioId}` (src/utils/listenProgress.js).
 * Doubles as the data source for "Your Listens" — see
 * [ListenHistoryRepository]'s doc comment for why, instead of the web
 * app's own `listens` collection query, which nothing currently writes to.
 */
class ListenProgressRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private fun docRef(uid: String, audioId: String) = firestore.collection("listenProgress").document("${uid}_$audioId")

    /** One listener's saved position for one recording — the raw shape
     * behind every "Resume" / "Completed" badge on a list card. */
    data class Entry(val status: String, val positionSeconds: Long, val durationSeconds: Long)

    /** All of this listener's progress docs, keyed by audioId — used to
     * paint badges/progress bars across a whole list in one read instead
     * of one Firestore get() per card (unlike the web app's per-card
     * useEffect in AudioCard.jsx, which is fine there but would be a lot
     * of round-trips natively for a long list). */
    suspend fun getProgressMap(): Map<String, Entry> {
        val uid = auth.currentUser?.uid ?: return emptyMap()
        return runCatching {
            firestore.collection("listenProgress").whereEqualTo("userId", uid).get().await()
                .documents.associate { doc ->
                    (doc.getString("audioId") ?: "") to Entry(
                        status = doc.getString("status") ?: "not-started",
                        positionSeconds = doc.getLong("position") ?: 0,
                        durationSeconds = doc.getLong("duration") ?: 0,
                    )
                }.filterKeys { it.isNotEmpty() }
        }.getOrDefault(emptyMap())
    }

    /** The "Change status" menu's explicit manual override — mirrors
     * src/utils/listenProgress.js's setListenStatus. */
    suspend fun setStatus(audioId: String, status: String) {
        val uid = auth.currentUser?.uid ?: error("Sign in to update listen status.")
        val data = mutableMapOf<String, Any>("userId" to uid, "audioId" to audioId, "status" to status, "manual" to true, "updatedAt" to FieldValue.serverTimestamp())
        if (status == "not-started") data["position"] = 0L
        docRef(uid, audioId).set(data, SetOptions.merge()).await()
    }

    suspend fun saveProgress(audioId: String, positionSeconds: Long, durationSeconds: Long) {
        val uid = auth.currentUser?.uid ?: return
        if (positionSeconds <= RESUME_THRESHOLD_SECONDS) return
        val status = when {
            durationSeconds > 0 && positionSeconds.toDouble() / durationSeconds >= COMPLETE_RATIO -> "completed"
            else -> "in-progress"
        }
        runCatching {
            docRef(uid, audioId).set(
                mapOf(
                    "userId" to uid,
                    "audioId" to audioId,
                    "position" to positionSeconds,
                    "duration" to durationSeconds,
                    "status" to status,
                    "updatedAt" to FieldValue.serverTimestamp(),
                ),
                SetOptions.merge(),
            ).await()
        }
    }

    /** Resolves each history row's title/speaker against the `audio`
     * collection in parallel (there's no denormalized title on the
     * progress doc itself). Capped at 40 rows — a reasonable "recent
     * history" length, and Firestore has no batched-get for arbitrary
     * doc paths anyway, so this is 40 individual gets run concurrently. */
    suspend fun getHistory(limit: Int = 40): List<ListenHistoryItem> = coroutineScope {
        val uid = auth.currentUser?.uid ?: return@coroutineScope emptyList()
        val snapshot = runCatching {
            firestore.collection("listenProgress")
                .whereEqualTo("userId", uid)
                .orderBy("updatedAt", Query.Direction.DESCENDING)
                .limit(limit.toLong())
                .get()
                .await()
        }.getOrNull() ?: return@coroutineScope emptyList()

        snapshot.documents.map { doc ->
            async {
                val audioId = doc.getString("audioId") ?: return@async null
                val audio = runCatching { firestore.collection("audio").document(audioId).get().await().toObject(Audio::class.java) }.getOrNull()
                ListenHistoryItem(
                    audioId = audioId,
                    title = audio?.title ?: "",
                    speaker = audio?.speaker ?: "",
                    positionSeconds = (doc.getLong("position") ?: 0),
                    durationSeconds = (doc.getLong("duration") ?: 0),
                    status = doc.getString("status") ?: "in-progress",
                    updatedAtMillis = doc.getTimestamp("updatedAt")?.toDate()?.time ?: 0,
                )
            }
        }.mapNotNull { it.await() }.filter { it.title.isNotBlank() }
    }
}
