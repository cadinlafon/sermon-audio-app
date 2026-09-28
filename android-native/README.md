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

**Primary tabs:** Home (notices + latest sermon), Doctrine (weekly topic
slider, full-year schedule, questions, audio, docs, memorization, notes),
Sermons (merged sermon + homily list, search/sort/type-filter — see
"Where this differs from the web app"), Sunday School, and a More tab.

**More tab:** Search (audio + resources), Resources, Spotify, Your Listens
(listen history/resume), Liked Sermons, Playlists (create/reorder/play),
Notes (per-recording notes), Bookmarks (timestamped moments), Downloads
(real offline audio, not just metadata), Stats, Suggest a Feature,
Settings & About (full account management — display name, email, password,
delete account, notifications, privacy link), About This App, Contact.

**Also:** a full Player screen (like/bookmark/add-to-playlist/download
actions, scrubbable seek bar, previous/next), Login, and Sign Up.

See **"Where this intentionally differs from the web app"** below for the
handful of places this deliberately doesn't mirror the web app 1:1 (and
why), and **"Not yet implemented"** for what's still out of scope.

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
2. Package name: `com.palousefellowship.audio` (must match exactly — the
   debug build type deliberately has no `applicationIdSuffix`, so debug
   and release both build as this exact id; do not add one back without
   also registering a second Firebase Android app for it).
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
Storage — playback (and offline downloads) fetch a short-lived signed URL
from the same Supabase Edge Function the web app calls
(`audio-download-url`), which needs the Supabase project URL and anon
(public) key.

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

Without this file, the app builds, runs, and loads all Firestore-backed
screens correctly, but every "play"/"download" tap shows a friendly
audio-loading error (verified — see "Testing performed" below).

### 3. Firestore rules

The backend has **no deployed `firestore.rules`** — access control is
enforced client-side today (same as the web app; see `../firestore.rules.*`
for the documented-but-manually-applied reference rules). This native
client reads/writes exactly the collections the web app already
reads/writes (`audio`, `notices`, `doctrineWeeks`, `resources`, `users`,
`saved`, `notes`, `listenProgress`, `suggestions`, `userStats`), so it
needs no new rules beyond whatever you already have for the web app.

## Data sources (what talks to what)

| Feature | Backend |
|---|---|
| Sermons / Sunday School lists | Firestore `audio` collection, same fields as `../src/pages/Admin/UploadAudio.jsx` writes |
| Playback URL | `POST {SUPABASE_URL}/functions/v1/audio-download-url` — same Edge Function as `../supabase/functions/audio-download-url`, exchanges `audioStorageKey` for a 4-hour signed Backblaze B2 URL |
| Home notices | Firestore `notices` collection |
| Doctrine campaign + Weekly Topic slider + Schedule | Firestore `doctrineWeeks/current` + `doctrineWeeks/topics`; the full-year Schedule table is static data ported from `../src/data/doctrineSchedule.js` |
| Resources / Spotify | Firestore `resources` collection (Spotify screen = same collection, `type == "spotify"` — see below) |
| Auth + account management | Firebase Auth — email/password + Google sign-in, plus display-name/email/password change and account deletion, mirroring `../src/pages/Settings/Account.jsx` |
| Liked Sermons | Firestore `saved/{uid}_{audioId}` — same shape as `../src/utils/saveSermon.js` |
| Playlists | The `playlists` array field on `users/{uid}` — same shape as `../src/context/PlaylistContext.jsx` (parsed by hand, not via Firestore POJO mapping) |
| Notes / Bookmarks | Firestore `notes/{uid}_{audioId}` — same shape as `../src/utils/notes.js` |
| Your Listens (history) | Firestore `listenProgress` — see "Where this differs" below for why, instead of the web's own (currently unpopulated) `listens` query |
| Downloads | Real offline audio: downloads the signed URL's bytes into app-private storage via OkHttp, tracked in Room, capped at 5 per device (same limit the web app enforces) |
| Suggest a Feature | Firestore `suggestions` collection — same shape as `../src/pages/SuggestFeature.jsx`, including voting |
| Stats | Firestore `userStats/{uid}` — same shape as `../src/pages/Stats.jsx` |
| Push notifications | Firebase Cloud Messaging — writes the device token to `users/{uid}.fcmToken`, the same field the existing `sendPushNotification` Cloud Function already reads |
| Images (Doctrine header, resource thumbnails) | Already-public URLs from a different Edge Function (`public-image`) — loaded directly with Coil, no extra network round-trip |

