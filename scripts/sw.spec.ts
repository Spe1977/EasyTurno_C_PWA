import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';

const SW_PATH = join(__dirname, '..', 'sw.js');

interface MockResponse {
  ok: boolean;
  status: number;
  url: string;
  body: string;
  vary?: string;
  clone: () => MockResponse;
}

function createMockResponse(
  url: string,
  body = 'ok',
  ok = true,
  status = 200,
  vary?: string
): MockResponse {
  const res: MockResponse = {
    ok,
    status,
    url,
    body,
    vary,
    clone: () => createMockResponse(url, body, ok, status, vary),
  };
  return res;
}

class MockRequest {
  url: string;
  method: string;
  destination: string;
  mode: string;
  cache?: string;
  originHeader?: string;

  constructor(
    input: string | MockRequest,
    init: {
      method?: string;
      destination?: string;
      mode?: string;
      cache?: string;
      originHeader?: string;
    } = {}
  ) {
    if (typeof input === 'string') {
      this.url = input.startsWith('http') ? input : `https://easyturno.pages.dev${input}`;
      this.method = init.method ?? 'GET';
      this.destination = init.destination ?? '';
      this.mode = init.mode ?? 'cors';
      this.cache = init.cache;
      this.originHeader = init.originHeader;
    } else {
      this.url = input.url;
      this.method = init.method ?? input.method;
      this.destination = init.destination ?? input.destination;
      this.mode = init.mode ?? input.mode;
      this.cache = init.cache ?? input.cache;
      this.originHeader = init.originHeader ?? input.originHeader;
    }
  }
}

interface SwTestHarness {
  listeners: Map<string, (event: unknown) => unknown>;
  cacheStores: Map<string, Map<string, MockResponse>>;
  skipWaitingMock: jest.Mock<Promise<void>, []>;
  claimMock: jest.Mock<Promise<void>, []>;
  fetchMock: jest.Mock<Promise<MockResponse>, [MockRequest | string]>;
  dispatchInstall: () => Promise<void>;
  dispatchActivate: () => Promise<void>;
  dispatchMessage: (data: unknown, source?: { url?: string } | null) => Promise<void>;
  dispatchFetch: (request: MockRequest) => Promise<MockResponse | undefined>;
}

