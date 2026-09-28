package com.palousefellowship.audio

import android.content.Context
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.data.repository.AuthRepository
import com.palousefellowship.audio.data.repository.DoctrineRepository
import com.palousefellowship.audio.data.repository.DownloadRepository
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.data.repository.NotesRepository
import com.palousefellowship.audio.data.repository.NoticeRepository
import com.palousefellowship.audio.data.repository.PlaylistRepository
import com.palousefellowship.audio.data.repository.PushRepository
import com.palousefellowship.audio.data.repository.ResourceRepository
import com.palousefellowship.audio.data.repository.SavedRepository
import com.palousefellowship.audio.data.repository.StatsRepository
import com.palousefellowship.audio.data.repository.SuggestionRepository
import com.palousefellowship.audio.player.PlayerRepository
import com.palousefellowship.audio.util.NetworkConnectivityObserver
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob

/**
 * Deliberately simple, hand-written dependency container instead of a DI
 * framework (Hilt/Koin) — this app is small enough that a framework would
 * add build-time risk (extra codegen, extra failure surface to debug)
 * without a real benefit. Everything here is a plain singleton created
 * once in [PfaApplication.onCreate].
 */
class AppContainer(context: Context) {
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate)

    val authRepository = AuthRepository()
    val audioRepository = AudioRepository(context)
    val noticeRepository = NoticeRepository()
    val doctrineRepository = DoctrineRepository()
    val resourceRepository = ResourceRepository()
    val pushRepository = PushRepository()
    val connectivityObserver = NetworkConnectivityObserver(context)
    val listenProgressRepository = ListenProgressRepository()
    val downloadRepository = DownloadRepository(context, audioRepository)
    val savedRepository = SavedRepository()
    val playlistRepository = PlaylistRepository()
    val notesRepository = NotesRepository()
    val suggestionRepository = SuggestionRepository()
    val statsRepository = StatsRepository()
    val playerRepository = PlayerRepository(
        context.applicationContext,
        audioRepository,
        downloadRepository,
        listenProgressRepository,
        appScope,
    )
}
