package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.Playlist
import com.palousefellowship.audio.data.model.PlaylistItem
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await
import kotlin.random.Random

/**
 * Mirrors src/context/PlaylistContext.jsx exactly: playlists live as a
 * plain array field on `users/{uid}.playlists`, not their own collection,
 * so this reads/writes that whole array rather than individual docs.
 * Parsed by hand (Firestore's automatic POJO mapping doesn't reliably
 * round-trip an untyped nested array-of-maps field like this one).
 */
class PlaylistRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private fun userRef(uid: String) = firestore.collection("users").document(uid)

    suspend fun getPlaylists(): UiState<List<Playlist>> {
        val uid = auth.currentUser?.uid ?: return UiState.Success(emptyList())
        return try {
            val snap = userRef(uid).get().await()
            @Suppress("UNCHECKED_CAST")
            val raw = snap.get("playlists") as? List<Map<String, Any?>> ?: emptyList()
            UiState.Success(raw.map { it.toPlaylist() }.sortedByDescending { it.updatedAt })
        } catch (e: Exception) {
            UiState.Error(e.message ?: "Couldn't load your playlists.")
        }
    }

    suspend fun getPlaylist(id: String): Playlist? = (getPlaylists() as? UiState.Success)?.data?.find { it.id == id }

    suspend fun create(name: String): Playlist {
        val uid = auth.currentUser?.uid ?: error("Sign in to create a playlist.")
        val current = (getPlaylists() as? UiState.Success)?.data.orEmpty()
        val playlist = Playlist(
            id = newId(),
            name = name.ifBlank { "New playlist" },
            createdAt = System.currentTimeMillis(),
            updatedAt = System.currentTimeMillis(),
        )
        save(uid, listOf(playlist) + current)
        return playlist
    }

    suspend fun rename(id: String, name: String) = mutate(id) { it.copy(name = name) }
    suspend fun setDescription(id: String, description: String) = mutate(id) { it.copy(description = description) }

    suspend fun addItem(id: String, audio: Audio) = mutate(id) { pl ->
        if (pl.items.any { it.id == audio.id }) pl
        else pl.copy(items = pl.items + audio.toItem())
    }

    suspend fun removeItem(id: String, audioId: String) = mutate(id) { pl -> pl.copy(items = pl.items.filterNot { it.id == audioId }) }

    suspend fun moveItem(id: String, fromIndex: Int, toIndex: Int) = mutate(id) { pl ->
        val list = pl.items.toMutableList()
        if (fromIndex !in list.indices || toIndex !in list.indices) return@mutate pl
        val item = list.removeAt(fromIndex)
        list.add(toIndex, item)
        pl.copy(items = list)
    }

    suspend fun delete(id: String) {
        val uid = auth.currentUser?.uid ?: return
        val current = (getPlaylists() as? UiState.Success)?.data.orEmpty()
        save(uid, current.filterNot { it.id == id })
    }

    private suspend fun mutate(id: String, transform: (Playlist) -> Playlist) {
        val uid = auth.currentUser?.uid ?: error("Sign in to use playlists.")
        val current = (getPlaylists() as? UiState.Success)?.data.orEmpty()
        val next = current.map { if (it.id == id) transform(it).copy(updatedAt = System.currentTimeMillis()) else it }
        save(uid, next)
    }

    private suspend fun save(uid: String, playlists: List<Playlist>) {
        userRef(uid).update("playlists", playlists.map { it.toMap() }).await()
    }

    private fun newId() = (1..8).map { "abcdefghijklmnopqrstuvwxyz0123456789".random(Random) }.joinToString("")
}

private fun Audio.toItem() = PlaylistItem(id = id, title = title, speaker = speaker, type = type, duration = duration, audioStorageKey = audioStorageKey, order = order)

@Suppress("UNCHECKED_CAST")
private fun Map<String, Any?>.toPlaylist(): Playlist {
    val cover = this["cover"] as? Map<String, Any?>
    val items = (this["items"] as? List<Map<String, Any?>>).orEmpty()
    return Playlist(
        id = this["id"] as? String ?: "",
        name = this["name"] as? String ?: "",
        description = this["description"] as? String ?: "",
        coverEmoji = cover?.get("emoji") as? String ?: "🎧",
        coverColorIndex = (cover?.get("color") as? Long)?.toInt() ?: 0,
        items = items.map { it.toPlaylistItem() },
        public = this["public"] as? Boolean ?: false,
        createdAt = (this["createdAt"] as? Long) ?: 0,
        updatedAt = (this["updatedAt"] as? Long) ?: 0,
    )
}

@Suppress("UNCHECKED_CAST")
private fun Map<String, Any?>.toPlaylistItem() = PlaylistItem(
    id = this["id"] as? String ?: "",
    title = this["title"] as? String ?: "",
    speaker = this["speaker"] as? String ?: "",
    type = this["type"] as? String ?: "",
    duration = (this["duration"] as? Long) ?: 0,
    audioStorageKey = this["audioStorageKey"] as? String ?: "",
    order = (this["order"] as? Long) ?: 0,
)

private fun Playlist.toMap(): Map<String, Any?> = mapOf(
    "id" to id,
    "name" to name,
    "description" to description,
    "cover" to mapOf("emoji" to coverEmoji, "color" to coverColorIndex),
    "items" to items.map { it.toMap() },
    "public" to public,
    "createdAt" to createdAt,
    "updatedAt" to updatedAt,
)

private fun PlaylistItem.toMap(): Map<String, Any?> = mapOf(
    "id" to id, "title" to title, "speaker" to speaker, "type" to type,
    "duration" to duration, "audioStorageKey" to audioStorageKey, "order" to order,
)
