package com.palousefellowship.audio.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

/** Mirrors the Resources page's `resources` query — published items only,
 * client-sorted by `order`. [typeFilter] powers the Spotify screen, which
 * is just Resources narrowed to `type == "spotify"` (there's no separate
 * Spotify collection in the backend — see the app's README). */
class ResourceRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    suspend fun getResources(typeFilter: String? = null): UiState<List<Resource>> = try {
        val snapshot = firestore.collection("resources").get().await()
        val items = snapshot.documents.mapNotNull { it.toObject(Resource::class.java) }
            .filter { it.published }
            .filter { typeFilter == null || it.type == typeFilter }
            .sortedBy { it.order }
        UiState.Success(items)
    } catch (e: Exception) {
        UiState.Error(e.message ?: "Couldn't load resources.")
    }
}
