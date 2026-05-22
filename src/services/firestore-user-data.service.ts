import { Injectable, inject, signal } from '@angular/core';
import { Capacitor } from '@capacitor/core';
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
import { FirebaseAppService } from './firebase-app.service';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';

@Injectable({ providedIn: 'root' })
export class FirestoreUserDataService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly _state = signal<ShiftDataState>(EMPTY_SHIFT_DATA_STATE);
  readonly state = this._state.asReadonly();
  private readonly _activeDeviceCount = signal<number>(0);
  readonly activeDeviceCount = this._activeDeviceCount.asReadonly();
  private unsubscribers: Unsubscribe[] = [];

  start(uid: string): void {
    this.stop();
    const db = this.firebase.firestore;
    this.unsubscribers = [
      onSnapshot(collection(db, `users/${uid}/shiftSeries`), snapshot => {
        this.patch({
          shiftSeries: this.mapDocs<ShiftSeries>(snapshot),
        });
      }),
      onSnapshot(collection(db, `users/${uid}/manualShifts`), snapshot => {
        this.patch({
          manualShifts: this.mapDocs<ManualShift>(snapshot),
        });
      }),
      onSnapshot(collection(db, `users/${uid}/shiftOverrides`), snapshot => {
        this.patch({
          shiftOverrides: this.mapDocs<ShiftOverride>(snapshot),
        });
      }),
      onSnapshot(collection(db, `users/${uid}/devices`), snapshot => {
        this._activeDeviceCount.set(snapshot.size);
      }),
    ];
  }

  stop(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this._state.set(EMPTY_SHIFT_DATA_STATE);
    this._activeDeviceCount.set(0);
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

  async registerDevice(uid: string, deviceId: string, fcmToken?: string | null): Promise<void> {
    const db = this.firebase.firestore;
    const batch = writeBatch(db);
    batch.set(doc(db, `users/${uid}/devices/${deviceId}`), {
      id: deviceId,
      lastActive: serverTimestamp(),
      userAgent: navigator.userAgent,
      platform: Capacitor.isNativePlatform() ? 'android' : 'web',
      ...(fcmToken ? { fcmToken } : {}),
    });
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

  private mapDocs<T>(snapshot: QuerySnapshot): T[] {
    return snapshot.docs.map(document => document.data() as T);
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
