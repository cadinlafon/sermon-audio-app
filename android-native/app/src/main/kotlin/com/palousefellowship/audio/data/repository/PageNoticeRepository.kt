package com.palousefellowship.audio.data.repository

import android.content.Context
import com.google.firebase.firestore.FirebaseFirestore
import com.palousefellowship.audio.data.model.PageNotice
import kotlinx.coroutines.tasks.await

/** One small read per audio-page visit, like the web's usePageNotices; the
 * pages filter by schedule/category/placement themselves. Dismissals are
 * remembered on the device. */
class PageNoticeRepository(
    context: Context,
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    private val prefs = context.getSharedPreferences("pf_page_notices", Context.MODE_PRIVATE)

    suspend fun load(): List<PageNotice> = runCatching {
        firestore.collection("pageNotices").get().await().documents.mapNotNull { d -> runCatching { d.toObject(PageNotice::class.java)?.copy(id = d.id) }.getOrNull() }
    }.getOrDefault(emptyList())

    fun isDismissed(n: PageNotice): Boolean = n.dismissible && n.fingerprint in prefs.getStringSet("dismissed", emptySet()).orEmpty()

    fun dismiss(n: PageNotice) {
        val set = prefs.getStringSet("dismissed", emptySet()).orEmpty().toMutableSet()
        set.add(n.fingerprint)
        prefs.edit().putStringSet("dismissed", set.toList().takeLast(200).toSet()).apply()
    }
}
