package com.palousefellowship.audio.ui.screens.auth

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import com.google.android.gms.auth.api.signin.GoogleSignIn
import com.google.android.gms.auth.api.signin.GoogleSignInOptions
import com.google.android.gms.common.api.ApiException
import com.palousefellowship.audio.R

/**
 * Same Google sign-in the web app offers (src/pages/Login.jsx's
 * `signInWithGoogle`), using the classic GoogleSignInClient flow — it
 * needs no extra Digital Asset Links setup, unlike Credential Manager,
 * which keeps first-run setup simpler for this project.
 *
 * Requires `R.string.default_web_client_id`, which is generated from
 * app/google-services.json's oauth_client entry — see README.md.
 */
@Composable
fun GoogleSignInButton(
    label: String,
    enabled: Boolean,
    onIdToken: (idToken: String, displayName: String, email: String) -> Unit,
    onError: (String) -> Unit,
) {
    val context = LocalContext.current
    val googleSignInClient = remember(context) {
        val options = GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
            .requestIdToken(context.getString(R.string.default_web_client_id))
            .requestEmail()
            .build()
        GoogleSignIn.getClient(context, options)
    }

    val launcher = rememberLauncherForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
        val task = GoogleSignIn.getSignedInAccountFromIntent(result.data)
        try {
            val account = task.getResult(ApiException::class.java)
            val idToken = account?.idToken
            if (idToken != null) {
                onIdToken(idToken, account.displayName ?: "", account.email ?: "")
            } else {
                onError("Google sign-in didn't return a token. Please try again.")
            }
        } catch (e: ApiException) {
            onError("Google sign-in was cancelled or failed.")
        }
    }

    OutlinedButton(
        onClick = { launcher.launch(googleSignInClient.signInIntent) },
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
    ) {
        Text(label)
    }
}
