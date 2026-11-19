const CACHE_VERSION = 'v7';
const STATIC_CACHE = `easyturno-static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `easyturno-runtime-${CACHE_VERSION}`;
const APP_SHELL_URL = '/index.html';
const MAX_RUNTIME_CACHE_ENTRIES = 60;
const HASHED_STATIC_ASSET_RE = /-[A-Za-z0-9_-]{8}\.(js|css|woff2?)$/;

const PRECACHE_URLS = [
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
const PRECACHE_URL_SET = new Set(PRECACHE_URLS);
const RUNTIME_CACHEABLE_JSON_PATHS = new Set(PRECACHE_URLS.filter(url => url.endsWith('.json')));
const recentRuntimeUrls = new Set();

function isSameOrigin(requestUrl) {
  return requestUrl.origin === self.location.origin;
}

function isAppShellNavigation(request) {
  return request.mode === 'navigate';
}

function isHashedStaticAsset(requestUrl) {
  return isSameOrigin(requestUrl) && HASHED_STATIC_ASSET_RE.test(requestUrl.pathname);
}

function isRuntimeCacheable(request, requestUrl) {
  if (!isSameOrigin(requestUrl) || requestUrl.pathname === '/sw.js') {
    return false;
  }

  if (PRECACHE_URL_SET.has(requestUrl.pathname)) {
    return true;
  }

  return (
    ['script', 'style', 'worker', 'image', 'font'].includes(request.destination) ||
    requestUrl.pathname.endsWith('.js') ||
    requestUrl.pathname.endsWith('.css') ||
    RUNTIME_CACHEABLE_JSON_PATHS.has(requestUrl.pathname)
  );
}

function touchRuntimeUrl(url) {
  recentRuntimeUrls.delete(url);
  recentRuntimeUrls.add(url);
}

async function trimRuntimeCache(cache) {
  const keys = await cache.keys();
  if (keys.length <= MAX_RUNTIME_CACHE_ENTRIES) {
    return;
  }

  let remaining = keys.length;
  const requestsByUrl = new Map(keys.map(request => [request.url, request]));

  for (const request of keys) {
    if (remaining <= MAX_RUNTIME_CACHE_ENTRIES) {
      break;
    }
    if (!recentRuntimeUrls.has(request.url)) {
      await cache.delete(request);
      requestsByUrl.delete(request.url);
      remaining -= 1;
    }
  }

  for (const url of Array.from(recentRuntimeUrls)) {
    if (remaining <= MAX_RUNTIME_CACHE_ENTRIES) {
      break;
    }
    const targetRequest = requestsByUrl.get(url);
    if (!targetRequest) {
      recentRuntimeUrls.delete(url);
      continue;
    }
    await cache.delete(targetRequest);
    recentRuntimeUrls.delete(url);
    requestsByUrl.delete(url);
    remaining -= 1;
  }
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
      await cache.put(APP_SHELL_URL, response.clone());
    }
    return response;
  } catch (error) {
    const cachedShell = await cache.match(APP_SHELL_URL, { ignoreVary: true });
    if (cachedShell) {
      return cachedShell;
    }

    console.error('Navigation request failed and no cached app shell is available.', error);
    throw error;
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  if (cached) {
    touchRuntimeUrl(request.url);
    return cached;
  }

  const response = await fetch(request);
  if (response && response.ok) {
    await cache.put(request, response.clone());
    touchRuntimeUrl(request.url);
    await trimRuntimeCache(cache);
  }
  return response;
}

async function staleWhileRevalidate(request, event) {
  const requestUrl = new URL(request.url);
  const cacheName = PRECACHE_URL_SET.has(requestUrl.pathname) ? STATIC_CACHE : RUNTIME_CACHE;
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request, { ignoreVary: true });

  if (cached && cacheName === RUNTIME_CACHE) {
    touchRuntimeUrl(request.url);
  }

  const networkPromise = fetch(request)
    .then(async response => {
      if (response && response.ok) {
        await cache.put(request, response.clone());
        if (cacheName === RUNTIME_CACHE) {
          touchRuntimeUrl(request.url);
          await trimRuntimeCache(cache);
        }
      }
      return response;
    })
    .catch(() => cached);

  if (cached && event && typeof event.waitUntil === 'function') {
    event.waitUntil(networkPromise);
  }

  return cached || networkPromise;
}

self.addEventListener('install', event => {
  event.waitUntil(precacheAppShell());
});

function isSameOriginClient(source) {
  if (!source || typeof source.url !== 'string') {
    return false;
  }
  try {
    return new URL(source.url).origin === self.location.origin;
  } catch {
    return false;
  }
}

self.addEventListener('message', event => {
  if (!event.data || event.data.type !== 'SKIP_WAITING') {
    return;
  }
  // Only honour SKIP_WAITING from a same-origin window/worker client; ignore
  // messages whose source is missing or cross-origin to avoid third parties
  // (cross-origin iframes, dev tools, etc.) forcing an unexpected activation.
  if (!isSameOriginClient(event.source)) {
    return;
  }
  const skipResult = self.skipWaiting();
  if (typeof event.waitUntil === 'function') {
    event.waitUntil(Promise.resolve(skipResult));
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (![STATIC_CACHE, RUNTIME_CACHE].includes(cacheName)) {
              return caches.delete(cacheName);
            }
            return Promise.resolve(false);
          })
        );
      })
      .then(() => {
        recentRuntimeUrls.clear();
        return self.clients.claim();
      })
  );
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

  if (isHashedStaticAsset(requestUrl)) {
    event.respondWith(cacheFirst(event.request));
    return;
  }

  if (!isRuntimeCacheable(event.request, requestUrl)) {
    return;
  }

  event.respondWith(staleWhileRevalidate(event.request, event));
});
