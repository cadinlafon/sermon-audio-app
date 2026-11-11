package com.palousefellowship.audio.data.prefs

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/** Same three-way preference the web app's ThemeContext keeps
 * ("pf-theme-preference": light | dark | system, default light), cycled by
 * the sun/moon button in the top bar. */
enum class ThemePreference(val key: String, val icon: String) {
    LIGHT("light", "☀️"),
    DARK("dark", "🌙"),
    SYSTEM("system", "🖥️");

    fun next() = when (this) { LIGHT -> DARK; DARK -> SYSTEM; SYSTEM -> LIGHT }

    companion object {
        fun fromKey(key: String?) = entries.firstOrNull { it.key == key } ?: LIGHT
    }
}

class ThemePrefs(context: Context) {
    private val prefs = context.getSharedPreferences("pf_theme", Context.MODE_PRIVATE)
    private val _preference = MutableStateFlow(ThemePreference.fromKey(prefs.getString("preference", null)))
    val preference: StateFlow<ThemePreference> = _preference.asStateFlow()

    fun cycle() {
        val next = _preference.value.next()
        prefs.edit().putString("preference", next.key).apply()
        _preference.value = next
    }
}
