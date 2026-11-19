import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { bootEmptyApp } from './helpers';

const SW_SOURCE_PATH = fileURLToPath(new URL('../../sw.js', import.meta.url));

test.describe('Fase 5 PWA Service Worker, Cache Strategy, Manifest & Accessibility', () => {
  test('Step 5.1 & 5.2: SW enters waiting on update without auto-skipWaiting, activates on SKIP_WAITING, prunes old caches, and serves hashed chunks cache-first', async ({
    page,
    context,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', err => pageErrors.push(err));

    const originalSw = readFileSync(SW_SOURCE_PATH, 'utf8');
    let serveUpdatedSw = false;

    await context.route(
      url => url.pathname === '/sw.js',
      async route => {
        const serveV8 = serveUpdatedSw || route.request().url().includes('v8-e2e');
        const body = serveV8
          ? originalSw.replace("const CACHE_VERSION = 'v7';", "const CACHE_VERSION = 'v8-e2e';")
          : originalSw;
        await route.fulfill({
          status: 200,
          contentType: 'application/javascript',
          headers: { 'Cache-Control': 'no-cache' },
          body,
        });
      }
    );

    await bootEmptyApp(page);

    // 1. Register v7 SW and reload so it controls the page and caches app assets
    await page.evaluate(async () => {
      await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
    });
    await page.reload();
    await expect
      .poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller)))
      .toBe(true);

    // 2. Open lazy @defer Calendar view so its JS chunk passes through the controlling SW
    await page.locator('[data-cy="view-calendar"]').click();
    await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();

    await expect
      .poll(() =>
        page.evaluate(async () => {
          const cache = await caches.open('easyturno-runtime-v7');
          const keys = await cache.keys();
          return keys.some(req => new URL(req.url).pathname.endsWith('.js'));
        })
      )
      .toBe(true);

    const cachedJsUrl = await page.evaluate(async () => {
      const cache = await caches.open('easyturno-runtime-v7');
      const keys = await cache.keys();
      const urls = keys.map(req => {
        const parsed = new URL(req.url);
        return `${parsed.pathname}${parsed.search}`;
      });
      return (
        urls.find(u => /^\/chunk-.*\.js$/.test(u)) ?? urls.find(u => u.includes('.js')) ?? null
      );
    });
    expect(cachedJsUrl).toBeTruthy();

    // 3. Offline verification: cached JS bundle + app shell reload + calendar @defer view work offline
    await context.setOffline(true);
    try {
      const offlineChunk = await page.evaluate(async url => {
        const res = await fetch(url);
        return { ok: res.ok, status: res.status, length: (await res.text()).length };
      }, cachedJsUrl!);
      expect(offlineChunk.ok).toBe(true);
      expect(offlineChunk.status).toBe(200);
      expect(offlineChunk.length).toBeGreaterThan(0);

      await page.reload();
      await page.locator('[data-cy="view-calendar"]').click();
      await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();
    } finally {
      await context.setOffline(false);
    }

    // 4. Trigger SW v8-e2e update: must pause in `waiting` instead of auto-skipping
    serveUpdatedSw = true;
    const swStateAfterUpdate = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.register('/sw.js?v=v8-e2e', { scope: '/' });

      const deadline = Date.now() + 5000;
      while (!reg.waiting && Date.now() < deadline) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      return {
        hasWaiting: Boolean(reg.waiting),
        hasActive: Boolean(reg.active),
        controllerState: navigator.serviceWorker.controller?.state ?? null,
      };
    });

    expect(swStateAfterUpdate.hasWaiting).toBe(true);
    expect(swStateAfterUpdate.hasActive).toBe(true);
    expect(swStateAfterUpdate.controllerState).toBe('activated');

    // Old v7 caches still exist until activation is explicitly requested
    const cachesBeforeActivation = await page.evaluate(() => caches.keys());
    expect(cachesBeforeActivation).toContain('easyturno-static-v7');
    expect(cachesBeforeActivation).toContain('easyturno-runtime-v7');

    // 5. Send SKIP_WAITING -> controllerchange fires and activate prunes v7 caches
    const controllerChangedPromise = page.evaluate(
      () =>
        new Promise<boolean>(resolve => {
          navigator.serviceWorker.addEventListener('controllerchange', () => resolve(true), {
            once: true,
          });
        })
    );

    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/');
      reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
    });

    expect(await controllerChangedPromise).toBe(true);

    await expect
      .poll(async () => {
        const keys = await page.evaluate(() => caches.keys());
        return {
          hasNewStatic: keys.includes('easyturno-static-v8-e2e'),
          hasOldStatic: keys.includes('easyturno-static-v7'),
          hasOldRuntime: keys.includes('easyturno-runtime-v7'),
        };
      })
      .toEqual({
        hasNewStatic: true,
        hasOldStatic: false,
        hasOldRuntime: false,
      });

    expect(pageErrors).toEqual([]);
  });

  test('Step 5.4: manifest icons, shortcut deep-link, modal focus trap/restore, and keyboard calendar navigation', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', err => pageErrors.push(err));

    // 1. Verify manifest fields and all referenced icons resolve HTTP 200
    const manifestResp = await page.request.get('/manifest.webmanifest');
    expect(manifestResp.status()).toBe(200);
    const manifest = (await manifestResp.json()) as {
      id?: string;
      start_url?: string;
      display?: string;
      theme_color?: string;
      icons?: Array<{ src: string }>;
      shortcuts?: Array<{ url: string; icons?: Array<{ src: string }> }>;
    };
    expect(manifest.id).toBe('/');
    expect(manifest.start_url).toBe('/');
    expect(manifest.display).toBe('standalone');
    expect(manifest.theme_color).toBe('#4f46e5');

    for (const icon of manifest.icons ?? []) {
      const iconResp = await page.request.get(`/${icon.src}`);
      expect(iconResp.status()).toBe(200);
    }

    // 2. Verify PWA shortcut URL `/?action=add_shift` opens the Shift Form dialog cleanly
    await page.addInitScript(() => {
      localStorage.setItem('easyturno.authMode', 'guest');
    });
    await page.goto('/?action=add_shift');

    const formDialog = page.locator('[role="dialog"]').first();
    await expect(formDialog).toBeVisible();
    await expect(formDialog).toHaveAttribute('aria-modal', 'true');
    await expect(formDialog).toHaveAttribute('aria-labelledby', 'shiftFormModalTitle');
    await expect.poll(() => new URL(page.url()).search).toBe('');

    await page.keyboard.press('Escape');
    await expect(formDialog).toBeHidden();

    // 3. Focus management & Tab trap in Settings dialog
    const settingsBtn = page.locator('[data-cy="settings-btn"]');
    await expect(settingsBtn).toHaveAccessibleName(/settings|impostazioni/i);
    await settingsBtn.focus();
    await expect(settingsBtn).toBeFocused();
    await page.keyboard.press('Enter');

    const settingsDialog = page.locator('[role="dialog"]').first();
    await expect(settingsDialog).toBeVisible();
    await expect(settingsDialog).toHaveAttribute('aria-labelledby', 'settingsDrawerTitle');

    await expect
      .poll(() =>
        page.evaluate(() => {
          const dialog = document.querySelector('[role="dialog"]');
          return Boolean(dialog && dialog.contains(document.activeElement));
        })
      )
      .toBe(true);

    // Tab several times and confirm focus remains trapped inside the dialog
    for (let i = 0; i < 18; i += 1) {
      await page.keyboard.press('Tab');
      const stillInside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"]');
        return Boolean(dialog && dialog.contains(document.activeElement));
      });
      expect(stillInside).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(settingsDialog).toBeHidden();
    await expect(settingsBtn).toBeFocused();

    // 4. Calendar keyboard navigation (Enter selects day cell)
    await page.locator('[data-cy="view-calendar"]').click();
    const dayCell = page.locator('[data-cy="calendar-day-15"]');
    await expect(dayCell).toHaveAttribute('role', 'button');
    await dayCell.focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('[data-cy="calendar-selected-day"]')).toBeVisible();
    await expect(dayCell).toHaveAttribute('aria-pressed', 'true');

    expect(pageErrors).toEqual([]);
  });
});
