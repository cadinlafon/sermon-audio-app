package com.palousefellowship.audio.data.remote

import retrofit2.http.Body
import retrofit2.http.Header
import retrofit2.http.POST

/**
 * The same Supabase Edge Function the web app calls from
 * AudioPlayerContext.jsx's `requestDownloadUrl` — audio files live in a
 * private Backblaze B2 bucket, never a public Storage URL, so this
 * exchanges a Firestore `audio` doc's storage key for a short-lived
 * (4-hour) signed download URL. Deployed at
 * `${SUPABASE_URL}/functions/v1/audio-download-url`.
 */
interface AudioUrlApi {
    @POST("functions/v1/audio-download-url")
    suspend fun getDownloadUrl(
        @Body body: AudioUrlRequest,
        // Optional: a Firebase ID token, sent when signed in, exactly like
        // the web client — the function verifies it best-effort and falls
        // back to anonymous access if it's missing or invalid, since
        // listening has never required an account.
        @Header("Authorization") authorization: String,
    ): AudioUrlResponse
}

data class AudioUrlRequest(
    // Preferred path: pass the storage key straight from the Firestore
    // doc we already read, skipping a redundant server-side lookup.
    val storageKey: String? = null,
    // Fallback path (used for the Doctrine collection, whose audio files
    // are nested rather than top-level `audio` docs).
    val audioId: String? = null,
    val collection: String? = null,
)

data class AudioUrlResponse(
    val url: String? = null,
    val expiresIn: Int? = null,
    val error: String? = null,
)

/** summarize-audio (same Edge Function the web's AiSummary.jsx calls). */
interface SummaryApi {
    @POST("functions/v1/summarize-audio")
    suspend fun summarize(
        @Body body: SummarizeRequest,
        @Header("Authorization") authorization: String,
    ): SummarizeResponse
}

data class SummarizeRequest(
    val audioId: String,
    val audioUrl: String?,
    val audioType: String,
    val title: String,
    val force: Boolean = false,
    val mode: String? = null,
)

data class SummarizeResponse(val summary: String? = null, val error: String? = null, val pending: Boolean? = null)
