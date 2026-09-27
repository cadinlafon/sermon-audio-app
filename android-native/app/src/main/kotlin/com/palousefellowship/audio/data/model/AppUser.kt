package com.palousefellowship.audio.data.model

/** Mirrors the fields on `users/{uid}` this app actually reads/writes.
 * The web app's doc has many more admin-only fields (permissions, disabled
 * flags, referral tracking, etc.) that are irrelevant to a listener client. */
data class AppUser(
    val uid: String = "",
    val fullName: String = "",
    val email: String = "",
    val role: String = "user",
    val disabled: Boolean = false,
    val disabledReason: String? = null,
)
