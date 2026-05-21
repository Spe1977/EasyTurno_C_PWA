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

  // Import the encrypted backup via file chooser
  const importChooserPromise = page.waitForEvent('filechooser');
  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(import backup|importa backup)$/i })
    .click();
  const importChooser = await importChooserPromise;
  await importChooser.setFiles(backupPath);

  // Fill password modal (import mode: password only)
  await expect(page.locator('[data-cy="password-input"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-cy="password-input"]').fill(backupPassword);
  await page.locator('[data-cy="password-confirm-btn"]').click();

  await expect(page.getByText('Backup Shift')).toBeVisible({ timeout: 10000 });

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

test('rejects import of an encrypted backup when the wrong password is provided', async ({
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
  const fileChooserPromise = page.waitForEvent('filechooser');
  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(import backup|importa backup)$/i })
    .click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles(backupPath);

  await expect(page.locator('[data-cy="password-input"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-cy="password-input"]').fill('WrongPassword!');
  await expect(page.locator('[data-cy="password-confirm-btn"]')).toBeEnabled({ timeout: 5000 });
  await page.locator('[data-cy="password-confirm-btn"]').click();

  // Wait for password modal to close (proves confirmPasswordPrompt() executed)
  await expect(page.locator('[data-cy="password-input"]')).not.toBeVisible({ timeout: 10000 });

  // Verify the import failed: the shift must NOT be restored
  // Use waitForFunction to let the async decrypt + error handling complete
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Protected Backup Shift'),
    {},
    { timeout: 15000 }
  );
  await expect(page.getByText('Protected Backup Shift')).not.toBeVisible();

  // Verify data wasn't persisted (survives reload)
  await page.reload();
  await expect(page.getByText('Protected Backup Shift')).not.toBeVisible({ timeout: 10000 });
});

test('rejects an import file larger than 5 MB without prompting for password', async ({ page }) => {
  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(import backup|importa backup)$/i })
    .click();
  const fileChooser = await fileChooserPromise;

  // 5 MiB + 1 byte — exactly one byte over MAX_IMPORT_FILE_SIZE_BYTES
  const oversized = Buffer.alloc(5 * 1024 * 1024 + 1, 0x78); // 'x'
  await fileChooser.setFiles({
    name: 'oversized.json',
    mimeType: 'application/json',
    buffer: oversized,
  });

  const errorToast = page.locator('[role="alert"]').filter({ hasText: /troppo grande|too large/i });
  await expect(errorToast.first()).toBeVisible({ timeout: 5000 });

  // Password modal must NOT have opened (importBackup returned before readAsText)
  await expect(page.locator('[data-cy="password-input"]')).not.toBeVisible();
});

test('imports a legacy backup encrypted with 250,000 PBKDF2 iterations', async ({ page }) => {
  test.setTimeout(60000);

  const backupPassword = 'LegacyBackup12345!';
  const legacyShiftTitle = 'Legacy 250k Shift';
  const startISO = new Date(Date.now() + 86_400_000).toISOString();
  const endISO = new Date(Date.now() + 86_400_000 + 3_600_000).toISOString();

  // Build a backup payload in the page context with iterations=250000 to
  // emulate a backup produced before T2 raised the iteration count to 600k.
  const legacyPayloadJson = await page.evaluate(
    async ({ password, shiftTitle, start, end }) => {
      const ITER = 250_000;
      const ALGO = 'AES-GCM';
      const KEY_LEN = 256;

      const encoder = new TextEncoder();
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));

      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        'PBKDF2',
        false,
        ['deriveKey']
      );
      const key = await crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' },
        keyMaterial,
        { name: ALGO, length: KEY_LEN },
        false,
        ['encrypt']
      );

      const shift = {
        id: 'legacy-' + Date.now().toString(36),
        seriesId: 'legacy-series',
        title: shiftTitle,
        start,
        end,
        color: 'sky',
        isRecurring: false,
      };
      const plaintext = JSON.stringify([shift]);
      const encrypted = await crypto.subtle.encrypt(
        { name: ALGO, iv },
        key,
        encoder.encode(plaintext)
      );

      const bufToBase64 = (buf: ArrayBuffer): string => {
        const bytes = new Uint8Array(buf);
        const CHUNK = 8192;
        let binary = '';
        for (let i = 0; i < bytes.length; i += CHUNK) {
          binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
        }
        return btoa(binary);
      };

      return JSON.stringify({
        type: 'easyturno-password-backup',
        version: 1,
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: ITER,
        salt: bufToBase64(salt.buffer),
        iv: bufToBase64(iv.buffer),
        data: bufToBase64(encrypted),
      });
    },
    { password: backupPassword, shiftTitle: legacyShiftTitle, start: startISO, end: endISO }
  );

  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  const fileChooserPromise = page.waitForEvent('filechooser');
  await page
    .locator('.modal-fade-in')
    .getByRole('button', { name: /^(import backup|importa backup)$/i })
    .click();
  const fileChooser = await fileChooserPromise;

  await fileChooser.setFiles({
    name: 'legacy_250k_backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(legacyPayloadJson, 'utf-8'),
  });

  await expect(page.locator('[data-cy="password-input"]')).toBeVisible({ timeout: 10000 });
  await page.locator('[data-cy="password-input"]').fill(backupPassword);
  await page.locator('[data-cy="password-confirm-btn"]').click();

  await expect(page.getByText(legacyShiftTitle)).toBeVisible({ timeout: 20000 });

  await page.reload();
  await expect(page.getByText(legacyShiftTitle)).toBeVisible({ timeout: 10000 });
});

