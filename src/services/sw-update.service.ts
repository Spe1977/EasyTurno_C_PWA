import { Injectable, isDevMode, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SwUpdateService {
  updateAvailable = signal(false);
  private registration: ServiceWorkerRegistration | null = null;
  private isReloading = false;

  private updateCheckInterval: ReturnType<typeof setInterval> | null = null;
  private readonly isTestEnvironment =
    typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent);
  private readonly isLocalHost =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  async checkForUpdates(): Promise<void> {
    if (
      !('serviceWorker' in navigator) ||
      (!this.isTestEnvironment && (isDevMode() || this.isLocalHost))
    ) {
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');

      // Expose an update that already finished installing before this check ran
      if (this.registration.waiting && navigator.serviceWorker.controller) {
        this.updateAvailable.set(true);
      }

      // Check for updates every 60 seconds

      this.updateCheckInterval = setInterval(() => {
        void this.registration?.update();
      }, 60000);

      // Listen for updates
      this.registration.addEventListener('updatefound', () => {
        const newWorker = this.registration?.installing;

        newWorker?.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New Service Worker available
            this.updateAvailable.set(true);
          }
        });
      });

      // Handle controller change (after skipWaiting)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (this.isReloading) {
          return;
        }
        this.isReloading = true;
        this.reloadPage();
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  protected reloadPage(): void {
    window.location.reload();
  }

  activateUpdate(): void {
    if (this.registration?.waiting) {
      // Tell the waiting Service Worker to skip waiting and activate
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }

  reloadOrActivateUpdate(): void {
    if (this.updateAvailable()) {
      this.activateUpdate();
      return;
    }

    this.reloadPage();
  }

  cleanup(): void {
    if (this.updateCheckInterval !== null) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
  }
}
