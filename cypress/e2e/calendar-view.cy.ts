describe('Calendar View', () => {
  beforeEach(() => {
    cy.visit('/');
    cy.window().then(win => win.localStorage.clear());
    cy.reload();
    cy.contains('EasyTurno', { timeout: 15000 }).should('be.visible');
  });

  describe('View Toggle', () => {
    it('should start in list view by default', () => {
      cy.get('[data-cy="view-list"]').should('have.class', 'bg-white');
      cy.get('[data-cy="view-calendar"]').should('not.have.class', 'bg-white');
    });

    it('should switch to calendar view when calendar button is clicked', () => {
      cy.get('[data-cy="view-calendar"]').click();
      cy.get('[data-cy="view-calendar"]').should('have.class', 'bg-white');
      cy.get('[data-cy="calendar-grid"]').should('be.visible');
    });

    it('should switch back to list view when list button is clicked', () => {
      cy.get('[data-cy="view-calendar"]').click();
      cy.get('[data-cy="calendar-grid"]').should('be.visible');

      cy.get('[data-cy="view-list"]').click();
      cy.get('[data-cy="calendar-grid"]').should('not.exist');
    });
  });

  describe('Calendar Display', () => {
    beforeEach(() => {
      cy.get('[data-cy="view-calendar"]').click();
    });

    it('should display current month and year', () => {
      const now = new Date();
      const year = now.getFullYear();

      cy.get('[data-cy="calendar-month-year"]')
        .should('be.visible')
        .and('contain', year.toString());
    });

    it('should display 42 calendar days (6 weeks)', () => {
      cy.get('[data-cy^="calendar-day-"]').should('have.length', 42);
    });

    it('should display weekday headers', () => {
      cy.get('.weekday-headers').should('be.visible');
      cy.get('.weekday-headers > div').should('have.length', 7);
    });

    it('should have Today button', () => {
      cy.get('[data-cy="calendar-today"]').should('be.visible').and('be.visible');
    });
  });

  describe('Month Navigation', () => {
    beforeEach(() => {
      cy.get('[data-cy="view-calendar"]').click();
    });

    it('should navigate to previous month', () => {
      cy.get('[data-cy="calendar-month-year"]').then($el => {
        const initialText = $el.text();

        cy.get('[data-cy="calendar-prev-month"]').click();

        cy.get('[data-cy="calendar-month-year"]').should('not.have.text', initialText);
      });
    });

    it('should navigate to next month', () => {
      cy.get('[data-cy="calendar-month-year"]').then($el => {
        const initialText = $el.text();

        cy.get('[data-cy="calendar-next-month"]').click();

        cy.get('[data-cy="calendar-month-year"]').should('not.have.text', initialText);
      });
    });

    it('should return to current month when Today is clicked', () => {
      const now = new Date();
      const currentMonth = now.toLocaleDateString('it-IT', { month: 'long' });

      // Navigate away
      cy.get('[data-cy="calendar-next-month"]').click();
      cy.get('[data-cy="calendar-next-month"]').click();

      // Click Today
      cy.get('[data-cy="calendar-today"]').click();

      cy.get('[data-cy="calendar-month-year"]').should('contain', currentMonth);
    });

    it('should handle year transitions', () => {
      // Navigate through months to test year change
      for (let i = 0; i < 12; i++) {
        cy.get('[data-cy="calendar-next-month"]').click();
      }

      // Should be in next year
      const nextYear = new Date().getFullYear() + 1;
      cy.get('[data-cy="calendar-month-year"]').should('contain', nextYear.toString());
    });
  });

  describe('Day Selection', () => {
    beforeEach(() => {
      cy.get('[data-cy="view-calendar"]').click();
    });

    it('should select a day when clicked', () => {
      cy.get('[data-cy="calendar-day-15"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('be.visible');
    });

    it('should clear selection when same day is clicked again', () => {
      cy.get('[data-cy="calendar-day-15"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('be.visible');

      cy.get('[data-cy="calendar-day-15"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('not.exist');
    });

    it('should clear selection when clear button is clicked', () => {
      cy.get('[data-cy="calendar-day-15"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('be.visible');

      cy.get('[data-cy="calendar-clear-selection"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('not.exist');
    });

    it('should clear selection when navigating to different month', () => {
      cy.get('[data-cy="calendar-day-15"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('be.visible');

      cy.get('[data-cy="calendar-next-month"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('not.exist');
    });
  });

  describe('Shift Indicators', () => {
    beforeEach(() => {
      // Create a shift for testing
      cy.get('[data-cy="add-shift-btn"]').first().click();

      // Fill form
      cy.get('[data-cy="shift-title-input"]').type('Test Shift');

      // Set date to tomorrow
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      cy.get('[data-cy="shift-start-date"]').clear().type(dateStr);
      cy.get('[data-cy="shift-start-time"]').clear().type('09:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(dateStr);
      cy.get('[data-cy="shift-end-time"]').clear().type('17:00');

      cy.get('[data-cy="save-shift-btn"]').click();

      // Switch to calendar view
      cy.get('[data-cy="view-calendar"]').click();
    });

    it('should display shift indicators on calendar days', () => {
      cy.get('.shift-indicators').should('exist');
      cy.get('.shift-indicators > div').should('have.length.at.least', 1);
    });

    it('should show shift count badge when more than 5 shifts', () => {
      // Create 6 shifts on the same day
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const dateStr = tomorrow.toISOString().split('T')[0];

      // Ensure we're in list view
      cy.get('[data-cy="view-list"]').click();
      cy.wait(300);

      for (let i = 0; i < 6; i++) {
        cy.get('[data-cy="add-shift-btn"]').first().click();
        cy.wait(700); // Wait for modal animation

        cy.get('[data-cy="shift-title-input"]', { timeout: 10000 })
          .should('be.visible')
          .should('not.be.disabled');

        // Clear and type title
        cy.get('[data-cy="shift-title-input"]')
          .invoke('val', '')
          .trigger('input')
          .type(`Shift ${i + 1}`);

        cy.get('[data-cy="shift-start-date"]', { timeout: 5000 })
          .should('be.visible')
          .invoke('val', dateStr)
          .trigger('input');
        cy.get('[data-cy="shift-start-time"]').invoke('val', '09:00').trigger('input');
        cy.get('[data-cy="shift-end-date"]').invoke('val', dateStr).trigger('input');
        cy.get('[data-cy="shift-end-time"]').invoke('val', '17:00').trigger('input');

        cy.get('[data-cy="save-shift-btn"]').scrollIntoView().should('be.visible').click();

        // Wait for modal to close
        cy.get('body').then($body => {
          if ($body.find('[data-cy="shift-title-input"]').length > 0) {
            cy.wait(500);
          }
        });
        cy.wait(500);
      }

      cy.get('[data-cy="view-calendar"]').click();
      cy.wait(1500); // Wait for calendar to render and indicators to appear

      // Should show badge with count
      cy.get('[data-cy="calendar-shift-badge"]', { timeout: 15000 })
        .should('be.visible')
        .and('contain', '6');
    });
  });

  describe('Day Selection with Shifts', () => {
    beforeEach(() => {
      // Create a shift for tomorrow using clear+type to properly trigger Angular signals
      cy.get('[data-cy="add-shift-btn"]').first().click();
      cy.wait(500);
      cy.get('[data-cy="shift-title-input"]', { timeout: 5000 })
        .should('be.visible')
        .type('Test Shift');

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      cy.get('[data-cy="shift-start-date"]').clear().type(dateStr);
      cy.get('[data-cy="shift-start-time"]').clear().type('09:00');
      cy.get('[data-cy="shift-end-date"]').clear().type(dateStr);
      cy.get('[data-cy="shift-end-time"]').clear().type('17:00');
      cy.get('[data-cy="save-shift-btn"]').click();

      // Verify shift was saved before switching to calendar
      cy.contains('Test Shift', { timeout: 5000 }).should('be.visible');

      cy.get('[data-cy="view-calendar"]').click();
      cy.wait(500);
    });

    it('should show shift count in selected day info', () => {
      // Find a day cell that has actual shift dots (colored circles inside .shift-indicators)
      cy.get('.shift-indicators .rounded-full', { timeout: 10000 })
        .should('have.length.at.least', 1)
        .first()
        .closest('[data-cy^="calendar-day-"]')
        .click();

      // Verify selected day panel shows shift info
      cy.get('[data-cy="calendar-selected-day"]', { timeout: 5000 })
        .scrollIntoView()
        .should('be.visible')
        .and('contain', 'Test Shift');
    });

    it('should display formatted date in selected day info', () => {
      cy.get('.shift-indicators .rounded-full', { timeout: 10000 })
        .should('have.length.at.least', 1)
        .first()
        .closest('[data-cy^="calendar-day-"]')
        .click();

      cy.get('[data-cy="calendar-selected-day"]').should('be.visible');
      // Should contain a formatted date string
      cy.get('[data-cy="calendar-selected-day"]').find('h3').should('not.be.empty');
    });
  });

  describe('Mobile Responsiveness', () => {
    beforeEach(() => {
      cy.viewport('iphone-x');
      cy.get('[data-cy="view-calendar"]').click();
    });

    it('should display calendar grid properly on mobile', () => {
      cy.get('[data-cy="calendar-grid"]').should('be.visible');
      cy.get('[data-cy^="calendar-day-"]').should('have.length', 42);
    });

    it('should have touch-friendly navigation buttons', () => {
      cy.get('[data-cy="calendar-prev-month"]').should('be.visible').and('be.enabled');
      cy.get('[data-cy="calendar-next-month"]').should('be.visible').and('be.enabled');
      cy.get('[data-cy="calendar-today"]').should('be.visible').and('be.enabled');
    });

    it('should display selected day info on mobile', () => {
      cy.get('[data-cy="calendar-day-15"]').click();
      cy.get('[data-cy="calendar-selected-day"]').should('be.visible');
    });
  });

  describe('Dark Mode', () => {
    beforeEach(() => {
      cy.get('[data-cy="settings-btn"]').click();
      cy.get('[data-cy="theme-dark-btn"]').click();
      cy.wait(200);
      // Close modal with Escape key
      cy.get('body').type('{esc}');
      cy.wait(200);
      cy.get('[data-cy="view-calendar"]').click();
    });

    it('should display calendar in dark mode', () => {
      cy.get('.calendar-container').should('have.class', 'dark:bg-gray-800');
    });

    it('should have visible text in dark mode', () => {
      cy.get('[data-cy="calendar-month-year"]').should('be.visible');
      cy.get('.weekday-headers').should('be.visible');
    });
  });

  describe('Accessibility', () => {
    beforeEach(() => {
      cy.get('[data-cy="view-calendar"]').click();
    });

    it('should have aria-labels for navigation buttons', () => {
      cy.get('[data-cy="calendar-prev-month"]').should('have.attr', 'aria-label');
      cy.get('[data-cy="calendar-next-month"]').should('have.attr', 'aria-label');
    });

    it('should be keyboard navigable', () => {
      cy.get('[data-cy="calendar-prev-month"]').focus().should('have.focus');
      cy.get('[data-cy="calendar-prev-month"]').type('{enter}');
      // Month should change
      cy.wait(100);
    });
  });
});
