import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// GitHub Pages serves this repo at https://<user>.github.io/congressionalappchallenge/, so every asset URL,
// the manifest scope, and the service worker scope must live under /congressionalappchallenge/.
export const BASE = '/congressionalappchallenge/';

/**
 * `vite preview` doesn't know the .pmtiles type, serves it with an empty Content-Type,
 * and its compression middleware then gzips each byte-range response, which browsers
 * reject (ERR_CONTENT_DECODING_FAILED). Label it as binary so it's sent as-is, like
 * GitHub Pages does.
 */
const pmtilesPreviewFix: Plugin = {
  name: 'pmtiles-preview-content-type',
  configurePreviewServer(server) {
    server.middlewares.use((req, res, next) => {
      if (req.url?.split('?')[0]?.endsWith('.pmtiles')) {
        const setHeader = res.setHeader.bind(res);
        res.setHeader = (name, value) =>
          setHeader(
            name,
            name.toLowerCase() === 'content-type' ? 'application/octet-stream' : value,
          );
      }
      next();
    });
  },
};

export default defineConfig({
  base: BASE,
  plugins: [
    react(),
    pmtilesPreviewFix,
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
        // Everything, including zone data (json), map fonts (pbf) and the basemap.
        globPatterns: ['**/*.{js,mjs,css,html,svg,png,ico,webmanifest,json,pbf,pmtiles}'],
        // The Oʻahu basemap is ~11 MB; the default limit (2 MB) would silently skip it.
        maximumFileSizeToCacheInBytes: 16 * 1024 * 1024,
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
