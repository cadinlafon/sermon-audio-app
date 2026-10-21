import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // 🔥 THIS WAS MISSING

// Version shown on the Dev Info page: the build's date + time (and the
// git commit it was built from). Because it's baked into the bundle, every
// deploy gets a new one — and the same bundle change is what makes the
// service worker update, so "New version available" and a new Version
// always arrive together.
function buildVersion() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  const stamp = `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}.${p(d.getHours())}${p(d.getMinutes())}`
  let commit = ''
  try {
    commit = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    // not a git checkout — the timestamp alone is still unique
  }
  return commit ? `${stamp} (${commit})` : stamp
}

const APP_VERSION = buildVersion()

// How a deploy reaches people already using the app (src/utils/appUpdate.js):
//   "auto"   (default) small updates: the app refreshes itself as soon as it
//            is safe — nothing playing, nobody typing, not in the admin area.
//            If it isn't safe it falls back to the "New version available" bar.
//   "prompt" big updates: always show the "New version available" bar and wait
//            for the Refresh button.
// Pick per deploy:  PF_UPDATE_MODE=prompt npm run build
// It's written to dist/version.json, which running apps fetch when a new
// version is detected — so the NEW deploy decides how it is delivered.
const UPDATE_MODE = process.env.PF_UPDATE_MODE === 'prompt' ? 'prompt' : 'auto'

function emitVersionFile() {
  return {
    name: 'pf-emit-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify({ version: APP_VERSION, mode: UPDATE_MODE }),
      })
    },
  }
}

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(APP_VERSION),
  },
  plugins: [
    emitVersionFile(),
    react(),
    VitePWA({
      // 'prompt': a new service worker installs in the background and
      // WAITS — the page is told (onNeedRefresh -> src/utils/appUpdate.js)
      // and shows a "New version available — Refresh" prompt. With the
      // old 'autoUpdate' the new worker took over immediately and the
      // page was force-reloaded with no warning, which would cut off
      // whatever someone was listening to.
      registerType: 'prompt',

      workbox: {
        // Pages stay controlled from first install (offline-ready
        // without a second visit); updates still wait for the prompt.
        clientsClaim: true,

        // The main bundle has grown past workbox's 2 MiB default precache
        // limit (Media3-adjacent web features: QR codes, Cast, etc.) —
        // raise the cap rather than leaving the service worker un-buildable.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [
          /\/[^/?]+\.[^/]+$/,
        ],

        // 🔥 DON'T CACHE SITEMAP
        globIgnores: ['**/sitemap*.xml'],

        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith('.xml'),
            handler: 'NetworkOnly',
          },
        ],
      },

      manifest: {
        name: 'Sermon Audio App',
        short_name: 'Sermons',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#111111',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
  ],
})
