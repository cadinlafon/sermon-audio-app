package com.palousefellowship.audio.ui.shell

import android.content.Intent
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.palousefellowship.audio.AppContainer
import com.palousefellowship.audio.data.config.PageConfig
import com.palousefellowship.audio.data.config.Session
import com.palousefellowship.audio.data.repository.ReportsRepository
import com.palousefellowship.audio.ui.screens.auth.GoogleSignInButton
import kotlinx.coroutines.launch

const val APP_URL = "https://palousefellowshipsermonapp.web.app"

/** What the avatar opens: a "Welcome back" login card for guests (the web's
 * dropdown) and a full-height right-hand sidebar once signed in
 * (ProfileSidebar.jsx). Every button inside closes it. */
@Composable
fun AccountPanel(
    container: AppContainer,
    session: Session,
    accountPages: List<PageConfig>,
    unreadReplies: Int,
    onDismiss: () -> Unit,
    onGoRoute: (String) -> Unit,
    onGoPage: (PageConfig) -> Unit,
) {
    Dialog(onDismissRequest = onDismiss, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Box(Modifier.fillMaxSize().background(Color(0x73281200)).clickable(onClick = onDismiss)) {
            if (session.signedIn) {
                SignedInSidebar(container, session, accountPages, unreadReplies, onDismiss, onGoRoute, onGoPage)
            } else {
                GuestCard(container, onDismiss, onGoRoute)
            }
        }
    }
}

@Composable
private fun BoxScope.GuestCard(container: AppContainer, onDismiss: () -> Unit, onGoRoute: (String) -> Unit) {
    val colors = MaterialTheme.colorScheme
    val scope = rememberCoroutineScope()
    var email by remember { mutableStateOf("") }
    var password by remember { mutableStateOf("") }
    var error by remember { mutableStateOf<String?>(null) }
    var busy by remember { mutableStateOf(false) }

    Column(
        Modifier.align(Alignment.TopEnd).statusBarsPadding().padding(top = 56.dp, end = 12.dp, start = 12.dp).width(300.dp)
            .clip(RoundedCornerShape(16.dp)).background(colors.surface).border(1.dp, colors.outline, RoundedCornerShape(16.dp))
            .clickable(enabled = false) {}.padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text("Welcome back", fontFamily = androidx.compose.ui.text.font.FontFamily.Serif, fontSize = 16.sp, color = colors.onBackground)
        OutlinedTextField(email, { email = it }, placeholder = { Text("Email") }, singleLine = true, modifier = Modifier.fillMaxWidth(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email))
        OutlinedTextField(password, { password = it }, placeholder = { Text("Password") }, singleLine = true, modifier = Modifier.fillMaxWidth(), visualTransformation = PasswordVisualTransformation(), keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password))
        Button(
            onClick = {
                if (email.isBlank() || password.isBlank()) { error = "Please enter your email and password."; return@Button }
                busy = true; error = null
                scope.launch {
                    container.authRepository.signInWithEmail(email.trim(), password).fold(
                        onSuccess = { container.eventLogger.log("user_login"); onDismiss() },
                        onFailure = { error = it.message; busy = false },
                    )
                }
            },
            enabled = !busy, modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(10.dp),
            colors = ButtonDefaults.buttonColors(containerColor = colors.primary),
        ) { Text("LOG IN", fontWeight = FontWeight.SemiBold, letterSpacing = 1.sp) }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            HorizontalDivider(Modifier.weight(1f), color = colors.outline)
            Text("or", fontSize = 12.sp, color = colors.onSurfaceVariant)
            HorizontalDivider(Modifier.weight(1f), color = colors.outline)
        }
        GoogleSignInButton(
            label = "Continue with Google", enabled = !busy,
            onIdToken = { token, name, mail ->
                busy = true
                scope.launch {
                    container.authRepository.signInWithGoogleIdToken(token, name, mail).fold(
                        onSuccess = { onDismiss() },
                        onFailure = { error = it.message; busy = false },
                    )
                }
            },
            onError = { error = it },
        )
        Text(
            "Don't have an account? Sign up", fontSize = 13.sp, color = colors.onSurfaceVariant,
            modifier = Modifier.fillMaxWidth().clickable { onDismiss(); onGoRoute("sign_up") }.padding(vertical = 4.dp),
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        error?.let { Text(it, color = colors.error, fontSize = 12.sp) }
    }
}

