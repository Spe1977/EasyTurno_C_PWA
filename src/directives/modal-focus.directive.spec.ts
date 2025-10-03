import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, DebugElement } from '@angular/core';
import { By } from '@angular/platform-browser';
import { ModalFocusDirective } from './modal-focus.directive';

@Component({
  template: `
    <div appModalFocus>
      <button id="first-btn">First Button</button>
      <input id="input-field" type="text" />
      <button id="last-btn">Last Button</button>
    </div>
  `,
  standalone: true,
  imports: [ModalFocusDirective],
})
class TestModalComponent {}

@Component({
  template: `
    <div appModalFocus>
      <button id="only-btn">Only Button</button>
    </div>
  `,
  standalone: true,
  imports: [ModalFocusDirective],
})
class TestSingleElementComponent {}

@Component({
  template: `
    <div appModalFocus>
      <p>No focusable elements</p>
    </div>
  `,
  standalone: true,
  imports: [ModalFocusDirective],
})
class TestNoFocusableComponent {}

@Component({
  template: `
    <div appModalFocus>
      <button disabled>Disabled Button</button>
      <button id="enabled-btn">Enabled Button</button>
      <input disabled type="text" />
      <input id="enabled-input" type="text" />
    </div>
  `,
  standalone: true,
  imports: [ModalFocusDirective],
})
class TestDisabledElementsComponent {}

