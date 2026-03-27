/// <reference types="cypress" />

describe('Shift Management - Core Flows', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.window().then(win => win.localStorage.clear());
    cy.reload();
    cy.contains('EasyTurno', { timeout: 15000 }).should('be.visible');
  });

  describe('Create single shift', () => {
    it('should create a new shift successfully', () => {
      // Click "Add Shift" button (use first() since there are 2 buttons with same data-cy)
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(300); // Wait for modal animation

      // Wait for modal to open and input to be enabled
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .should('not.be.disabled');
      cy.get('[data-cy="shift-title-input"]').type('Turno Mattina');

      // Set start datetime
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD
      cy.get('[data-cy="shift-start-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-start-time"]').should('be.visible').invoke('val', '08:00');

      // Set end datetime (4 hours later)
      cy.get('[data-cy="shift-end-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-end-time"]').should('be.visible').invoke('val', '12:00');

      // Save
      cy.wait(200); // Wait for form to stabilize
      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // Verify shift appears in list
      cy.contains('Turno Mattina').should('be.visible');
    });

    it('should display error if title is missing', () => {
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(300); // Wait for modal animation

      // Wait for modal to open
      cy.get('[data-cy="shift-start-date"]', { timeout: 5000 }).should('be.visible');

      // Fill dates to avoid other validation errors
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10);
      cy.get('[data-cy="shift-start-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-start-time"]').should('be.visible').invoke('val', '08:00');
      cy.get('[data-cy="shift-end-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-end-time"]').should('be.visible').invoke('val', '12:00');

      // Try to save without filling title
      cy.wait(200); // Wait for form to stabilize
      cy.get('[data-cy="save-shift-btn"]').should('be.visible');
      cy.get('[data-cy="save-shift-btn"]').click();

      // Toast error should appear with validation message
      cy.contains(/Il titolo è obbligatorio|Title is required/i, { timeout: 5000 }).should(
        'be.visible'
      );
    });
  });

  describe('Edit shift', () => {
    beforeEach(() => {
      // Create a shift first
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();

      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .type('Original Shift');

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10);
      cy.get('[data-cy="shift-start-date"]').invoke('val', startDateStr);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '10:00');

      cy.get('[data-cy="shift-end-date"]').invoke('val', startDateStr);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '12:00');

      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();
      cy.contains('Original Shift').should('be.visible');
    });

    it('should edit a shift successfully', () => {
      // Click edit button on shift card
      cy.get('[data-cy="edit-shift-btn"]').first().click();

      // Edit title
      cy.get('[data-cy="shift-title-input"]').clear().type('Updated Shift');

      // Save
      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // Verify updated shift appears
      cy.contains('Updated Shift').should('be.visible');
      cy.contains('Original Shift').should('not.exist');
    });
  });

  describe('Delete shift', () => {
    beforeEach(() => {
      // Create a shift
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();

      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .type('To Delete');

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10);
      cy.get('[data-cy="shift-start-date"]').invoke('val', startDateStr);
      cy.get('[data-cy="shift-start-time"]').invoke('val', '14:00');

      cy.get('[data-cy="shift-end-date"]').invoke('val', startDateStr);
      cy.get('[data-cy="shift-end-time"]').invoke('val', '17:00');

      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();
      cy.contains('To Delete').should('be.visible');
    });

    it('should delete a shift after confirmation', () => {
      // Click delete button on shift card
      cy.get('[data-cy="delete-shift-btn"]').first().click();

      // Confirm deletion in dialog
      cy.contains('button', /Elimina|Delete/i).click();

      // Verify shift is removed
      cy.contains('To Delete').should('not.exist');
    });
  });
});
