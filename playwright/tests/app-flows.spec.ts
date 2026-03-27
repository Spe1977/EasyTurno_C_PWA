import { Dialog, expect, test } from '@playwright/test';
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

test('resets all data after confirmation', async ({ page }) => {
  await createShift(page, {
    title: 'Shift To Reset',
    date: isoDateDaysFromToday(1),
    startTime: '08:30',
    endTime: '16:30',
  });

  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(reset all data|resetta tutti i dati)$/i })
    .first()
    .click();

  const confirmationModal = page.locator('.modal-fade-in').last();
  await expect(confirmationModal.getByText(/warning|attenzione/i)).toBeVisible();

  await confirmationModal
    .getByRole('button', { name: /^(reset all data|resetta tutti i dati)$/i })
    .click();

  await expect(page.getByText('Shift To Reset')).not.toBeVisible();

  await page.reload();
  await expect(page.getByText('Shift To Reset')).not.toBeVisible();
});

test('exports an encrypted backup and imports it back with the password', async ({ page }) => {
  const backupPassword = 'PlaywrightBackup123!';

  await createShift(page, {
    title: 'Backup Shift',
    date: isoDateDaysFromToday(2),
    startTime: '09:15',
    endTime: '17:45',
  });

  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  const exportPromptQueue = [backupPassword, backupPassword];
  const exportDialogHandler = async (dialog: Dialog) => {
    await dialog.accept(exportPromptQueue.shift() ?? '');
  };

  page.on('dialog', exportDialogHandler);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.locator('[data-cy="export-btn"]').click(),
  ]);

  page.off('dialog', exportDialogHandler);

  const backupPath = '/tmp/easyturno_playwright_backup.json';
  await download.saveAs(backupPath);

  await page.reload();
  await expect(page.getByText('Backup Shift')).toBeVisible();

  await page.locator('[data-cy="settings-btn"]').click();
  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(reset all data|resetta tutti i dati)$/i })
    .first()
    .click();

  const confirmationModal = page.locator('.modal-fade-in').last();
  await confirmationModal
    .getByRole('button', { name: /^(reset all data|resetta tutti i dati)$/i })
    .click();

  await expect(page.getByText('Backup Shift')).not.toBeVisible();

  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  page.once('dialog', async (dialog: Dialog) => {
    await dialog.accept(backupPassword);
  });

  await page.locator('#importFile').setInputFiles(backupPath);

  await expect(page.getByText('Backup Shift')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Backup Shift')).toBeVisible();
});
