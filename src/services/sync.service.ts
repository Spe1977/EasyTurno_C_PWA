import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { FirestoreUserDataService } from './firestore-user-data.service';
import { DeviceService } from './device.service';
import { PushNotificationService } from './push-notification.service';

export type SyncMode = 'local' | 'connecting' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  mode: SyncMode;
  labelKey: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly auth = inject(AuthService);
  private readonly firestoreStore = inject(FirestoreUserDataService);
  private readonly deviceService = inject(DeviceService);
  private readonly pushNotificationService = inject(PushNotificationService);
  private readonly remoteReady = signal(false);
  private readonly syncError = signal<string | null>(null);

  readonly status = computed<SyncStatus>(() => {
    const auth = this.auth.state();
    if (auth.mode === 'guest') return { mode: 'local', labelKey: 'syncLocal' };
    if (auth.mode !== 'authenticated' || !auth.uid) return { mode: 'local', labelKey: 'syncLocal' };
    if (this.syncError()) return { mode: 'error', labelKey: 'syncError', error: this.syncError()! };
    if (!navigator.onLine) return { mode: 'offline', labelKey: 'syncOffline' };
    return this.remoteReady()
      ? { mode: 'synced', labelKey: 'syncSynced' }
      : { mode: 'connecting', labelKey: 'syncConnecting' };
  });

  constructor() {
    effect(() => {
      const auth = this.auth.state();
      const fcmToken = this.pushNotificationService.token();
      if (auth.mode === 'authenticated' && auth.uid) {
        this.remoteReady.set(false);
        this.firestoreStore.start(auth.uid);
        void this.firestoreStore.registerDevice(auth.uid, this.deviceService.deviceId(), fcmToken);
        this.remoteReady.set(true);
      } else {
        this.firestoreStore.stop();
        this.remoteReady.set(false);
      }
    });
  }
}
