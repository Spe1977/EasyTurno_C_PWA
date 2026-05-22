import { Injectable, effect, inject, signal } from '@angular/core';
import { ManualShift, ShiftDataState, ShiftOverride, ShiftSeries } from '../shift.model';
import { AuthService } from './auth.service';
import { FirestoreUserDataService } from './firestore-user-data.service';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';

/**
 * Local store boundary for the v2 `ShiftDataState`. Owns the single writable
 * signal and exposes it as readonly to consumers so `ShiftService` and the
 * upcoming Firestore sync layer share the same source of truth without
 * duplicating mutation paths.
 */
@Injectable({ providedIn: 'root' })
export class UserDataService {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(FirestoreUserDataService);

  private readonly _state = signal<ShiftDataState>(EMPTY_SHIFT_DATA_STATE);
  readonly state = this._state.asReadonly();
  readonly activeDeviceCount = this.firestore.activeDeviceCount;

  constructor() {
    effect(() => {
      const auth = this.auth.state();
      if (auth.mode === 'authenticated' && auth.uid) {
        this._state.set(this.firestore.state());
      }
    });
  }

  setState(next: ShiftDataState): void {
    this._state.set(next);
  }

  update(mutator: (state: ShiftDataState) => ShiftDataState): void {
    this._state.update(mutator);
  }

  /**
   * Primary mutation boundary. Updates local state synchronously and routes
   * changes to Firestore asynchronously if the user is authenticated.
   */
  async mutate(
    mutator: (state: ShiftDataState) => ShiftDataState,
    action?:
      | { type: 'manual'; data: ManualShift }
      | { type: 'series'; data: ShiftSeries }
      | { type: 'override'; data: ShiftOverride }
      | {
          type: 'batch';
          manuals?: ManualShift[];
          series?: ShiftSeries[];
          overrides?: ShiftOverride[];
        }
  ): Promise<void> {
    const next = mutator(this._state());
    this._state.set(next);

    const auth = this.auth.state();
    if (auth.mode === 'authenticated' && auth.uid && action) {
      try {
        if (action.type === 'manual') {
          await this.firestore.upsertManualShift(auth.uid, action.data);
        } else if (action.type === 'series') {
          await this.firestore.upsertShiftSeries(auth.uid, action.data);
        } else if (action.type === 'override') {
          await this.firestore.upsertShiftOverride(auth.uid, action.data);
        } else if (action.type === 'batch') {
          await this.firestore.applyBatch(auth.uid, {
            manuals: action.manuals,
            series: action.series,
            overrides: action.overrides,
          });
        }
      } catch (err) {
        console.error('Firestore mutation failed:', err);
      }
    }
  }
}
