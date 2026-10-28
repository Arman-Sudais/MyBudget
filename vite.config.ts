import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { resolve } from 'node:path'

export default defineConfig(({ mode }) => ({
  ...(mode === 'emulator'
    ? {
        build: {
          rolldownOptions: {
            preserveEntrySignatures: 'strict',
            input: {
              app: resolve('index.html'),
              'test-auth': resolve('tests/cloud/auth-helper.ts'),
            },
            output: {
              entryFileNames: (chunk) =>
                chunk.name === 'test-auth' ? 'test-auth.js' : 'assets/[name]-[hash].js',
            },
          },
        },
      }
    : {}),
  // Keep the forwarded preview port stable; Vite must not silently switch ports.
  server: { host: '0.0.0.0', port: 5173, strictPort: true },
  preview: { host: '0.0.0.0', port: 4173, strictPort: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'icons/*.png'],
      manifest: {
        id: '/',
        name: 'MyBudget — Personal Budgeting',
        short_name: 'MyBudget',
        description: 'Rencanakan uangmu, nikmati hidupmu.',
        lang: 'id',
        theme_color: '#154c43',
        background_color: '#f6f8f7',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          {
            src: '/icons/maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        clientsClaim: true,
        cleanupOutdatedCaches: true,
      },
    }),
  ],
}))
