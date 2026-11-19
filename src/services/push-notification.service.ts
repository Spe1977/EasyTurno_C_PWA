import { Injectable, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import type { Token } from '@capacitor/push-notifications';
import { createLazyLoader } from '../utils/lazy-loader';

@Injectable({ providedIn: 'root' })
export class PushNotificationService {
  private readonly _token = signal<string | null>(null);
  readonly token = this._token.asReadonly();
  private readonly loadPushNotifications = createLazyLoader(
    async () => (await import('@capacitor/push-notifications')).PushNotifications
  );

  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      console.info('PushNotificationService: Running on web, native features disabled');
      return;
    }

    const PushNotifications = await this.loadPushNotifications();
    // Request permissions
    let permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('Push notification permission not granted');
      return;
    }

    // Register with FCM
    await PushNotifications.register();

    // Listen for registration token
    await PushNotifications.addListener('registration', (token: Token) => {
      console.info('Push registration success');
      this._token.set(token.value);
    });

    // Listen for registration errors
    await PushNotifications.addListener('registrationError', error => {
      console.error('Error on push registration:', JSON.stringify(error));
    });

    // Listen for incoming notifications
    await PushNotifications.addListener('pushNotificationReceived', notification => {
      console.info('Push notification received:', notification);
    });

    // Listen for notification actions
    await PushNotifications.addListener('pushNotificationActionPerformed', notification => {
      console.info('Push notification action performed:', notification);
    });
  }
}
