package com.palousefellowship.audio.data.repository

import com.google.firebase.firestore.FirebaseFirestore
import com.palousefellowship.audio.data.model.DoctrineContent
import com.palousefellowship.audio.data.model.DoctrineTopics
import com.palousefellowship.audio.util.UiState
import kotlinx.coroutines.tasks.await

data class DoctrineScreenData(
    val content: DoctrineContent?,
    val topics: DoctrineTopics,
)

/** Mirrors Doctrine.jsx: `doctrineWeeks/current` (the featured
 * campaign) plus `doctrineWeeks/topics` (the Weekly Topic slider) —
 * a missing topics doc is not an error, same as the web page. */
class DoctrineRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    suspend fun getDoctrine(): UiState<DoctrineScreenData> = try {
        val currentSnap = firestore.collection("doctrineWeeks").document("current").get().await()
        val content = if (currentSnap.exists()) currentSnap.toObject(DoctrineContent::class.java) else null

        val topics = try {
            val topicsSnap = firestore.collection("doctrineWeeks").document("topics").get().await()
            topicsSnap.toObject(DoctrineTopics::class.java) ?: DoctrineTopics()
        } catch (_: Exception) {
            DoctrineTopics() // weekly topics are optional — never fail the whole page over them
        }

        UiState.Success(DoctrineScreenData(content, topics))
    } catch (e: Exception) {
        UiState.Error(e.message ?: "Couldn't load the Doctrine page.")
    }
}
