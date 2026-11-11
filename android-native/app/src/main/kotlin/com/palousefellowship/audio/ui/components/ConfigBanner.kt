package com.palousefellowship.audio.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.BiasAlignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.palousefellowship.audio.data.config.BannerConfig

/** The page banner from Audio Page Manager → Appearance (DoctrineBanner.jsx): the photo is
 * never cropped on disk — focus X/Y, zoom, height and overall size are applied here. */
@Composable
fun ConfigBanner(banner: BannerConfig, modifier: Modifier = Modifier) {
    val h = (banner.height * banner.size / 100f).dp
    val outer = when (banner.align) { "left" -> Alignment.CenterStart; "right" -> Alignment.CenterEnd; else -> Alignment.Center }
    Box(modifier.fillMaxWidth(), contentAlignment = outer) {
        Box(
            Modifier.fillMaxWidth(banner.size / 100f).height(h).clip(RoundedCornerShape(10.dp))
                .background(MaterialTheme.colorScheme.background).border(1.dp, MaterialTheme.colorScheme.outline, RoundedCornerShape(10.dp)),
        ) {
            AsyncImage(
                model = banner.url, contentDescription = null, contentScale = ContentScale.Crop,
                alignment = BiasAlignment(banner.focusX / 50f - 1f, banner.focusY / 50f - 1f),
                modifier = Modifier.fillMaxWidth().height(h).graphicsLayer {
                    scaleX = banner.zoom; scaleY = banner.zoom
                    transformOrigin = TransformOrigin(banner.focusX / 100f, banner.focusY / 100f)
                },
            )
        }
    }
}
