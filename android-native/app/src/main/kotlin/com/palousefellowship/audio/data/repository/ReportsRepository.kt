package com.palousefellowship.audio.data.repository

import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

data class ReportReply(val body: String, val atMillis: Long, val by: String)

data class ProblemReport(
    val id: String,
    val title: String,
    val details: String,
    val createdAtMillis: Long,
    val replies: List<ReportReply>,
    val userUnread: Boolean,
)

/** Port of src/utils/problemReports.js — "Report a Problem" in the account
 * sidebar writes problemReports/{id}; admin replies come back on the same doc. */
class ReportsRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    companion object {
        const val MAX_TITLE = 120
        const val MAX_DETAILS = 3000
    }

    suspend fun createReport(title: String, details: String) {
        val t = title.trim()
        val d = details.trim()
        if (t.isEmpty()) error("Please add a short title.")
        if (d.isEmpty()) error("Please describe the problem.")
        val user = auth.currentUser ?: error("Please sign in to report a problem.")
        firestore.collection("problemReports").add(
            mapOf(
                "userId" to user.uid,
                "userName" to (user.displayName ?: user.email?.substringBefore("@") ?: "User"),
                "userEmail" to (user.email ?: ""),
                "title" to t.take(MAX_TITLE),
                "details" to d.take(MAX_DETAILS),
                "createdAt" to FieldValue.serverTimestamp(),
                "tags" to emptyList<String>(),
                "replies" to emptyList<Any>(),
                "adminSeen" to false,
                "userUnread" to false,
            ),
        ).await()
    }

    /** The signed-in person's own reports, newest first (empty when signed out). */
    fun myReports(uid: String?): Flow<List<ProblemReport>> = callbackFlow {
        if (uid == null) { trySend(emptyList()); awaitClose { }; return@callbackFlow }
        val reg = firestore.collection("problemReports").whereEqualTo("userId", uid)
            .addSnapshotListener { snap, _ ->
                val list = snap?.documents?.map { d ->
                    @Suppress("UNCHECKED_CAST")
                    val replies = (d.get("replies") as? List<Map<String, Any?>>)?.map {
                        ReportReply(it["body"] as? String ?: "", (it["at"] as? Number)?.toLong() ?: 0L, it["by"] as? String ?: "")
                    } ?: emptyList()
                    ProblemReport(
                        id = d.id,
                        title = d.getString("title") ?: "",
                        details = d.getString("details") ?: "",
                        createdAtMillis = d.getTimestamp("createdAt")?.toDate()?.time ?: 0L,
                        replies = replies,
                        userUnread = d.getBoolean("userUnread") == true,
                    )
                }?.sortedByDescending { it.createdAtMillis } ?: emptyList()
                trySend(list)
            }
        awaitClose { reg.remove() }
    }

    suspend fun markRepliesRead(ids: List<String>) {
        ids.forEach { id ->
            runCatching { firestore.collection("problemReports").document(id).update("userUnread", false).await() }
        }
    }
}
