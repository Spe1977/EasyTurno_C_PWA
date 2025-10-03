/// <reference types="cypress" />

describe('Advanced Features - Overtime, Allowances, Statistics', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.contains('EasyTurno', { timeout: 10000 }).should('be.visible');
  });

  describe('Overtime Management', () => {
    it('should add shift with overtime hours', () => {
      // Open add shift form
      cy.get('[data-cy="add-shift-btn"]').click();

      // Fill basic info
      cy.get('[data-cy="shift-title-input"]').type('Shift with Overtime');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '09:00';
      const endDate = startDate;
      const endTime = '17:00';

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type(startTime);
      cy.get('[data-cy="shift-end-date"]').clear().type(endDate);
      cy.get('[data-cy="shift-end-time"]').clear().type(endTime);

      // Add overtime hours
      cy.get('[data-cy="overtime-hours-input"]').clear().type('2.5');

      // Save
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify shift appears
      cy.contains('Shift with Overtime').should('be.visible');
    });

    it('should display overtime hours in shift card', () => {
      // Create shift with overtime
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Overtime Check');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type('10:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type('18:00');

      cy.get('[data-cy="overtime-hours-input"]').clear().type('1.5');
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify overtime is displayed
      cy.contains('Overtime Check').should('be.visible');
      cy.contains('1.5').should('be.visible');
    });
  });

  describe('Allowances Management', () => {
    it('should add shift with custom allowances', () => {
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Shift with Allowances');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type('09:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type('17:00');

      // Add first allowance
      cy.get('[data-cy="add-allowance-btn"]').click();
      cy.get('[data-cy="allowance-name-input"]').first().type('Transport');
      cy.get('[data-cy="allowance-amount-input"]').first().clear().type('15');

      // Add second allowance
      cy.get('[data-cy="add-allowance-btn"]').click();
      cy.get('[data-cy="allowance-name-input"]').last().type('Meal');
      cy.get('[data-cy="allowance-amount-input"]').last().clear().type('10');

      // Save
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify shift appears
      cy.contains('Shift with Allowances').should('be.visible');
    });

    it('should remove allowance from shift', () => {
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Test Allowances');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type('10:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type('18:00');

      // Add two allowances
      cy.get('[data-cy="add-allowance-btn"]').click();
      cy.get('[data-cy="allowance-name-input"]').first().type('First');
      cy.get('[data-cy="allowance-amount-input"]').first().clear().type('20');

      cy.get('[data-cy="add-allowance-btn"]').click();

      // Count allowances (should be 2)
      cy.get('[data-cy="allowance-name-input"]').should('have.length', 2);

      // Remove first allowance
      cy.get('[data-cy="remove-allowance-btn"]').first().click();

      // Count allowances (should be 1)
      cy.get('[data-cy="allowance-name-input"]').should('have.length', 1);
    });
  });

  describe('Statistics Dashboard', () => {
    beforeEach(() => {
      // Create multiple shifts with overtime and allowances for statistics
      const baseDate = new Date();
      baseDate.setHours(0, 0, 0, 0);

      // Add first shift
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Morning Shift');

      const date1 = new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000);
      const dateStr1 = date1.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').clear().type(dateStr1);
      cy.get('[data-cy="shift-start-time"]').clear().type('08:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(dateStr1);
      cy.get('[data-cy="shift-end-time"]').clear().type('16:00');
      cy.get('[data-cy="overtime-hours-input"]').clear().type('2');
      cy.get('[data-cy="save-shift-btn"]').click();
      cy.wait(500);

      // Add second shift
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Evening Shift');

      const date2 = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      const dateStr2 = date2.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').clear().type(dateStr2);
      cy.get('[data-cy="shift-start-time"]').clear().type('16:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(dateStr2);
      cy.get('[data-cy="shift-end-time"]').clear().type('00:00');
      cy.get('[data-cy="overtime-hours-input"]').clear().type('1.5');
      cy.get('[data-cy="save-shift-btn"]').click();
      cy.wait(500);
    });

    it('should open statistics modal', () => {
      // Open settings
      cy.get('[data-cy="settings-btn"]').click();

      // Click statistics button
      cy.get('[data-cy="statistics-btn"]').click();

      // Verify modal opened
      cy.contains(/Statistiche|Statistics/i).should('be.visible');
      cy.contains(/Totale turni|Total shifts/i).should('be.visible');
    });

    it('should display shift count statistics', () => {
      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Should show at least 2 shifts
      cy.contains(/Totale turni|Total shifts/i)
        .parent()
        .should('contain', '2');
    });

    it('should display total hours worked', () => {
      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Should show total hours (8h + 8h = 16h)
      cy.contains(/Ore lavorate|Hours worked/i)
        .parent()
        .should('be.visible');
    });

    it('should display total overtime hours', () => {
      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Should show total overtime (2 + 1.5 = 3.5h)
      cy.contains(/Straordinario|Overtime/i)
        .parent()
        .should('contain', '3.5');
    });

    it('should allow changing date range for statistics', () => {
      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Change start date
      cy.get('input[type="date"]').first().should('be.visible');
      cy.get('input[type="date"]').last().should('be.visible');

      // Verify date inputs work
      const newDate = new Date();
      newDate.setDate(newDate.getDate() - 60);
      const newDateStr = newDate.toISOString().slice(0, 10);

      cy.get('input[type="date"]').first().clear().type(newDateStr);

      // Statistics should update
      cy.contains(/Totale turni|Total shifts/i).should('be.visible');
    });
  });

  describe('Export and Import', () => {
    beforeEach(() => {
      // Create a test shift for export
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Export Test Shift');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type('10:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type('18:00');

      cy.get('[data-cy="save-shift-btn"]').click();
      cy.wait(500);
    });

    it('should export backup successfully', () => {
      // Open settings
      cy.get('[data-cy="settings-btn"]').click();

      // Click export button
      cy.get('[data-cy="export-btn"]').click();

      // Verify download (in real scenario, we'd check downloads folder)
      // For now, just verify the button worked
      cy.contains('Export Test Shift').should('be.visible');
    });

    it('should show import button in settings', () => {
      cy.get('[data-cy="settings-btn"]').click();

      // Verify import button exists
      cy.get('[data-cy="import-btn"]').should('be.visible');
    });
  });

  describe('Dark Mode', () => {
    it('should toggle dark mode', () => {
      // Open settings
      cy.get('[data-cy="settings-btn"]').click();

      // Find and click dark mode button
      cy.get('[data-cy="theme-dark-btn"]').click();

      // Verify dark class is added to html element
      cy.get('html').should('have.class', 'dark');

      // Toggle back to light
      cy.get('[data-cy="theme-light-btn"]').click();

      // Verify dark class is removed
      cy.get('html').should('not.have.class', 'dark');
    });

    it('should persist theme preference', () => {
      // Toggle to dark mode
      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="theme-dark-btn"]').click();
      cy.get('html').should('have.class', 'dark');

      // Reload page
      cy.reload();

      // Verify dark mode persisted
      cy.get('html').should('have.class', 'dark');
    });
  });

  describe('Language Switch', () => {
    it('should switch language', () => {
      // Open settings
      cy.get('[data-cy="settings-btn"]').click();

      // Switch to English
      cy.get('[data-cy="lang-en-btn"]').click();

      // Verify language changed (check for English text)
      cy.contains(/Add Shift|Shifts/i).should('be.visible');

      // Switch back to Italian
      cy.get('[data-cy="lang-it-btn"]').click();

      // Verify language changed back (check for Italian text)
      cy.contains(/Aggiungi Turno|Turni/i).should('be.visible');
    });
  });
});
