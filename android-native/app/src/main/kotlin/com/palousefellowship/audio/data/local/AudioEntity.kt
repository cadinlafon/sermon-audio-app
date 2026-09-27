package com.palousefellowship.audio.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey
import com.palousefellowship.audio.data.model.Audio

/**
 * A last-known-good local copy of `audio` docs (see Step 11: cache
 * metadata, never auto-download the whole library). Written after every
 * successful fetch, read only when a fetch fails — the same "offline
 * fallback" pattern as the web app's src/utils/audioListCache.js, just
 * backed by Room instead of localStorage.
 */
@Entity(tableName = "cached_audio")
data class AudioEntity(
    @PrimaryKey val id: String,
    val title: String,
    val speaker: String,
    val type: String,
    val duration: Long,
    val audioStorageKey: String,
    val transcribeStorageKey: String?,
    val order: Long,
    val createdAtMillis: Long?,
    val cachedAtMillis: Long,
)

fun Audio.toEntity(cachedAtMillis: Long = System.currentTimeMillis()) = AudioEntity(
    id = id,
    title = title,
    speaker = speaker,
    type = type,
    duration = duration,
    audioStorageKey = audioStorageKey,
    transcribeStorageKey = transcribeStorageKey,
    order = order,
    createdAtMillis = createdAt?.toDate()?.time,
    cachedAtMillis = cachedAtMillis,
)

fun AudioEntity.toModel() = Audio(
    id = id,
    title = title,
    speaker = speaker,
    type = type,
    duration = duration,
    audioStorageKey = audioStorageKey,
    transcribeStorageKey = transcribeStorageKey,
    order = order,
    createdAt = null,
)