test('rejects backup export when password is shorter than 12 characters', async ({ page }) => {
  await createShift(page, {
    title: 'Short Password Guard',
    date: isoDateDaysFromToday(2),
    startTime: '09:00',
    endTime: '17:00',
  });

  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.getByText(/settings|impostazioni/i)).toBeVisible();

  await page.locator('[data-cy="export-btn"]').click();
  await expect(page.locator('[data-cy="password-input"]')).toBeVisible();

  // Hint mentioning 12-character minimum must be visible in export mode
  await expect(page.getByText(/12/).first()).toBeVisible();

  // Track whether a download is triggered (it must NOT be)
  let downloadStarted = false;
  page.once('download', () => {
    downloadStarted = true;
  });

  await page.locator('[data-cy="password-input"]').fill('abc');
  await page.locator('[data-cy="password-confirm-input"]').fill('abc');
  await page.locator('[data-cy="password-confirm-btn"]').click();

  // Error toast must appear and mention the 12-character requirement
  const errorToast = page.locator('[role="alert"]').filter({ hasText: /12/ });
  await expect(errorToast.first()).toBeVisible({ timeout: 5000 });

  // Modal stays open so the user can correct the password
  await expect(page.locator('[data-cy="password-input"]')).toBeVisible();

  // No file was downloaded
  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  await page.waitForTimeout(500);
  expect(downloadStarted).toBe(false);
});

test('shows decryption error modal without auto-clearing data when ciphertext is unreadable', async ({
  page,
}) => {
  // Seed localStorage with a payload that looks encrypted (magic header + plausible
  // base64 length) but cannot be decrypted with the current device key. This
  // simulates the real-world scenario where the IndexedDB key has been wiped
  // or rotated while the ciphertext on disk is left behind.
  const corruptedCiphertext = 'ETBLOB1:' + 'A'.repeat(64);
  const storageKey = 'easyturno_user_data_v2';
  await page.evaluate(value => {
    window.localStorage.setItem('easyturno_user_data_v2', value);
  }, corruptedCiphertext);

  await page.reload();

  // The decryption error modal must appear (alertdialog) and the user must be
  // given the choice to either reset or keep the unreadable data.
  const errorModal = page.locator('[role="alertdialog"]');
  await expect(errorModal).toBeVisible({ timeout: 5000 });
  await expect(errorModal.getByText(/unable to read|impossibile leggere/i)).toBeVisible();
  await expect(
    errorModal.getByRole('button', { name: /reset all data|azzera tutti i dati/i })
  ).toBeVisible();
  const keepDataBtn = errorModal.getByRole('button', { name: /keep data|mantieni i dati/i });
  await expect(keepDataBtn).toBeVisible();

  // Dismissing the modal must NOT wipe the ciphertext — the user might still
  // want to restore a backup later. Verify both at the storage level and by
  // reloading the page (the modal should reappear).
  await keepDataBtn.click();
  await expect(errorModal).not.toBeVisible();

  const storedAfterDismiss = await page.evaluate(
    key => window.localStorage.getItem(key),
    storageKey
  );
  expect(storedAfterDismiss).toBe(corruptedCiphertext);

  await page.reload();
  await expect(page.locator('[role="alertdialog"]')).toBeVisible({ timeout: 5000 });

  // Now confirm the explicit reset path: ciphertext is cleared and the user
  // lands on an empty list.
  await page
    .locator('[role="alertdialog"]')
    .getByRole('button', { name: /reset all data|azzera tutti i dati/i })
    .click();
  await expect(page.locator('[role="alertdialog"]')).not.toBeVisible();

  const storedAfterReset = await page.evaluate(key => window.localStorage.getItem(key), storageKey);
  // After reset the service re-saves an empty encrypted array, so the value is
  // either null (briefly) or a fresh ciphertext for "[]" — but never the
  // original corrupted payload.
  expect(storedAfterReset).not.toBe(corruptedCiphertext);
});
