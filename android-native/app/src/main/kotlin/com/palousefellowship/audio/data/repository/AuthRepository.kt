package com.palousefellowship.audio.data.repository

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.FirebaseUser
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.SetOptions
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.tasks.await

/**
 * Same two sign-in methods the web app offers (src/pages/Login.jsx /
 * SignUp.jsx): email+password and Google. No fake/local-only auth —
 * everything here is a real Firebase Auth call against the same project.
 */
class AuthRepository(
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    val currentUser: FirebaseUser? get() = auth.currentUser

    val authState: Flow<FirebaseUser?> = callbackFlow {
        val listener = FirebaseAuth.AuthStateListener { trySend(it.currentUser) }
        auth.addAuthStateListener(listener)
        awaitClose { auth.removeAuthStateListener(listener) }
    }

    suspend fun signInWithEmail(email: String, password: String): Result<Unit> = runCatching {
        auth.signInWithEmailAndPassword(email, password).await()
        Unit
    }.mapAuthError()

    suspend fun signUpWithEmail(email: String, password: String, fullName: String): Result<Unit> = runCatching {
        val gate = checkRegistrationAllowed()
        if (!gate.allowed) error(gate.reason ?: "Sign-ups are currently closed.")

        val result = auth.createUserWithEmailAndPassword(email, password).await()
        val uid = result.user?.uid ?: error("Account creation failed.")
        writeNewUserDoc(uid, email, fullName, loginMethod = "email")
    }.mapAuthError()

    suspend fun signInWithGoogleIdToken(idToken: String, fallbackName: String, fallbackEmail: String): Result<Unit> = runCatching {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        val result = auth.signInWithCredential(credential).await()
        val isNewUser = result.additionalUserInfo?.isNewUser == true
        val uid = result.user?.uid
        if (isNewUser && uid != null) {
            val gate = checkRegistrationAllowed()
            if (!gate.allowed) {
                auth.signOut()
                error(gate.reason ?: "Sign-ups are currently closed.")
            }
            writeNewUserDoc(uid, result.user?.email ?: fallbackEmail, result.user?.displayName ?: fallbackName, loginMethod = "google")
        }
    }.mapAuthError()

    fun signOut() = auth.signOut()

    private suspend fun writeNewUserDoc(uid: String, email: String, fullName: String, loginMethod: String) {
        val data = mapOf(
            "uid" to uid,
            "fullName" to fullName,
            "email" to email,
            "role" to "user",
            "loginMethod" to loginMethod,
        )
        firestore.collection("users").document(uid).set(data, SetOptions.merge()).await()
    }

    private data class RegistrationGate(val allowed: Boolean, val reason: String? = null)

    // Mirrors src/utils/registrationGate.js's `registrationEnabled` check.
    // The web version also enforces a daily sign-up cap; that's left out
    // here as a deliberate scope trim (see README limitations) — it's a
    // soft anti-spam knob, not a security control (there's no deployed
    // Firestore rule backing either version).
    private suspend fun checkRegistrationAllowed(): RegistrationGate = try {
        val snap = firestore.collection("appConfig").document("status").get().await()
        val enabled = snap.getBoolean("registrationEnabled") ?: true
        if (enabled) RegistrationGate(true) else RegistrationGate(false, "New sign-ups are currently closed. Please check back later.")
    } catch (_: Exception) {
        RegistrationGate(true) // config read failing must never block sign-up
    }

    private fun Result<Unit>.mapAuthError(): Result<Unit> = recoverCatching { throw Exception(friendlyAuthError(it)) }

    private fun friendlyAuthError(error: Throwable): String {
        val code = (error as? com.google.firebase.auth.FirebaseAuthException)?.errorCode
        return when (code) {
            "ERROR_INVALID_CREDENTIAL", "ERROR_WRONG_PASSWORD", "ERROR_USER_NOT_FOUND" -> "Invalid email or password."
            "ERROR_TOO_MANY_REQUESTS" -> "Too many failed attempts. Please wait a moment and try again."
            "ERROR_INVALID_EMAIL" -> "Please enter a valid email address."
            "ERROR_EMAIL_ALREADY_IN_USE" -> "An account with this email already exists."
            "ERROR_WEAK_PASSWORD" -> "Please choose a stronger password."
            else -> error.message ?: "Something went wrong. Please try again."
        }
    }
}
