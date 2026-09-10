# `summarize-audio` Edge Function

This Edge Function accepts a Firebase Authentication ID token, verifies it against
the Firebase project's public signing keys, and only accepts public audio URLs from
this app's Supabase `audio` bucket or Firebase Storage bucket. It sends the trusted
URL to Groq's transcription endpoint and then summarizes the transcript.

## Deploy

From the repository root, authenticate and connect the local Supabase setup to the
existing project:

```sh
npx supabase login
npx supabase link --project-ref vnseaznxwtupupglrxos
```

Set the required Edge Function secrets. Replace the placeholder only in your local
terminal; do not put the real key in any source file or `.env` file.

```sh
npx supabase secrets set GROQ_API_KEY="PASTE_YOUR_GROQ_KEY_HERE"
npx supabase secrets set FIREBASE_PROJECT_ID="palousefellowshipsermonapp"
npx supabase secrets set FIREBASE_STORAGE_BUCKET="palousefellowshipsermonapp.firebasestorage.app"
```

Deploy it:

```sh
npx supabase functions deploy summarize-audio
```

`SUPABASE_URL` is supplied automatically inside deployed Supabase Edge Functions;
do not add it as a secret. The browser already has the public `VITE_SUPABASE_URL`
and anon key needed to call the function.

## Firestore cache field

The Edge Function writes a generated string to `audio/{audioId}.aiSummary` through
the caller's Firebase session. Existing records need no migration: the field is
added on the first successful summary. Make sure your Firestore rules allow a
signed-in user to read `audio` documents and update only `aiSummary` on that
collection (or use an equivalent trusted-write policy). The function checks that
the requested URL and type exactly match that Firestore document before invoking
Groq.
