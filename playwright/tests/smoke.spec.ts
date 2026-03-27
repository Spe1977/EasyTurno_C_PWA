import { expect, test } from '@playwright/test';

function tomorrowIsoDate(): string {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const year = tomorrow.getFullYear();
  const month = `${tomorrow.getMonth() + 1}`.padStart(2, '0');
  const day = `${tomorrow.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByText('EasyTurno')).toBeVisible();
});

test('loads the app shell and toggles calendar view', async ({ page }) => {
  await expect(page.locator('[data-cy="view-toggle"]')).toBeVisible();
  await expect(page.locator('[data-cy="view-list"]')).toBeVisible();

  await page.locator('[data-cy="view-calendar"]').click();

  await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();
  await expect(page.locator('[data-cy="calendar-month-year"]')).toBeVisible();
});

test('creates a new shift from the main form', async ({ page }) => {
  const date = tomorrowIsoDate();

  await page.locator('[data-cy="add-shift-btn"]').first().click();
  await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();

  await page.locator('[data-cy="shift-title-input"]').fill('Playwright Shift');
  await page.locator('[data-cy="shift-start-date"]').fill(date);
  await page.locator('[data-cy="shift-start-time"]').fill('08:00');
  await page.locator('[data-cy="shift-end-date"]').fill(date);
  await page.locator('[data-cy="shift-end-time"]').fill('12:00');
  await page.locator('[data-cy="save-shift-btn"]').click();

  await expect(page.getByText('Playwright Shift')).toBeVisible();
});
