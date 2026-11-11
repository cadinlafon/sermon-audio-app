package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.palousefellowship.audio.util.CompletedItem
import com.palousefellowship.audio.util.Goal
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.tasks.await

data class SermonStatEntry(val id: String, val title: String, val speaker: String, val count: Long, val seconds: Double, val type: String?, val doctrine: Boolean)

/** Everything Goals and Year in Review need (useGoalData.js): the goal list, daily listening totals,
 * finished recordings and each recording's category. */
data class GoalData(
    val goals: List<Goal>,
    val daily: Map<String, Map<String, Double>>,
    val longestSessionSeconds: Double,
    val totalSeconds: Double,
    val sermons: List<SermonStatEntry>,
    val completed: List<CompletedItem>,
    val audioTypes: Map<String, String>,
    val totals: Map<String, Int>,
)

class GoalDataRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val audioRepository: AudioRepository,
) {
    @Suppress("UNCHECKED_CAST")
    suspend fun load(): GoalData? = coroutineScope {
        val uid = auth.currentUser?.uid ?: return@coroutineScope null
        val userDoc = async { runCatching { firestore.collection("users").document(uid).get().await() }.getOrNull() }
        val statsDoc = async { runCatching { firestore.collection("userStats").document(uid).get().await() }.getOrNull() }
        val progress = async { runCatching { firestore.collection("listenProgress").whereEqualTo("userId", uid).get().await() }.getOrNull() }
        val audioList = async { (audioRepository.getAudio(listOf("sermon", "homily", "sundayschool")) as? com.palousefellowship.audio.util.UiState.Success)?.data.orEmpty() }

        val goals = (userDoc.await()?.get("goals") as? List<Map<String, Any?>>).orEmpty().mapNotNull { g ->
            val id = g["id"] as? String ?: return@mapNotNull null
            Goal(id, g["period"] as? String ?: "week", g["metric"] as? String ?: "minutes", (g["target"] as? Number)?.toDouble() ?: 0.0, g["seriesType"] as? String)
        }
        val s = statsDoc.await()
        val daily = (s?.get("daily") as? Map<String, Map<String, Any?>>).orEmpty().mapValues { (_, v) -> v.mapValues { (it.value as? Number)?.toDouble() ?: 0.0 } }
        val sermons = (s?.get("sermons") as? Map<String, Map<String, Any?>>).orEmpty().map { (id, v) ->
            SermonStatEntry(id, v["title"] as? String ?: "Untitled", v["speaker"] as? String ?: "Unknown", (v["count"] as? Number)?.toLong() ?: 0, (v["seconds"] as? Number)?.toDouble() ?: 0.0, v["type"] as? String, v["doctrine"] == true)
        }
        val completed = progress.await()?.documents.orEmpty().filter { it.getString("status") == "completed" }.mapNotNull { d ->
            d.getString("audioId")?.let { CompletedItem(it, (d.getTimestamp("updatedAt")?.seconds ?: 0L) * 1000) }
        }
        val list = audioList.await()
        GoalData(
            goals, daily, (s?.get("longestSessionSeconds") as? Number)?.toDouble() ?: 0.0, (s?.get("totalSeconds") as? Number)?.toDouble() ?: 0.0,
            sermons, completed, list.associate { it.id to it.type }, list.groupingBy { it.type }.eachCount(),
        )
    }

    suspend fun saveGoals(goals: List<Goal>) {
        val uid = auth.currentUser?.uid ?: return
        firestore.collection("users").document(uid).update("goals", goals.map { it.toMap() }).await()
    }
}
