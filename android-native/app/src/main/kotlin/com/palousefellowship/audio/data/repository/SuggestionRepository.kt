package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.palousefellowship.audio.data.model.Suggestion
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

/** Mirrors `suggestions/{id}` (src/pages/SuggestFeature.jsx). */
class SuggestionRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    suspend fun getSuggestions(): UiState<List<Suggestion>> = try {
        val snapshot = firestore.collection("suggestions").orderBy("createdAt", Query.Direction.DESCENDING).get().await()
        UiState.Success(snapshot.documents.mapNotNull { it.toObject(Suggestion::class.java) })
    } catch (e: Exception) {
        UiState.Error(e.message ?: "Couldn't load suggestions.")
    }

    suspend fun submit(title: String, details: String) {
        val uid = auth.currentUser?.uid ?: "anon"
        firestore.collection("suggestions").add(
            mapOf(
                "title" to title,
                "details" to details,
                "userId" to uid,
                "votes" to 0L,
                "voters" to emptyList<String>(),
                "status" to "none",
                "createdAt" to FieldValue.serverTimestamp(),
            ),
        ).await()
    }

    suspend fun vote(suggestion: Suggestion, upvote: Boolean) {
        val uid = auth.currentUser?.uid ?: error("Sign in to vote.")
        val hasVoted = suggestion.voters.contains(uid)
        val newVotes = when {
            upvote && !hasVoted -> suggestion.votes + 1
            !upvote && hasVoted -> suggestion.votes - 1
            else -> suggestion.votes
        }
        val newVoters = when {
            upvote && !hasVoted -> suggestion.voters + uid
            !upvote && hasVoted -> suggestion.voters - uid
            else -> suggestion.voters
        }
        firestore.collection("suggestions").document(suggestion.id)
            .update("votes", newVotes, "voters", newVoters).await()
    }
}
