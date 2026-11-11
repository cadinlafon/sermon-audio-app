package com.palousefellowship.audio.ui.theme

import androidx.compose.ui.graphics.Color

// Lifted directly from the web app's shared inline-style palette (every
// page in src/pages/*.jsx reuses these same hex values), so the native
// app reads as the same product rather than a reskin.
val CreamBackground = Color(0xFFFDF8F3)
val CardBackground = Color(0xFFFFFDF9)
val BorderTan = Color(0xFFEDDFC8)
val DarkBrown = Color(0xFF3D2200)
val MidBrown = Color(0xFF7A4F10)
val MutedBrown = Color(0xFF9B7040)
val AccentOrange = Color(0xFFC97C2E)
val AccentBrownDark = Color(0xFFA85E18)
val ErrorRed = Color(0xFFA33622)
val ErrorRedBg = Color(0xFFFFF5F2)
val SuccessGreen = Color(0xFF166534)
val SuccessGreenBg = Color(0xFFDCFCE7)

// Dark theme: the exact values the web app's theme-tokens.css maps its
// light palette to under [data-theme="dark"].
val DarkSurface = Color(0xFF261C12)        // --color-fdf8f3 (page)
val DarkCard = Color(0xFF261F12)           // --color-fffdf9 (cards / bars)
val DarkBorder = Color(0xFF433723)         // --color-eddfc8
val DarkOnSurface = Color(0xFFE8E1D9)      // --color-3d2200 (primary text)
val DarkOnSurfaceMuted = Color(0xFFBD9B75) // --color-9b7040
val DarkAccent = Color(0xFFDC9D62)         // --color-a85e18
val DarkAccentSoft = Color(0xFFDFAA74)     // --color-c97c2e
val DarkMidBrown = Color(0xFFE7C28D)       // --color-7a4f10
val DarkNavInactive = Color(0xFFCCAD8F)    // --color-b08050
val NavInactive = Color(0xFFB08050)
