const STATIC_CACHE = 'easyturno-static-v5';
const RUNTIME_CACHE = 'easyturno-runtime-v1';
const APP_SHELL_URL = '/index.html';

const PRECACHE_URLS = [
  '/',
  APP_SHELL_URL,
  '/manifest.webmanifest',
  '/favicon.ico',
  '/favicon.png',
  '/icon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
];
const RUNTIME_CACHEABLE_JSON_PATHS = new Set(PRECACHE_URLS.filter(url => url.endsWith('.json')));

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isAppShellNavigation(request) {
  return request.mode === 'navigate';
}

function isRuntimeCacheable(request, requestUrl) {
  if (!isSameOrigin(requestUrl)) {
    return false;
  }

  if (PRECACHE_URLS.includes(requestUrl.pathname)) {
    return true;
  }

  return (
    ['script', 'style', 'worker', 'image', 'font'].includes(request.destination) ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname.endsWith('.css') ||
    RUNTIME_CACHEABLE_JSON_PATHS.has(requestUrl.pathname)
  );
}

async function precacheAppShell() {
  const cache = await caches.open(STATIC_CACHE);
  const results = await Promise.allSettled(
    PRECACHE_URLS.map(url => cache.add(new Request(url, { cache: 'reload' })))
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.warn('Failed to precache asset:', PRECACHE_URLS[index], result.reason);
    }
  });
}

async function networkFirstNavigation(request) {
  const cache = await caches.open(STATIC_CACHE);

  try {
    const response = await fetch(request);
    if (response.ok) {
      cache.put(APP_SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cachedShell = await cache.match(APP_SHELL_URL);
    if (cachedShell) {
      return cachedShell;
    }

    console.error('Navigation request failed and no cached app shell is available.', error);
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cacheName = PRECACHE_URLS.includes(new URL(request.url).pathname)
    ? STATIC_CACHE
    : RUNTIME_CACHE;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cached);

  return cached || networkPromise;
}

self.addEventListener('install', event => {
  event.waitUntil(
    precacheAppShell().then(() => {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (![STATIC_CACHE, RUNTIME_CACHE].includes(cacheName)) {
            return caches.delete(cacheName);
          }
          return Promise.resolve(false);
        })
      );
    })
  );

  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.url.startsWith('chrome-extension://')) {
    return;
  }

  const requestUrl = new URL(event.request.url);

  if (isAppShellNavigation(event.request)) {
    event.respondWith(networkFirstNavigation(event.request));
    return;
  }

  if (!isRuntimeCacheable(event.request, requestUrl)) {
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request));
});
