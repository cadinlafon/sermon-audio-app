package com.palousefellowship.audio.data.repository

import android.content.Context
import com.palousefellowship.audio.data.local.AppDatabase
import com.palousefellowship.audio.data.local.DownloadEntity
import com.palousefellowship.audio.data.model.Audio
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.IOException

/**
 * Real offline audio, not just cached metadata (see the web app's
 * src/utils/offlineDownloads.js for the feature this mirrors): downloads
 * the signed URL's bytes into the app's private storage so playback works
 * with airplane mode on, and tracks the catalog in Room. Capped at
 * [MAX_DOWNLOADS] per device, same limit the web app enforces per account.
 */
class DownloadRepository(
    private val context: Context,
    private val audioRepository: AudioRepository,
) {
    private val dao = AppDatabase.get(context).downloadDao()
    private val client = OkHttpClient()

    companion object {
        const val MAX_DOWNLOADS = 5
    }

    fun observeDownloads(): Flow<List<DownloadEntity>> = dao.observeAll()

    suspend fun getDownload(audioId: String): DownloadEntity? = dao.get(audioId)

    suspend fun isDownloaded(audioId: String): Boolean = dao.get(audioId) != null

    private fun fileFor(audioId: String) = File(File(context.filesDir, "downloads").apply { mkdirs() }, "$audioId.audio")

    suspend fun download(audio: Audio): Result<Unit> = withContext(Dispatchers.IO) {
        runCatching {
            if (dao.get(audio.id) != null) return@runCatching
            if (dao.count() >= MAX_DOWNLOADS) {
                error("You've reached the $MAX_DOWNLOADS-download limit on this device. Remove one from Downloads first.")
            }
            val url = audioRepository.resolvePlaybackUrl(audio).getOrThrow()
            val request = Request.Builder().url(url).build()
            val file = fileFor(audio.id)
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) throw IOException("Download failed (${response.code})")
                val body = response.body ?: throw IOException("Empty response")
                file.outputStream().use { out -> body.byteStream().copyTo(out) }
            }
            dao.insert(
                DownloadEntity(
                    audioId = audio.id,
                    title = audio.title,
                    speaker = audio.speaker,
                    type = audio.type,
                    duration = audio.duration,
                    localPath = file.absolutePath,
                    fileSizeBytes = file.length(),
                    downloadedAtMillis = System.currentTimeMillis(),
                ),
            )
        }
    }

    suspend fun remove(audioId: String) = withContext(Dispatchers.IO) {
        fileFor(audioId).delete()
        dao.delete(audioId)
    }

    suspend fun totalBytes(): Long = withContext(Dispatchers.IO) { dao.getAll().sumOf { it.fileSizeBytes } }
}
