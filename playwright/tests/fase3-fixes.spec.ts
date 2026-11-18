import { expect, Page, test } from '@playwright/test';
import { bootEmptyApp, createShift, isoDateDaysFromToday, openStatistics } from './helpers';

const HARDCODED_ITALIAN_STATS_PATTERNS: RegExp[] = [
  /Analisi e resoconto/i,
  /delle tue ore e indennit/i,
  /Dati calcolati in locale/i,
  /Non ci sono turni pianificati/i,
  /Usa i filtri temporali/i,
  /(?<![a-zA-Z])turn[oi](?![a-z])/i,
  /(?<![a-zA-Z])ore(?![a-z])/i,
];

function extractCssAlpha(computedColor: string): number {
  const normalized = computedColor.trim().toLowerCase();
  if (normalized === 'transparent') {
    return 0;
  }

  const slashMatch = normalized.match(/\/\s*([\d.]+)\s*\)$/);
  if (slashMatch?.[1] !== undefined) {
    return Number(slashMatch[1]);
  }

  const rgbaMatch = normalized.match(/^rgba\(\s*[^,]+,\s*[^,]+,\s*[^,]+,\s*([\d.]+)\s*\)$/);
  if (rgbaMatch?.[1] !== undefined) {
    return Number(rgbaMatch[1]);
  }

  return 1;
}

function assertNoItalianStatsStrings(modalText: string): void {
  for (const pattern of HARDCODED_ITALIAN_STATS_PATTERNS) {
    expect(modalText).not.toMatch(pattern);
  }
}

async function switchLanguageToEnglish(page: Page): Promise<void> {
  await page.locator('[data-cy="settings-btn"]').click();
  await expect(page.locator('[data-cy="lang-en-btn"]')).toBeVisible();
  await page.locator('[data-cy="lang-en-btn"]').click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-fade-in')).toHaveCount(0);
}