function loadServiceWorkerHarness(
  initialCaches: Record<string, Record<string, MockResponse>> = {}
): SwTestHarness {
  const swSource = readFileSync(SW_PATH, 'utf8');
  const listeners = new Map<string, (event: unknown) => unknown>();
  const cacheStores = new Map<string, Map<string, MockResponse>>();

  for (const [cacheName, entries] of Object.entries(initialCaches)) {
    const store = new Map<string, MockResponse>();
    for (const [key, value] of Object.entries(entries)) {
      const normalized = key.startsWith('http') ? key : `https://easyturno.pages.dev${key}`;
      store.set(normalized, value);
    }
    cacheStores.set(cacheName, store);
  }

  const getOrCreateStore = (cacheName: string) => {
    let store = cacheStores.get(cacheName);
    if (!store) {
      store = new Map<string, MockResponse>();
      cacheStores.set(cacheName, store);
    }
    return store;
  };

  const normalizeKey = (input: string | MockRequest): string => {
    const raw = typeof input === 'string' ? input : input.url;
    return raw.startsWith('http') ? raw : `https://easyturno.pages.dev${raw}`;
  };

  const requestOriginStore = new Map<string, Map<string, string | undefined>>();

  const cachesApi = {
    open: jest.fn(async (cacheName: string) => {
      const store = getOrCreateStore(cacheName);
      let originMap = requestOriginStore.get(cacheName);
      if (!originMap) {
        originMap = new Map<string, string | undefined>();
        requestOriginStore.set(cacheName, originMap);
      }
      return {
        match: jest.fn(async (req: string | MockRequest, options?: { ignoreVary?: boolean }) => {
          const cached = store.get(normalizeKey(req));
          if (!cached) return undefined;
          if (!options?.ignoreVary && cached.vary === 'Origin') {
            const reqOrigin = typeof req === 'string' ? undefined : req.originHeader;
            const cachedOrigin = originMap!.get(normalizeKey(req));
            if (reqOrigin !== cachedOrigin) {
              return undefined;
            }
          }
          return cached;
        }),
        put: jest.fn(async (req: string | MockRequest, response: MockResponse) => {
          const key = normalizeKey(req);
          store.delete(key);
          store.set(key, response);
          originMap!.set(key, typeof req === 'string' ? undefined : req.originHeader);
        }),
        add: jest.fn(async (req: string | MockRequest) => {
          const key = normalizeKey(req);
          const response = await fetchMock(typeof req === 'string' ? new MockRequest(req) : req);
          store.set(key, response);
        }),
        delete: jest.fn(async (req: string | MockRequest) => store.delete(normalizeKey(req))),
        keys: jest.fn(async () => Array.from(store.keys()).map(url => new MockRequest(url))),
      };
    }),
    keys: jest.fn(async () => Array.from(cacheStores.keys())),
    delete: jest.fn(async (cacheName: string) => cacheStores.delete(cacheName)),
  };

  const skipWaitingMock = jest.fn(async () => undefined);
  const claimMock = jest.fn(async () => undefined);
  const fetchMock = jest.fn(async (req: MockRequest | string) => {
    const url = typeof req === 'string' ? req : req.url;
    return createMockResponse(url, `network:${url}`);
  });

  const selfMock: Record<string, unknown> = {
    location: new URL('https://easyturno.pages.dev/sw.js'),
    skipWaiting: skipWaitingMock,
    clients: {
      claim: claimMock,
    },
    addEventListener: (type: string, listener: (event: unknown) => unknown) => {
      listeners.set(type, listener);
    },
  };

  const context = vm.createContext({
    self: selfMock,
    caches: cachesApi,
    fetch: fetchMock,
    Request: MockRequest,
    URL,
    Set,
    Map,
    Promise,
    console,
  });

  vm.runInContext(swSource, context);

  return {
    listeners,
    cacheStores,
    skipWaitingMock,
    claimMock,
    fetchMock,
    async dispatchInstall() {
      const promises: Promise<unknown>[] = [];
      const handler = listeners.get('install');
      expect(handler).toBeDefined();
      handler!({
        waitUntil: (p: Promise<unknown>) => promises.push(Promise.resolve(p)),
      });
      await Promise.all(promises);
    },
    async dispatchActivate() {
      const promises: Promise<unknown>[] = [];
      const handler = listeners.get('activate');
      expect(handler).toBeDefined();
      handler!({
        waitUntil: (p: Promise<unknown>) => promises.push(Promise.resolve(p)),
      });
      await Promise.all(promises);
    },
    async dispatchMessage(data: unknown, source?: { url?: string } | null) {
      const promises: Promise<unknown>[] = [];
      const handler = listeners.get('message');
      expect(handler).toBeDefined();
      handler!({
        data,
        source,
        waitUntil: (p: Promise<unknown>) => promises.push(Promise.resolve(p)),
      });
      await Promise.all(promises);
    },
    async dispatchFetch(request: MockRequest) {
      const handler = listeners.get('fetch');
      expect(handler).toBeDefined();
      let responded: Promise<MockResponse> | undefined;
      const bgPromises: Promise<unknown>[] = [];
      handler!({
        request,
        respondWith: (p: Promise<MockResponse>) => {
          responded = Promise.resolve(p);
        },
        waitUntil: (p: Promise<unknown>) => bgPromises.push(Promise.resolve(p)),
      });
      if (!responded) return undefined;
      const result = await responded;
      await Promise.allSettled(bgPromises);
      return result;
    },
  };
}

