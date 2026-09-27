package com.palousefellowship.audio

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build

class PfaApplication : Application() {
    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(this)
        createNotificationChannel()
    }

    // Android 8+ requires a channel before a Firebase Messaging
    // notification can be shown. Media3's own playback notification
    // creates and manages its own separate channel automatically — this
    // one is only for FCM (see the matching
    // com.google.firebase.messaging.default_notification_channel_id
    // meta-data in AndroidManifest.xml, which points FCM at it).
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(
            GENERAL_CHANNEL_ID,
            getString(R.string.notification_channel_general_name),
            NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
            description = getString(R.string.notification_channel_general_desc)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val GENERAL_CHANNEL_ID = "general"
    }
}
