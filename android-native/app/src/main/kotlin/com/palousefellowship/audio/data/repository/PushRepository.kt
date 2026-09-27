package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import com.google.firebase.messaging.FirebaseMessaging
import kotlinx.coroutines.tasks.await

/**
 * Writes to the exact same `users/{uid}.fcmToken` field the web app's
 * src/utils/requestPushPermission.js writes — the existing
 * `sendPushNotification` Cloud Function already reads that field, so an
 * Android device becomes reachable by the admin's existing "send
 * notification" tool with no backend changes.
 */
class PushRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    suspend fun registerCurrentToken(): Result<Unit> = runCatching {
        val uid = auth.currentUser?.uid ?: error("Sign in to enable notifications.")
        val token = FirebaseMessaging.getInstance().token.await()
        firestore.collection("users").document(uid)
            .set(mapOf("fcmToken" to token, "pushToken" to token), SetOptions.merge())
            .await()
    }
}
