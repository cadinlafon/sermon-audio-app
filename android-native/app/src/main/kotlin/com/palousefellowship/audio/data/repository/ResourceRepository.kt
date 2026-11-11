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

    /** Categories + curated rows (resourceCategories / resourceSections, by `order`) — what Resources.jsx loads. */
    suspend fun getCategoriesAndSections(): Pair<List<com.palousefellowship.audio.data.model.ResourceCategory>, List<com.palousefellowship.audio.data.model.ResourceSection>> {
        val cats = runCatching { firestore.collection("resourceCategories").get().await().documents.sortedBy { it.getLong("order") ?: 0 }.map { com.palousefellowship.audio.data.model.ResourceCategory(it.id, it.getString("name") ?: "") } }.getOrDefault(emptyList())
        val secs = runCatching { firestore.collection("resourceSections").get().await().documents.sortedBy { it.getLong("order") ?: 0 }.map { com.palousefellowship.audio.data.model.ResourceSection(it.id, it.getString("name") ?: "") } }.getOrDefault(emptyList())
        return cats to secs
    }
}
