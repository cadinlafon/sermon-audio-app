package com.palousefellowship.audio.data.config

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.tasks.await

/** Who's signed in + their role — what the web's AuthContext exposes
 * (user / role / isAdmin) so the page gate and menus can decide access. */
data class Session(
    val uid: String? = null,
    val email: String? = null,
    val displayName: String? = null,
    val role: String? = null,
    val isAdmin: Boolean = false,
    val loaded: Boolean = false,
) {
    val signedIn: Boolean get() = uid != null
}

class SessionRepository(
    private val scope: CoroutineScope,
    private val auth: FirebaseAuth = FirebaseAuth.getInstance(),
    private val firestore: FirebaseFirestore = FirebaseFirestore.getInstance(),
) {
    private val _session = MutableStateFlow(Session())
    val session: StateFlow<Session> = _session.asStateFlow()

    init {
        auth.addAuthStateListener { a ->
            val user = a.currentUser
            if (user == null) {
                _session.value = Session(loaded = true)
            } else {
                // Show the signed-in state immediately; the role arrives with the users doc.
                _session.value = Session(user.uid, user.email, user.displayName, loaded = false)
                scope.launch {
                    val role = try {
                        firestore.collection("users").document(user.uid).get().await().getString("role")
                    } catch (_: Exception) { null }
                    if (auth.currentUser?.uid == user.uid) {
                        _session.value = Session(user.uid, user.email, user.displayName, role, role == "admin", loaded = true)
                    }
                }
            }
        }
    }
}

/** Lets the player observe sign-in without a constructor cycle (set once by AppContainer). */
object SessionRepositoryHolder {
    var flow: kotlinx.coroutines.flow.StateFlow<Session>? = null
}
