const CACHE_NAME = 'easyturno-cache-v1';
const CACHE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.webmanifest',
    '/icon.svg'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Opened cache and caching assets');
                return cache.addAll(CACHE_ASSETS);
            })
    );
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
    if (event.request.method !== 'GET') {
        return;
    }

    // Cache-first strategy
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // If we get a valid response, we cache it for next time.
                    if (networkResponse && networkResponse.status === 200) {
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