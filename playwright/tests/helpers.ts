import { expect, Page } from '@playwright/test';

export function isoDateDaysFromToday(offset: number): string {
  const date = new Date();
  date.setDate(date.getDate() + offset);

  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function bootEmptyApp(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(page.getByText('EasyTurno')).toBeVisible();
}

export async function createShift(
  page: Page,
  options: {
    title: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    overtimeHours?: string;
  }
): Promise<void> {
  const {
    title,
    date = isoDateDaysFromToday(1),
    startTime = '08:00',
    endTime = '12:00',
    overtimeHours,
  } = options;

  await page.locator('[data-cy="add-shift-btn"]').first().click();
  await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();

  await page.locator('[data-cy="shift-title-input"]').fill(title);
  await page.locator('[data-cy="shift-start-date"]').fill(date);
  await page.locator('[data-cy="shift-start-time"]').fill(startTime);
  await page.locator('[data-cy="shift-end-date"]').fill(date);
  await page.locator('[data-cy="shift-end-time"]').fill(endTime);

  if (overtimeHours) {
    await page.locator('[data-cy="overtime-hours-input"]').fill(overtimeHours);
  }

  await page.locator('[data-cy="save-shift-btn"]').click();
  await expect(page.getByText(title)).toBeVisible();
}

export async function createRecurringShift(
  page: Page,
  options: {
    title: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    frequency?: 'days' | 'weeks' | 'months' | 'years';
    interval?: string;
  }
): Promise<void> {
  const {
    title,
    date = isoDateDaysFromToday(1),
    startTime = '08:00',
    endTime = '12:00',
    frequency = 'days',
    interval = '1',
  } = options;

  await page.locator('[data-cy="add-shift-btn"]').first().click();
  await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();

  await page.locator('[data-cy="shift-title-input"]').fill(title);
  await page.locator('[data-cy="shift-start-date"]').fill(date);
  await page.locator('[data-cy="shift-start-time"]').fill(startTime);
  await page.locator('[data-cy="shift-end-date"]').fill(date);
  await page.locator('[data-cy="shift-end-time"]').fill(endTime);
  await page.locator('[data-cy="recurring-checkbox"]').check();
  await expect(page.locator('[data-cy="frequency-select"]')).toBeVisible();
  await page.locator('[data-cy="frequency-select"]').selectOption(frequency);
  await page.locator('[data-cy="interval-select"]').selectOption(interval);
  await page.locator('[data-cy="save-shift-btn"]').click();

  await expect(page.getByText(title).first()).toBeVisible();
}

export async function openStatistics(page: Page): Promise<void> {
  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();
  await page.locator('[data-cy="statistics-btn"]').click();
  await expect(page.getByRole('heading', { name: /statistics|statistiche/i })).toBeVisible();
}
