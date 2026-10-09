import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this repo at https://<user>.github.io/congressionalappchallenge/, so every asset URL,
// the manifest scope, and the service worker scope must live under /congressionalappchallenge/.
export const BASE = '/congressionalappchallenge/';

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    VitePWA({
      // injectManifest = we write our own service worker (src/sw.ts) and Workbox only
      // injects the list of files to precache. Needed later for map-tile range requests
      // and the offline check-in queue, which generateSW can't express.
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      // 'prompt' = a new version waits until the user taps "Reload", so an update never
      // swaps the app out from under someone mid-emergency.
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,webmanifest}'],
      },
      includeAssets: ['icons/favicon.svg'],
      manifest: {
        name: 'Kōkua: Hawaiʻi Emergency Prep',
        short_name: 'Kōkua',
        description:
          'Offline-first emergency preparedness for Hawaiʻi: evacuation zones, safe places, alerts, and your family plan.',
        lang: 'en',
        start_url: BASE,
        scope: BASE,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#0b4f6c',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
