package com.palousefellowship.audio.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface DownloadDao {
    @Query("SELECT * FROM downloads ORDER BY downloadedAtMillis DESC")
    fun observeAll(): Flow<List<DownloadEntity>>

    @Query("SELECT * FROM downloads ORDER BY downloadedAtMillis DESC")
    suspend fun getAll(): List<DownloadEntity>

    @Query("SELECT * FROM downloads WHERE audioId = :audioId LIMIT 1")
    suspend fun get(audioId: String): DownloadEntity?

    @Query("SELECT COUNT(*) FROM downloads")
    suspend fun count(): Int

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(entity: DownloadEntity)

    @Query("DELETE FROM downloads WHERE audioId = :audioId")
    suspend fun delete(audioId: String)
}
