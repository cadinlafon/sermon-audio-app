package com.palousefellowship.audio.ui.screens.settings

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.palousefellowship.audio.BuildConfig
import com.palousefellowship.audio.ui.pfaViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(onSignInRequired: () -> Unit) {
    val viewModel = pfaViewModel { c -> SettingsViewModel(c.authRepository, c.pushRepository) }
    val user by viewModel.user.collectAsStateWithLifecycle()
    val pushError by viewModel.pushError.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current

    var notificationsOn by remember { mutableStateOf(false) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        notificationsOn = granted
        if (granted) viewModel.onNotificationPermissionGranted()
    }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Settings & About", style = MaterialTheme.typography.titleLarge) }) },
    ) { padding ->
        Column(
            modifier = Modifier.fillMaxSize().padding(padding).verticalScroll(rememberScrollState()).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp),
        ) {
            SettingsSection(title = "Account") {
                if (user != null) {
                    Text(user?.email ?: user?.displayName ?: "Signed in", style = MaterialTheme.typography.bodyMedium)
                    OutlinedButton(onClick = { viewModel.signOut() }, modifier = Modifier.padding(top = 10.dp)) { Text("Sign Out") }
                } else {
                    Text("You're not signed in.", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Button(onClick = onSignInRequired, modifier = Modifier.padding(top = 10.dp)) { Text("Sign In") }
                }
            }

            SettingsSection(title = "Notifications") {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.weight(1f)) {
                        Text("New sermon & announcement alerts", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            "Requires being signed in.",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Switch(
                        checked = notificationsOn,
                        onCheckedChange = { checked ->
                            if (checked && user == null) {
                                onSignInRequired()
                                return@Switch
                            }
                            if (checked && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                val hasPermission = ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
                                if (hasPermission) {
                                    notificationsOn = true
                                    viewModel.onNotificationPermissionGranted()
                                } else {
                                    permissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                }
                            } else {
                                notificationsOn = checked
                                if (checked) viewModel.onNotificationPermissionGranted()
                            }
                        },
                    )
                }
                pushError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 6.dp)) }
            }

            SettingsSection(title = "About") {
                Text("Palouse Fellowship Audio", style = MaterialTheme.typography.titleMedium)
                Text("Version ${BuildConfig.VERSION_NAME}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(
                    "Sermons, Sunday School lessons, homilies, and the Doctrine campaign from Palouse Fellowship — the same content as the web app, in a native Android player.",
                    style = MaterialTheme.typography.bodyMedium,
                    modifier = Modifier.padding(top = 8.dp),
                )
            }

            SettingsSection(title = "Privacy") {
                // The web app's Privacy section lives inside its single
                // /settings page (src/pages/Settings/Settings.jsx), not a
                // dedicated route — link there rather than a URL that
                // doesn't exist.
                OutlinedButton(onClick = { uriHandler.openUri("https://palousefellowshipsermonapp.web.app/settings") }) {
                    Text("Privacy Policy")
                }
            }
        }
    }
}

@Composable
private fun SettingsSection(title: String, content: @Composable () -> Unit) {
    Card(modifier = Modifier.fillMaxWidth(), shape = RoundedCornerShape(16.dp)) {
        Column(Modifier.padding(16.dp)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.primary)
            Column(Modifier.padding(top = 10.dp)) { content() }
        }
    }
}
