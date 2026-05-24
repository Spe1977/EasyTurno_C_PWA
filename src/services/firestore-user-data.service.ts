import { Injectable, computed, inject, signal } from '@angular/core';
import {
  collection,
  doc,
  onSnapshot,
  writeBatch,
  getDocs,
  type QuerySnapshot,
  type Unsubscribe,
  serverTimestamp,
} from 'firebase/firestore';
import { ManualShift, ShiftDataState, ShiftOverride, ShiftSeries } from '../shift.model';
import { DevicePlatform, DeviceRecord } from './device.service';
import { FirebaseAppService } from './firebase-app.service';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';

/** Devices untouched for longer than this are pruned on the next registration. */
const STALE_DEVICE_MS = 90 * 24 * 60 * 60 * 1000;

/** Sticky precedence: a higher rank can never be overwritten by a lower one. */
const PLATFORM_RANK: Record<DevicePlatform, number> = {
  web: 0,
  'pwa-installed': 1,
  native: 2,
};

@Injectable({ providedIn: 'root' })
export class FirestoreUserDataService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly _state = signal<ShiftDataState>(EMPTY_SHIFT_DATA_STATE);
  readonly state = this._state.asReadonly();
  private readonly _devices = signal<DeviceRecord[]>([]);
  readonly devices = this._devices.asReadonly();
  /** Installations only (`platform !== 'web'`); web sessions are unlimited. */
  readonly activeDeviceCount = computed(
    () => this._devices().filter(device => device.platform !== 'web').length
  );
  readonly webSessionCount = computed(
    () => this._devices().filter(device => device.platform === 'web').length
  );
  private readonly _snapshotsReady = signal(false);
  readonly snapshotsReady = this._snapshotsReady.asReadonly();
  private unsubscribers: Unsubscribe[] = [];
  private initialSnapshotsSeen = {
    shiftSeries: false,
    manualShifts: false,
    shiftOverrides: false,
    devices: false,
  };

  start(uid: string): void {
    this.stop();
    const db = this.firebase.firestore;
    this.unsubscribers = [
      onSnapshot(collection(db, `users/${uid}/shiftSeries`), snapshot => {
        this.patch({
          shiftSeries: this.mapDocs<ShiftSeries>(snapshot),
        });
        this.markInitialSnapshotSeen('shiftSeries');
      }),
      onSnapshot(collection(db, `users/${uid}/manualShifts`), snapshot => {
        this.patch({
          manualShifts: this.mapDocs<ManualShift>(snapshot),
        });
        this.markInitialSnapshotSeen('manualShifts');
      }),
      onSnapshot(collection(db, `users/${uid}/shiftOverrides`), snapshot => {
        this.patch({
          shiftOverrides: this.mapDocs<ShiftOverride>(snapshot),
        });
        this.markInitialSnapshotSeen('shiftOverrides');
      }),
      onSnapshot(collection(db, `users/${uid}/devices`), snapshot => {
        this._devices.set(this.mapDeviceDocs(snapshot));
        this.markInitialSnapshotSeen('devices');
      }),
    ];
  }

  stop(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this._state.set(EMPTY_SHIFT_DATA_STATE);
    this._devices.set([]);
    this._snapshotsReady.set(false);
    this.initialSnapshotsSeen = {
      shiftSeries: false,
      manualShifts: false,
      shiftOverrides: false,
      devices: false,
    };
  }

  async upsertManualShift(uid: string, shift: ManualShift): Promise<void> {
    const db = this.firebase.firestore;
    const batch = writeBatch(db);
    batch.set(doc(db, `users/${uid}/manualShifts/${shift.id}`), this.withoutUndefined(shift));
    await batch.commit();
  }

  async upsertShiftSeries(uid: string, series: ShiftSeries): Promise<void> {
    const db = this.firebase.firestore;
    const batch = writeBatch(db);
    batch.set(doc(db, `users/${uid}/shiftSeries/${series.id}`), this.withoutUndefined(series));
    await batch.commit();
  }

  async upsertShiftOverride(uid: string, override: ShiftOverride): Promise<void> {
    const db = this.firebase.firestore;
    const batch = writeBatch(db);
    batch.set(
      doc(db, `users/${uid}/shiftOverrides/${override.id}`),
      this.withoutUndefined(override)
    );
    await batch.commit();
  }

  async applyBatch(
    uid: string,
    data: { manuals?: ManualShift[]; series?: ShiftSeries[]; overrides?: ShiftOverride[] }
  ): Promise<void> {
    const db = this.firebase.firestore;
    const batch = writeBatch(db);
    data.manuals?.forEach(m =>
      batch.set(doc(db, `users/${uid}/manualShifts/${m.id}`), this.withoutUndefined(m))
    );
    data.series?.forEach(s =>
      batch.set(doc(db, `users/${uid}/shiftSeries/${s.id}`), this.withoutUndefined(s))
    );
    data.overrides?.forEach(o =>
      batch.set(doc(db, `users/${uid}/shiftOverrides/${o.id}`), this.withoutUndefined(o))
    );
    await batch.commit();
  }

  /**
   * Registers (or refreshes) this device. The write applies a sticky platform
   * upgrade — a device that was ever seen as `native`/`pwa-installed` is never
   * downgraded back to `web` — and opportunistically prunes other devices that
   * have been inactive for more than 90 days.
   */
  async registerDevice(
    uid: string,
    deviceId: string,
    platform: DevicePlatform,
    fcmToken?: string | null
  ): Promise<void> {
    const db = this.firebase.firestore;
    const snapshot = await getDocs(collection(db, `users/${uid}/devices`));
    const batch = writeBatch(db);
    const now = Date.now();
    let existingPlatform: DevicePlatform | undefined;

    snapshot.docs.forEach(document => {
      if (document.id === deviceId) {
        existingPlatform = (document.data() as { platform?: DevicePlatform }).platform;
        return; // Never prune the device we are registering.
      }
      const lastActive = this.toMillis((document.data() as { lastActive?: unknown }).lastActive);
      if (lastActive !== null && now - lastActive > STALE_DEVICE_MS) {
        batch.delete(document.ref);
      }
    });

    batch.set(doc(db, `users/${uid}/devices/${deviceId}`), {
      id: deviceId,
      lastActive: serverTimestamp(),
      userAgent: navigator.userAgent,
      platform: this.resolveStickyPlatform(platform, existingPlatform),
      ...(fcmToken ? { fcmToken } : {}),
    });
    await batch.commit();
  }

  /** Manual escape hatch from Settings: free a slot by deleting one device. */
  async removeDevice(uid: string, deviceId: string): Promise<void> {
    const db = this.firebase.firestore;
    const batch = writeBatch(db);
    batch.delete(doc(db, `users/${uid}/devices/${deviceId}`));
    await batch.commit();
  }

  async deleteUserDataTree(uid: string): Promise<void> {
    const db = this.firebase.firestore;
    const batch = writeBatch(db);
    for (const path of ['shiftSeries', 'manualShifts', 'shiftOverrides', 'devices']) {
      const snapshot = await getDocs(collection(db, `users/${uid}/${path}`));
      snapshot.docs.forEach(document => batch.delete(document.ref));
    }
    batch.delete(doc(db, `users/${uid}/profile/main`));
    batch.delete(doc(db, `users/${uid}/settings/main`));
    await batch.commit();
  }

  private patch(patch: Partial<ShiftDataState>): void {
    this._state.update(state => ({ ...state, ...patch }));
  }

  private markInitialSnapshotSeen(
    key: 'shiftSeries' | 'manualShifts' | 'shiftOverrides' | 'devices'
  ): void {
    this.initialSnapshotsSeen[key] = true;
    if (Object.values(this.initialSnapshotsSeen).every(Boolean)) {
      this._snapshotsReady.set(true);
    }
  }

  private mapDocs<T>(snapshot: QuerySnapshot): T[] {
    return snapshot.docs.map(document => document.data() as T);
  }

  private mapDeviceDocs(snapshot: QuerySnapshot): DeviceRecord[] {
    return snapshot.docs.map(document => {
      const data = document.data() as {
        id?: string;
        platform?: DevicePlatform;
        lastActive?: unknown;
        userAgent?: string;
        fcmToken?: string;
      };
      return {
        id: data.id ?? document.id,
        platform: data.platform ?? 'web',
        lastActive: this.toMillis(data.lastActive),
        userAgent: data.userAgent,
        fcmToken: data.fcmToken,
      };
    });
  }

  private resolveStickyPlatform(
    detected: DevicePlatform,
    existing?: DevicePlatform
  ): DevicePlatform {
    if (!existing) return detected;
    return PLATFORM_RANK[detected] >= PLATFORM_RANK[existing] ? detected : existing;
  }

  private toMillis(value: unknown): number | null {
    const candidate = value as { toMillis?: () => number } | null | undefined;
    return typeof candidate?.toMillis === 'function' ? candidate.toMillis() : null;
  }

  private withoutUndefined<T>(value: T): T {
    if (Array.isArray(value)) {
      return value.filter(item => item !== undefined).map(item => this.withoutUndefined(item)) as T;
    }
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value)
          .filter(([, item]) => item !== undefined)
          .map(([key, item]) => [key, this.withoutUndefined(item)])
      ) as T;
    }
    return value;
  }
}
