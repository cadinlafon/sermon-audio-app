package com.palousefellowship.audio.ui.screens.contact

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

/**
 * The web app's Contact page deliberately never ships the real email/phone
 * in the page's own JS — it only reveals them after solving a Cloudflare
 * Turnstile challenge, verified server-side by the `contact-info` Edge
 * Function (see src/pages/Contact.jsx's comment). Turnstile is a browser
 * widget with no native Android SDK this app already depends on, and
 * embedding a WebView just to solve one CAPTCHA would cut against "no
 * WebView" in spirit even if not literally the whole UI — so this screen
 * explains that and opens the real Contact page in the system browser for
 * the actual reveal, the same pattern apps commonly use for one-off
 * external verification flows (this is a single external link, not the
 * app's UI running inside a WebView).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ContactScreen() {
    val uriHandler = LocalUriHandler.current

    Scaffold(
        topBar = { TopAppBar(title = { Text("Contact", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            verticalArrangement = Arrangement.Center,
        ) {
            Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp)) {
                Column(Modifier.padding(24.dp)) {
                    Text("✉️", style = MaterialTheme.typography.headlineLarge)
                    Text(
                        "Get in touch",
                        style = MaterialTheme.typography.headlineSmall,
                        modifier = Modifier.padding(top = 12.dp),
                    )
                    Text(
                        "To keep our email and phone number away from spam bots, they're only shown after a quick verification in your browser.",
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    Button(
                        onClick = { uriHandler.openUri("https://palousefellowshipsermonapp.web.app/contact") },
                        modifier = Modifier.fillMaxWidth().padding(top = 18.dp),
                    ) {
                        Text("View Contact Info")
                    }
                }
            }
            Text(
                "Opens in your browser, not inside the app.",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
        }
    }
}
