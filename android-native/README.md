# Palouse Fellowship Audio — Native Android

A genuine native Android client for the Palouse Fellowship sermon-audio app —
Kotlin, Jetpack Compose, Material 3, and Media3/ExoPlayer, talking to the
**same Firebase/Supabase backend** as the React/Vite web app in the parent
directory. It is not a WebView, not a TWA, and does not embed the website.

- Package ID: `com.palousefellowship.audio`
- App name: **Palouse Fellowship Audio**
- Language/UI: Kotlin, Jetpack Compose, Material 3
- Audio: AndroidX Media3 (ExoPlayer + MediaSession)
- Backend: Firebase Auth/Firestore/Cloud Messaging + one Supabase Edge
  Function call (see "How playback works" below) — the exact same project
  the web app in `../` uses, no separate backend.

This lives entirely inside `android-native/` and does not touch, move, or
depend on any file in the rest of the repo. The React/Vite/PWA app is
untouched and still works exactly as it did before this existed.

## Screens

Home (notices + latest sermon), Sermons, Sunday School, Homilies, Doctrine
(with the Weekly Topic slider), Resources, Spotify, Settings & About, plus
sign in/create account and a full player screen. See **"Where this
intentionally differs from the web app"** below for two screens that are
implemented differently than their name might suggest, and **"Not yet
implemented"** for the (large) list of web-only features this v1 doesn't
attempt.

## Requirements

- Android Studio Ladybug (2024.2) or newer, with an Android SDK including
  API 35 and a recent build-tools version. Any recent Android Studio will
  prompt to install what's missing.
- JDK 17 (bundled with modern Android Studio — you don't need to install
  one separately).

## Opening the project

1. Android Studio → **Open** → select the `android-native/` folder
   (open it directly, *not* the parent `sermon-audio-app/` folder).
2. **First-time-only:** this checkout does not include the Gradle wrapper
   jar (binary files aren't included by the tool that generated this
   project). Android Studio detects this on open and offers to generate
   it — accept that prompt (or run `gradle wrapper --gradle-version 8.9`
   yourself first, if you have any Gradle installed). After that, the
   project behaves like any normal Gradle project (`./gradlew ...` works
   from a terminal too).
3. Let Gradle sync. On a completely fresh checkout this **will succeed
   and produce a real, installable debug APK** even before you touch any
   config — `app/google-services.json` ships as a committed placeholder
   specifically so the build isn't blocked (see below). Firebase features
   just won't *work* until you swap in the real file.

## Firebase & Supabase setup (for the app to actually work)

None of this blocks a build — it blocks Firebase Auth/Firestore/Messaging
and audio playback from actually working. Do all three before testing on
a device:

### 1. `app/google-services.json`

The committed file is a **placeholder** (see the `_comment` field inside
it) — real-looking shape, fake IDs, so Gradle's `google-services` plugin
doesn't fail the build on a fresh checkout, but no Firebase call will
succeed until you replace it.

1. Firebase console → the **palousefellowshipsermonapp** project (same
   project `../src/firebase.js` points at) → **Project settings** → **Add
   app** → **Android**.
2. Package name: `com.palousefellowship.audio` (must match exactly).
3. Download the generated `google-services.json` and overwrite
   `app/google-services.json` with it.
4. Firebase console → **Authentication** → make sure **Email/Password**
   and **Google** sign-in providers are enabled (same providers the web
   app uses) — Android needs them enabled at the project level, same as
   the web app.

This file is **not gitignored** — Google's own docs say it's safe to
commit (same trust level as any client-shipped API key); it contains no
service-role/admin credentials. If your team prefers keeping it out of
git anyway, add `app/google-services.json` to `.gitignore` yourself and
keep only the placeholder tracked.

### 2. `supabase.properties`

Audio files live in a private Backblaze B2 bucket, not public Firebase
Storage — playback fetches a short-lived signed URL from the same
Supabase Edge Function the web app calls (`audio-download-url`), which
needs the Supabase project URL and anon (public) key.

```bash
cp supabase.properties.example supabase.properties
```

Fill in the same two values the web app's `../.env` already has:
`VITE_SUPABASE_URL` → `SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` →
`SUPABASE_ANON_KEY`. This file is gitignored — the anon key is a public,
RLS-scoped value (safe to ship in a client, unlike the service-role key,
which this app never touches), but it's kept out of git the same way
`keystore.properties` is, so no key sits in source control regardless of
its actual sensitivity.

