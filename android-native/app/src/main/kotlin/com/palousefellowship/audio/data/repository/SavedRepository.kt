package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.SetOptions
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.SavedAudio
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

/** Mirrors `saved/{uid}_{audioId}` (src/utils/saveSermon.js) — liked
 * recordings, one doc per listener per recording, storing the full audio
 * record so the Saved page can list/play without a second lookup. */
class SavedRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private fun ref(uid: String, audioId: String) = firestore.collection("saved").document("${uid}_$audioId")

    suspend fun isSaved(audioId: String): Boolean {
        val uid = auth.currentUser?.uid ?: return false
        return runCatching { ref(uid, audioId).get().await().exists() }.getOrDefault(false)
    }

    /** Returns the new saved state (true = now saved). */
    suspend fun toggle(audio: Audio): Boolean {
        val uid = auth.currentUser?.uid ?: error("Sign in to save recordings.")
        val docRef = ref(uid, audio.id)
        val existing = docRef.get().await()
        return if (existing.exists()) {
            docRef.delete().await()
            false
        } else {
            val data = mapOf(
                "userId" to uid,
                "sermonId" to audio.id,
                "title" to audio.title,
                "speaker" to audio.speaker,
                "type" to audio.type,
                "duration" to audio.duration,
                "audioStorageKey" to audio.audioStorageKey,
                "createdAt" to com.google.firebase.firestore.FieldValue.serverTimestamp(),
            )
            docRef.set(data, SetOptions.merge()).await()
            true
        }
    }

    suspend fun getSaved(): UiState<List<SavedAudio>> {
        val uid = auth.currentUser?.uid ?: return UiState.Success(emptyList())
        return try {
            val snapshot = firestore.collection("saved")
                .whereEqualTo("userId", uid)
                .orderBy("createdAt", Query.Direction.DESCENDING)
                .get()
                .await()
            val items = snapshot.documents.map { doc ->
                SavedAudio(
                    sermonId = doc.getString("sermonId") ?: "",
                    title = doc.getString("title") ?: "",
                    speaker = doc.getString("speaker") ?: "",
                    type = doc.getString("type") ?: "",
                    duration = doc.getLong("duration") ?: 0,
                    audioStorageKey = doc.getString("audioStorageKey") ?: "",
                    savedAtMillis = doc.getTimestamp("createdAt")?.toDate()?.time ?: 0,
                )
            }
            UiState.Success(items)
        } catch (e: Exception) {
            UiState.Error(e.message ?: "Couldn't load your saved recordings.")
        }
    }
}
