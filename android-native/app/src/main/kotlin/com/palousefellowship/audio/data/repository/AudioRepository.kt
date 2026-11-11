package com.palousefellowship.audio.data.repository

import android.content.Context
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.palousefellowship.audio.data.local.AppDatabase
import com.palousefellowship.audio.data.local.toEntity
import com.palousefellowship.audio.data.local.toModel
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.remote.AudioUrlRequest
import com.palousefellowship.audio.data.remote.NetworkModule
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

/**
 * Same query shapes as the web app's Sermons/SundaySchool/Homilys pages
 * (`audio` where type in [...] / == ..., client-sorted by `order`), plus
 * a Room-backed "last known good" fallback for offline viewing.
 */
class AudioRepository(
    context: Context,
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private val dao = AppDatabase.get(context).audioDao()

    suspend fun getAudio(types: List<String>): UiState<List<Audio>> {
        return try {
            val query: Query = if (types.size == 1) {
                firestore.collection("audio").whereEqualTo("type", types.first())
            } else {
                firestore.collection("audio").whereIn("type", types)
            }
            val snapshot = query.get().await()
            val items = snapshot.documents.mapNotNull { it.toObject(Audio::class.java) }
                .sortedBy { it.order }
            dao.replace(types, items.map { it.toEntity() })
            UiState.Success(items)
        } catch (e: Exception) {
            val cached = dao.getByTypes(types).map { it.toModel() }
            if (cached.isNotEmpty()) {
                UiState.Success(cached, fromCache = true)
            } else {
                UiState.Error(e.message ?: "Couldn't load recordings.")
            }
        }
    }

    /** Home screen's "Latest Sermon" card — mirrors Home.jsx's query
     * (newest 15 by createdAt, first one whose type is "sermon"). */
    suspend fun getLatestSermon(): Audio? = try {
        val snapshot = firestore.collection("audio")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .limit(15)
            .get()
            .await()
        snapshot.documents.mapNotNull { it.toObject(Audio::class.java) }
            .firstOrNull { it.type == Audio.TYPE_SERMON }
    } catch (_: Exception) {
        null // the rest of Home still renders fine without this card
    }

    /** Exchanges [audio]'s private storage key for a short-lived signed
     * playback URL — see AudioUrlApi's doc comment for why this can't
     * just be a public Storage URL. */
    suspend fun resolvePlaybackUrl(audio: Audio): Result<String> = runCatching {
        val token = auth.currentUser?.getIdToken(false)?.await()?.token
        val authorization = "Bearer ${token ?: com.palousefellowship.audio.BuildConfig.SUPABASE_ANON_KEY}"
        val response = NetworkModule.audioUrlApi.getDownloadUrl(
            AudioUrlRequest(storageKey = audio.audioStorageKey),
            authorization,
        )
        response.url ?: error(response.error ?: "Audio is unavailable.")
    }.recoverCatching { throw Exception(friendlyNetworkError(it)) }

    // Never surface a raw exception message (a Retrofit/OkHttp message like
    // "Expected URL scheme 'http' or 'https'..." or a bare java.net one) —
    // the player screen shows this text directly, so it has to read like
    // something a listener, not a developer, would understand.
    private fun friendlyNetworkError(error: Throwable): String = when (error) {
        is java.net.UnknownHostException, is java.net.ConnectException -> "You're offline and this hasn't been downloaded for offline listening. Tap to retry once you're back online."
        is java.net.SocketTimeoutException -> "The connection timed out. Tap to retry."
        is retrofit2.HttpException -> "This recording couldn't be loaded right now. Tap to retry."
        else -> if (error.message?.let { it.contains("Audio is unavailable") || it.contains("storage_unconfigured") || it.contains("storage_unavailable") } == true) {
            "Audio is unavailable right now. Tap to retry."
        } else {
            "This recording couldn't be loaded. Tap to retry."
        }
    }

    suspend fun getAudioById(id: String): Audio? = runCatching {
        firestore.collection("audio").document(id).get().await().toObject(Audio::class.java)?.copy(id = id)
    }.getOrNull()

    // ── AI summaries (AiSummary.jsx) ─────────────────────────────────────────

    /** Transcribes + summarizes via the same Edge Functions the web uses; the
     * function also saves the summary onto the audio doc. */
    suspend fun summarize(audio: Audio, force: Boolean): Result<String> = runCatching {
        val user = auth.currentUser ?: error("Login/Signup to use this feature")
        if (audio.audioStorageKey.isBlank()) error("This audio file is unavailable right now.")
        val token = user.getIdToken(false).await().token ?: error("Please sign in again.")
        val bearer = "Bearer $token"
        val key = audio.transcribeStorageKey?.takeIf { it.isNotBlank() } ?: audio.audioStorageKey
        val url = NetworkModule.audioUrlApi.getDownloadUrl(AudioUrlRequest(storageKey = key), bearer).url
            ?: error("Audio is unavailable.")
        val response = NetworkModule.summaryApi.summarize(
            com.palousefellowship.audio.data.remote.SummarizeRequest(audio.id, url, audio.type, audio.title.ifBlank { "Untitled audio" }, force),
            bearer,
        )
        response.summary ?: error(response.error ?: "No summary was returned.")
    }.recoverCatching { e ->
        // The function sends a deliberately user-safe message in the error body.
        val body = (e as? retrofit2.HttpException)?.response()?.errorBody()?.string()
        val msg = body?.let { runCatching { org.json.JSONObject(it).optString("error").ifBlank { null } }.getOrNull() }
        throw Exception(msg ?: e.message?.takeIf { !it.startsWith("HTTP") } ?: "We couldn't generate the summary right now. Please try again.")
    }

    suspend fun deleteSummary(audioId: String): Result<Unit> = runCatching {
        firestore.collection("audio").document(audioId).update("aiSummary", com.google.firebase.firestore.FieldValue.delete()).await()
        Unit
    }

    // ── Transcripts (src/utils/transcripts.js) ───────────────────────────────

    /** Asks the Edge Function to transcribe (once — it never re-transcribes). */
    suspend fun generateTranscript(audio: Audio): Result<Unit> = runCatching {
        val user = auth.currentUser ?: error("Sign in to generate a transcript.")
        val token = user.getIdToken(false).await().token ?: error("Please sign in again.")
        val bearer = "Bearer $token"
        val key = audio.transcribeStorageKey?.takeIf { it.isNotBlank() } ?: audio.audioStorageKey
        val url = NetworkModule.audioUrlApi.getDownloadUrl(AudioUrlRequest(storageKey = key), bearer).url ?: error("Audio is unavailable.")
        val r = NetworkModule.summaryApi.summarize(
            com.palousefellowship.audio.data.remote.SummarizeRequest(audio.id, url, audio.type, audio.title.ifBlank { "Untitled audio" }, false, "transcript"),
            bearer,
        )
        if (r.pending == true) error(r.error ?: "This transcript is being generated — check back in a moment.")
    }.recoverCatching { e ->
        val body = (e as? retrofit2.HttpException)?.response()?.errorBody()?.string()
        val msg = body?.let { runCatching { org.json.JSONObject(it).optString("error").ifBlank { null } }.getOrNull() }
        throw Exception(msg ?: e.message?.takeIf { !it.startsWith("HTTP") } ?: "Couldn't generate the transcript.")
    }

    @Suppress("UNCHECKED_CAST")
    suspend fun fetchTranscript(audioId: String): TranscriptData? = runCatching {
        val snap = firestore.collection("transcripts").document(audioId).get().await()
        if (!snap.exists()) return@runCatching null
        val segs = (snap.get("segments") as? List<Map<String, Any?>>).orEmpty().map {
            TranscriptSegment((it["start"] as? Number)?.toDouble() ?: 0.0, (it["end"] as? Number)?.toDouble() ?: 0.0, it["text"] as? String ?: "")
        }
        TranscriptData(
            segments = segs,
            topics = (snap.get("topics") as? List<*>)?.filterIsInstance<String>().orEmpty(),
            edits = (snap.get("edits") as? Map<String, Any?>).orEmpty().mapValues { it.value as? String ?: "" },
            speakerLabels = (snap.get("speakerLabels") as? Map<String, Any?>).orEmpty().mapValues { it.value as? String ?: "" },
        )
    }.getOrNull()
}

data class TranscriptSegment(val start: Double, val end: Double, val text: String)
data class TranscriptData(val segments: List<TranscriptSegment>, val topics: List<String>, val edits: Map<String, String>, val speakerLabels: Map<String, String>)
