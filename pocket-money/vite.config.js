import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Pocket Money',
        short_name: 'Pocket Money',
        description: "Chores turn into real, saved-up pocket money.",
        theme_color: '#5b2fa8',
        background_color: '#f5f6fa',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Hashed assets are precached, but the HTML itself is deliberately
        // NOT: Netlify rewrites it at the edge (headers, injected scripts),
        // so pinning it in the precache would freeze those changes on
        // devices until the next build. Navigations go network-first and
        // only fall back to the cached page when offline. Supabase API
        // calls are never cached.
        globPatterns: ['**/*.{js,css,svg,png}'],
        globIgnores: ['push-sw.js'],
        importScripts: ['push-sw.js'],
        navigateFallback: null,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: { cacheName: 'pages', networkTimeoutSeconds: 4 },
          },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.js'],
  },
})