test.describe('Fase 3 bug fixes & Tailwind v4 / i18n regressions', () => {
  test.beforeEach(async ({ page }) => {
    await bootEmptyApp(page);
  });

  test('Step 3.1: displays info toast when searching outside [-12m, +24m] after modal closes', async ({
    page,
  }) => {
    await page.getByRole('button', { name: /search date|cerca data/i }).click();
    const searchModal = page.locator('.modal-fade-in');
    await expect(searchModal).toBeVisible();

    const outsideRangeDate = isoDateDaysFromToday(1200);
    await searchModal.locator('input[name="searchDate"]').fill(outsideRangeDate);
    await searchModal.locator('button[type="submit"]').click();

    await expect(page.locator('.modal-fade-in')).toHaveCount(0);
    await expect(page.locator('div.fixed.inset-0')).toHaveCount(0);

    const toastContainer = page.locator('app-toast-container');
    await expect(toastContainer).toBeAttached();
    const toastAlert = toastContainer
      .locator('[role="alert"]')
      .filter({ hasText: /(-12m\/\+24m)|outside quick range|fuori dall'intervallo/i });
    await expect(toastAlert).toBeVisible();
  });

  test('Step 3.1: displays success toast after resetting all data and closing confirmation modal', async ({
    page,
  }) => {
    await page.locator('[data-cy="settings-btn"]').click();
    await expect(page.locator('.modal-fade-in')).toBeVisible();

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

    await expect(page.locator('.modal-fade-in')).toHaveCount(0);
    await expect(page.locator('div.fixed.inset-0')).toHaveCount(0);

    const toastContainer = page.locator('app-toast-container');
    await expect(toastContainer).toBeAttached();
    const resetToast = toastContainer
      .locator('[role="alert"]')
      .filter({ hasText: /all data has been deleted|tutti i dati sono stati cancellati/i });
    await expect(resetToast).toBeVisible();
  });

  test('Step 3.2: renders modal backdrop with Tailwind v4 bg-black/50 semi-transparent overlay', async ({
    page,
  }) => {
    await page.locator('[data-cy="add-shift-btn"]').first().click();
    await expect(page.locator('.modal-fade-in')).toBeVisible();

    const backdrop = page.locator('div.fixed.inset-0').filter({
      has: page.locator('.modal-fade-in'),
    });
    await expect(backdrop).toBeVisible();
    await expect(backdrop).toHaveClass(/\bbg-black\/50\b/);
    await expect(backdrop).not.toHaveClass(/\bbg-opacity-50\b/);

    const backgroundColor = await backdrop.evaluate(
      el => window.getComputedStyle(el).backgroundColor
    );
    expect(backgroundColor).not.toBe('rgb(0, 0, 0)');

    const alpha = extractCssAlpha(backgroundColor);
    expect(alpha).toBeGreaterThanOrEqual(0.45);
    expect(alpha).toBeLessThanOrEqual(0.55);
  });

  test('Step 3.3: renders selected-day shift card borderLeftColor using mapped hex color in Calendar view', async ({
    page,
  }) => {
    await createShift(page, {
      title: 'Sky Calendar Shift',
      date: isoDateDaysFromToday(0),
      startTime: '09:00',
      endTime: '17:00',
      color: 'sky',
    });

    await page.locator('[data-cy="view-calendar"]').click();
    await expect(page.locator('[data-cy="calendar-grid"]')).toBeVisible();

    const shiftDayCell = page
      .locator('[data-cy^="calendar-day-"]')
      .filter({ has: page.locator('.shift-indicators .rounded-full') })
      .first();
    await expect(shiftDayCell).toBeVisible();
    await shiftDayCell.click();

    const selectedPanel = page.locator('[data-cy="calendar-selected-day"]');
    await expect(selectedPanel).toBeVisible();

    const shiftCard = selectedPanel
      .locator('[data-cy^="calendar-shift-"]:not([data-cy="calendar-shift-count"])')
      .filter({ hasText: 'Sky Calendar Shift' });
    await expect(shiftCard).toBeVisible();

    const borderStyles = await shiftCard.evaluate(el => {
      const computed = window.getComputedStyle(el);
      return {
        computedBorderLeftColor: computed.borderLeftColor,
        computedBorderLeftWidth: computed.borderLeftWidth,
        inlineBorderLeftColor: el instanceof HTMLElement ? el.style.borderLeftColor : '',
      };
    });

    expect(borderStyles.computedBorderLeftWidth).toBe('4px');
    expect(borderStyles.computedBorderLeftColor).not.toBe('rgba(0, 0, 0, 0)');
    expect(borderStyles.computedBorderLeftColor).not.toBe('transparent');
    expect(borderStyles.computedBorderLeftColor).toBe('rgb(14, 165, 233)');
    expect(borderStyles.inlineBorderLeftColor).not.toBe('');
  });

  test('Step 3.4: renders statistics modal empty state in English without hardcoded Italian strings', async ({
    page,
  }) => {
    await switchLanguageToEnglish(page);
    await openStatistics(page);

    const statsModal = page.locator('.modal-fade-in').last();
    await expect(statsModal.getByRole('heading', { name: 'Statistics' })).toBeVisible();
    await expect(statsModal.getByText('No data available for this period')).toBeVisible();

    const subtitle = statsModal.locator('h3 + p');
    await expect(subtitle).toBeVisible();
    const subtitleText = (await subtitle.textContent())?.trim() ?? '';
    expect(subtitleText).toMatch(/\s/);
    expect(subtitleText).not.toMatch(/\w+\.\w+/);

    const emptyDescription = statsModal.locator('h4 + p');
    await expect(emptyDescription).toBeVisible();
    const emptyDescriptionText = (await emptyDescription.textContent())?.trim() ?? '';
    expect(emptyDescriptionText).toMatch(/\s/);
    expect(emptyDescriptionText).not.toMatch(/\w+\.\w+/);

    const emptyModalText = (await statsModal.textContent()) ?? '';
    assertNoItalianStatsStrings(emptyModalText);
    assertNoItalianStatsStrings(await statsModal.innerText());
  });

  test('Step 3.4: renders statistics modal populated state in English without hardcoded Italian strings', async ({
    page,
  }) => {
    await switchLanguageToEnglish(page);

    await createShift(page, {
      title: 'Morning Shift',
      date: isoDateDaysFromToday(0),
      startTime: '08:00',
      endTime: '16:00',
      overtimeHours: '2',
      color: 'sky',
    });

    await openStatistics(page);
    const statsModal = page.locator('.modal-fade-in').last();
    await statsModal.locator('input[name="statsStartDate"]').fill(isoDateDaysFromToday(-1));
    await statsModal.locator('input[name="statsEndDate"]').fill(isoDateDaysFromToday(2));

    await expect(statsModal.getByText('Total Shifts')).toBeVisible();
    await expect(statsModal.getByText('Total Hours Worked')).toBeVisible();
    await expect(statsModal.getByText('Total Overtime Hours')).toBeVisible();
    await expect(statsModal.getByText('Shifts by Type')).toBeVisible();
    await expect(statsModal.getByText('Morning Shift')).toBeVisible();
    await expect(statsModal.getByText(/8\.0/)).toBeVisible();
    await expect(statsModal.getByText(/\+2\.0/)).toBeVisible();
    await expect(statsModal.getByText(/1\s+[A-Za-z][a-z]+(?:\(s\))?\s+\(100%\)/)).toBeVisible();

    const populatedModalText = (await statsModal.textContent()) ?? '';
    assertNoItalianStatsStrings(populatedModalText);
    assertNoItalianStatsStrings(await statsModal.innerText());
  });
});
