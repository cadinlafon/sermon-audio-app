package com.palousefellowship.audio.ui.theme

import android.app.Activity
import android.os.Build
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.toArgb
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.core.view.WindowCompat

private val LightColors = lightColorScheme(
    primary = AccentBrownDark,
    onPrimary = CreamBackground,
    secondary = AccentOrange,
    background = CreamBackground,
    surface = CardBackground,
    surfaceVariant = BorderTan,
    onBackground = DarkBrown,
    onSurface = DarkBrown,
    onSurfaceVariant = MutedBrown,
    error = ErrorRed,
    errorContainer = ErrorRedBg,
    outline = BorderTan,
)

private val DarkColors = darkColorScheme(
    primary = AccentOrange,
    onPrimary = DarkSurface,
    secondary = AccentBrownDark,
    background = DarkSurface,
    surface = DarkSurfaceVariant,
    surfaceVariant = DarkSurfaceVariant,
    onBackground = DarkOnSurface,
    onSurface = DarkOnSurface,
    onSurfaceVariant = DarkOnSurfaceMuted,
    error = Color(0xFFFFB4A9),
    outline = DarkSurfaceVariant,
)

/**
 * Follows the system light/dark setting (Step 8: "if practical") rather
 * than a manual in-app toggle — one less piece of state to persist, and
 * it's what most listeners expect a modern app to do by default.
 * Deliberately does NOT opt into Android 12+ dynamic (wallpaper-derived)
 * color: this app has its own brand palette that should look the same as
 * the web app, not shift with the listener's wallpaper.
 */
@Composable
fun PalouseFellowshipAudioTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    useDynamicColor: Boolean = false,
    content: @Composable () -> Unit,
) {
    val context = LocalContext.current
    val colorScheme = when {
        useDynamicColor && Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ->
            if (darkTheme) dynamicDarkColorScheme(context) else dynamicLightColorScheme(context)
        darkTheme -> DarkColors
        else -> LightColors
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        androidx.compose.runtime.SideEffect {
            val window = (view.context as Activity).window
            window.statusBarColor = colorScheme.background.toArgb()
            WindowCompat.getInsetsController(window, view).isAppearanceLightStatusBars = !darkTheme
        }
    }

    MaterialTheme(
        colorScheme = colorScheme,
        typography = PfaTypography,
        content = content,
    )
}
