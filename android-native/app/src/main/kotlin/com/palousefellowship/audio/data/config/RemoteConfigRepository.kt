package com.palousefellowship.audio.data.config

import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

/** Live admin-controlled app configuration (appConfig/status, same document
 * the web app's ShutdownContext listens to), plus the Page Manager's `pages`
 * collection (the web's PagesContext). One snapshot listener each, started
 * once for the whole app, so an admin's change shows up here in real time. */
data class AppStatus(
    val shutdown: Boolean = false,
    val message: String = "",
    val returnDateMillis: Long? = null,
    /** Raw `audioPages` map — resolved/validated by [com.palousefellowship.audio.data.config.AudioPagesConfig]. */
    val audioPages: Map<String, Any?>? = null,
    val audioAiEnabled: Boolean = true,
    val audioAiAudiences: List<String> = listOf("guest", "user", "admin"),
    val loaded: Boolean = false,
)

class RemoteConfigRepository(
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
    scope: CoroutineScope,
) {
    private val _status = MutableStateFlow(AppStatus())
    val status: StateFlow<AppStatus> = _status.asStateFlow()

    private val _pageDocs = MutableStateFlow<Map<String, Map<String, Any?>>>(emptyMap())
    private val _pagesLoaded = MutableStateFlow(false)
    val pagesLoaded: StateFlow<Boolean> = _pagesLoaded.asStateFlow()
    val pageDocs: StateFlow<Map<String, Map<String, Any?>>> = _pageDocs.asStateFlow()

    init {
        firestore.collection("appConfig").document("status").addSnapshotListener { snap, _ ->
            val data = snap?.data
            _status.update {
                if (data == null) it.copy(loaded = true) else AppStatus(
                    shutdown = data["shutdown"] as? Boolean ?: false,
                    message = data["message"] as? String ?: "",
                    returnDateMillis = (data["returnDate"] as? com.google.firebase.Timestamp)?.toDate()?.time,
                    audioPages = (data["audioPages"] as? Map<*, *>)?.entries
                        ?.associate { (k, v) -> k.toString() to v },
                    audioAiEnabled = data["audioAiEnabled"] as? Boolean ?: true,
                    audioAiAudiences = (data["audioAiAudiences"] as? List<*>)?.filterIsInstance<String>()?.takeIf { l -> l.isNotEmpty() } ?: listOf("guest", "user", "admin"),
                    loaded = true,
                )
            }
        }
        firestore.collection("pages").addSnapshotListener { snap, _ ->
            if (snap != null) _pageDocs.value = snap.documents.associate { it.id to (it.data ?: emptyMap()) }
            _pagesLoaded.value = true
        }
    }
}
