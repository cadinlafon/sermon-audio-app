import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa' // 🔥 THIS WAS MISSING

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',

      workbox: {
        navigateFallback: '/index.html',

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