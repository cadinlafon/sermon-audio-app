package com.palousefellowship.audio.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId

/** Mirrors the `notices` collection (shown inline on Home in the web app —
 * there is no separate Notices page there, so there isn't one here either). */
data class Notice(
    @DocumentId val id: String = "",
    val title: String = "",
    val details: String = "",
    val pinned: Boolean = false,
    val active: Boolean = true,
    val audience: String = "all", // "all" | "users" | "admins" | "guests"
    val expiresAt: Timestamp? = null,
    val createdAt: Timestamp? = null,
    val buttonEnabled: Boolean = false,
    val buttonType: String? = null, // "url" | "page"
    val buttonValue: String? = null,
    val buttonText: String? = null,
) {
    fun isVisible(signedIn: Boolean, now: Long = System.currentTimeMillis()): Boolean {
        if (!active) return false
        expiresAt?.let { if (it.toDate().time <= now) return false }
        return when (audience) {
            "users" -> signedIn
            "guests" -> !signedIn
            "admins" -> false // admin-only notices aren't shown to regular listeners
            else -> true
        }
    }
}
