package com.palousefellowship.audio.data.prefs

import android.content.Context
import com.palousefellowship.audio.data.config.PlaybackConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import org.json.JSONObject

val SKIP_OPTIONS = listOf(10, 15, 30, 45, 60)
val SPEED_OPTIONS = listOf(0.75f, 1f, 1.25f, 1.5f, 1.75f, 2f)
val REPEAT_MODES = listOf("off", "track", "queue")

/** The listener's own player preferences (src/utils/playerSettings.js), kept per
 * device. [touched] records which of speed / skip the LISTENER changed — the
 * admin's playback defaults (Audio Page Manager → Playback) fill in the rest. */
data class PlayerSettings(
    val skipBack: Int = 30,
    val skipForward: Int = 30,
    val speed: Float = 1f,
    val repeat: String = "off",
    val shuffle: Boolean = false,
    val showRemaining: Boolean = false,
    val showNotesWhilePlaying: Boolean = true,
    val sectionRecent: Boolean = true,
    val sectionBookmarks: Boolean = true,
    val sectionRelated: Boolean = true,
    val touchedSpeed: Boolean = false,
    val touchedSkipBack: Boolean = false,
    val touchedSkipForward: Boolean = false,
) {
    /** applyAdminDefaults(): the listener's choice wins, otherwise the admin's default. */
    fun effective(admin: PlaybackConfig): PlayerSettings = copy(
        speed = if (touchedSpeed) speed else admin.defaultSpeed.toFloat(),
        skipBack = if (touchedSkipBack) skipBack else admin.skipBack,
        skipForward = if (touchedSkipForward) skipForward else admin.skipForward,
    )
}

class PlayerSettingsStore(context: Context) {
    private val prefs = context.getSharedPreferences("pf_player", Context.MODE_PRIVATE)
    private val _settings = MutableStateFlow(load())
    val settings: StateFlow<PlayerSettings> = _settings.asStateFlow()

    private fun load(): PlayerSettings = runCatching {
        val o = JSONObject(prefs.getString("settings", "{}") ?: "{}")
        val d = PlayerSettings()
        PlayerSettings(
            skipBack = o.optInt("skipBack", d.skipBack).takeIf { it in SKIP_OPTIONS } ?: d.skipBack,
            skipForward = o.optInt("skipForward", d.skipForward).takeIf { it in SKIP_OPTIONS } ?: d.skipForward,
            speed = o.optDouble("speed", 1.0).toFloat().takeIf { it in 0.5f..3f } ?: 1f,
            repeat = o.optString("repeat", "off").takeIf { it in REPEAT_MODES } ?: "off",
            shuffle = o.optBoolean("shuffle", false),
            showRemaining = o.optBoolean("showRemaining", false),
            showNotesWhilePlaying = o.optBoolean("showNotesWhilePlaying", true),
            sectionRecent = o.optBoolean("sectionRecent", true),
            sectionBookmarks = o.optBoolean("sectionBookmarks", true),
            sectionRelated = o.optBoolean("sectionRelated", true),
            touchedSpeed = o.optBoolean("touchedSpeed", false),
            touchedSkipBack = o.optBoolean("touchedSkipBack", false),
            touchedSkipForward = o.optBoolean("touchedSkipForward", false),
        )
    }.getOrDefault(PlayerSettings())

    fun update(transform: (PlayerSettings) -> PlayerSettings) {
        val next = transform(_settings.value)
        _settings.value = next
        prefs.edit().putString("settings", JSONObject().apply {
            put("skipBack", next.skipBack); put("skipForward", next.skipForward); put("speed", next.speed.toDouble())
            put("repeat", next.repeat); put("shuffle", next.shuffle); put("showRemaining", next.showRemaining)
            put("showNotesWhilePlaying", next.showNotesWhilePlaying)
            put("sectionRecent", next.sectionRecent); put("sectionBookmarks", next.sectionBookmarks); put("sectionRelated", next.sectionRelated)
            put("touchedSpeed", next.touchedSpeed); put("touchedSkipBack", next.touchedSkipBack); put("touchedSkipForward", next.touchedSkipForward)
        }.toString()).apply()
    }

    // Queue + recently played survive restarts (only the fields needed to list/replay them).
    fun loadList(key: String, max: Int): List<com.palousefellowship.audio.data.model.Audio> = runCatching {
        val arr = org.json.JSONArray(prefs.getString(key, "[]") ?: "[]")
        (0 until arr.length()).mapNotNull { i ->
            val o = arr.getJSONObject(i)
            val id = o.optString("id").ifEmpty { return@mapNotNull null }
            com.palousefellowship.audio.data.model.Audio(
                id = id, title = o.optString("title"), speaker = o.optString("speaker"), type = o.optString("type"),
                duration = o.optLong("duration"), audioStorageKey = o.optString("audioStorageKey"),
                transcribeStorageKey = o.optString("transcribeStorageKey").ifEmpty { null }, order = o.optLong("order"),
                date = o.optString("date").ifEmpty { null }, series = o.optString("series").ifEmpty { null },
            )
        }.take(max)
    }.getOrDefault(emptyList())

    fun saveList(key: String, list: List<com.palousefellowship.audio.data.model.Audio>) {
        val arr = org.json.JSONArray()
        list.forEach { a ->
            arr.put(JSONObject().apply {
                put("id", a.id); put("title", a.title); put("speaker", a.speaker); put("type", a.type); put("duration", a.duration)
                put("audioStorageKey", a.audioStorageKey); put("transcribeStorageKey", a.transcribeStorageKey ?: ""); put("order", a.order)
                put("date", a.date ?: ""); put("series", a.series ?: "")
            })
        }
        prefs.edit().putString(key, arr.toString()).apply()
    }
}
