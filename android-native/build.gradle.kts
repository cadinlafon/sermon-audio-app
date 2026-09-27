// Top-level build file. Real work happens in app/build.gradle.kts — this
// just declares which plugin versions are available to sub-modules
// without applying them here (`apply false`).
plugins {
    alias(libs.plugins.android.application) apply false
    alias(libs.plugins.kotlin.android) apply false
    alias(libs.plugins.kotlin.compose) apply false
    alias(libs.plugins.google.services) apply false
    alias(libs.plugins.ksp) apply false
}
