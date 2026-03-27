/// <reference types="cypress" />

describe('Recurring Shifts', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.window().then(win => win.localStorage.clear());
    cy.reload();
    cy.contains('EasyTurno', { timeout: 15000 }).should('be.visible');
  });

  afterEach(() => {
    // Close any open modals
    cy.closeModal();
    cy.wait(300);
  });

  describe('Create recurring shift (daily)', () => {
    it('should create daily recurring shifts', () => {
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(500); // Wait for modal animation

      // Wait for modal and ensure form input is ready
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .should('not.be.disabled');
      cy.get('[data-cy="shift-title-input"]').type('Daily Work');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '09:00';
      const endTime = '17:00';

      cy.get('[data-cy="shift-start-date"]').should('be.visible').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').should('be.visible').invoke('val', startTime);
      cy.get('[data-cy="shift-end-date"]').should('be.visible').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').should('be.visible').invoke('val', endTime);

      // Enable recurring
      cy.get('[data-cy="recurring-checkbox"]').check().trigger('change');
      cy.wait(1000); // Wait longer for @if block to render

      // Set frequency to daily (Giornaliera in Italian)
      cy.get('[data-cy="frequency-select"]', { timeout: 10000 })
        .should('be.visible')
        .should('not.be.disabled');
      cy.get('[data-cy="frequency-select"]').select('days');

      // Set interval
      cy.get('[data-cy="interval-select"]').should('be.visible');
      cy.get('[data-cy="interval-select"]').select('1');

      // Save
      cy.wait(200); // Wait for form to stabilize
      cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();

      // Wait for recurring shifts to be created
      cy.wait(3000);

      // Verify multiple instances appear
      cy.contains('Daily Work', { timeout: 10000 }).should('be.visible');
      // Should create multiple instances (at least 2)
      cy.get(':contains("Daily Work")').should('have.length.at.least', 2);
    });
  });

  describe('Create recurring shift (weekly)', () => {
    it('should create weekly recurring shifts', () => {
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();

      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .type('Weekly Meeting');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 10, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '10:00';
      const endTime = '12:00';

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', startTime);
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', endTime);

      // Enable recurring
      cy.get('[data-cy="recurring-checkbox"]').check().trigger('change');
      cy.wait(1000); // Wait longer for @if block to render

      // Set frequency to weekly (Settimanale in Italian)
      cy.get('[data-cy="frequency-select"]', { timeout: 10000 })
        .should('be.visible')
        .should('not.be.disabled')
        .select('weeks');

      // Save
      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // Verify shift appears
      cy.contains('Weekly Meeting').should('be.visible');
    });
  });

  describe('Edit single instance', () => {
    beforeEach(() => {
      // Create a recurring shift
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(300); // Wait for modal animation

      // Wait for modal to be visible
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .should('not.be.disabled');
      cy.get('[data-cy="shift-title-input"]').type('Recurring Task');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 11, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '11:00';
      const endTime = '12:00';

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', startTime);
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', endTime);

      cy.get('[data-cy="recurring-checkbox"]').check().trigger('change');
      cy.wait(1000); // Wait longer for @if block to render
      cy.get('[data-cy="frequency-select"]', { timeout: 10000 })
        .should('be.visible')
        .should('not.be.disabled')
        .scrollIntoView();
      cy.wait(300);
      cy.get('[data-cy="frequency-select"]').select('days');

      cy.wait(200); // Wait for form to stabilize
      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // Wait longer for recurring shifts to be created and rendered
      cy.wait(2000);

      // Verify shifts are visible before proceeding
      cy.contains('Recurring Task', { timeout: 10000 }).should('be.visible');
      cy.get(':contains("Recurring Task")').should('have.length.at.least', 2);
    });

    it('should edit only single instance when confirmed', () => {
      // Click edit on first instance - find parent and then edit button
      cy.contains('Recurring Task')
        .first()
        .parent()
        .parent()
        .find('[data-cy="edit-shift-btn"]')
        .first()
        .click();

      // Wait for form to open
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 }).should('be.visible');

      // Edit the title
      cy.get('[data-cy="shift-title-input"]').clear().type('Modified Instance');

      // Save - this will trigger the confirmation dialog for recurring shifts
      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // NOW the confirmation dialog should appear
      cy.contains(/Solo questo evento|Just this event/i, { timeout: 5000 }).should(
        'be.visible'
      );

      // Choose "only this occurrence"
      cy.contains('button', /Solo questo evento|Just this event/i).click();

      // Verify one instance is modified
      cy.contains('Modified Instance').should('be.visible');
      // Other instances should still exist
      cy.contains('Recurring Task').should('be.visible');
    });
  });

  describe('Delete entire series', () => {
    beforeEach(() => {
      // Create recurring shift
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();

      // Wait for modal to be visible
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .type('Series to Delete');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 15, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '15:00';
      const endTime = '17:00';

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', startTime);
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', endTime);

      cy.get('[data-cy="recurring-checkbox"]').check().trigger('change');
      cy.wait(1000); // Wait longer for @if block to render
      cy.get('[data-cy="frequency-select"]', { timeout: 10000 })
        .should('be.visible')
        .should('not.be.disabled')
        .select('days');

      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // Wait longer for recurring shifts to be created and rendered
      cy.wait(2000);

      // Verify shifts are visible before proceeding
      cy.contains('Series to Delete', { timeout: 10000 }).should('be.visible');
      cy.get(':contains("Series to Delete")').should('have.length.at.least', 2);
    });

    it('should delete entire series when confirmed', () => {
      // Get initial count
      cy.get(':contains("Series to Delete")').then($els => {
        const initialCount = $els.length;
        expect(initialCount).to.be.at.least(2);

        // Click delete on first instance - find parent and then delete button
        cy.contains('Series to Delete')
          .first()
          .parent()
          .parent()
          .find('[data-cy="delete-shift-btn"]')
          .first()
          .click();

        // Should show confirmation dialog
        cy.contains(/Solo questo|Only this|Tutta la serie|Entire series/i, {
          timeout: 5000,
        }).should('be.visible');

        // Choose "entire series" - this will delete immediately, no second confirmation
        cy.contains('button', /Tutta la serie|Entire series/i).click();

        // All instances should be removed (wait for deletion to process)
        cy.wait(500);
        cy.contains('Series to Delete').should('not.exist');
      });
    });
  });

  describe('Edit middle instance of recurring series', () => {
    beforeEach(() => {
      // Create a recurring shift with daily frequency
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(500); // Wait for modal animation

      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .should('not.be.disabled')
        .type('Daily Series');

      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 9, 0);
      const startDate = start.toISOString().slice(0, 10);
      const startTime = '09:00';
      const endTime = '17:00';

      cy.get('[data-cy="shift-start-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-start-time"]').invoke('val', startTime);
      cy.get('[data-cy="shift-end-date"]').invoke('val', startDate);
      cy.get('[data-cy="shift-end-time"]').invoke('val', endTime);

      cy.get('[data-cy="recurring-checkbox"]').check().trigger('change');
      cy.wait(1000); // Wait longer for @if block to render
      cy.get('[data-cy="frequency-select"]', { timeout: 10000 })
        .scrollIntoView()
        .should('be.visible')
        .should('not.be.disabled')
        .select('days');
      cy.wait(300);
      cy.get('[data-cy="interval-select"]')
        .scrollIntoView()
        .should('be.visible')
        .should('not.be.disabled')
        .select('1');

      cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();

      cy.wait(4000); // Wait longer for recurring shifts generation
      cy.contains('Daily Series', { timeout: 10000 }).should('be.visible');
    });

    it('should preserve previous shifts when editing middle instance of series', () => {
      // Count initial shifts using data-cy selector and filter
      cy.get('[data-cy="shift-title"]')
        .filter(':contains("Daily Series")')
        .should('have.length.at.least', 4);

      // Click edit on the 4th shift (index 3)
      cy.get('[data-cy="shift-title"]')
        .filter(':contains("Daily Series")')
        .eq(3)
        .parents('div.rounded-xl')
        .first()
        .find('[data-cy="edit-shift-btn"]')
        .click();

      // Wait for form to open
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .should('not.be.disabled');

      // Change the title
      cy.get('[data-cy="shift-title-input"]')
        .invoke('val', '')
        .trigger('input')
        .type('Modified Series');

      // Save
      cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();

      // Should show confirmation dialog
      cy.contains(/Solo questo|Only this|Tutta la serie|Entire series/i, {
        timeout: 5000,
      }).should('be.visible');

      // Choose "entire series"
      cy.contains('button', /Tutta la serie|Entire series/i).click();

      cy.wait(2000); // Wait for series update

      // Verify that the first 3 shifts still have the original title
      cy.get('[data-cy="shift-title"]')
        .filter(':contains("Daily Series")')
        .should('have.length.at.least', 3);

      // Verify that shifts from the 4th onwards have the new title
      cy.get('[data-cy="shift-title"]')
        .filter(':contains("Modified Series")')
        .should('have.length.at.least', 1);
    });
  });
});
