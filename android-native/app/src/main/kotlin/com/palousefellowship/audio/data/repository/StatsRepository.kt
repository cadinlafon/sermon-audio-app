package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.palousefellowship.audio.data.model.UserStats
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

/** Mirrors `userStats/{uid}` (src/pages/Stats.jsx). */
class StatsRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    suspend fun getStats(): UiState<UserStats> {
        val uid = auth.currentUser?.uid ?: return UiState.Success(UserStats())
        return try {
            val snap = firestore.collection("userStats").document(uid).get().await()
            UiState.Success(snap.toObject(UserStats::class.java) ?: UserStats())
        } catch (e: Exception) {
            UiState.Error(e.message ?: "Couldn't load your stats.")
        }
    }
}
