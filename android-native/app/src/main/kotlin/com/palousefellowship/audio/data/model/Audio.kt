package com.palousefellowship.audio.data.model

import com.google.firebase.Timestamp
import com.google.firebase.firestore.DocumentId

/**
 * Mirrors the `audio` Firestore collection exactly as written by the web
 * app's admin upload flow (src/pages/Admin/UploadAudio.jsx) — same field
 * names, so this maps straight off Firestore's automatic POJO conversion.
 *
 * [audioStorageKey] is a Backblaze B2 object key, NOT a playable URL — it
 * must be exchanged for a short-lived signed URL via the Supabase edge
 * function (see [com.palousefellowship.audio.data.remote.AudioUrlApi]).
 */
data class Audio(
    @DocumentId val id: String = "",
    val title: String = "",
    val speaker: String = "",
    val type: String = "", // "sermon" | "homily" | "sundayschool"
    val duration: Long = 0, // seconds
    val audioStorageKey: String = "",
    val transcribeStorageKey: String? = null,
    val order: Long = 0,
    val createdAt: Timestamp? = null,
    val aiSummary: String? = null,
) {
    companion object {
        const val TYPE_SERMON = "sermon"
        const val TYPE_HOMILY = "homily"
        const val TYPE_SUNDAY_SCHOOL = "sundayschool"
    }
}
