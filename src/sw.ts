/// <reference lib="webworker" />
import { clientsClaim } from 'workbox-core';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
  type PrecacheEntry,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';

declare const self: ServiceWorkerGlobalScope & {
  // Filled in at build time by vite-plugin-pwa with every file in dist/ (plus a hash
  // of each), so the whole app shell is downloaded and stored on first visit.
  __WB_MANIFEST: Array<PrecacheEntry | string>;
};

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
