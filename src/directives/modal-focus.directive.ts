import { Directive, ElementRef, OnInit, OnDestroy, HostListener } from '@angular/core';

@Directive({
  selector: '[appModalFocus]',
  standalone: true,
})
export class ModalFocusDirective implements OnInit, OnDestroy {
  private previouslyFocusedElement: HTMLElement | null = null;
  private focusableElements: HTMLElement[] = [];

  constructor(private elementRef: ElementRef<HTMLElement>) {}

  ngOnInit(): void {
    // Store the currently focused element to restore it later
    this.previouslyFocusedElement = document.activeElement as HTMLElement;

    // Wait for the modal to be fully rendered
    setTimeout(() => {
      this.updateFocusableElements();
      this.focusFirstElement();
    }, 0);
  }

  ngOnDestroy(): void {
    // Restore focus to the previously focused element
    if (
      this.previouslyFocusedElement &&
      typeof this.previouslyFocusedElement.focus === 'function'
    ) {
      this.previouslyFocusedElement.focus();
    }
  }

  @HostListener('keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Tab') {
      this.handleTabKey(event);
    } else if (event.key === 'Escape') {
      // Escape key handling is managed by parent component
      // This just ensures focus trap doesn't interfere
      return;
    }
  }

  private updateFocusableElements(): void {
    const focusableSelectors = [
      'button:not([disabled])',
      '[href]:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"]):not([disabled])',
    ].join(', ');

    this.focusableElements = Array.from(
      this.elementRef.nativeElement.querySelectorAll<HTMLElement>(focusableSelectors)
    );
  }

  private focusFirstElement(): void {
    const firstElement = this.focusableElements[0];
    if (firstElement) {
      firstElement.focus();
    }
  }

  private handleTabKey(event: KeyboardEvent): void {
    if (this.focusableElements.length === 0) {
      return;
    }

    const firstElement = this.focusableElements[0];
    const lastElement = this.focusableElements[this.focusableElements.length - 1];
    const activeElement = document.activeElement as HTMLElement;

    if (!firstElement || !lastElement) {
      return;
    }

    if (event.shiftKey) {
      // Shift + Tab: Move focus backwards
      if (activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: Move focus forwards
      if (activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
}
