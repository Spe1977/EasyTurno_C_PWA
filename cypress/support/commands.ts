/// <reference types="cypress" />

// ***********************************************
// Custom commands for EasyTurno E2E tests
// ***********************************************

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to add a shift through the UI
       */
      addShift(title: string, start: string, end: string): Chainable<void>;

      /**
       * Custom command to open settings modal
       */
      openSettings(): Chainable<void>;

      /**
       * Custom command to close modals by pressing Escape key safely
       */
      closeModal(): Chainable<void>;

      /**
       * Visit app and wait for Angular to be fully interactive
       */
      visitApp(): Chainable<void>;
    }
  }
}

Cypress.Commands.add('addShift', (title: string, start: string, end: string) => {
  cy.get('button').contains('Aggiungi Turno').click();
  cy.get('input[name="title"]').type(title);
  cy.get('input[type="datetime-local"]').first().type(start);
  cy.get('input[type="datetime-local"]').last().type(end);
  cy.get('button').contains('Salva').click();
});

Cypress.Commands.add('openSettings', () => {
  cy.get('button[aria-label*="Settings"], button[aria-label*="Impostazioni"]').click();
});

Cypress.Commands.add('visitApp', () => {
  cy.visit('/');
  // Wait for Angular to render translated content (proves full bootstrap)
  cy.contains('EasyTurno', { timeout: 15000 }).should('be.visible');
  // Verify the add-shift button is interactive (Angular event binding complete)
  cy.get('[data-cy="add-shift-btn"]', { timeout: 10000 }).should('exist');
});

Cypress.Commands.add('closeModal', () => {
  // Use Cypress's built-in type command which is compatible with Cypress 15+
  cy.get('body').type('{esc}', { force: true });
});

export {};
