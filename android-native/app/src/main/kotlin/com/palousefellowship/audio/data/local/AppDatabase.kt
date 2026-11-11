package com.palousefellowship.audio.data.local

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(entities = [AudioEntity::class, DownloadEntity::class], version = 3, exportSchema = false)
abstract class AppDatabase : RoomDatabase() {
    abstract fun audioDao(): AudioDao
    abstract fun downloadDao(): DownloadDao

    companion object {
        // 2 → 3: cached audio gains date / series / aiSummary (used by the
        // Audio Page Manager's search, grouping and featured series). A real
        // migration so a user's offline-download records survive the update.
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE cached_audio ADD COLUMN date TEXT")
                db.execSQL("ALTER TABLE cached_audio ADD COLUMN series TEXT")
                db.execSQL("ALTER TABLE cached_audio ADD COLUMN aiSummary TEXT")
            }
        }

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
                    .addMigrations(MIGRATION_2_3)
                    .fallbackToDestructiveMigration()
                    .build().also { instance = it }
            }
    }
}
