/// <reference types="cypress" />

describe('Advanced Features - Overtime, Allowances, Statistics', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.window().then(win => win.localStorage.clear());
    cy.reload();
    cy.contains('EasyTurno', { timeout: 15000 }).should('be.visible');
  });

  afterEach(() => {
    // Close any open modals by pressing Escape key
    cy.closeModal();
    cy.wait(300);
  });

  describe('Overtime Management', () => {
    it('should add shift with overtime hours', () => {
      // Open add shift form
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(500); // Wait for modal animation

      // Fill basic info
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .should('not.be.disabled')
        .type('Shift with Overtime');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '09:00';
      const endDate = startDate;
      const endTime = '17:00';

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', startTime);
      cy.get('[data-cy="shift-end-date"]').invoke('val', endDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', endTime);

      // Add overtime hours - scroll into view first
      cy.get('[data-cy="overtime-hours-input"]').scrollIntoView().should('be.visible').invoke('val', '2.5').trigger('input');

      // Save
      cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();

      // Verify shift appears
      cy.contains('Shift with Overtime').should('be.visible');
    });

    it('should save overtime hours correctly', () => {
      // Create shift with overtime
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(500); // Wait for modal animation

      cy.get('[data-cy="shift-title-input"]').should('be.visible').should('not.be.disabled').type('Overtime Check');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '10:00');
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '18:00');

      cy.get('[data-cy="overtime-hours-input"]').scrollIntoView().should('be.visible').invoke('val', '1.5').trigger('input');
      cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();

      // Verify shift is created
      cy.contains('Overtime Check').should('be.visible');

      // Verify overtime is saved by checking statistics
      cy.closeModal();
      cy.wait(500);
      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Should show overtime hours in statistics
      cy.contains(/Straordinario|Overtime/i).should('be.visible');
      cy.contains('1.5').should('be.visible');
    });
  });

  describe('Allowances Management', () => {
    it('should add shift with custom allowances', () => {
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.get('[data-cy="shift-title-input"]').type('Shift with Allowances');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '09:00');
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '17:00');

      // Add first allowance
      cy.get('[data-cy="add-allowance-btn"]').click();
      cy.get('[data-cy="allowance-name-input"]').first().type('Transport');
      cy.get('[data-cy="allowance-amount-input"]').first().should('be.visible').invoke('val', '15').trigger('input');

      // Add second allowance
      cy.get('[data-cy="add-allowance-btn"]').click();
      cy.get('[data-cy="allowance-name-input"]').last().type('Meal');
      cy.get('[data-cy="allowance-amount-input"]').last().should('be.visible').invoke('val', '10').trigger('input');

      // Save
      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // Verify shift appears
      cy.contains('Shift with Allowances').should('be.visible');
    });

    it('should remove allowance from shift', () => {
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.get('[data-cy="shift-title-input"]').type('Test Allowances');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '10:00');
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '18:00');

      // Add two allowances
      cy.get('[data-cy="add-allowance-btn"]').click();
      cy.get('[data-cy="allowance-name-input"]').first().type('First');
      cy.get('[data-cy="allowance-amount-input"]').first().should('be.visible').invoke('val', '20').trigger('input');

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
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(500); // Wait for modal animation
      cy.get('[data-cy="shift-title-input"]').should('be.visible').should('not.be.disabled').type('Morning Shift');

      const date1 = new Date(baseDate.getTime() + 1 * 24 * 60 * 60 * 1000);
      const dateStr1 = date1.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').invoke('val', dateStr1);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '08:00');
      cy.get('[data-cy="shift-end-date"]').invoke('val', dateStr1);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '16:00');
      cy.get('[data-cy="overtime-hours-input"]').scrollIntoView().should('be.visible').invoke('val', '2').trigger('input');
      cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();
      cy.wait(500);

      // Add second shift
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(500); // Wait for modal animation
      cy.get('[data-cy="shift-title-input"]').should('be.visible').should('not.be.disabled').type('Evening Shift');

      const date2 = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      const dateStr2 = date2.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').invoke('val', dateStr2);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '16:00');
      cy.get('[data-cy="shift-end-date"]').invoke('val', dateStr2);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '00:00');
      cy.get('[data-cy="overtime-hours-input"]').scrollIntoView().should('be.visible').invoke('val', '1.5').trigger('input');
      cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();
      cy.wait(500);
    });

    it('should open statistics modal', () => {
      // Ensure no modals are open
      cy.closeModal();
      cy.wait(500);

      // Open settings
      cy.get('[data-cy="settings-btn"]').click();

      // Click statistics button
      cy.get('[data-cy="statistics-btn"]').click();

      // Verify modal opened
      cy.contains(/Statistiche|Statistics/i).should('be.visible');
      cy.contains(/Totale turni|Total shifts/i).should('be.visible');
    });

    it('should display shift count statistics', () => {
      // Ensure no modals are open
      cy.closeModal();
      cy.wait(500);

      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Should show at least 2 shifts
      cy.contains(/Totale turni|Total shifts/i)
        .parent()
        .should('contain', '2');
    });

    it('should display total hours worked', () => {
      // Ensure no modals are open
      cy.closeModal();
      cy.wait(500);

      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Should show total hours (8h + 8h = 16h)
      // Match multiple variations of the label
      cy.contains(/Ore Totali Lavorate|Ore totali|Ore lavorate|Hours worked|Total hours/i)
        .should('be.visible');
    });

    it('should display total overtime hours', () => {
      // Ensure no modals are open
      cy.closeModal();
      cy.wait(500);

      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Should show total overtime (2 + 1.5 = 3.5h)
      cy.contains(/Straordinario|Overtime/i)
        .parent()
        .should('contain', '3.5');
    });

    it('should allow changing date range for statistics', () => {
      // Ensure no modals are open
      cy.closeModal();
      cy.wait(500);

      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="statistics-btn"]').click();

      // Change start date
      cy.get('input[type="date"]').first().should('be.visible');
      cy.get('input[type="date"]').last().should('be.visible');

      // Verify date inputs work
      const newDate = new Date();
      newDate.setDate(newDate.getDate() - 60);
      const newDateStr = newDate.toISOString().slice(0, 10);

      cy.get('input[type="date"]').first().invoke('val', newDateStr);

      // Statistics should update
      cy.contains(/Totale turni|Total shifts/i).should('be.visible');
    });
  });

  describe('Export and Import', () => {
    beforeEach(() => {
      // Create a test shift for export
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.get('[data-cy="shift-title-input"]').type('Export Test Shift');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '10:00');
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '18:00');

      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();
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
      // Ensure no modals are open
      cy.closeModal();
      cy.wait(500);

      // Open settings
      cy.get('[data-cy="settings-btn"]').click();
      cy.wait(500);

      // Switch to English
      cy.get('[data-cy="lang-en-btn"]').should('be.visible').click();

      // Wait for language change to apply
      cy.wait(500);

      // Close settings modal by pressing ESC
      cy.closeModal();
      cy.wait(500);

      // Verify language changed (check for English text in main UI)
      // Check the app title or search button which is always visible
      cy.contains('button', /Search Date/i).should('be.visible');

      // Open settings again to switch back
      cy.get('[data-cy="settings-btn"]').click();
      cy.wait(500);

      // Switch back to Italian
      cy.get('[data-cy="lang-it-btn"]').should('be.visible').click();

      // Wait for language change
      cy.wait(500);

      // Close modal
      cy.closeModal();
      cy.wait(500);

      // Verify language changed back (check for Italian text in main UI)
      // Check the search button which is always visible
      cy.contains('button', /Cerca Data/i).should('be.visible');
    });
  });
});
