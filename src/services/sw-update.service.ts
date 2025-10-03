import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class SwUpdateService {
  updateAvailable = signal(false);
  private registration: ServiceWorkerRegistration | null = null;

  async checkForUpdates(): Promise<void> {
    if (!('serviceWorker' in navigator)) {
      return;
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js');

      // Check for updates every 60 seconds
      // eslint-disable-next-line no-undef
      setInterval(() => {
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
        window.location.reload();
      });
    } catch (error) {
      console.error('Service Worker registration failed:', error);
    }
  }

  activateUpdate(): void {
    if (this.registration?.waiting) {
      // Tell the waiting Service Worker to skip waiting and activate
      this.registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
  }
}
