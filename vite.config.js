import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // 🔥 THIS WAS MISSING

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      workbox: {
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
