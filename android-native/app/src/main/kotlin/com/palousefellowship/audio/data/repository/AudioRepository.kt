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
    }
}
