package com.palousefellowship.audio.data.remote

import com.palousefellowship.audio.BuildConfig
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

/** Builds the Retrofit client used only for the audio-download-url call.
 * Everything else (Firestore, Auth, Messaging) goes through the Firebase
 * SDK directly and doesn't need Retrofit. */
object NetworkModule {

    // Every request to the Supabase gateway needs this, the same way the
    // web app's supabase-js client attaches it automatically.
    private val apiKeyInterceptor = Interceptor { chain ->
        val request = chain.request().newBuilder()
            .addHeader("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .addHeader("Content-Type", "application/json")
            .build()
        chain.proceed(request)
    }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .addInterceptor(apiKeyInterceptor)
            .apply {
                if (BuildConfig.DEBUG) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BASIC })
                }
            }
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    val audioUrlApi: AudioUrlApi by lazy {
        Retrofit.Builder()
            .baseUrl("${BuildConfig.SUPABASE_URL}/")
            .client(client)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(AudioUrlApi::class.java)
    }
}
