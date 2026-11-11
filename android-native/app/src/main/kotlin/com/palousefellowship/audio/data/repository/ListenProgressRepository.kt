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

    /** Home's "Continue Listening": the last [limit] recordings this listener
     * started but hasn't finished (Home.jsx — status + ordering are applied
     * client-side so no composite Firestore index is needed). */
    data class ContinueItem(val audio: Audio, val positionSeconds: Long, val durationSeconds: Long)

    suspend fun getContinueListening(limit: Int = 3): List<ContinueItem> = coroutineScope {
        val uid = auth.currentUser?.uid ?: return@coroutineScope emptyList()
        val snap = runCatching { firestore.collection("listenProgress").whereEqualTo("userId", uid).get().await() }.getOrNull()
            ?: return@coroutineScope emptyList()
        snap.documents
            .filter { it.getString("status") == "in-progress" && !it.getString("audioId").isNullOrEmpty() }
            .sortedByDescending { it.getTimestamp("updatedAt")?.seconds ?: 0L }
            .take(limit)
            .map { d ->
                async {
                    val audioId = d.getString("audioId") ?: return@async null
                    val audio = runCatching { firestore.collection("audio").document(audioId).get().await().toObject(Audio::class.java) }.getOrNull()
                        ?: return@async null
                    ContinueItem(audio, d.getLong("position") ?: 0, d.getLong("duration") ?: 0)
                }
            }.mapNotNull { it.await() }
    }

    /** The "Change status" menu's explicit manual override — mirrors
     * src/utils/listenProgress.js's setListenStatus. */
    suspend fun setStatus(audioId: String, status: String) {
        val uid = auth.currentUser?.uid ?: error("Sign in to update listen status.")
        val data = mutableMapOf<String, Any>("userId" to uid, "audioId" to audioId, "status" to status, "manual" to true, "updatedAt" to FieldValue.serverTimestamp())
        if (status == "not-started") data["position"] = 0L
        docRef(uid, audioId).set(data, SetOptions.merge()).await()
    }

    /** Saves position + status, and keeps users/{uid}.lastPlayed pointed at whatever is
     * resumable (cleared once finished) so the app can pick back up next launch —
     * saveListenProgress in src/utils/listenProgress.js. */
    suspend fun saveProgress(audioId: String, positionSeconds: Long, durationSeconds: Long) {
        val uid = auth.currentUser?.uid ?: return
        if (durationSeconds <= 0 || positionSeconds <= RESUME_THRESHOLD_SECONDS) return
        val status = if (positionSeconds.toDouble() / durationSeconds >= COMPLETE_RATIO) "completed" else "in-progress"
        runCatching {
            docRef(uid, audioId).set(
                mapOf(
                    "userId" to uid, "audioId" to audioId, "position" to positionSeconds, "duration" to durationSeconds,
                    "status" to status, "updatedAt" to FieldValue.serverTimestamp(),
                ),
                SetOptions.merge(),
            ).await()
            firestore.collection("users").document(uid).set(
                mapOf("lastPlayed" to if (status == "in-progress") mapOf("audioId" to audioId, "position" to positionSeconds, "duration" to durationSeconds, "updatedAt" to FieldValue.serverTimestamp()) else null),
                SetOptions.merge(),
            ).await()
        }
    }

    /** users/{uid}.lastPlayed → (audio, position) for the launch-time resume. */
    suspend fun getLastPlayed(): Pair<Audio, Long>? {
        val uid = auth.currentUser?.uid ?: return null
        return runCatching {
            val last = firestore.collection("users").document(uid).get().await().get("lastPlayed") as? Map<*, *> ?: return null
            val audioId = last["audioId"] as? String ?: return null
            val pos = (last["position"] as? Number)?.toLong() ?: 0L
            val audio = firestore.collection("audio").document(audioId).get().await().toObject(Audio::class.java)?.copy(id = audioId) ?: return null
            audio to pos
        }.getOrNull()
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