describe('ModalFocusDirective', () => {
  let fixture: ComponentFixture<TestModalComponent>;
  let directiveElement: DebugElement;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [TestModalComponent, ModalFocusDirective],
    });
  });

  describe('Initialization and focus management', () => {
    it('should create directive instance', () => {
      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      directiveElement = fixture.debugElement.query(By.directive(ModalFocusDirective));
      expect(directiveElement).toBeTruthy();
    });

    it('should focus first focusable element on init', done => {
      // Store reference to active element before modal opens
      const initialElement = document.createElement('button');
      initialElement.id = 'initial-element';
      document.body.appendChild(initialElement);
      initialElement.focus();

      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      // Wait for setTimeout in ngOnInit
      setTimeout(() => {
        const firstButton = fixture.nativeElement.querySelector('#first-btn') as HTMLElement;
        expect(document.activeElement).toBe(firstButton);
        document.body.removeChild(initialElement);
        done();
      }, 10);
    });

    it('should restore previous focus on destroy', done => {
      const previousElement = document.createElement('button');
      previousElement.id = 'previous-element';
      document.body.appendChild(previousElement);
      previousElement.focus();

      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      // Wait for ngOnInit to complete
      setTimeout(() => {
        // Destroy the component
        fixture.destroy();

        // Check if focus was restored
        expect(document.activeElement).toBe(previousElement);
        document.body.removeChild(previousElement);
        done();
      }, 10);
    });

    it('should handle null previouslyFocusedElement gracefully', done => {
      fixture = TestBed.createComponent(TestModalComponent);

      // Simulate case where document.activeElement is not focusable
      Object.defineProperty(document, 'activeElement', {
        value: null,
        configurable: true,
      });

      fixture.detectChanges();

      setTimeout(() => {
        // Destroy should not throw error even with null previouslyFocusedElement
        expect(() => fixture.destroy()).not.toThrow();

        // Restore original activeElement
        Object.defineProperty(document, 'activeElement', {
          value: document.body,
          configurable: true,
        });

        done();
      }, 10);
    });
  });

  describe('Tab key focus trap', () => {
    it('should trap focus with Tab key (forward)', done => {
      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      setTimeout(() => {
        const lastButton = fixture.nativeElement.querySelector('#last-btn') as HTMLElement;
        const firstButton = fixture.nativeElement.querySelector('#first-btn') as HTMLElement;

        // Spy on focus methods
        const firstFocusSpy = jest.spyOn(firstButton, 'focus');

        // Mock activeElement to be lastButton
        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          get: () => lastButton,
        });

        // Press Tab
        const tabEvent = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        });

        const directiveEl = fixture.debugElement.query(By.directive(ModalFocusDirective));
        directiveEl.nativeElement.dispatchEvent(tabEvent);

        // Should focus first element
        expect(firstFocusSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should trap focus with Shift+Tab key (backward)', done => {
      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      setTimeout(() => {
        const firstButton = fixture.nativeElement.querySelector('#first-btn') as HTMLElement;
        const lastButton = fixture.nativeElement.querySelector('#last-btn') as HTMLElement;

        // Spy on focus methods
        const lastFocusSpy = jest.spyOn(lastButton, 'focus');

        // Mock activeElement to be firstButton
        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          get: () => firstButton,
        });

        // Press Shift+Tab
        const shiftTabEvent = new KeyboardEvent('keydown', {
          key: 'Tab',
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        });

        const directiveEl = fixture.debugElement.query(By.directive(ModalFocusDirective));
        directiveEl.nativeElement.dispatchEvent(shiftTabEvent);

        // Should focus last element
        expect(lastFocusSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should not trap focus when Tab is pressed on middle element', done => {
      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      setTimeout(() => {
        const inputField = fixture.nativeElement.querySelector('#input-field') as HTMLElement;

        // Mock activeElement to be inputField (middle element)
        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          get: () => inputField,
        });

        // Press Tab
        const tabEvent = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        });

        const directiveEl = fixture.debugElement.query(By.directive(ModalFocusDirective));
        const preventDefaultSpy = jest.spyOn(tabEvent, 'preventDefault');
        directiveEl.nativeElement.dispatchEvent(tabEvent);

        // Should NOT prevent default (let browser handle normal tab)
        expect(preventDefaultSpy).not.toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should handle single focusable element', done => {
      const singleFixture = TestBed.createComponent(TestSingleElementComponent);
      singleFixture.detectChanges();

      setTimeout(() => {
        const onlyButton = singleFixture.nativeElement.querySelector('#only-btn') as HTMLElement;

        // Spy on focus
        const focusSpy = jest.spyOn(onlyButton, 'focus');

        // Mock activeElement to be onlyButton
        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          get: () => onlyButton,
        });

        // Press Tab
        const tabEvent = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        });

        const directiveEl = singleFixture.debugElement.query(By.directive(ModalFocusDirective));
        directiveEl.nativeElement.dispatchEvent(tabEvent);

        // Should trap focus to itself
        expect(focusSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should handle no focusable elements gracefully', done => {
      const noFocusFixture = TestBed.createComponent(TestNoFocusableComponent);
      noFocusFixture.detectChanges();

      setTimeout(() => {
        // Press Tab
        const tabEvent = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        });

        const directiveEl = noFocusFixture.debugElement.query(By.directive(ModalFocusDirective));

        // Should not throw error
        expect(() => directiveEl.nativeElement.dispatchEvent(tabEvent)).not.toThrow();
        done();
      }, 10);
    });
  });

  describe('Escape key handling', () => {
    it('should allow Escape key to propagate', done => {
      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      setTimeout(() => {
        const escapeEvent = new KeyboardEvent('keydown', {
          key: 'Escape',
          bubbles: true,
          cancelable: true,
        });

        const directiveEl = fixture.debugElement.query(By.directive(ModalFocusDirective));
        const preventDefaultSpy = jest.spyOn(escapeEvent, 'preventDefault');

        directiveEl.nativeElement.dispatchEvent(escapeEvent);

        // Escape should not be prevented (parent component handles it)
        expect(preventDefaultSpy).not.toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  describe('Disabled elements handling', () => {
    it('should skip disabled elements when finding focusable elements', done => {
      const disabledFixture = TestBed.createComponent(TestDisabledElementsComponent);

      const enabledButton = disabledFixture.nativeElement.querySelector(
        '#enabled-btn'
      ) as HTMLElement;

      // Spy on focus BEFORE detectChanges (before ngOnInit runs)
      const focusSpy = jest.spyOn(enabledButton, 'focus');

      disabledFixture.detectChanges();

      setTimeout(() => {
        // Should have focused first enabled element during ngOnInit, skipping disabled ones
        expect(focusSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    it('should only trap focus between enabled elements', done => {
      const disabledFixture = TestBed.createComponent(TestDisabledElementsComponent);
      disabledFixture.detectChanges();

      setTimeout(() => {
        const enabledInput = disabledFixture.nativeElement.querySelector(
          '#enabled-input'
        ) as HTMLElement;
        const enabledButton = disabledFixture.nativeElement.querySelector(
          '#enabled-btn'
        ) as HTMLElement;

        // Spy on focus
        const buttonFocusSpy = jest.spyOn(enabledButton, 'focus');

        // Mock activeElement to be last enabled element
        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          get: () => enabledInput,
        });

        // Press Tab
        const tabEvent = new KeyboardEvent('keydown', {
          key: 'Tab',
          bubbles: true,
          cancelable: true,
        });

        const directiveEl = disabledFixture.debugElement.query(By.directive(ModalFocusDirective));
        directiveEl.nativeElement.dispatchEvent(tabEvent);

        // Should wrap to first enabled element
        expect(buttonFocusSpy).toHaveBeenCalled();
        done();
      }, 10);
    });
  });

  describe('Edge cases', () => {
    it('should handle rapid Tab key presses', done => {
      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      setTimeout(() => {
        const firstButton = fixture.nativeElement.querySelector('#first-btn') as HTMLElement;
        const lastButton = fixture.nativeElement.querySelector('#last-btn') as HTMLElement;

        // Spy on focus
        const firstFocusSpy = jest.spyOn(firstButton, 'focus');

        // Mock activeElement to be lastButton
        Object.defineProperty(document, 'activeElement', {
          configurable: true,
          get: () => lastButton,
        });

        // Simulate rapid Tab presses
        const directiveEl = fixture.debugElement.query(By.directive(ModalFocusDirective));

        for (let i = 0; i < 5; i++) {
          const tabEvent = new KeyboardEvent('keydown', {
            key: 'Tab',
            bubbles: true,
            cancelable: true,
          });
          directiveEl.nativeElement.dispatchEvent(tabEvent);
        }

        // Should have called focus on first button multiple times
        expect(firstFocusSpy).toHaveBeenCalled();
        expect(firstFocusSpy.mock.calls.length).toBeGreaterThanOrEqual(1);
        done();
      }, 10);
    });

    it('should handle other keyboard events without errors', done => {
      fixture = TestBed.createComponent(TestModalComponent);
      fixture.detectChanges();

      setTimeout(() => {
        const directiveEl = fixture.debugElement.query(By.directive(ModalFocusDirective));

        const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
        const spaceEvent = new KeyboardEvent('keydown', { key: ' ', bubbles: true });
        const arrowEvent = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });

        // Should not throw errors for other keys
        expect(() => directiveEl.nativeElement.dispatchEvent(enterEvent)).not.toThrow();
        expect(() => directiveEl.nativeElement.dispatchEvent(spaceEvent)).not.toThrow();
        expect(() => directiveEl.nativeElement.dispatchEvent(arrowEvent)).not.toThrow();
        done();
      }, 10);
    });
  });
});
