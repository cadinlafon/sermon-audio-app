package com.palousefellowship.audio.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase

@Database(entities = [AudioEntity::class, DownloadEntity::class], version = 2, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun audioDao(): AudioDao
    abstract fun downloadDao(): DownloadDao

    companion object {
        @Volatile private var instance: AppDatabase? = null

        fun get(context: Context): AppDatabase =
            instance ?: synchronized(this) {
                instance ?: Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "pfa_cache.db",
                )
                    // No real user data is unrecoverable here — both tables
                    // are pure caches (last-known audio lists, offline
                    // downloads) that repopulate from Firestore/re-download,
                    // so a schema bump just clears and starts fresh instead
                    // of needing a hand-written migration.
                    .fallbackToDestructiveMigration()
                    .build().also { instance = it }
            }
    }
}
