import { expect, test } from '@playwright/test';
import {
  bootEmptyApp,
  createRecurringShift,
  createShift,
  isoDateDaysFromToday,
  openStatistics,
} from './helpers';

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

  // Click export to open password modal
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-cy="export-btn"]').click();

  // Fill password modal (export mode: password + confirmation)
  await expect(page.locator('[data-cy="password-input"]')).toBeVisible();
  await page.locator('[data-cy="password-input"]').fill(backupPassword);
  await page.locator('[data-cy="password-confirm-input"]').fill(backupPassword);
  await page.locator('[data-cy="password-confirm-btn"]').click();

  const download = await downloadPromise;

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

  // Import the encrypted backup
  await page.locator('#importFile').setInputFiles(backupPath);

  // Fill password modal (import mode: password only)
  await expect(page.locator('[data-cy="password-input"]')).toBeVisible();
  await page.locator('[data-cy="password-input"]').fill(backupPassword);
  await page.locator('[data-cy="password-confirm-btn"]').click();

  await expect(page.getByText('Backup Shift')).toBeVisible();

  await page.reload();
  await expect(page.getByText('Backup Shift')).toBeVisible();
});

test('edits only one recurring occurrence when confirmed', async ({ page }) => {
  await createRecurringShift(page, {
    title: 'Recurring Task',
    date: isoDateDaysFromToday(1),
    startTime: '11:00',
    endTime: '12:00',
  });

  const recurringTaskTitles = page
    .locator('[data-cy="shift-title"]')
    .filter({ hasText: 'Recurring Task' });
  await expect(recurringTaskTitles.first()).toBeVisible();
  expect(await recurringTaskTitles.count()).toBeGreaterThan(1);

  await page
    .getByText('Recurring Task')
    .first()
    .locator('../..')
    .locator('[data-cy="edit-shift-btn"]')
    .click();
  await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
  await page.locator('[data-cy="shift-title-input"]').fill('Modified Instance');
  await page.locator('[data-cy="save-shift-btn"]').click();

  const confirmModal = page.locator('.modal-fade-in').last();
  await expect(
    confirmModal.getByRole('button', { name: /just this event|solo questo evento/i })
  ).toBeVisible();
  await confirmModal.getByRole('button', { name: /just this event|solo questo evento/i }).click();

  await expect(page.getByText('Modified Instance')).toBeVisible();
  await expect(
    page.locator('[data-cy="shift-title"]').filter({ hasText: 'Recurring Task' }).first()
  ).toBeVisible();
});

test('deletes an entire recurring series when confirmed', async ({ page }) => {
  await createRecurringShift(page, {
    title: 'Series to Delete',
    date: isoDateDaysFromToday(1),
    startTime: '15:00',
    endTime: '17:00',
  });

  const seriesTitles = page
    .locator('[data-cy="shift-title"]')
    .filter({ hasText: 'Series to Delete' });
  await expect(seriesTitles.first()).toBeVisible();
  expect(await seriesTitles.count()).toBeGreaterThan(1);

  await page
    .getByText('Series to Delete')
    .first()
    .locator('../..')
    .locator('[data-cy="delete-shift-btn"]')
    .click();

  const confirmModal = page.locator('.modal-fade-in').last();
  await expect(
    confirmModal.getByRole('button', { name: /entire series|tutta la serie/i })
  ).toBeVisible();
  await confirmModal.getByRole('button', { name: /entire series|tutta la serie/i }).click();

  await expect(
    page.locator('[data-cy="shift-title"]').filter({ hasText: 'Series to Delete' })
  ).toHaveCount(0);
});

test('opens statistics and renders the expected summary sections', async ({ page }) => {
  await createShift(page, {
    title: 'Morning Shift',
    date: isoDateDaysFromToday(1),
    startTime: '08:00',
    endTime: '16:00',
    overtimeHours: '2',
  });

  await createShift(page, {
    title: 'Evening Shift',
    date: isoDateDaysFromToday(2),
    startTime: '14:00',
    endTime: '22:00',
    overtimeHours: '1.5',
  });

  await openStatistics(page);

  const statsModal = page.locator('.modal-fade-in').last();
  await statsModal.locator('input[name="statsEndDate"]').fill(isoDateDaysFromToday(3));
  await expect(statsModal.getByText(/total shifts|totale turni/i)).toBeVisible();
  await expect(statsModal.getByText(/total hours worked|ore totali lavorate/i)).toBeVisible();
  await expect(
    statsModal.getByText(/total overtime hours|totale ore di straordinario/i)
  ).toBeVisible();
  await expect(statsModal.getByText(/shifts by type|turni per tipologia/i)).toBeVisible();
  await expect(statsModal.getByText('Morning Shift')).toBeVisible();
  await expect(statsModal.getByText('Evening Shift')).toBeVisible();
});

test('shows an error toast when importing an encrypted backup with the wrong password', async ({
  page,
}) => {
  const backupPassword = 'PlaywrightBackup123!';

  await createShift(page, {
    title: 'Protected Backup Shift',
    date: isoDateDaysFromToday(2),
    startTime: '09:15',
    endTime: '17:45',
  });

  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  // Export with password modal
  const downloadPromise = page.waitForEvent('download');
  await page.locator('[data-cy="export-btn"]').click();

  await expect(page.locator('[data-cy="password-input"]')).toBeVisible();
  await page.locator('[data-cy="password-input"]').fill(backupPassword);
  await page.locator('[data-cy="password-confirm-input"]').fill(backupPassword);
  await page.locator('[data-cy="password-confirm-btn"]').click();

  const download = await downloadPromise;

  const backupPath = '/tmp/easyturno_playwright_wrong_password_backup.json';
  await download.saveAs(backupPath);

  await page.reload();
  await expect(page.getByText('Protected Backup Shift')).toBeVisible();

  await page.locator('[data-cy="settings-btn"]').click();
  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(reset all data|resetta tutti i dati)$/i })
    .first()
    .click();

  const resetModal = page.locator('.modal-fade-in').last();
  await resetModal
    .getByRole('button', { name: /^(reset all data|resetta tutti i dati)$/i })
    .click();
  await expect(page.getByText('Protected Backup Shift')).not.toBeVisible();

  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  // Import with wrong password via password modal
  await page.locator('#importFile').setInputFiles(backupPath);

  await expect(page.locator('[data-cy="password-input"]')).toBeVisible();
  await page.locator('[data-cy="password-input"]').fill('WrongPassword!');
  await page.locator('[data-cy="password-confirm-btn"]').click();

  await expect(
    page.getByRole('alert').getByText(/invalid backup password|password backup non valida/i)
  ).toBeVisible();
  await expect(page.getByText('Protected Backup Shift')).not.toBeVisible();
});
