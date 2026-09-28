import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.kotlin.compose)
    alias(libs.plugins.google.services)
    alias(libs.plugins.ksp)
}

// Release signing: read from keystore.properties (gitignored, never
// committed — see keystore.properties.example and README.md "Signing").
// When it's missing (fresh checkout, CI without secrets), the release
// build falls back to no signing config so `assembleRelease` still works
// for local testing; that APK just can't be installed as an update to a
// signed build or uploaded to a store until it's properly signed.
val keystorePropertiesFile = rootProject.file("keystore.properties")
val keystoreProperties = Properties().apply {
    if (keystorePropertiesFile.exists()) {
        keystorePropertiesFile.inputStream().use { load(it) }
    }
}
val hasReleaseSigning = keystorePropertiesFile.exists()

// Supabase project config (same project the web app's src/supabase.js
// points at) — read from a gitignored supabase.properties so no key ever
// sits in source control, even though the anon key is a public,
// RLS-scoped value by design (same trust level as google-services.json's
// api_key, never the secret service-role key). Copy
// supabase.properties.example to supabase.properties and fill in the
// real values — see README.md "Firebase & Supabase setup".
val supabasePropertiesFile = rootProject.file("supabase.properties")
val supabaseProperties = Properties().apply {
    if (supabasePropertiesFile.exists()) {
        supabasePropertiesFile.inputStream().use { load(it) }
    }
}
val supabaseUrl = supabaseProperties.getProperty("SUPABASE_URL", "")
val supabaseAnonKey = supabaseProperties.getProperty("SUPABASE_ANON_KEY", "")

android {
    namespace = "com.palousefellowship.audio"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.palousefellowship.audio"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        vectorDrawables { useSupportLibrary = true }

        buildConfigField("String", "SUPABASE_URL", "\"$supabaseUrl\"")
        buildConfigField("String", "SUPABASE_ANON_KEY", "\"$supabaseAnonKey\"")
    }

    signingConfigs {
        if (hasReleaseSigning) {
            create("release") {
                storeFile = rootProject.file(keystoreProperties.getProperty("storeFile"))
                storePassword = keystoreProperties.getProperty("storePassword")
                keyAlias = keystoreProperties.getProperty("keyAlias")
                keyPassword = keystoreProperties.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        debug {
            // No applicationIdSuffix: the Firebase Android app is
            // registered as exactly com.palousefellowship.audio (see
            // app/google-services.json), and a ".debug" suffix here would
            // make debug builds ship under com.palousefellowship.audio.debug
            // — a package google-services doesn't have a client for
            // (":app:processDebugGoogleServices" would fail with "No
            // matching client found"). Debug and release intentionally
            // share one applicationId; if you ever want them installable
            // side by side, register a second Firebase Android app for
            // the suffixed id instead of re-adding the suffix here.
            isDebuggable = true
        }
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (hasReleaseSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.lifecycle.runtime.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.ktx)
    implementation(libs.androidx.lifecycle.viewmodel.compose)
    implementation(libs.androidx.lifecycle.runtime.compose)
    implementation(libs.androidx.activity.compose)
    implementation(libs.androidx.navigation.compose)
    implementation(libs.androidx.core.splashscreen)

    implementation(platform(libs.androidx.compose.bom))
    implementation(libs.androidx.compose.ui)
    implementation(libs.androidx.compose.ui.graphics)
    implementation(libs.androidx.compose.ui.tooling.preview)
    debugImplementation(libs.androidx.compose.ui.tooling)
    implementation(libs.androidx.compose.material3)
    implementation(libs.androidx.compose.material.icons.extended)

    implementation(libs.androidx.media3.exoplayer)
    implementation(libs.androidx.media3.session)
    implementation(libs.androidx.media3.common)

    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    implementation(platform(libs.firebase.bom))
    implementation(libs.firebase.auth.ktx)
    implementation(libs.firebase.firestore.ktx)
    implementation(libs.firebase.messaging.ktx)
    implementation(libs.play.services.auth)

    implementation(libs.retrofit.core)
    implementation(libs.retrofit.converter.gson)
    implementation(libs.okhttp.core)
    implementation(libs.okhttp.logging.interceptor)

    implementation(libs.coil.compose)

    implementation(libs.kotlinx.coroutines.android)
    implementation(libs.kotlinx.coroutines.play.services)
}
