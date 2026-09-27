package com.palousefellowship.audio.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

@Dao
interface AudioDao {
    @Query("SELECT * FROM cached_audio WHERE type = :type ORDER BY `order` ASC")
    suspend fun getByType(type: String): List<AudioEntity>

    @Query("SELECT * FROM cached_audio WHERE type IN (:types) ORDER BY `order` ASC")
    suspend fun getByTypes(types: List<String>): List<AudioEntity>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertAll(items: List<AudioEntity>)

    @Query("DELETE FROM cached_audio WHERE type = :type")
    suspend fun clearType(type: String)

    @Query("DELETE FROM cached_audio WHERE type IN (:types)")
    suspend fun clearTypes(types: List<String>)

    /** Replaces every cached row for the given type(s) with a fresh set,
     * in one transaction, so a reader never sees a half-updated cache. */
    @Transaction
    suspend fun replace(types: List<String>, items: List<AudioEntity>) {
        clearTypes(types)
        insertAll(items)
    }
}
