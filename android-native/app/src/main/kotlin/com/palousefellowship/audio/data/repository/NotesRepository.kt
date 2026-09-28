package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.palousefellowship.audio.data.model.Audio
import com.palousefellowship.audio.data.model.Bookmark
import com.palousefellowship.audio.data.model.NoteDoc
import com.palousefellowship.audio.data.model.NoteEntry
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

/** Mirrors `notes/{uid}_{audioId}` — see src/utils/notes.js and
 * data/model/NoteDoc.kt's doc comment for the shape. */
class NotesRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private fun ref(uid: String, audioId: String) = firestore.collection("notes").document("${uid}_$audioId")

    suspend fun getNote(audioId: String): NoteDoc {
        val uid = auth.currentUser?.uid ?: return NoteDoc(audioId = audioId)
        return runCatching { ref(uid, audioId).get().await() }.getOrNull()?.toNoteDoc(audioId) ?: NoteDoc(audioId = audioId)
    }

    suspend fun saveText(audioId: String, text: String, audio: Audio?) {
        val uid = auth.currentUser?.uid ?: error("Sign in to take notes.")
        patch(uid, audioId, mapOf("text" to text), audio)
    }

    suspend fun addBookmark(audioId: String, atSeconds: Double, label: String, audio: Audio?) {
        val uid = auth.currentUser?.uid ?: error("Sign in to bookmark a moment.")
        val note = getNote(audioId)
        val bookmark = mapOf("id" to newId(), "t" to atSeconds, "label" to label, "createdAt" to System.currentTimeMillis())
        val next = note.bookmarks.map { it.toMap() } + bookmark
        patch(uid, audioId, mapOf("bookmarks" to next), audio)
    }

    suspend fun removeBookmark(audioId: String, bookmarkId: String) {
        val uid = auth.currentUser?.uid ?: return
        val note = getNote(audioId)
        val next = note.bookmarks.filterNot { it.id == bookmarkId }.map { it.toMap() }
        patch(uid, audioId, mapOf("bookmarks" to next), null)
    }

    private suspend fun patch(uid: String, audioId: String, data: Map<String, Any?>, audio: Audio?) {
        val meta = if (audio != null) mapOf("title" to audio.title, "speaker" to audio.speaker) else emptyMap()
        ref(uid, audioId).set(
            mapOf("userId" to uid, "audioId" to audioId) + meta + data + mapOf("updatedAt" to FieldValue.serverTimestamp()),
            SetOptions.merge(),
        ).await()
    }

    /** All of this listener's note docs — the Notes and Bookmarks screens'
     * data source (a note doc with an empty [NoteDoc.text] but a non-empty
     * [NoteDoc.bookmarks] list only shows up on the Bookmarks screen). */
    suspend fun getAllNotes(): UiState<List<NoteDoc>> {
        val uid = auth.currentUser?.uid ?: return UiState.Success(emptyList())
        return try {
            val snapshot = firestore.collection("notes").whereEqualTo("userId", uid).get().await()
            UiState.Success(snapshot.documents.mapNotNull { it.getString("audioId")?.let { id -> it.toNoteDoc(id) } })
        } catch (e: Exception) {
            UiState.Error(e.message ?: "Couldn't load your notes.")
        }
    }

    private fun newId() = (1..8).map { "abcdefghijklmnopqrstuvwxyz0123456789".random() }.joinToString("")
}

@Suppress("UNCHECKED_CAST")
private fun com.google.firebase.firestore.DocumentSnapshot.toNoteDoc(audioId: String): NoteDoc {
    val entries = (get("entries") as? List<Map<String, Any?>>).orEmpty().map {
        NoteEntry(
            id = it["id"] as? String ?: "",
            t = (it["t"] as? Number)?.toDouble() ?: 0.0,
            text = it["text"] as? String ?: "",
            category = it["category"] as? String ?: "general",
            createdAt = (it["createdAt"] as? Long) ?: 0,
        )
    }
    val bookmarks = (get("bookmarks") as? List<Map<String, Any?>>).orEmpty().map {
        Bookmark(
            id = it["id"] as? String ?: "",
            t = (it["t"] as? Number)?.toDouble() ?: 0.0,
            label = it["label"] as? String ?: "",
            createdAt = (it["createdAt"] as? Long) ?: 0,
        )
    }
    return NoteDoc(
        audioId = audioId,
        title = getString("title") ?: "",
        speaker = getString("speaker") ?: "",
        text = getString("text") ?: "",
        entries = entries,
        bookmarks = bookmarks,
    )
}

private fun Bookmark.toMap(): Map<String, Any?> = mapOf("id" to id, "t" to t, "label" to label, "createdAt" to createdAt)
