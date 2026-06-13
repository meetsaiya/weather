/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

// Workbox injects the precache manifest here at build time.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// --- Runtime caching --------------------------------------------------------

// Open-Meteo forecast/archive/geocoding — network-first, fall back to cache
// when offline so the dashboard can still render the last known state.
registerRoute(
  ({ url }) => url.hostname.endsWith('open-meteo.com'),
  new NetworkFirst({
    cacheName: 'ww-openmeteo',
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// BigDataCloud reverse geocoding — same pattern, shorter cache list.
registerRoute(
  ({ url }) => url.hostname.includes('api-bdc.net'),
  new NetworkFirst({
    cacheName: 'ww-geocode',
    networkTimeoutSeconds: 6,
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
);

// Same-origin static assets — cache-first.
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    ['style', 'script', 'image', 'font'].includes(request.destination),
  new CacheFirst({
    cacheName: 'ww-assets',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 60 }),
    ],
  })
);

// --- Push notification handler (forward-compatible with real Web Push) ------

self.addEventListener('push', (event) => {
  let payload = { title: 'WeatherWise', body: '' };
  if (event.data) {
    try {
      payload = { ...payload, ...event.data.json() };
    } catch {
      payload.body = event.data.text();
    }
  }
  event.waitUntil(showBrief(payload.title, payload.body));
});

// --- Page → SW message channel (used by the setTimeout-based morning brief) -

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SHOW_NOTIFICATION') {
    event.waitUntil(showBrief(data.title, data.body));
  } else if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

function showBrief(title, body) {
  return self.registration.showNotification(title || 'WeatherWise', {
    body: body || '',
    icon: '/pwa-192x192.png',
    badge: '/favicon-32x32.png',
    tag: 'ww-daily-brief',
    renotify: false,
    data: { openUrl: '/' },
  });
}

// --- Click-to-focus ---------------------------------------------------------

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.openUrl ?? '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        const url = new URL(client.url);
        if (url.origin === self.location.origin) {
          client.focus();
          return client.navigate(target);
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target);
    })
  );
});

self.skipWaiting();
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
