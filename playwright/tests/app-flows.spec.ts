import { expect, test } from '@playwright/test';
import { bootEmptyApp, createShift, isoDateDaysFromToday } from './helpers';

test.beforeEach(async ({ page }) => {
  await bootEmptyApp(page);
});

test('persists a created shift after reload', async ({ page }) => {
  await createShift(page, {
    title: 'Persistent Shift',
    date: isoDateDaysFromToday(1),
    startTime: '10:00',
    endTime: '14:00',
  });

  await page.reload();

  await expect(page.getByText('Persistent Shift')).toBeVisible();
});

test('edits an existing shift', async ({ page }) => {
  await createShift(page, {
    title: 'Original Shift',
    date: isoDateDaysFromToday(1),
    startTime: '09:00',
    endTime: '11:00',
  });

  await page.locator('[data-cy="edit-shift-btn"]').first().click();
  await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
  await page.locator('[data-cy="shift-title-input"]').fill('Updated Shift');
  await page.locator('[data-cy="save-shift-btn"]').click();

  await expect(page.getByText('Updated Shift')).toBeVisible();
  await expect(page.getByText('Original Shift')).not.toBeVisible();
});

test('deletes an existing shift after confirmation', async ({ page }) => {
  await createShift(page, {
    title: 'Disposable Shift',
    date: isoDateDaysFromToday(1),
    startTime: '14:00',
    endTime: '17:00',
  });

  await page.locator('[data-cy="delete-shift-btn"]').first().click();
  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(delete|elimina)$/i })
    .click();

  await expect(page.getByText('Disposable Shift')).not.toBeVisible();
});

test('persists dark theme and english language preferences', async ({ page }) => {
  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  await page.locator('[data-cy="theme-dark-btn"]').click();
  await page.locator('[data-cy="lang-en-btn"]').click();

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('[data-cy="add-shift-btn"]').first()).toContainText('Add Shift');

  await page.getByRole('button', { name: /cancel|annulla/i }).click();
  await page.reload();

  await expect(page.locator('html')).toHaveClass(/dark/);
  await expect(page.locator('[data-cy="add-shift-btn"]').first()).toContainText('Add Shift');
});

test('shows shift details from calendar day selection', async ({ page }) => {
  await createShift(page, {
    title: 'Calendar Shift',
    date: isoDateDaysFromToday(1),
    startTime: '07:00',
    endTime: '13:00',
    overtimeHours: '1.5',
  });

  await page.locator('[data-cy="view-calendar"]').click();
  await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();

  const indicator = page.locator('.shift-indicators .rounded-full').first();
  await expect(indicator).toBeVisible();
  await indicator.evaluate(element => {
    const dayCell = element.closest('[data-cy^="calendar-day-"]');
    if (dayCell instanceof HTMLElement) {
      dayCell.click();
    }
  });

  await expect(page.locator('[data-cy="calendar-selected-day"]')).toBeVisible();
  await expect(page.locator('[data-cy="calendar-shift-count"]')).toContainText('1');
  await expect(page.getByText('Calendar Shift')).toBeVisible();
  await expect(page.getByText(/\+1\.5h/i)).toBeVisible();
});
