package com.palousefellowship.audio.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.palousefellowship.audio.data.model.Audio

/** A recording downloaded for offline playback — the actual audio bytes
 * live in a local file under the app's private storage ([localPath]);
 * this row is just the catalog entry, mirroring the metadata the web
 * app keeps in IndexedDB for the same feature (src/utils/offlineDownloads.js). */
@Entity(tableName = "downloads")
data class DownloadEntity(
    @PrimaryKey val audioId: String,
    val title: String,
    val speaker: String,
    val type: String,
    val duration: Long,
    val localPath: String,
    val fileSizeBytes: Long,
    val downloadedAtMillis: Long,
)

fun DownloadEntity.toAudio() = Audio(id = audioId, title = title, speaker = speaker, type = type, duration = duration)
