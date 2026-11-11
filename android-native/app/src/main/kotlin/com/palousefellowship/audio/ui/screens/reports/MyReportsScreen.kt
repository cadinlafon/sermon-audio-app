package com.palousefellowship.audio.ui.screens.reports

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.PfaApplication
import com.palousefellowship.audio.data.repository.ProblemReport
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** Port of MyReports.jsx — the problems this person reported and the team's
 * replies. Opening the page marks every reply as read. */
@Composable
fun MyReportsScreen(onBack: () -> Unit) {
    val container = (LocalContext.current.applicationContext as PfaApplication).container
    val session by container.sessionRepository.session.collectAsStateWithLifecycle()
    val reports by remember(session.uid) { container.reportsRepository.myReports(session.uid) }
        .collectAsStateWithLifecycle(initialValue = emptyList())

    LaunchedEffect(reports) {
        val unread = reports.filter { it.userUnread }.map { it.id }
        if (unread.isNotEmpty()) container.reportsRepository.markRepliesRead(unread)
    }

    val colors = MaterialTheme.colorScheme
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = androidx.compose.foundation.layout.PaddingValues(20.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            TextButton(onClick = onBack, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) { Text("← Back", color = colors.primary) }
            Text("My Reports", fontFamily = FontFamily.Serif, fontSize = 28.sp, color = colors.onBackground)
            Text("Problems you've reported, and what we said back.", fontSize = 14.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
        }
        if (!session.signedIn && session.loaded) {
            item { Text("Sign in to see the problems you've reported.", fontSize = 14.sp, color = colors.onSurfaceVariant) }
        } else if (reports.isEmpty()) {
            item { Text("You haven't reported anything. Use Report a Problem in the profile sidebar if something goes wrong.", fontSize = 14.sp, lineHeight = 22.sp, color = colors.onSurfaceVariant) }
        }
        items(reports, key = { it.id }) { ReportCard(it) }
    }
}

private fun fmt(ms: Long): String = if (ms <= 0) "" else SimpleDateFormat("MMM d, yyyy, h:mm a", Locale.US).format(Date(ms))

@Composable
private fun ReportCard(r: ProblemReport) {
    val colors = MaterialTheme.colorScheme
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier.fillMaxWidth().clip(shape).background(colors.surface)
            .border(1.dp, if (r.userUnread) Color(0xFFE0A458) else colors.outline, shape).padding(horizontal = 18.dp, vertical = 16.dp),
    ) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(r.title, fontFamily = FontFamily.Serif, fontSize = 17.sp, color = colors.onBackground, modifier = Modifier.weight(1f))
            if (r.userUnread) Text("New reply", fontSize = 11.sp, fontWeight = FontWeight.Bold, color = Color(0xFFB91C1C), modifier = Modifier.background(Color(0xFFFEE2E2), RoundedCornerShape(999.dp)).padding(horizontal = 9.dp, vertical = 3.dp))
        }
        Text("Sent ${fmt(r.createdAtMillis)}", fontSize = 12.sp, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp, bottom = 10.dp))
        Text(r.details, fontSize = 14.sp, lineHeight = 22.sp, color = colors.onBackground)
        if (r.replies.isEmpty()) {
            Text("No reply yet — we'll answer here.", fontSize = 12.5.sp, fontStyle = androidx.compose.ui.text.font.FontStyle.Italic, color = colors.onSurfaceVariant, modifier = Modifier.padding(top = 12.dp))
        } else {
            Column(Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                r.replies.forEach { rep ->
                    Column(Modifier.fillMaxWidth().background(colors.background, RoundedCornerShape(10.dp)).padding(horizontal = 12.dp, vertical = 10.dp)) {
                        Text("${rep.by.ifBlank { "Palouse Fellowship" }} · ${fmt(rep.atMillis)}", fontSize = 11.5.sp, fontWeight = FontWeight.SemiBold, color = colors.onSurfaceVariant)
                        Text(rep.body, fontSize = 14.sp, lineHeight = 21.sp, color = colors.onBackground, modifier = Modifier.padding(top = 4.dp))
                    }
                }
            }
        }
    }
}
