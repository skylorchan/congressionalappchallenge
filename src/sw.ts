/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  matchPrecache,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { createPartialResponse } from 'workbox-range-requests';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  // Filled in at build time by vite-plugin-pwa with every file in dist/ (plus a hash
  // of each), so the whole app shell, the zone data and the Oʻahu basemap are
  // downloaded and stored on first visit.
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

// The basemap is one PMTiles file. The map library never downloads it whole: it asks
// for small byte ranges ("Range: bytes=…") for each tile. Workbox's precache route
// would answer those with the entire 11 MB file, which the map rejects, so this route
// (registered first, so it wins) slices the cached copy into a proper 206 response.
registerRoute(
  ({ url }) => url.pathname.endsWith('.pmtiles'),
  async ({ request }) => {
    const cached = await matchPrecache(request.url);
    if (!cached) return fetch(request); // not cached yet (first visit still installing)
    if (!request.headers.has('range')) return cached;
    return createPartialResponse(request, cached);
  },
);

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Any page navigation (e.g. opening the installed app with no signal) gets the cached
// index.html, so the app opens even in airplane mode.
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Take control of open tabs on first install so the page works offline right away.
clientsClaim();

// The "Reload" button in UpdatePrompt sends this to activate a waiting new version.
self.addEventListener('message', (event) => {
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') void self.skipWaiting();
});