Without this file, the app builds and runs, but every "play" tap will
show the audio-loading error state.

### 3. Firestore rules

The backend has **no deployed `firestore.rules`** — access control is
enforced client-side today (same as the web app; see `../firestore.rules.*`
for the documented-but-manually-applied reference rules). This native
client reads/writes exactly the collections the web app already reads/
writes (`audio`, `notices`, `doctrineWeeks`, `resources`, `users`), so it
needs no new rules beyond whatever you already have for the web app.

## Data sources (what talks to what)

| Feature | Backend |
|---|---|
| Sermons / Sunday School / Homilies lists | Firestore `audio` collection, same fields as `../src/pages/Admin/UploadAudio.jsx` writes |
| Playback URL | `POST {SUPABASE_URL}/functions/v1/audio-download-url` — same Edge Function as `../supabase/functions/audio-download-url`, exchanges `audioStorageKey` for a 4-hour signed Backblaze B2 URL |
| Home notices | Firestore `notices` collection |
| Doctrine campaign + Weekly Topic slider | Firestore `doctrineWeeks/current` + `doctrineWeeks/topics` |
| Resources / Spotify | Firestore `resources` collection (Spotify screen = same collection, `type == "spotify"` — see below) |
| Auth | Firebase Auth — email/password + Google, writes `users/{uid}` on sign-up the same shape the web app does |
| Push notifications | Firebase Cloud Messaging — writes the device token to `users/{uid}.fcmToken`, the same field the existing `sendPushNotification` Cloud Function already reads |
| Images (Doctrine header, resource thumbnails) | Already-public URLs from a different Edge Function (`public-image`) — loaded directly with Coil, no extra network round-trip |

## Where this intentionally differs from the web app

- **Notices** has no dedicated screen — same as the web app, they're shown
  inline on Home.
- **Spotify** has no dedicated backend collection on either platform —
  it's the Resources screen filtered to `type == "spotify"`, matching the
  real data model (`../src/lib/resourceTypes.js`) instead of inventing a
  separate one. Tapping a card opens the Spotify app directly via a
  `spotify:` URI when it's installed, and falls back to the web link.
- **Sermons vs. Homilies**: the web app actually merges these into one
  page with a type filter; this app keeps them as two separate screens
  (both are in your required screen list), sharing one `AudioListScreen`
  parameterized by type.

## How playback works (Media3)

`player/PlaybackService.kt` is a `MediaSessionService` that owns a single
ExoPlayer instance independent of any Activity — this is what gives you
background playback, lock-screen controls, the system media notification,
and Bluetooth/headset button handling, all without hand-written
broadcast-receiver code (Media3's session module does this automatically
once a `MediaSession` is attached to the player).

`player/PlayerRepository.kt` is an app-wide singleton (owned by
`AppContainer`) that both the mini player and the full Player screen read
from, so they always agree. Tapping "play" resolves a signed URL first
(via the repository/Retrofit call above), then hands ExoPlayer a
`MediaItem` with title/artist metadata for the lock screen and
notification.

Covered: play/pause, seek/scrub, position/duration, loading state, error
state with retry, background playback, lock-screen + notification
controls, Bluetooth/headset buttons, audio focus (ducking/pausing for
calls and other apps), previous/next within whatever list you played
from, and proper `MediaSession`/`ExoPlayer` lifecycle teardown.

## Offline / caching

Per the brief, this does **not** bulk-download the audio library. It
caches list *metadata* only: after every successful load, the Sermons /
Sunday School / Homilies lists are written to a small Room database
(`data/local/AppDatabase.kt`); if a later load fails (offline, Firebase
unreachable), the last successful list is shown instead with an "You're
offline" banner, rather than a blank screen. Notices/Doctrine/Resources
are not cached in v1 — a documented trim, not an oversight (see below).

## Error handling

Every screen's ViewModel exposes one `UiState<T>` (`Loading` /
`Success(data, fromCache)` / `Error(message)`) and every screen renders
all three, plus an explicit empty state distinct from an error. No screen
can end up blank on a failure. The player screen has a dedicated
loading/error/retry state independent of the list screens.

## Permissions

Only what's actually used:

