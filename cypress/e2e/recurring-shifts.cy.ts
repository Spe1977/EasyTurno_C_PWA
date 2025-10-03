/// <reference types="cypress" />

describe('Recurring Shifts', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    cy.contains('EasyTurno', { timeout: 10000 }).should('be.visible');
  });

  describe('Create recurring shift (daily)', () => {
    it('should create daily recurring shifts', () => {
      cy.get('[data-cy="add-shift-btn"]').click();

      // Fill basic info
      cy.get('[data-cy="shift-title-input"]').type('Daily Work');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '09:00';
      const endTime = '17:00';

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type(startTime);
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type(endTime);

      // Enable recurring
      cy.get('[data-cy="recurring-checkbox"]').check();

      // Set frequency to daily (Giornaliera in Italian)
      cy.get('[data-cy="frequency-select"]').select('days');

      // Set interval
      cy.get('[data-cy="interval-select"]').select('1');

      // Save
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify multiple instances appear
      cy.contains('Daily Work').should('be.visible');
      // Should create multiple instances (at least 2)
      cy.get(':contains("Daily Work")').should('have.length.at.least', 2);
    });
  });

  describe('Create recurring shift (weekly)', () => {
    it('should create weekly recurring shifts', () => {
      cy.get('[data-cy="add-shift-btn"]').click();

      cy.get('[data-cy="shift-title-input"]').type('Weekly Meeting');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '10:00';
      const endTime = '12:00';

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type(startTime);
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type(endTime);

      // Enable recurring
      cy.get('[data-cy="recurring-checkbox"]').check();

      // Set frequency to weekly (Settimanale in Italian)
      cy.get('[data-cy="frequency-select"]').select('weeks');

      // Save
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify shift appears
      cy.contains('Weekly Meeting').should('be.visible');
    });
  });

  describe('Edit single instance', () => {
    beforeEach(() => {
      // Create a recurring shift
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Recurring Task');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '11:00';
      const endTime = '12:00';

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type(startTime);
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type(endTime);

      cy.get('[data-cy="recurring-checkbox"]').check();
      cy.get('[data-cy="frequency-select"]').select('days');

      cy.get('[data-cy="save-shift-btn"]').click();
      cy.contains('Recurring Task', { timeout: 5000 }).should('be.visible');
    });

    it('should edit only single instance when confirmed', () => {
      // Click edit on first instance
      cy.contains('Recurring Task')
        .first()
        .parents('[class*="border-l-"], .shift-card')
        .find('[data-cy="edit-shift-btn"]')
        .first()
        .click();

      // Should show confirmation dialog
      cy.contains(/Solo questo|Only this|Tutta la serie|Entire series/i, { timeout: 5000 }).should(
        'be.visible'
      );

      // Choose "only this"
      cy.contains('button', /Solo questo|Only this/i).click();

      // Edit the title
      cy.get('[data-cy="shift-title-input"]').clear().type('Modified Instance');

      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify one instance is modified
      cy.contains('Modified Instance').should('be.visible');
      // Other instances should still exist
      cy.contains('Recurring Task').should('be.visible');
    });
  });

  describe('Delete entire series', () => {
    beforeEach(() => {
      // Create recurring shift
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Series to Delete');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '15:00';
      const endTime = '17:00';

      cy.get('[data-cy="shift-start-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-start-time"]').clear().type(startTime);
      cy.get('[data-cy="shift-end-date"]').clear().type(startDate);
      cy.get('[data-cy="shift-end-time"]').clear().type(endTime);

      cy.get('[data-cy="recurring-checkbox"]').check();
      cy.get('[data-cy="frequency-select"]').select('days');

      cy.get('[data-cy="save-shift-btn"]').click();
      cy.contains('Series to Delete', { timeout: 5000 }).should('be.visible');
    });

    it('should delete entire series when confirmed', () => {
      // Get initial count
      cy.get(':contains("Series to Delete")').then($els => {
        const initialCount = $els.length;
        expect(initialCount).to.be.at.least(2);

        // Click delete on first instance
        cy.contains('Series to Delete')
          .first()
          .parents('[class*="border-l-"], .shift-card')
          .find('[data-cy="delete-shift-btn"]')
          .first()
          .click();

        // Should show confirmation dialog
        cy.contains(/Solo questo|Only this|Tutta la serie|Entire series/i, {
          timeout: 5000,
        }).should('be.visible');

        // Choose "entire series"
        cy.contains('button', /Tutta la serie|Entire series/i).click();

        // Confirm deletion
        cy.contains('button', /Elimina|Delete/i).click();

        // All instances should be removed
        cy.contains('Series to Delete').should('not.exist');
      });
    });
  });
});
