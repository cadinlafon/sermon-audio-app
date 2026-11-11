package com.palousefellowship.audio

import android.content.Context
import com.palousefellowship.audio.data.config.RemoteConfigRepository
import com.palousefellowship.audio.data.config.SessionRepository
import com.palousefellowship.audio.data.prefs.ThemePrefs
import com.palousefellowship.audio.data.repository.AudioRepository
import com.palousefellowship.audio.data.repository.AuthRepository
import com.palousefellowship.audio.data.repository.DoctrineRepository
import com.palousefellowship.audio.data.repository.EventLogger
import com.palousefellowship.audio.data.repository.GoalDataRepository
import com.palousefellowship.audio.data.repository.DownloadRepository
import com.palousefellowship.audio.data.repository.ListenProgressRepository
import com.palousefellowship.audio.data.repository.NotesRepository
import com.palousefellowship.audio.data.repository.NoticeRepository
import com.palousefellowship.audio.data.repository.PageNoticeRepository
import com.palousefellowship.audio.data.repository.PlaylistRepository
import com.palousefellowship.audio.data.repository.PushRepository
import com.palousefellowship.audio.data.repository.ReportsRepository
import com.palousefellowship.audio.data.repository.ResourceRepository
import com.palousefellowship.audio.data.repository.SavedRepository
import com.palousefellowship.audio.data.repository.StatsRepository
import com.palousefellowship.audio.data.repository.SuggestionRepository
import com.palousefellowship.audio.player.ListenTracker
import com.palousefellowship.audio.player.PlayerRepository
import com.palousefellowship.audio.data.prefs.PlayerSettingsStore
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
    val themePrefs = ThemePrefs(context)
    val remoteConfig = RemoteConfigRepository(scope = appScope)
    val sessionRepository = SessionRepository(appScope)
    val reportsRepository = ReportsRepository()
    val eventLogger = EventLogger(context, appScope)
    val goalDataRepository by lazy { GoalDataRepository(audioRepository = audioRepository) }
    val pageNoticeRepository = PageNoticeRepository(context)
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
    val playerSettings = PlayerSettingsStore(context)
    val listenTracker = ListenTracker()
    val playerRepository = run {
        com.palousefellowship.audio.data.config.SessionRepositoryHolder.flow = sessionRepository.session
        PlayerRepository(
            context.applicationContext,
            audioRepository,
            downloadRepository,
            listenProgressRepository,
            listenTracker,
            playerSettings,
            remoteConfig,
            appScope,
        )
    }
}