describe('sw.js Service Worker (Fase 5 Step 5.1 & 5.2)', () => {
  describe('Step 5.1: Update lifecycle without automatic skipWaiting', () => {
    it('precaches app shell on install WITHOUT calling self.skipWaiting()', async () => {
      const sw = loadServiceWorkerHarness();

      await sw.dispatchInstall();

      expect(sw.skipWaitingMock).not.toHaveBeenCalled();
      const cacheKeys = Array.from(sw.cacheStores.keys());
      const staticCacheName = cacheKeys.find(name => name.startsWith('easyturno-static-'));
      expect(staticCacheName).toBeDefined();
      expect(
        sw.cacheStores.get(staticCacheName!)?.has('https://easyturno.pages.dev/index.html')
      ).toBe(true);
    });

    it('calls self.skipWaiting() only when SKIP_WAITING comes from a same-origin client', async () => {
      const sw = loadServiceWorkerHarness();

      await sw.dispatchMessage({ type: 'SKIP_WAITING' }, { url: 'https://evil.example/page' });
      await sw.dispatchMessage({ type: 'SKIP_WAITING' }, null);
      await sw.dispatchMessage({ type: 'OTHER' }, { url: 'https://easyturno.pages.dev/' });
      expect(sw.skipWaitingMock).not.toHaveBeenCalled();

      await sw.dispatchMessage({ type: 'SKIP_WAITING' }, { url: 'https://easyturno.pages.dev/' });
      expect(sw.skipWaitingMock).toHaveBeenCalledTimes(1);
    });

    it('cleans up legacy caches (including old easyturno-static-v6 and easyturno-runtime-v1) and claims clients inside waitUntil on activate', async () => {
      const sw = loadServiceWorkerHarness({
        'easyturno-static-v6': {
          '/index.html': createMockResponse('/index.html', 'old-shell'),
        },
        'easyturno-runtime-v1': {
          '/chunk-OLDCHUNK.js': createMockResponse('/chunk-OLDCHUNK.js', 'old-chunk'),
        },
      });

      await sw.dispatchActivate();

      expect(sw.cacheStores.has('easyturno-static-v6')).toBe(false);
      expect(sw.cacheStores.has('easyturno-runtime-v1')).toBe(false);
      expect(sw.claimMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('Step 5.2: Cache-first hashed chunks, SWR unhashed, network-first HTML & pruning', () => {
    it('serves hashed JS/CSS/font assets cache-first with zero network requests on cache hit', async () => {
      const sw = loadServiceWorkerHarness();
      await sw.dispatchInstall();
      sw.fetchMock.mockClear();

      const hashedUrls = [
        '/main-QHLZURKS.js',
        '/styles-AVTXUO5L.css',
        '/chunk-H_5hN62o.js',
        '/chunk-Da4-SChG.js',
        '/media/inter-AbCd1234.woff2',
      ];

      for (const path of hashedUrls) {
        const req = new MockRequest(path, {
          destination: path.endsWith('.css')
            ? 'style'
            : path.endsWith('.woff2')
              ? 'font'
              : 'script',
        });

        const first = await sw.dispatchFetch(req);
        expect(first?.body).toBe(`network:https://easyturno.pages.dev${path}`);
      }
      expect(sw.fetchMock).toHaveBeenCalledTimes(hashedUrls.length);

      sw.fetchMock.mockClear();

      for (const path of hashedUrls) {
        const req = new MockRequest(path, {
          destination: path.endsWith('.css')
            ? 'style'
            : path.endsWith('.woff2')
              ? 'font'
              : 'script',
        });

        const second = await sw.dispatchFetch(req);
        expect(second?.body).toBe(`network:https://easyturno.pages.dev${path}`);
      }
      expect(sw.fetchMock).not.toHaveBeenCalled();
    });

    it('uses stale-while-revalidate for unhashed runtime assets and ignores /sw.js', async () => {
      const sw = loadServiceWorkerHarness();

      const swReq = new MockRequest('/sw.js', { destination: 'script' });
      const swResp = await sw.dispatchFetch(swReq);
      expect(swResp).toBeUndefined();

      const mainReq = new MockRequest('/main.js', { destination: 'script' });
      const first = await sw.dispatchFetch(mainReq);
      expect(first?.body).toBe('network:https://easyturno.pages.dev/main.js');
      expect(sw.fetchMock).toHaveBeenCalledTimes(1);

      sw.fetchMock.mockResolvedValueOnce(
        createMockResponse('https://easyturno.pages.dev/main.js', 'updated-main')
      );
      const second = await sw.dispatchFetch(mainReq);
      expect(second?.body).toBe('network:https://easyturno.pages.dev/main.js');
      expect(sw.fetchMock).toHaveBeenCalledTimes(2);
    });

    it('uses networkFirst for navigation requests and falls back offline to cached /index.html', async () => {
      const sw = loadServiceWorkerHarness();
      await sw.dispatchInstall();

      sw.fetchMock.mockRejectedValueOnce(new Error('offline'));
      const navReq = new MockRequest('/?action=add_shift', { mode: 'navigate' });
      const offlineShell = await sw.dispatchFetch(navReq);
      expect(offlineShell?.body).toBe('network:https://easyturno.pages.dev/index.html');
    });

    it('prunes RUNTIME_CACHE entries with LRU eviction when exceeding the bounded limit', async () => {
      const sw = loadServiceWorkerHarness();

      for (let i = 0; i < 60; i += 1) {
        const hash = String(i).padStart(8, '0');
        const req = new MockRequest(`/chunk-${hash}.js`, { destination: 'script' });
        await sw.dispatchFetch(req);
      }

      // Touch chunk 0 via cache-first hit so it becomes most recently used
      await sw.dispatchFetch(new MockRequest('/chunk-00000000.js', { destination: 'script' }));

      // Fetch new chunks past the cap
      for (let i = 60; i < 80; i += 1) {
        const hash = String(i).padStart(8, '0');
        const req = new MockRequest(`/chunk-${hash}.js`, { destination: 'script' });
        await sw.dispatchFetch(req);
      }

      const runtimeCacheName = Array.from(sw.cacheStores.keys()).find(name =>
        name.startsWith('easyturno-runtime-')
      );
      expect(runtimeCacheName).toBeDefined();
      const runtimeStore = sw.cacheStores.get(runtimeCacheName!)!;
      expect(runtimeStore.size).toBeLessThanOrEqual(60);
      expect(runtimeStore.has('https://easyturno.pages.dev/chunk-00000079.js')).toBe(true);
      expect(runtimeStore.has('https://easyturno.pages.dev/chunk-00000000.js')).toBe(true);
      expect(runtimeStore.has('https://easyturno.pages.dev/chunk-00000001.js')).toBe(false);
    });

    it('matches cached hashed and runtime assets with ignoreVary even when Vary: Origin differs between requests', async () => {
      const sw = loadServiceWorkerHarness();
      sw.fetchMock.mockImplementation(async req => {
        const url = typeof req === 'string' ? req : req.url;
        return createMockResponse(url, `network:${url}`, true, 200, 'Origin');
      });

      const moduleReq = new MockRequest('/chunk-VARYORIG.js', {
        destination: 'script',
        originHeader: 'https://easyturno.pages.dev',
      });
      const firstRes = await sw.dispatchFetch(moduleReq);
      expect(firstRes?.body).toBe('network:https://easyturno.pages.dev/chunk-VARYORIG.js');
      expect(sw.fetchMock).toHaveBeenCalledTimes(1);

      const plainFetchOffline = new MockRequest('/chunk-VARYORIG.js', { destination: '' });
      sw.fetchMock.mockRejectedValueOnce(new Error('offline'));
      const secondRes = await sw.dispatchFetch(plainFetchOffline);
      expect(secondRes?.body).toBe('network:https://easyturno.pages.dev/chunk-VARYORIG.js');
      expect(sw.fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