@Composable
private fun BoxScope.SignedInSidebar(
    container: AppContainer, session: Session, accountPages: List<PageConfig>, unreadReplies: Int,
    onDismiss: () -> Unit, onGoRoute: (String) -> Unit, onGoPage: (PageConfig) -> Unit,
) {
    val colors = MaterialTheme.colorScheme
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var title by remember { mutableStateOf("") }
    var details by remember { mutableStateOf("") }
    var sending by remember { mutableStateOf(false) }
    var reportError by remember { mutableStateOf<String?>(null) }
    var sent by remember { mutableStateOf(false) }

    val suggest = accountPages.firstOrNull { it.id == "suggest" }
    val settings = accountPages.firstOrNull { it.id == "settings" }
    val others = accountPages.filter { it.id != "suggest" && it.id != "settings" }
    val name = session.displayName?.takeIf { it.isNotBlank() } ?: session.email ?: "Your account"

    Column(
        Modifier.align(Alignment.CenterEnd).fillMaxHeight().width(310.dp).background(colors.surface)
            .clickable(enabled = false) {}.statusBarsPadding().navigationBarsPadding().padding(18.dp),
    ) {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
            Text(name, fontFamily = androidx.compose.ui.text.font.FontFamily.Serif, fontSize = 17.sp, color = colors.onBackground, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
            Text("✕", fontSize = 18.sp, color = colors.onSurfaceVariant, modifier = Modifier.clip(CircleShape).clickable(onClick = onDismiss).padding(8.dp))
        }
        HorizontalDivider(Modifier.padding(vertical = 12.dp), color = colors.outline)

        Column(Modifier.weight(1f).verticalScroll(rememberScrollState())) {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                QuickBlock("📤", "Share App", Modifier.weight(1f)) {
                    onDismiss()
                    context.startActivity(Intent.createChooser(Intent(Intent.ACTION_SEND).apply {
                        type = "text/plain"
                        putExtra(Intent.EXTRA_SUBJECT, "Palouse Fellowship Sermon App")
                        putExtra(Intent.EXTRA_TEXT, "Listen to sermons from Palouse Fellowship.\n$APP_URL")
                    }, "Share App"))
                }
                if (suggest != null) QuickBlock(suggest.icon, suggest.displayName, Modifier.weight(1f)) { onGoPage(suggest) } else Spacer(Modifier.weight(1f))
                if (settings != null) QuickBlock(settings.icon, settings.displayName, Modifier.weight(1f)) { onGoPage(settings) } else Spacer(Modifier.weight(1f))
            }
            HorizontalDivider(Modifier.padding(vertical = 12.dp), color = colors.outline)
            others.forEach { p ->
                ListRow(p.icon, p.displayName) { onGoPage(p) }
            }
            Row(Modifier.fillMaxWidth().clickable { onGoRoute("my_reports") }.padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Box(Modifier.width(22.dp), contentAlignment = Alignment.Center) { Text("📨", fontSize = 16.sp) }
                Text("My Reports", fontSize = 15.sp, color = colors.onBackground)
                if (unreadReplies > 0) Box(Modifier.size(9.dp).clip(CircleShape).background(Color(0xFFDC2626)))
            }
            HorizontalDivider(Modifier.padding(vertical = 12.dp), color = colors.outline)

            Text("Report a Problem", fontFamily = androidx.compose.ui.text.font.FontFamily.Serif, fontSize = 15.sp, color = colors.onBackground)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(title, { title = it.take(ReportsRepository.MAX_TITLE) }, placeholder = { Text("Title") }, singleLine = true, enabled = !sending, modifier = Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(details, { details = it.take(ReportsRepository.MAX_DETAILS) }, placeholder = { Text("What went wrong? What were you doing?") }, minLines = 3, enabled = !sending, modifier = Modifier.fillMaxWidth())
            reportError?.let { Text(it, color = colors.error, fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp)) }
            if (sent) Text("Report sent — thank you!", color = Color(0xFF166534), fontSize = 12.sp, modifier = Modifier.padding(top = 6.dp))
            Button(
                onClick = {
                    sending = true; reportError = null
                    scope.launch {
                        runCatching { container.reportsRepository.createReport(title, details) }.fold(
                            onSuccess = { sent = true; sending = false; title = ""; details = "" },
                            onFailure = { reportError = it.message ?: "Couldn't send the report."; sending = false },
                        )
                    }
                },
                enabled = !sending && title.isNotBlank() && details.isNotBlank(),
                modifier = Modifier.padding(top = 8.dp).fillMaxWidth(), shape = RoundedCornerShape(10.dp),
            ) { Text(if (sending) "Sending…" else "Submit") }
        }

        HorizontalDivider(Modifier.padding(vertical = 12.dp), color = colors.outline)
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            if (session.isAdmin) {
                Text(
                    "Admin", color = colors.onBackground, fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).border(1.dp, colors.outline, RoundedCornerShape(10.dp))
                        .clickable { onDismiss(); context.startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse("$APP_URL/admin"))) }
                        .padding(vertical = 12.dp),
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
            Text(
                "Log out", color = Color(0xFFA33622), fontSize = 14.sp, fontWeight = FontWeight.SemiBold,
                modifier = Modifier.weight(1f).clip(RoundedCornerShape(10.dp)).border(1.dp, Color(0xFFA33622).copy(alpha = 0.4f), RoundedCornerShape(10.dp))
                    .clickable { onDismiss(); container.eventLogger.log("logout"); container.authRepository.signOut() }.padding(vertical = 12.dp),
                textAlign = androidx.compose.ui.text.style.TextAlign.Center,
            )
        }
    }
}

@Composable
private fun QuickBlock(icon: String, label: String, modifier: Modifier, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Column(
        modifier.clip(RoundedCornerShape(14.dp)).background(colors.background).border(1.dp, colors.outline, RoundedCornerShape(14.dp))
            .clickable(onClick = onClick).padding(vertical = 12.dp, horizontal = 4.dp),
        horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        PageIcon(icon, 30.dp)
        Text(label, fontSize = 11.sp, maxLines = 2, color = colors.onBackground, textAlign = androidx.compose.ui.text.style.TextAlign.Center)
    }
}

@Composable
private fun ListRow(icon: String, label: String, onClick: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable(onClick = onClick).padding(vertical = 10.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Box(Modifier.width(22.dp), contentAlignment = Alignment.Center) { PageIcon(icon, 18.dp) }
        Text(label, fontSize = 15.sp, color = MaterialTheme.colorScheme.onBackground)
    }
}
