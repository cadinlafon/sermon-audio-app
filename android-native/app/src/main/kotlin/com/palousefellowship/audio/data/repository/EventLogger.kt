package com.palousefellowship.audio.data.repository

import android.content.Context
import android.os.Build
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await
import java.util.UUID

/** Same `logs` documents the web's logEvent() writes (page_visit, user_login, notice_click…),
 * so Admin → Logs / Analytics / Referrals include listeners using the Android app. Never throws. */
class EventLogger(
    context: Context,
    private val scope: CoroutineScope,
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
) {
    private val prefs = context.getSharedPreferences("pf_analytics", Context.MODE_PRIVATE)
    private val sessionId: String = prefs.getString("sessionId", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("sessionId", it).apply() }
    private val visitorId: String = prefs.getString("visitorId", null) ?: UUID.randomUUID().toString().also { prefs.edit().putString("visitorId", it).apply() }
    private val metrics = context.resources.displayMetrics
    private var lastPage: String? = null

    fun log(event: String, data: Map<String, Any?> = emptyMap(), page: String? = null) {
        scope.launch {
            runCatching {
                val user = auth.currentUser
                val doc = mutableMapOf<String, Any?>("event" to event)
                doc.putAll(data)
                doc["sessionId"] = sessionId
                doc["visitorId"] = visitorId
                doc["firstTrafficSource"] = "direct"; doc["firstTrafficMedium"] = "app"; doc["firstTrafficCampaign"] = null
                doc["latestTrafficSource"] = "direct"; doc["latestTrafficMedium"] = "app"; doc["latestTrafficCampaign"] = null
                doc["firstPlatform"] = "direct"; doc["latestPlatform"] = "direct"
                doc["userId"] = user?.uid; doc["fullName"] = null; doc["email"] = user?.email
                doc["device"] = mapOf(
                    "userAgent" to "PalouseFellowshipAudio-Android/${Build.VERSION.RELEASE} (${Build.MANUFACTURER} ${Build.MODEL})",
                    "language" to java.util.Locale.getDefault().toLanguageTag(), "platform" to "Android",
                    "screenWidth" to metrics.widthPixels, "screenHeight" to metrics.heightPixels,
                    "timezone" to java.util.TimeZone.getDefault().id, "isMobile" to true, "isStandalone" to true,
                )
                doc["page"] = page ?: lastPage ?: "/"
                doc["createdAt"] = FieldValue.serverTimestamp()
                firestore.collection("logs").add(doc).await()
                user?.let { firestore.collection("users").document(it.uid).set(mapOf("lastActiveAt" to FieldValue.serverTimestamp()), SetOptions.merge()).await() }
            }
        }
    }

    /** Called on every screen change, with the web-equivalent path (so it groups with the web's page_visit logs). */
    fun pageVisit(path: String) {
        if (path == lastPage) return
        lastPage = path
        log("page_visit", mapOf("path" to path), path)
    }
}
