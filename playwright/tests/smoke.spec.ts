import { expect, test } from '@playwright/test';
import { bootEmptyApp, createShift, isoDateDaysFromToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await bootEmptyApp(page);
});

test('loads the app shell and toggles calendar view', async ({ page }) => {
  await expect(page.locator('[data-cy="view-toggle"]')).toBeVisible();
  await expect(page.locator('[data-cy="view-list"]')).toBeVisible();

  await page.locator('[data-cy="view-calendar"]').click();

  await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();
  await expect(page.locator('[data-cy="calendar-month-year"]')).toBeVisible();
});

test('creates a new shift from the main form', async ({ page }) => {
  await createShift(page, {
    title: 'Playwright Shift',
    date: isoDateDaysFromToday(1),
  });
});
