package com.palousefellowship.audio.ui.screens.spotify

import androidx.compose.runtime.Composable
import com.palousefellowship.audio.data.model.Resource
import com.palousefellowship.audio.ui.screens.resources.ResourcesScreen

/**
 * There's no separate "Spotify" collection in the backend — Spotify
 * episodes are just `resources` docs with type == "spotify" (see
 * src/lib/resourceTypes.js and ResourceDetail.jsx on the web side). This
 * screen is Resources pre-filtered to that type, matching the real data
 * model instead of inventing a parallel one.
 */
@Composable
fun SpotifyScreen(onPlayAudioResource: (Resource) -> Unit) {
    ResourcesScreen(
        title = "Spotify",
        typeFilter = Resource.TYPE_SPOTIFY,
        emptyIcon = "🎵",
        emptyMessage = "No Spotify episodes have been added yet.",
        onPlayAudioResource = onPlayAudioResource,
    )
}