## Where this intentionally differs from the web app

Findings from actually auditing the web app's code (not assumptions),
each a case where reproducing the web app's exact current behavior would
either not be a real feature or would be strictly worse than the
alternative:

- **Notices** has no dedicated screen — same as the web app, they're shown
  inline on Home.
- **Spotify** has no dedicated backend collection on either platform —
  it's the Resources screen filtered to `type == "spotify"`, matching the
  real data model (`../src/lib/resourceTypes.js`) instead of inventing a
  separate one. Tapping a card opens the Spotify app directly via a
  `spotify:` URI when it's installed, and falls back to the web link.
- **Sermons + Homilies are one screen**, not two — the web app's own
  `/homilies` page (`src/pages/Homilys.jsx`) exists as a file but **is not
  registered as a route in `App.jsx`**, so it's unreachable on the live
  web app today; the actual reachable Sermons page already queries
  `type in [sermon, homily]` with a type filter. This app matches that
  real, reachable behavior: one Sermons screen with All/Sermons/Homilies
  filter chips, search, and sort — verified working against production
  data.
- **Your Listens uses `listenProgress`, not `listens`** — the web app's
  `YourListens.jsx` queries a `listens` collection that, per an audit of
  every write path in the codebase, **nothing writes to** (the actual
  listen-tracking code writes to `appUsage` instead). The web page is
  effectively non-functional today. Rather than reproduce that dead page,
  this app powers "Your Listens" from `listenProgress` (real, already
  populated, already used for resume-position elsewhere in the web app)
  to actually deliver the feature.
- **Contact** doesn't embed the web page's Cloudflare Turnstile challenge
  (a browser widget with no native SDK here) — it explains why and opens
  the real Contact page in the system browser for the actual reveal,
  rather than adding a WebView just for one CAPTCHA.
- **About** is reproduced as-is: the web app's `/about` route is currently
  a literal "Coming Soon" placeholder, not a simplification on this side.

## How playback works (Media3)

`player/PlaybackService.kt` is a `MediaSessionService` that owns a single
ExoPlayer instance independent of any Activity — this is what gives you
background playback, lock-screen controls, the system media notification,
and Bluetooth/headset button handling, all without hand-written
broadcast-receiver code (Media3's session module does this automatically
once a `MediaSession` is attached to the player).

`player/PlayerRepository.kt` is an app-wide singleton (owned by
`AppContainer`) that both the mini player and the full Player screen read
from, so they always agree. Tapping "play" checks for a downloaded local
copy first (offline-first — see Downloads), otherwise resolves a signed
URL via the Retrofit call above, then hands ExoPlayer a `MediaItem` with
title/artist/category/date metadata for the lock screen and notification.
While playing, listen progress is saved to Firestore periodically and on
pause, powering both resume and "Your Listens".

Covered: play/pause, seek/scrub, position/duration, loading state, error
state with retry (friendly messages only — network/HTTP exceptions are
translated, never shown raw), background playback, lock-screen +
notification controls, Bluetooth/headset buttons, audio focus
(ducking/pausing for calls and other apps), previous/next within whatever
list or playlist you played from, jump-to-timestamp (from a bookmark),
and proper `MediaSession`/`ExoPlayer` lifecycle teardown.

## Offline / caching

Two distinct layers, per the brief's "don't bulk-download the library"
guidance:

- **List metadata cache** (Room, `data/local/AppDatabase.kt`): after every
  successful load, the Sermons and Sunday School lists are cached; if a
  later load fails (offline, Firebase unreachable), the last successful
  list is shown with a "You're offline" banner instead of a blank screen.
  A separate app-wide offline banner (via `ConnectivityManager`) also
  shows across every screen when the device has no network at all —
  verified working on-device (toggling connectivity mid-session showed
  and cleared the banner correctly).
- **Real offline audio** (Downloads, `data/repository/DownloadRepository.kt`):
  a listener explicitly downloads a recording's actual audio bytes to
  app-private storage; the player checks for and prefers a local download
  before ever requesting a fresh signed URL, so a downloaded recording
  plays with no connection at all. Capped at 5 per device.

## Error handling

