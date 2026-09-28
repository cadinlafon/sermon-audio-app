package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.palousefellowship.audio.data.model.Notice
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

/** Mirrors Home.jsx's notice fetch+filter (pinned first, then by whether
 * the doc is active, unexpired, and matches this viewer's audience). */
class NoticeRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    suspend fun getNotices(signedIn: Boolean): UiState<List<Notice>> = try {
        val snapshot = firestore.collection("notices")
            .orderBy("createdAt", Query.Direction.DESCENDING)
            .get()
            .await()
        val items = snapshot.documents.mapNotNull { it.toObject(Notice::class.java) }
            .filter { it.isVisible(signedIn) }
            .sortedByDescending { it.pinned }
        UiState.Success(items)
    } catch (e: Exception) {
        UiState.Error(e.message ?: "Couldn't load notices.")
    }

    /** Mirrors src/components/NoticeInputForm.jsx's submit — a notice
     * with `inputEnabled` collects one free-text reply per listener. */
    suspend fun submitInput(noticeId: String, value: String) {
        val user = auth.currentUser
        firestore.collection("noticeSubmissions").add(
            mapOf(
                "noticeId" to noticeId,
                "value" to value,
                "createdAt" to FieldValue.serverTimestamp(),
                "userId" to user?.uid,
                "userEmail" to user?.email,
            ),
        ).await()
    }
}