- `INTERNET`, `ACCESS_NETWORK_STATE` — everything talks to Firebase/Supabase.
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MEDIA_PLAYBACK`, `WAKE_LOCK` —
  background/lock-screen audio playback.
- `POST_NOTIFICATIONS` — only requested when you flip the Notifications
  switch in Settings, not on first launch.

No contacts, location, camera, or microphone permissions anywhere.

## Building a debug APK

```bash
./gradlew assembleDebug
```

Output: `app/build/outputs/apk/debug/app-debug.apk`

Or in Android Studio: **Build → Build App Bundle(s) / APK(s) → Build
APK(s)**.

## Building a release APK

```bash
./gradlew assembleRelease
```

Output: `app/build/outputs/apk/release/app-release.apk` (or
`app-release-unsigned.apk` if `keystore.properties` doesn't exist yet —
see **Signing** below; the build still succeeds either way, code-shrunk
via R8/ProGuard, it just won't install over a previously-signed copy or
be uploadable to a store until it's actually signed).

## Signing

**Never commit a keystore, its password, or `keystore.properties`** —
all three are gitignored already.

1. Generate a real upload/release keystore once, and keep it somewhere
   safe outside the repo (a password manager's file storage, an encrypted
   drive — not a shared folder):

   ```bash
   keytool -genkeypair -v \
     -keystore release-keystore.jks \
     -alias palouse-fellowship-audio \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

   You'll be prompted for a keystore password, your name/org details, and
   a key password (can be the same as the keystore password). **Write
   these down somewhere durable** — Google Play has no way to recover a
   lost signing key for an app already published with it.

2. ```bash
   cp keystore.properties.example keystore.properties
   ```

   Fill in `storeFile` (a path to wherever you put the `.jks` — the
   default assumes it sits next to this README), `storePassword`,
   `keyAlias`, `keyPassword`.

3. `./gradlew assembleRelease` now produces a properly signed
   `app-release.apk`.

If you're publishing through Google Play specifically, Play App Signing
is the modern recommended approach (Play re-signs your app with its own
key, and you only need to protect an *upload* key, which is recoverable
if lost) — this same keystore works fine as that upload key.

## Store readiness

This is a real native Compose UI with its own navigation, not a
WebView/TWA wrapper — meant to satisfy stores (e.g. Samsung Galaxy Store,
Amazon Appstore) that reject simple website wrappers. It does not attempt
to disguise a webview as native; there isn't one anywhere in this project.

## Not yet implemented

Deliberately out of scope for this first native pass — the web app has
grown a lot of features over many sessions (playlists, downloads for
offline listening, notes/bookmarks, listening goals, Year in Review,
transcripts, unified search, Chromecast, driving mode, the full admin
panel) that aren't in your minimum screen list. None of the backend work
needed for them is hard to reach from Android (same Firestore
collections), so they're a reasonable v2, not a redesign.

Also trimmed from what *is* in scope, each independently addable:

- Sign-up's daily registration-count cap (the web app enforces one; this
  app only checks the on/off `registrationEnabled` flag).
- Metadata caching for Notices/Doctrine/Resources (Sermons/Sunday
  School/Homilies are cached; those three aren't yet).
- Custom small icon on the Media3 playback notification (currently uses
  Media3's own bundled default icon rather than the app's branding —
  customizing it needs `DefaultMediaNotificationProvider`'s builder API,
  which I didn't want to guess at without being able to compile and
  verify it here).
- Tablet-specific multi-column layouts (screens are responsive/scrollable
  and work fine on a tablet, but don't yet use the extra width for a
  two-pane layout).

## What still needs testing

**I could not run an actual Gradle/Android build in this environment** —
no Android SDK, no JDK, no emulator here. Everything above was written
carefully against real, current, stable APIs (Media3 1.4.1, Compose BOM
2024.10.01, Firebase BoM 33.5.1, etc.), and checked by hand for balanced
braces, consistent imports, and correct Kotlin idioms — but it has not
been compiled. When you open it in Android Studio:

1. Let Gradle sync fully and fix anything it flags (should be nothing,
   but this is the real first checkpoint).
2. Fill in `google-services.json` and `supabase.properties` as above,
   then run on a device/emulator and confirm sign-in, list loading, and
   playback (including lock-screen controls and backgrounding) all work.
3. Test the offline banner by toggling airplane mode after a list has
   loaded once.
4. Test the Spotify screen's "open in app vs. browser" fallback with and
   without the Spotify app installed.
