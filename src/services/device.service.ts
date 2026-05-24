import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

const DEVICE_ID_KEY = 'easyturno_device_id';

/**
 * How many *installations* (native app or PWA installed on the home screen)
 * may sync before the soft warning shows. Plain web sessions (a browser tab on
 * easyturno.pages.dev) never count toward this limit.
 */
const SOFT_DEVICE_LIMIT = 3;

/**
 * `native`        — running inside the Capacitor Android/iOS shell.
 * `pwa-installed` — the PWA was opened in standalone display mode at least once
 *                   (installed to the home screen). This is a *sticky* identity.
 * `web`           — a normal browser tab; does not count toward the device limit.
 */
export type DevicePlatform = 'native' | 'pwa-installed' | 'web';

/** A `users/{uid}/devices/{deviceId}` record, normalised for UI consumption. */
export interface DeviceRecord {
  id: string;
  platform: DevicePlatform;
  /** Epoch milliseconds, or null while a serverTimestamp write is pending. */
  lastActive: number | null;
  userAgent?: string;
  fcmToken?: string;
}

@Injectable({ providedIn: 'root' })
export class DeviceService {
  deviceId(): string {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  }

  /** Counts only installations (`platform !== 'web'`); web sessions are free. */
  isSoftLimitExceeded(installedDeviceCount: number): boolean {
    return installedDeviceCount > SOFT_DEVICE_LIMIT;
  }

  /**
   * Best-effort detection of how this session is running. Note this is the
   * *currently observed* platform; a `web` result must never overwrite a
   * previously stored `pwa-installed`/`native` value (sticky upgrade lives in
   * `FirestoreUserDataService.registerDevice`).
   */
  detectPlatform(): DevicePlatform {
    if (Capacitor.isNativePlatform()) return 'native';
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches === true ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    return standalone ? 'pwa-installed' : 'web';
  }
}
