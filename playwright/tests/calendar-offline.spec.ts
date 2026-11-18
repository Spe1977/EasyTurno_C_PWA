import { expect, Page, test } from '@playwright/test';
import {
  bootEmptyApp,
  createRecurringShift,
  createShift,
  isoDateDaysFromToday,
  openStatistics,
} from './helpers';

async function expectedCalendarMonthYear(page: Page, monthOffset = 0): Promise<RegExp> {
  const lang = await page.locator('html').getAttribute('lang');
  const locale = lang === 'it' ? 'it-IT' : 'en-US';
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const monthName = target.toLocaleDateString(locale, { month: 'long' });
  return new RegExp(`^\\s*${monthName}\\s+${target.getFullYear()}\\s*$`, 'i');
}

test.describe('Calendar, Offline & Remaining Cypress Parity Flows', () => {
  test.beforeEach(async ({ page }) => {
    await bootEmptyApp(page);
  });

  test.describe('Calendar View & Navigation', () => {
    test('starts in list view and toggles cleanly between list and calendar views', async ({
      page,
    }) => {
      await expect(page.locator('[data-cy="view-list"]')).toHaveClass(/bg-white/);
      await expect(page.locator('[data-cy="view-calendar"]')).not.toHaveClass(/bg-white/);
      await expect(page.locator('[data-cy="calendar-grid"]')).toHaveCount(0);

      await page.locator('[data-cy="view-calendar"]').click();
      await expect(page.locator('[data-cy="view-calendar"]')).toHaveClass(/bg-white/);
      await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();

      await page.locator('[data-cy="view-list"]').click();
      await expect(page.locator('[data-cy="view-list"]')).toHaveClass(/bg-white/);
      await expect(page.locator('[data-cy="calendar-grid"]')).toHaveCount(0);
    });

    test('renders current month, year, 7 weekday headers, 42 calendar days, and Today button', async ({
      page,
    }) => {
      await page.locator('[data-cy="view-calendar"]').click();

      const expectedHeader = await expectedCalendarMonthYear(page, 0);
      await expect(page.locator('[data-cy="calendar-month-year"]')).toHaveText(expectedHeader);
      await expect(page.locator('.weekday-headers')).toBeVisible();
      await expect(page.locator('.weekday-headers > div')).toHaveCount(7);
      await expect(page.locator('[data-cy^="calendar-day-"]')).toHaveCount(42);
      await expect(page.locator('[data-cy="calendar-today"]')).toBeVisible();
    });

    test('navigates months backward, forward, back to Today, and across year transitions', async ({
      page,
    }) => {
      await page.locator('[data-cy="view-calendar"]').click();

      const monthYear = page.locator('[data-cy="calendar-month-year"]');
      const initialText = (await monthYear.textContent())?.trim() ?? '';
      const currentYear = new Date().getFullYear();
      expect(initialText).toContain(String(currentYear));

      await page.locator('[data-cy="calendar-prev-month"]').click();
      await expect(monthYear).not.toHaveText(initialText);
      const prevText = (await monthYear.textContent())?.trim() ?? '';

      await page.locator('[data-cy="calendar-next-month"]').click();
      await expect(monthYear).not.toHaveText(prevText);

      // Navigate two months ahead, then jump back via Today button
      await page.locator('[data-cy="calendar-next-month"]').click();
      await page.locator('[data-cy="calendar-next-month"]').click();
      await expect(monthYear).not.toHaveText(initialText);

      await page.locator('[data-cy="calendar-today"]').click();
      await expect(monthYear).toHaveText(initialText);

      // Advance 12 months to verify year transition forward
      for (let i = 0; i < 12; i++) {
        await page.locator('[data-cy="calendar-next-month"]').click();
      }
      await expect(monthYear).toContainText(String(currentYear + 1));

      // Step back 24 months to verify year transition backward past currentYear
      for (let i = 0; i < 24; i++) {
        await page.locator('[data-cy="calendar-prev-month"]').click();
      }
      await expect(monthYear).toContainText(String(currentYear - 1));
    });

    test('selects a day and clears selection by re-clicking, Clear button, or changing month', async ({
      page,
    }) => {
      await page.locator('[data-cy="view-calendar"]').click();

      const dayCell = page.locator('[data-cy="calendar-day-15"]');
      const selectedPanel = page.locator('[data-cy="calendar-selected-day"]');

      // Select day and verify formatted date header & empty-state count
      await dayCell.click();
      await expect(selectedPanel).toBeVisible();
      await expect(selectedPanel.locator('h3')).not.toBeEmpty();
      await expect(page.locator('[data-cy="calendar-shift-count"]')).toContainText('0');

      // Clicking the same day toggles selection off
      await dayCell.click();
      await expect(selectedPanel).toHaveCount(0);

      // Clicking Clear selection button closes selected day info
      await dayCell.click();
      await expect(selectedPanel).toBeVisible();
      await page.locator('[data-cy="calendar-clear-selection"]').click();
      await expect(selectedPanel).toHaveCount(0);

      // Navigating to a different month clears selection
      await dayCell.click();
      await expect(selectedPanel).toBeVisible();
      await page.locator('[data-cy="calendar-next-month"]').click();
      await expect(selectedPanel).toHaveCount(0);
    });

    test('displays shift count badge when a day has more than 5 shifts and opens shift from day panel', async ({
      page,
    }) => {
      const today = isoDateDaysFromToday(0);

      for (let i = 1; i <= 6; i++) {
        await createShift(page, {
          title: `Badge Shift ${i}`,
          date: today,
          startTime: `0${i}:00`,
          endTime: `0${i}:30`,
        });
      }

      await page.locator('[data-cy="view-calendar"]').click();
      await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();

      const badge = page.locator('[data-cy="calendar-shift-badge"]').first();
      await expect(badge).toBeVisible();
      await expect(badge).toContainText('6');

      // Open the day containing the badge and click a shift item to open edit modal
      await badge.evaluate(el => {
        const dayCell = el.closest('[data-cy^="calendar-day-"]');
        if (dayCell instanceof HTMLElement) {
          dayCell.click();
        }
      });

      const selectedPanel = page.locator('[data-cy="calendar-selected-day"]');
      await expect(selectedPanel).toBeVisible();
      await expect(selectedPanel.locator('h3')).not.toBeEmpty();
      await expect(page.locator('[data-cy="calendar-shift-count"]')).toContainText('6');

      await selectedPanel
        .locator('[data-cy^="calendar-shift-"]:not([data-cy="calendar-shift-count"])')
        .first()
        .click();
      await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
      await expect(page.locator('[data-cy="shift-title-input"]')).toHaveValue(/Badge Shift \d/);
    });

    test('renders calendar grid, touch navigation, and day details on mobile viewport', async ({
      page,
    }) => {
      await page.setViewportSize({ width: 375, height: 812 });
      await page.locator('[data-cy="view-calendar"]').click();

      await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();
      await expect(page.locator('[data-cy^="calendar-day-"]')).toHaveCount(42);

      await expect(page.locator('[data-cy="calendar-prev-month"]')).toBeVisible();
      await expect(page.locator('[data-cy="calendar-prev-month"]')).toBeEnabled();
      await expect(page.locator('[data-cy="calendar-next-month"]')).toBeVisible();
      await expect(page.locator('[data-cy="calendar-next-month"]')).toBeEnabled();
      await expect(page.locator('[data-cy="calendar-today"]')).toBeVisible();
      await expect(page.locator('[data-cy="calendar-today"]')).toBeEnabled();

      await page.locator('[data-cy="calendar-day-15"]').click();
      await expect(page.locator('[data-cy="calendar-selected-day"]')).toBeVisible();
    });

    test('renders calendar in dark mode and supports aria-labels and keyboard navigation', async ({
      page,
    }) => {
      // Enable dark mode from Settings and dismiss modal with Escape
      await page.locator('[data-cy="settings-btn"]').click();
      await page.locator('[data-cy="theme-dark-btn"]').click();
      await expect(page.locator('html')).toHaveClass(/dark/);
      await page.keyboard.press('Escape');
      await expect(page.locator('[data-cy="theme-dark-btn"]')).toHaveCount(0);

      await page.locator('[data-cy="view-calendar"]').click();
      await expect(page.locator('.calendar-container')).toHaveClass(/dark:bg-gray-800/);
      await expect(page.locator('[data-cy="calendar-month-year"]')).toBeVisible();
      await expect(page.locator('.weekday-headers')).toBeVisible();

      const prevBtn = page.locator('[data-cy="calendar-prev-month"]');
      const nextBtn = page.locator('[data-cy="calendar-next-month"]');

      const prevLabel = await prevBtn.getAttribute('aria-label');
      const nextLabel = await nextBtn.getAttribute('aria-label');
      expect(prevLabel?.trim().length).toBeGreaterThan(0);
      expect(nextLabel?.trim().length).toBeGreaterThan(0);

      const monthYear = page.locator('[data-cy="calendar-month-year"]');
      const initialMonth = (await monthYear.textContent())?.trim() ?? '';

      await prevBtn.focus();
      await expect(prevBtn).toBeFocused();
      await page.keyboard.press('Enter');
      await expect(monthYear).not.toHaveText(initialMonth);
    });
  });

  test.describe('Offline Simulation & V2 Persistence', () => {
    test('persists encrypted state under easyturno_user_data_v2 and survives real offline work', async ({
      context,
      page,
    }) => {
      // Wait for initial guest state save under v2 key
      await expect
        .poll(async () =>
          page.evaluate(() => window.localStorage.getItem('easyturno_user_data_v2'))
        )
        .toBeTruthy();

      const initialV2 = await page.evaluate(() =>
        window.localStorage.getItem('easyturno_user_data_v2')
      );
      const legacyValue = await page.evaluate(() =>
        window.localStorage.getItem('easyturno_shifts')
      );
      expect(legacyValue).toBeNull();

      await context.setOffline(true);
      try {
        await createShift(page, {
          title: 'Offline Created Shift',
          date: isoDateDaysFromToday(1),
          startTime: '13:00',
          endTime: '16:00',
        });

        await expect(page.getByText('Offline Created Shift')).toBeVisible();

        // Verify v2 storage key updated while completely offline (async WebCrypto save)
        await expect
          .poll(async () =>
            page.evaluate(() => window.localStorage.getItem('easyturno_user_data_v2'))
          )
          .not.toBe(initialV2);

        const offlineLegacy = await page.evaluate(() =>
          window.localStorage.getItem('easyturno_shifts')
        );
        expect(offlineLegacy).toBeNull();

        // Calendar view also works offline without network
        await page.locator('[data-cy="view-calendar"]').click();
        await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();
        await page.locator('[data-cy="view-list"]').click();
      } finally {
        await context.setOffline(false);
      }

      // After network returns, reload and verify offline shift loads from easyturno_user_data_v2
      await page.reload();
      await expect(page.getByText('Offline Created Shift')).toBeVisible();
    });

    test('serves web app manifest and skips service worker registration on localhost', async ({
      page,
    }) => {
      const manifestResponse = await page.request.get('/manifest.webmanifest');
      expect(manifestResponse.status()).toBe(200);
      const manifestJson = (await manifestResponse.json()) as {
        name?: string;
        short_name?: string;
      };
      expect(manifestJson.short_name ?? manifestJson.name).toContain('EasyTurno');

      const swStatus = await page.evaluate(async () => {
        const isLocal = ['localhost', '127.0.0.1'].includes(window.location.hostname);
        if (!('serviceWorker' in navigator)) {
          return { supported: false, isLocal, hasRegistration: false };
        }
        const reg = await navigator.serviceWorker.getRegistration();
        return { supported: true, isLocal, hasRegistration: Boolean(reg) };
      });

      if (swStatus.supported && swStatus.isLocal) {
        expect(swStatus.hasRegistration).toBe(false);
      }
    });
  });

  test.describe('Shift Validation, Recurring Series & Advanced Features', () => {
    test('displays validation error toast when saving a shift without a title', async ({
      page,
    }) => {
      const tomorrow = isoDateDaysFromToday(1);

      await page.locator('[data-cy="add-shift-btn"]').first().click();
      await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();

      await page.locator('[data-cy="shift-start-date"]').fill(tomorrow);
      await page.locator('[data-cy="shift-start-time"]').fill('08:00');
      await page.locator('[data-cy="shift-end-date"]').fill(tomorrow);
      await page.locator('[data-cy="shift-end-time"]').fill('12:00');
      await page.locator('[data-cy="save-shift-btn"]').click();

      const errorToast = page
        .locator('[role="alert"]')
        .filter({ hasText: /il titolo è obbligatorio|title is required/i });
      await expect(errorToast.first()).toBeVisible();
      await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
    });

    test('creates weekly recurring shifts and preserves earlier occurrences when editing a middle instance series', async ({
      page,
    }) => {
      await createRecurringShift(page, {
        title: 'Weekly Meeting',
        date: isoDateDaysFromToday(1),
        startTime: '10:00',
        endTime: '12:00',
        frequency: 'weeks',
        interval: '1',
      });

      const weeklyTitles = page
        .locator('[data-cy="shift-title"]')
        .filter({ hasText: 'Weekly Meeting' });
      expect(await weeklyTitles.count()).toBeGreaterThan(1);

      await createRecurringShift(page, {
        title: 'Daily Series',
        date: isoDateDaysFromToday(1),
        startTime: '09:00',
        endTime: '17:00',
        frequency: 'days',
        interval: '1',
      });

      const dailyItems = page.locator('app-shift-list-item').filter({ hasText: 'Daily Series' });
      await expect(dailyItems.nth(3)).toBeVisible();

      // Edit the 4th occurrence (index 3) and apply to the entire series from this point
      await dailyItems.nth(3).locator('[data-cy="edit-shift-btn"]').click();
      await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
      await page.locator('[data-cy="shift-title-input"]').fill('Modified Series');
      await page.locator('[data-cy="save-shift-btn"]').click();

      const confirmModal = page.locator('.modal-fade-in').last();
      await expect(
        confirmModal.getByRole('button', { name: /entire series|tutta la serie/i })
      ).toBeVisible();
      await confirmModal.getByRole('button', { name: /entire series|tutta la serie/i }).click();

      // First 3 occurrences stay "Daily Series"; 4th onwards become "Modified Series"
      await expect(
        page.locator('[data-cy="shift-title"]').filter({ hasText: 'Daily Series' })
      ).toHaveCount(3);
      const modifiedTitles = page
        .locator('[data-cy="shift-title"]')
        .filter({ hasText: 'Modified Series' });
      await expect(modifiedTitles.first()).toBeVisible();
      expect(await modifiedTitles.count()).toBeGreaterThan(1);
    });

    test('adds and removes custom allowances and verifies numeric statistics and date-range filtering', async ({
      page,
    }) => {
      const day1 = isoDateDaysFromToday(1);
      const day2 = isoDateDaysFromToday(2);

      // Create shift 1 with allowances (add 3, remove 1) and 2h overtime
      await page.locator('[data-cy="add-shift-btn"]').first().click();
      await expect(page.locator('[data-cy="shift-title-input"]')).toBeVisible();
      await page.locator('[data-cy="shift-title-input"]').fill('Morning Allowance Shift');
      await page.locator('[data-cy="shift-start-date"]').fill(day1);
      await page.locator('[data-cy="shift-start-time"]').fill('08:00');
      await page.locator('[data-cy="shift-end-date"]').fill(day1);
      await page.locator('[data-cy="shift-end-time"]').fill('16:00');
      await page.locator('[data-cy="overtime-hours-input"]').fill('2');

      await page.locator('[data-cy="add-allowance-btn"]').click();
      await page.locator('[data-cy="allowance-name-input"]').nth(0).fill('Transport');
      await page.locator('[data-cy="allowance-amount-input"]').nth(0).fill('15');

      await page.locator('[data-cy="add-allowance-btn"]').click();
      await page.locator('[data-cy="allowance-name-input"]').nth(1).fill('Meal');
      await page.locator('[data-cy="allowance-amount-input"]').nth(1).fill('10');

      await page.locator('[data-cy="add-allowance-btn"]').click();
      await expect(page.locator('[data-cy="allowance-name-input"]')).toHaveCount(3);
      await page.locator('[data-cy="remove-allowance-btn"]').nth(2).click();
      await expect(page.locator('[data-cy="allowance-name-input"]')).toHaveCount(2);

      await page.locator('[data-cy="save-shift-btn"]').click();
      await expect(page.getByText('Morning Allowance Shift')).toBeVisible();

      // Create shift 2 with 1.5h overtime
      await createShift(page, {
        title: 'Evening Overtime Shift',
        date: day2,
        startTime: '14:00',
        endTime: '22:00',
        overtimeHours: '1.5',
      });

      await openStatistics(page);
      const statsModal = page.locator('.modal-fade-in').last();

      await statsModal.locator('input[name="statsStartDate"]').fill(day1);
      await statsModal.locator('input[name="statsEndDate"]').fill(day2);

      await expect(statsModal.getByText('2', { exact: true }).first()).toBeVisible();
      await expect(statsModal.getByText(/16\.0/)).toBeVisible();
      await expect(statsModal.getByText(/\+3\.5/)).toBeVisible();
      await expect(statsModal.getByText('Transport')).toBeVisible();
      await expect(statsModal.getByText('15', { exact: true })).toBeVisible();
      await expect(statsModal.getByText('Meal')).toBeVisible();
      await expect(statsModal.getByText('10', { exact: true })).toBeVisible();

      // Narrow range to day 1 only
      await statsModal.locator('input[name="statsEndDate"]').fill(day1);
      await expect(statsModal.getByText(/8\.0/)).toBeVisible();
      await expect(statsModal.getByText(/\+2\.0/)).toBeVisible();

      // Move range to past empty window and verify empty state
      await statsModal.locator('input[name="statsStartDate"]').fill(isoDateDaysFromToday(-60));
      await statsModal.locator('input[name="statsEndDate"]').fill(isoDateDaysFromToday(-30));
      await expect(
        statsModal.getByText(/nessun dato disponibile|no data available/i)
      ).toBeVisible();
    });

    test('toggles theme dark/light and switches language bidirectionally between EN and IT', async ({
      page,
    }) => {
      await page.locator('[data-cy="settings-btn"]').click();

      await page.locator('[data-cy="theme-dark-btn"]').click();
      await expect(page.locator('html')).toHaveClass(/dark/);
      await page.locator('[data-cy="theme-light-btn"]').click();
      await expect(page.locator('html')).not.toHaveClass(/dark/);

      await page.locator('[data-cy="lang-en-btn"]').click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: /search date/i })).toBeVisible();
      await expect(page.locator('[data-cy="add-shift-btn"]').first()).toContainText('Add Shift');

      await page.locator('[data-cy="settings-btn"]').click();
      await page.locator('[data-cy="lang-it-btn"]').click();
      await page.keyboard.press('Escape');
      await expect(page.getByRole('button', { name: /cerca data/i })).toBeVisible();
      await expect(page.locator('[data-cy="add-shift-btn"]').first()).toContainText(
        'Aggiungi Turno'
      );
    });
  });
});
