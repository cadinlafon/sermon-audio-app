package com.palousefellowship.audio.ui.screens.about

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.ui.theme.BorderTan
import com.palousefellowship.audio.ui.theme.CardBackground
import com.palousefellowship.audio.ui.theme.CreamBackground
import com.palousefellowship.audio.ui.theme.DarkBrown
import com.palousefellowship.audio.ui.theme.MutedBrown

/** The web app's /about route (src/pages/About.jsx) is, today, literally
 * just a "Coming Soon" placeholder — not a simplification on this side,
 * that really is the whole page. Reproduced as-is, including the web's
 * centered card treatment, for honest parity. */
@Composable
fun AboutScreen() {
    Box(
        modifier = Modifier.fillMaxSize().background(CreamBackground).padding(32.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            modifier = Modifier.widthIn(max = 420.dp).fillMaxWidth(),
            colors = CardDefaults.cardColors(containerColor = CardBackground),
            shape = RoundedCornerShape(20.dp),
            border = BorderStroke(1.dp, BorderTan),
        ) {
            Column(
                modifier = Modifier.padding(horizontal = 28.dp, vertical = 40.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text("🏗️", style = MaterialTheme.typography.displaySmall)
                Text(
                    "Coming Soon",
                    style = MaterialTheme.typography.headlineMedium,
                    color = DarkBrown,
                    modifier = Modifier.padding(top = 14.dp),
                )
                Text(
                    "This page is still being set up. Check back soon — there's more on the way.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MutedBrown,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 14.dp),
                )
            }
        }
    }
}
