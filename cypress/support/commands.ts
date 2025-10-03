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

export {};
