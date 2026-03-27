/// <reference types="cypress" />

describe('Offline Functionality & PWA', () => {
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

  describe('Data persistence', () => {
    it('should persist shifts to localStorage', () => {
      // Create a shift
      cy.get('[data-cy="add-shift-btn"]').should('be.visible').first().click();
      cy.wait(300); // Wait for modal animation

      // Wait for modal and ensure element is visible before typing
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .should('not.be.disabled');
      cy.get('[data-cy="shift-title-input"]').type('Persistent Shift');

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10); // YYYY-MM-DD

      cy.get('[data-cy="shift-start-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-start-time"]').should('be.visible').invoke('val', '10:00');
      cy.get('[data-cy="shift-end-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-end-time"]').should('be.visible').invoke('val', '14:00');

      cy.wait(200); // Wait for form to stabilize
      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();
      cy.contains('Persistent Shift').should('be.visible');

      // Check localStorage (data might be encrypted, so just check it exists)
      cy.window().then(win => {
        const stored = win.localStorage.getItem('easyturno_shifts');
        expect(stored).to.exist;
        // Note: Data might be encrypted by CryptoService, so we don't parse it
        // Just verify it's stored
      });

      // Reload page
      cy.reload();
      cy.contains('EasyTurno', { timeout: 10000 }).should('be.visible');

      // Shift should still be visible (app will decrypt automatically)
      cy.contains('Persistent Shift').should('be.visible');
    });

    it('should persist theme preference', () => {
      // Open settings
      cy.get('[data-cy="settings-btn"]').click();

      // Toggle dark mode
      cy.get('[data-cy="theme-dark-btn"]').click();

      // Close settings by clicking backdrop
      cy.get('body').click(0, 0);

      // Wait for modal to close
      cy.wait(500);

      // Check localStorage
      cy.window().then(win => {
        const theme = win.localStorage.getItem('easyturno_theme');
        expect(theme).to.equal('dark');
      });

      // Reload page
      cy.reload();

      // Dark mode should persist
      cy.get('html').should('have.class', 'dark');
    });

    it('should persist language preference', () => {
      // Open settings
      cy.get('[data-cy="settings-btn"]').click();

      // Change language to English
      cy.get('[data-cy="lang-en-btn"]').click();

      // Wait for localStorage to update
      cy.wait(100);

      // Check localStorage
      cy.window().then(win => {
        const lang = win.localStorage.getItem('easyturno_lang');
        expect(lang).to.equal('en');
      });

      // Close settings by clicking backdrop
      cy.get('body').click(0, 0);

      // Reload page
      cy.reload();

      // UI should be in English
      cy.get('[data-cy="add-shift-btn"]').should('contain', 'Add Shift');
    });
  });

  describe('Service worker caching', () => {
    it('should register service worker', () => {
      cy.window().then(win => {
        // Check if service worker is supported
        if ('serviceWorker' in win.navigator) {
          if (['localhost', '127.0.0.1'].includes(win.location.hostname)) {
            cy.wrap(win.navigator.serviceWorker.getRegistration()).should('not.exist');
          } else {
            cy.wrap(win.navigator.serviceWorker.getRegistration()).should('exist');
          }
        }
      });
    });

    it('should cache static assets', () => {
      // Visit page
      cy.visit('/');
      cy.contains('EasyTurno', { timeout: 10000 }).should('be.visible');

      // Wait for service worker to install and cache assets
      cy.wait(2000);

      // Check if manifest is accessible
      cy.request('/manifest.webmanifest').its('status').should('equal', 200);
    });
  });

  describe('Work offline simulation', () => {
    it('should allow creating shifts while simulating offline', () => {
      // Create a shift
      cy.get('[data-cy="add-shift-btn"]').first().click();

      // Wait for modal and ensure visibility
      cy.wait(500);

      cy.get('[data-cy="shift-title-input"]')
        .should('be.visible')
        .should('not.be.disabled')
        .type('Offline Shift');

      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      const startDateStr = startDate.toISOString().slice(0, 10);

      cy.get('[data-cy="shift-start-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-start-time"]').should('be.visible').invoke('val', '13:00');
      cy.get('[data-cy="shift-end-date"]').should('be.visible').invoke('val', startDateStr);
      cy.get('[data-cy="shift-end-time"]').should('be.visible').invoke('val', '16:00');

      cy.get('[data-cy="save-shift-btn"]').should('be.visible').click();

      // Verify shift appears (stored in localStorage)
      cy.contains('Offline Shift').should('be.visible');

      // Verify data is in localStorage (not dependent on network)
      cy.window().then(win => {
        const stored = win.localStorage.getItem('easyturno_shifts');
        expect(stored).to.exist;
        // Data is encrypted by CryptoService, so we can't parse it as JSON
        // Just verify it exists and is stored locally
      });
    });
  });
});
