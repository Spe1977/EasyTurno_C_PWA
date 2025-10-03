/// <reference types="cypress" />

describe('Shift Management - Core Flows', () => {
  beforeEach(() => {
    cy.clearLocalStorage();
    cy.visit('/');
    // Wait for app to load
    cy.contains('EasyTurno', { timeout: 10000 }).should('be.visible');
  });

  describe('Create single shift', () => {
    it('should create a new shift successfully', () => {
      // Click "Add Shift" button
      cy.get('[data-cy="add-shift-btn"]').click();

      // Fill form
      cy.get('[data-cy="shift-title-input"]').type('Turno Mattina');

      // Set start datetime
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD
      cy.get('[data-cy="shift-start-date"]').clear().type(startDateStr);
      cy.get('[data-cy="shift-start-time"]').clear().type('08:00');

      // Set end datetime (4 hours later)
      cy.get('[data-cy="shift-end-date"]').clear().type(startDateStr);
      cy.get('[data-cy="shift-end-time"]').clear().type('12:00');

      // Save
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify shift appears in list
      cy.contains('Turno Mattina').should('be.visible');
    });

    it('should display error if title is missing', () => {
      cy.get('[data-cy="add-shift-btn"]').click();

      // Try to save without title
      cy.get('[data-cy="save-shift-btn"]').click();

      // Modal should still be visible (validation failed)
      cy.get('[role="dialog"]').should('be.visible');
    });
  });

  describe('Edit shift', () => {
    beforeEach(() => {
      // Create a shift first
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('Original Shift');

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10);
      cy.get('[data-cy="shift-start-date"]').clear().type(startDateStr);
      cy.get('[data-cy="shift-start-time"]').clear().type('10:00');

      cy.get('[data-cy="shift-end-date"]').clear().type(startDateStr);
      cy.get('[data-cy="shift-end-time"]').clear().type('12:00');

      cy.get('[data-cy="save-shift-btn"]').click();
      cy.contains('Original Shift').should('be.visible');
    });

    it('should edit a shift successfully', () => {
      // Click edit button on shift card
      cy.get('[data-cy="edit-shift-btn"]').first().click();

      // Edit title
      cy.get('[data-cy="shift-title-input"]').clear().type('Updated Shift');

      // Save
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify updated shift appears
      cy.contains('Updated Shift').should('be.visible');
      cy.contains('Original Shift').should('not.exist');
    });
  });

  describe('Delete shift', () => {
    beforeEach(() => {
      // Create a shift
      cy.get('[data-cy="add-shift-btn"]').click();
      cy.get('[data-cy="shift-title-input"]').type('To Delete');

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10);
      cy.get('[data-cy="shift-start-date"]').clear().type(startDateStr);
      cy.get('[data-cy="shift-start-time"]').clear().type('14:00');

      cy.get('[data-cy="shift-end-date"]').clear().type(startDateStr);
      cy.get('[data-cy="shift-end-time"]').clear().type('17:00');

      cy.get('[data-cy="save-shift-btn"]').click();
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