Every screen's ViewModel exposes one `UiState<T>` (`Loading` /
`Success(data, fromCache)` / `Error(message)`) and every screen renders
all three, plus an explicit empty state distinct from an error. No screen
can end up blank on a failure. The player screen has its own dedicated
loading/error/retry state, and every network failure it can hit
(no connection, timeout, bad HTTP response, malformed URL) is mapped to a
plain-language message — this was a real bug caught during on-device
testing (a raw `HttpUrl` parsing exception was originally shown verbatim)
and fixed; see "Testing performed."

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
WebView/TWA wrapper — meant to satisfy stores (e.g. Uptodown, Samsung
Galaxy Store, Amazon Appstore) that reject simple website wrappers. It
does not attempt to disguise a webview as native; there isn't one
anywhere in this project (verified with `grep -ri webview` across the
whole module — zero matches, aside from this sentence).

## Not yet implemented

Real features, deliberately out of scope for this pass, each independently
addable later without a redesign (same Firestore collections the web app
already uses):

- **Listening goals, Year in Review, Transcripts, driving mode, and
  Chromecast/TV mode** — the most complex remaining web features. Goals
  and Year in Review need new aggregation + a shareable-image canvas;
  Transcripts need an AI-generation trigger and a synced viewer; Chromecast
  is architecturally a different, larger effort on Android (the Google
  Cast SDK + a receiver, not a port of the web's sender-API code) and is
  arguably better done as a first-class Android feature later than rushed
  here.
- **Timestamped note entries** (adding a new categorized note *while*
  listening, beyond the one general text note per recording) and **notes
  markdown/checklist rendering** — the underlying data model (`entries[]`)
  is read and displayed, just not yet authored from this app.
- **Playlist drag-reorder** — up/down buttons instead of drag-and-drop
  (same end result, less gesture-handling code).
- Sign-up's daily registration-count cap (the web app enforces one; this
  app only checks the on/off `registrationEnabled` flag).
- Metadata caching for Notices/Doctrine/Resources/Saved/Playlists (only
  Sermons/Sunday School are Room-cached for offline viewing).
- Custom small icon on the Media3 playback notification (uses Media3's
  own bundled default icon rather than the app's branding).
- Tablet-specific multi-column layouts (screens are responsive/scrollable
  and work fine on a tablet, but don't yet use the extra width for a
  two-pane layout).
- The full admin panel (upload, content manager, users, analytics,
  notices editor, page manager, etc.) — this app is the listener-facing
  client only, matching the original brief's screen list.

## Testing performed

This was built and verified against a real Android SDK, Gradle 8.9, and a
running emulator (`sdk_gphone16k_arm64`, API 35) in this environment —
not just written and assumed to compile. Concretely:

- `./gradlew assembleDebug` and `assembleRelease` both succeed.
- The debug APK was installed and launched on-device; the app connects to
  the **real production Firestore** (no test/demo data) and rendered real
  content throughout: Home's latest-sermon card, the full Sermons list
  with working search/sort/type-filter chips (verified narrowing "Genesis"
  to 2 matching real recordings, and the Homilies chip correctly showing
  a real, honest empty state), Sunday School, the full Doctrine page
  (Weekly Topic slider on the real current week, the ported full-year
  Schedule table, Questions, Docs), the More menu and every page it links
  to (Playlists, Suggest a Feature — both showing correct signed-out/empty
  states with live Firestore reads), and Settings (signed-out Account
  state, Sign In screen).
- No crashes were observed in `logcat` across this session; one real bug
  *was* found and fixed this way — a raw OkHttp/Retrofit exception message
  leaking into the Player screen's error text instead of a friendly one
  (missing local Supabase config surfaced it) — now shows "This recording
  couldn't be played. Tap to retry." like every other failure mode.
- **Not exercised in this pass** (needs either real user credentials
  against production or a longer interactive session than was practical
  here): completing an actual sign-in/sign-up, a full playback session
  end-to-end (this dev environment has no local `supabase.properties`
  configured — the error-state path is what was verified instead),
  lock-screen/notification controls during real playback, a download
  actually completing, and CRUD round-trips on Notes/Bookmarks/Playlists.
  These are the same code paths already exercised for reads and for the
  identical pattern used elsewhere (e.g. Saved's toggle, which shares its
  Firestore write pattern with these), so they're low-risk, but they
  haven't been watched happen.
