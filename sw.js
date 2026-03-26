const CACHE_NAME = 'easyturno-cache-v5'; // Bump version to force update

// Critical local assets — must be available for the app to work offline.
// A failure here is logged as an error so it's easy to diagnose.
const LOCAL_ASSETS = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icon.svg',
    '/tailwind-init.js',
    // Main script
    '/index.tsx',
    // App files
    '/src/app.component.ts',
    '/src/app.component.html',
    '/src/shift.model.ts',
    '/src/services/shift.service.ts',
    '/src/services/translation.service.ts',
    '/src/pipes/date-format.pipe.ts',
    '/src/pipes/translate.pipe.ts',
    // i18n
    '/src/assets/i18n/it.json',
    '/src/assets/i18n/en.json',
];

// Optional CDN assets — cached opportunistically.
// A failure is only a warning: the app still works online without these cached.
const CDN_ASSETS = [
    'https://rsms.me/inter/inter.css',
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net/npm/ts-browser',
    "https://aistudiocdn.com/rxjs@^7.8.2?conditions=es2015",
    "https://aistudiocdn.com/rxjs@^7.8.2/operators?conditions=es2015",
    "https://next.esm.sh/@angular/common@^20.3.2?external=rxjs",
    "https://next.esm.sh/@angular/core@^20.3.2?external=rxjs",
    "https://next.esm.sh/@angular/platform-browser@^20.3.2?external=rxjs",
    "https://next.esm.sh/@angular/compiler@^20.3.2?external=rxjs",
    "https://next.esm.sh/@angular/forms@^20.3.2?external=rxjs",
    "https://next.esm.sh/@angular/common@^20.3.2/locales/it?external=rxjs"
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            // Cache local assets individually so one failure doesn't block the rest.
            const localPromises = LOCAL_ASSETS.map(url =>
                cache.add(url).catch(err =>
                    console.error(`[SW] Failed to cache local asset: ${url}`, err)
                )
            );
            // Cache CDN assets opportunistically — failures are non-fatal.
            const cdnPromises = CDN_ASSETS.map(url =>
                cache.add(url).catch(err =>
                    console.warn(`[SW] Optional CDN asset not cached: ${url}`, err)
                )
            );
            return Promise.all([...localPromises, ...cdnPromises]);
        })
    );
});

// Listen for SKIP_WAITING message
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Clearing old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    // We only want to cache GET requests.
    if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
        return;
    }

    // Cache-first strategy
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // If we get a valid response, we cache it for next time.
                    if (networkResponse && networkResponse.status === 200) {
                         // Make sure to clone the response, as it can be consumed only once.
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                }).catch(error => {
                    console.error('Fetch failed; user is likely offline.', error);
                    // If fetch fails (e.g., offline), and we didn't have a cache match,
                    // there's nothing more we can do. The browser will show its offline page.
                });

                // Return the cached response if it exists, otherwise wait for the network.
                return response || fetchPromise;
            });
        })
    );
});