package com.palousefellowship.audio.ui.screens.contact

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.palousefellowship.audio.ui.theme.AccentBrownDark
import com.palousefellowship.audio.ui.theme.BorderTan
import com.palousefellowship.audio.ui.theme.CardBackground
import com.palousefellowship.audio.ui.theme.CreamBackground
import com.palousefellowship.audio.ui.theme.DarkBrown
import com.palousefellowship.audio.ui.theme.MutedBrown

// Web's `captchaCard` amber tones (src/pages/Contact.jsx) — same palette as
// NoticeCard's `noticeItem`.
private val CaptchaBg = Color(0xFFFFFBEE)
private val CaptchaBorder = Color(0xFFF0D898)
private val LabelBrown = Color(0xFFB08050)
private val CardTitleColor = Color(0xFF5C3A1E)

private data class ContactRow(val label: String, val value: String)

/**
 * A close structural port of src/pages/Contact.jsx: same title/subtitle,
 * the same "Church" and "App Support" cards with Name/Email/Phone/For
 * rows, and the same footer note about spam-bot verification.
 *
 * One necessary behavior difference: the web page never ships the real
 * email/phone in its JS at all — it only reveals them after solving a
 * Cloudflare Turnstile challenge, verified server-side by the
 * `contact-info` Edge Function. Turnstile is a browser widget with no
 * native Android SDK this app depends on, and embedding a WebView just to
 * solve one CAPTCHA would cut against this app's "no WebView" design in
 * spirit — so the verify step here opens the real Contact page in the
 * system browser (a single external link, not the app's UI running
 * inside a WebView) and the two info cards show the web's own
 * pre-verification placeholder text ("Verify above to view").
 */
@Composable
fun ContactScreen() {
    val uriHandler = LocalUriHandler.current

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(CreamBackground),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 32.dp),
        verticalArrangement = Arrangement.spacedBy(20.dp),
    ) {
        item {
            Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                Text("Get in Touch", style = MaterialTheme.typography.headlineMedium, color = DarkBrown, textAlign = TextAlign.Center)
                Text(
                    "We'd love to hear from you.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MutedBrown,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(top = 6.dp),
                )
            }
        }

        item {
            Card(
                modifier = Modifier.fillMaxWidth(),
                colors = CardDefaults.cardColors(containerColor = CaptchaBg),
                border = BorderStroke(1.dp, CaptchaBorder),
                shape = RoundedCornerShape(18.dp),
            ) {
                Column(
                    modifier = Modifier.padding(horizontal = 24.dp, vertical = 26.dp).fillMaxWidth(),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text("🔒", style = MaterialTheme.typography.headlineSmall)
                    Text(
                        "Verify to see contact info",
                        style = MaterialTheme.typography.titleMedium,
                        color = DarkBrown,
                        modifier = Modifier.padding(top = 10.dp),
                    )
                    Text(
                        "Complete a quick check in your browser to reveal our email addresses and phone numbers.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MutedBrown,
                        textAlign = TextAlign.Center,
                        modifier = Modifier.padding(top = 6.dp),
                    )
                    Button(
                        onClick = { uriHandler.openUri("https://palousefellowshipsermonapp.web.app/contact") },
                        colors = ButtonDefaults.buttonColors(containerColor = AccentBrownDark),
                        modifier = Modifier.padding(top = 16.dp),
                    ) {
                        Text("Verify in Browser")
                    }
                }
            }
        }

        item {
            ContactCard(
                icon = "⛪",
                title = "Church",
                rows = listOf(
                    ContactRow("Name", "Jonathan Mcintosh"),
                    ContactRow("Email", "Verify above to view"),
                    ContactRow("Phone", "Verify above to view"),
                    ContactRow("For", "Sermons, events, and church activities"),
                ),
            )
        }

        item {
            ContactCard(
                icon = "🛠️",
                title = "App Support",
                rows = listOf(
                    ContactRow("Name", "Cadin LaFon"),
                    ContactRow("Email", "Verify above to view"),
                    ContactRow("Phone", "Verify above to view"),
                    ContactRow("For", "Technical issues and feature requests"),
                ),
            )
        }

        item {
            Text(
                "Verification helps us cut down on spam bots scraping this page — thanks for bearing with it.",
                style = MaterialTheme.typography.labelSmall.copy(fontStyle = FontStyle.Italic),
                color = LabelBrown,
                textAlign = TextAlign.Center,
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }
}

@Composable
private fun ContactCard(icon: String, title: String, rows: List<ContactRow>) {
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = CardBackground),
        border = BorderStroke(1.dp, BorderTan),
        shape = RoundedCornerShape(18.dp),
    ) {
        Column(Modifier.padding(horizontal = 24.dp, vertical = 20.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(icon, style = MaterialTheme.typography.titleLarge)
                Text(title, style = MaterialTheme.typography.titleMedium, color = CardTitleColor, modifier = Modifier.padding(start = 10.dp))
            }
            HorizontalDivider(Modifier.padding(top = 14.dp, bottom = 4.dp), color = BorderTan)
            rows.forEachIndexed { index, row ->
                Row(
                    modifier = Modifier.fillMaxWidth().padding(vertical = 10.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                ) {
                    Text(
                        row.label.uppercase(),
                        style = MaterialTheme.typography.labelSmall,
                        color = LabelBrown,
                    )
                    Text(
                        row.value,
                        style = MaterialTheme.typography.bodyMedium,
                        color = DarkBrown,
                        textAlign = TextAlign.End,
                        modifier = Modifier.padding(start = 12.dp),
                    )
                }
                if (index != rows.lastIndex) HorizontalDivider(color = Color(0xFFF0E4D0))
            }
        }
    }
}
