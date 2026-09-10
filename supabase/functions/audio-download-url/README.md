# Private Backblaze audio delivery

This function creates a four-hour, download-only B2 URL for one Firestore
`audio` document. It requires a Firebase session and only works when the audio
document has an `audioStorageKey`, for example:

```json
{ "audioStorageKey": "audio/2026/my-sermon.mp3" }
```

## Supabase secrets

Set these in the Supabase project, never in browser-visible `VITE_` variables:

```sh
npx supabase secrets set FIREBASE_PROJECT_ID="palousefellowshipsermonapp"
npx supabase secrets set BACKBLAZE_KEY_ID="..."
npx supabase secrets set BACKBLAZE_APPLICATION_KEY="..."
npx supabase secrets set BACKBLAZE_BUCKET_ID="12677a202dc12c09ad07021e"
npx supabase secrets set BACKBLAZE_BUCKET_NAME="audio-pf"
npx supabase functions deploy audio-download-url
npx supabase functions deploy summarize-audio
```

The B2 key must be restricted to bucket `audio-pf` and have `listFiles`,
`readFiles`, and `shareFiles`. Keep a separate write-capable key for admin
uploads; do not put either key in frontend code.

The admin upload/delete function needs a second restricted key:

```sh
npx supabase secrets set BACKBLAZE_ADMIN_KEY_ID="..."
npx supabase secrets set BACKBLAZE_ADMIN_APPLICATION_KEY="..."
npx supabase functions deploy audio-admin
```

Give that key access only to `audio-pf` with `listFiles`, `writeFiles`, and
`deleteFiles`. The function independently checks that the caller is a Firebase
user whose Firestore role is `admin`.

## B2 CORS

Allow `GET` and `HEAD` from the production site plus `http://localhost:5173`.
Allow the `Range` request header and expose `Accept-Ranges`, `Content-Length`,
`Content-Range`, and `Content-Type` so browser audio seeking works. For admin
browser uploads also allow `b2_upload_file` and the headers `authorization`,
`x-bz-file-name`, and `x-bz-content-sha1`.
