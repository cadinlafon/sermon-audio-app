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
    secondaryContainer = BorderTan,
    onSecondaryContainer = DarkBrown,
    background = CreamBackground,
    surface = CardBackground,
    surfaceVariant = BorderTan,
    onBackground = DarkBrown,
    onSurface = DarkBrown,
    onSurfaceVariant = MutedBrown,
    error = ErrorRed,
    errorContainer = ErrorRedBg,
    outline = BorderTan,
    outlineVariant = BorderTan,
    primaryContainer = Color(0xFFFDE8B8),
    onPrimaryContainer = Color(0xFF7A4F10),
    tertiaryContainer = Color(0xFFF4E7D4),
    surfaceTint = Color.Transparent,
    surfaceContainerLowest = CardBackground,
    surfaceContainerLow = CardBackground,
    surfaceContainer = CardBackground,
    surfaceContainerHigh = Color(0xFFF4E7D4),
    surfaceContainerHighest = Color(0xFFF0E4D0),
)

private val DarkColors = darkColorScheme(
    primary = DarkAccent,
    onPrimary = DarkSurface,
    secondary = DarkAccentSoft,
    background = DarkSurface,
    surface = DarkCard,
    surfaceVariant = DarkBorder,
    onBackground = DarkOnSurface,
    onSurface = DarkOnSurface,
    onSurfaceVariant = DarkOnSurfaceMuted,
    error = Color(0xFFD37766),
    errorContainer = Color(0xFF3A1F18),
    outline = DarkBorder,
    outlineVariant = DarkBorder,
    primaryContainer = Color(0xFF4A3C1C),
    onPrimaryContainer = Color(0xFFE7C28D),
    tertiaryContainer = Color(0xFF2C2316),
    surfaceTint = Color.Transparent,
    surfaceContainerLowest = DarkCard,
    surfaceContainerLow = DarkCard,
    surfaceContainer = DarkCard,
    surfaceContainerHigh = Color(0xFF2C2316),
    surfaceContainerHighest = Color(0xFF433723),
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

    androidx.compose.runtime.CompositionLocalProvider(LocalPfaExtras provides if (darkTheme) DarkExtras else LightExtras) {
        MaterialTheme(
            colorScheme = colorScheme,
            typography = PfaTypography,
            content = content,
        )
    }
}
