import { expect, test } from '@playwright/test';

interface CapturedScriptResponse {
  url: string;
  body: string;
}

const INITIAL_MAIN_SPLIT_MARKERS = [
  'shift-title-input',
  'calendar-month-year',
  'statistics-btn',
  'statsPeriodTitle',
  '@firebase/firestore',
  '@firebase/auth',
  'firestore.googleapis.com',
  'identitytoolkit',
];

const STRICT_ON_DEMAND_GUEST_MARKERS = [
  'statistics-btn',
  'statsPeriodTitle',
  '@firebase/firestore',
  '@firebase/auth',
  'firestore.googleapis.com',
  'identitytoolkit',
];

test.describe('Fase 4 Bundle Optimization, @defer & Lazy Firebase', () => {
  test('guest boot loads zero Firebase SDK or on-demand chunks and fetches secondary views & Auth on demand', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', err => pageErrors.push(err));

    const capturedScripts: CapturedScriptResponse[] = [];
    page.on('response', async response => {
      const url = response.url();
      if (!url.startsWith('http://127.0.0.1:3100/') && !url.startsWith('http://localhost:3100/')) {
        return;
      }
      if (!new URL(url).pathname.endsWith('.js')) return;
      try {
        const body = await response.text();
        capturedScripts.push({ url, body });
      } catch {
        // Ignore aborted or unreadable responses on navigation teardown
      }
    });

    await page.addInitScript(() => {
      localStorage.setItem('easyturno.authMode', 'guest');
    });

    await page.goto('/');
    const addShiftButton = page.locator('[data-cy="add-shift-btn"]').filter({ visible: true });
    await expect(addShiftButton).toBeVisible();
    // Allow microtasks/network idle settle for initial boot verification
    await page.waitForLoadState('networkidle');

    const initialCount = capturedScripts.length;
    expect(initialCount).toBeGreaterThan(0);

    // Core entry main.js must not contain any deferred components or Firebase SDK modules
    const mainScript = capturedScripts.find(item => new URL(item.url).pathname === '/main.js');
    expect(mainScript).toBeDefined();
    for (const marker of INITIAL_MAIN_SPLIT_MARKERS) {
      expect(mainScript!.body).not.toContain(marker);
    }

    // ShiftForm & Calendar use `prefetch on idle` for first-offline resilience, while
    // Settings, Statistics, AuthScreen, Verification & all Firebase SDKs are strictly on-demand
    const initialBundleText = capturedScripts.map(item => item.body).join('\n');
    for (const marker of STRICT_ON_DEMAND_GUEST_MARKERS) {
      expect(initialBundleText).not.toContain(marker);
    }

    // 1) Open Shift Form -> creates shift cleanly (chunk split outside main.js)
    await addShiftButton.click();
    await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();

    await page.locator('[data-cy="shift-title-input"]').fill('Turno Lazy');
    await page.locator('[data-cy="save-shift-btn"]').click();
    await expect(page.locator('[data-cy="shift-title"]', { hasText: 'Turno Lazy' })).toBeVisible();

    // 2) Switch to Calendar -> renders split Calendar view
    await page.locator('[data-cy="view-calendar"]').click();
    await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();

    // 3) Open Settings then Statistics -> two separate @defer chunks fetched on demand
    const beforeSettingsCount = capturedScripts.length;
    await page.locator('[data-cy="settings-btn"]').click();
    await expect(page.locator('[data-cy="statistics-btn"]')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const afterSettingsScripts = capturedScripts.slice(beforeSettingsCount);
    expect(afterSettingsScripts.length).toBeGreaterThan(0);
    expect(afterSettingsScripts.some(item => item.body.includes('statistics-btn'))).toBe(true);

    const beforeStatsCount = capturedScripts.length;
    await page.locator('[data-cy="statistics-btn"]').click();
    await expect(page.locator('app-statistics-drawer')).toBeVisible();
    await page.waitForLoadState('networkidle');

    const afterStatsScripts = capturedScripts.slice(beforeStatsCount);
    expect(afterStatsScripts.length).toBeGreaterThan(0);

    await page.keyboard.press('Escape');
    await expect(page.locator('app-statistics-drawer')).toBeHidden();

    // 4) Exit guest mode -> @defer auth-screen + lazy Firebase Auth SDK fetched on demand
    await page.locator('[data-cy="settings-btn"]').click();
    await expect(page.locator('[data-cy="auth-exit-btn"]')).toBeVisible();

    const beforeAuthCount = capturedScripts.length;
    await page.locator('[data-cy="auth-exit-btn"]').click();
    await expect(page.locator('app-auth-screen')).toBeVisible();
    await expect
      .poll(() =>
        capturedScripts
          .slice(beforeAuthCount)
          .some(
            item => item.body.includes('@firebase/auth') || item.body.includes('identitytoolkit')
          )
      )
      .toBe(true);

    expect(pageErrors).toEqual([]);
  });

  test('service worker caches @defer chunks and serves lazy views offline', async ({
    page,
    context,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', err => pageErrors.push(err));

    await page.addInitScript(() => {
      localStorage.setItem('easyturno.authMode', 'guest');
    });

    await page.goto('/');
    const addShiftButton = page.locator('[data-cy="add-shift-btn"]').filter({ visible: true });
    await expect(addShiftButton).toBeVisible();

    // Register /sw.js explicitly (SwUpdateService skips auto-registration on localhost)
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) {
        throw new Error('Service Worker API not available');
      }
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });

    // Reload so the Service Worker controls the page and caches shell + subsequent chunks
    await page.reload();
    await expect(addShiftButton).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    // Load Shift Form and Calendar while controlled and online so runtime cache stores both chunks
    await addShiftButton.click();
    await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('app-shift-form-modal')).toBeHidden();

    await page.locator('[data-cy="view-calendar"]').click();
    await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();
    await page.locator('[data-cy="view-list"]').click();
    await expect(page.locator('[data-cy="view-list"]')).toBeVisible();

    // Ensure SW cache has stored both shell JS and lazy @defer chunk JS responses
    await expect
      .poll(async () => {
        return page.evaluate(async () => {
          const cacheNames = await caches.keys();
          const jsUrls = new Set<string>();
          for (const name of cacheNames) {
            const cache = await caches.open(name);
            const requests = await cache.keys();
            for (const req of requests) {
              if (new URL(req.url).pathname.endsWith('.js')) {
                jsUrls.add(new URL(req.url).pathname);
              }
            }
          }
          return jsUrls.size;
        });
      })
      .toBeGreaterThanOrEqual(2);

    // Switch completely offline, reload, and open cached lazy views
    await context.setOffline(true);
    try {
      await page.reload();
      await expect(addShiftButton).toBeVisible();

      await page.locator('[data-cy="view-calendar"]').click();
      await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();

      await addShiftButton.click();
      await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    expect(pageErrors).toEqual([]);
  });
});
