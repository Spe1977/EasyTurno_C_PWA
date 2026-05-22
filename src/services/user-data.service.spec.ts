import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { UserDataService } from './user-data.service';
import { AuthService } from './auth.service';
import { FirestoreUserDataService } from './firestore-user-data.service';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';
import { ShiftDataState, ManualShift, ShiftSeries, ShiftOverride } from '../shift.model';

describe('UserDataService', () => {
  let authMock: {
    state: any;
  };
  let firestoreMock: {
    state: any;
    activeDeviceCount: any;
    upsertManualShift: jest.Mock;
    upsertShiftSeries: jest.Mock;
    upsertShiftOverride: jest.Mock;
    applyBatch: jest.Mock;
  };

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();

    authMock = {
      state: signal({ mode: 'guest' }),
    };

    firestoreMock = {
      state: signal(EMPTY_SHIFT_DATA_STATE),
      activeDeviceCount: signal(1),
      upsertManualShift: jest.fn().mockResolvedValue(undefined),
      upsertShiftSeries: jest.fn().mockResolvedValue(undefined),
      upsertShiftOverride: jest.fn().mockResolvedValue(undefined),
      applyBatch: jest.fn().mockResolvedValue(undefined),
    };

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        UserDataService,
        { provide: AuthService, useValue: authMock },
        { provide: FirestoreUserDataService, useValue: firestoreMock },
      ],
    });
  });

  it('starts with empty v2 state in guest mode', () => {
    const service = TestBed.inject(UserDataService);
    expect(service.state()).toEqual(EMPTY_SHIFT_DATA_STATE);
  });

  it('updates state through a single mutation boundary', () => {
    const service = TestBed.inject(UserDataService);
    service.update(state => ({
      ...state,
      manualShifts: [
        ...state.manualShifts,
        {
          id: 'm1',
          title: 'Manual',
          start: '2026-01-01T08:00:00.000Z',
          end: '2026-01-01T16:00:00.000Z',
          color: 'indigo',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }));

    expect(service.state().manualShifts).toHaveLength(1);
    expect(service.state().manualShifts[0].id).toBe('m1');
  });

  it('replaces the entire state through setState', () => {
    const service = TestBed.inject(UserDataService);
    const next: ShiftDataState = {
      schemaVersion: 2,
      shiftSeries: [],
      manualShifts: [
        {
          id: 'm2',
          title: 'Replaced',
          start: '2026-02-01T08:00:00.000Z',
          end: '2026-02-01T16:00:00.000Z',
          color: 'sky',
          createdAt: '2026-02-01T00:00:00.000Z',
          updatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
      shiftOverrides: [],
    };
    service.setState(next);

    expect(service.state()).toEqual(next);
  });

  it('exposes state as a readonly signal that other services can read', () => {
    const service = TestBed.inject(UserDataService);
    const snapshot = service.state;
    service.update(s => ({ ...s, manualShifts: [] }));
    expect(snapshot()).toBe(service.state());
  });

  it('mirrors Firestore state while authenticated so ShiftService can materialize cloud shifts', () => {
    authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
    const service = TestBed.inject(UserDataService);
    const remoteManual: ManualShift = {
      id: 'remote-manual',
      title: 'Remote Shift',
      start: '2026-05-25T07:00:00.000Z',
      end: '2026-05-25T15:00:00.000Z',
      color: 'sky',
      createdAt: '2026-05-22T00:00:00.000Z',
      updatedAt: '2026-05-22T00:00:00.000Z',
    };

    firestoreMock.state.set({
      schemaVersion: 2,
      shiftSeries: [],
      manualShifts: [remoteManual],
      shiftOverrides: [],
    });
    TestBed.flushEffects();

    expect(service.state().manualShifts).toEqual([remoteManual]);
  });

  describe('mutate', () => {
    it('mutates state locally in guest mode without calling Firestore', async () => {
      const service = TestBed.inject(UserDataService);
      const manual: ManualShift = {
        id: 'm-guest',
        title: 'Guest Shift',
        start: '2026-01-01T08:00:00.000Z',
        end: '2026-01-01T16:00:00.000Z',
        color: 'indigo',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      await service.mutate(state => ({ ...state, manualShifts: [...state.manualShifts, manual] }), {
        type: 'manual',
        data: manual,
      });

      expect(service.state().manualShifts).toContainEqual(manual);
      expect(firestoreMock.upsertManualShift).not.toHaveBeenCalled();
    });

    it('mutates state locally and calls Firestore upsertManualShift in authenticated mode', async () => {
      authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
      const service = TestBed.inject(UserDataService);
      const manual: ManualShift = {
        id: 'm-auth',
        title: 'Auth Shift',
        start: '2026-01-01T08:00:00.000Z',
        end: '2026-01-01T16:00:00.000Z',
        color: 'indigo',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      await service.mutate(state => ({ ...state, manualShifts: [...state.manualShifts, manual] }), {
        type: 'manual',
        data: manual,
      });

      expect(service.state().manualShifts).toContainEqual(manual);
      expect(firestoreMock.upsertManualShift).toHaveBeenCalledWith('uid-abc', manual);
    });

    it('calls Firestore upsertShiftSeries for series actions in authenticated mode', async () => {
      authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
      const service = TestBed.inject(UserDataService);
      const series: ShiftSeries = {
        id: 's-auth',
        title: 'Auth Series',
        start: '2026-01-01T08:00:00.000Z',
        end: '2026-01-01T16:00:00.000Z',
        color: 'rose',
        repetition: { frequency: 'days', interval: 1 },
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      await service.mutate(state => ({ ...state, shiftSeries: [...state.shiftSeries, series] }), {
        type: 'series',
        data: series,
      });

      expect(service.state().shiftSeries).toContainEqual(series);
      expect(firestoreMock.upsertShiftSeries).toHaveBeenCalledWith('uid-abc', series);
    });

    it('calls Firestore upsertShiftOverride for override actions in authenticated mode', async () => {
      authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
      const service = TestBed.inject(UserDataService);
      const override: ShiftOverride = {
        id: 'o-auth',
        seriesId: 's-auth',
        occurrenceStart: '2026-01-02T08:00:00.000Z',
        action: 'deleted',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      };

      await service.mutate(
        state => ({ ...state, shiftOverrides: [...state.shiftOverrides, override] }),
        { type: 'override', data: override }
      );

      expect(service.state().shiftOverrides).toContainEqual(override);
      expect(firestoreMock.upsertShiftOverride).toHaveBeenCalledWith('uid-abc', override);
    });

    it('calls Firestore applyBatch for batch actions in authenticated mode', async () => {
      authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
      const service = TestBed.inject(UserDataService);
      const manual = { id: 'm1' } as ManualShift;
      const series = { id: 's1' } as ShiftSeries;
      const override = { id: 'o1' } as ShiftOverride;

      await service.mutate(
        state => ({
          ...state,
          manualShifts: [...state.manualShifts, manual],
          shiftSeries: [...state.shiftSeries, series],
          shiftOverrides: [...state.shiftOverrides, override],
        }),
        {
          type: 'batch',
          manuals: [manual],
          series: [series],
          overrides: [override],
        }
      );

      expect(firestoreMock.applyBatch).toHaveBeenCalledWith('uid-abc', {
        manuals: [manual],
        series: [series],
        overrides: [override],
      });
    });

    it('catches and logs errors if Firestore operations fail, without throwing', async () => {
      authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
      const service = TestBed.inject(UserDataService);
      const manual = { id: 'm1' } as ManualShift;

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      firestoreMock.upsertManualShift.mockRejectedValueOnce(new Error('Firebase offline'));

      // Should resolve successfully instead of rejecting
      await expect(
        service.mutate(state => ({ ...state, manualShifts: [...state.manualShifts, manual] }), {
          type: 'manual',
          data: manual,
        })
      ).resolves.not.toThrow();

      expect(service.state().manualShifts).toContainEqual(manual);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Firestore mutation failed:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });

    it('does not call Firestore if action is undefined in authenticated mode', async () => {
      authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
      const service = TestBed.inject(UserDataService);
      const manual = { id: 'm-no-action' } as ManualShift;

      await service.mutate(state => ({ ...state, manualShifts: [...state.manualShifts, manual] }));

      expect(service.state().manualShifts).toContainEqual(manual);
      expect(firestoreMock.upsertManualShift).not.toHaveBeenCalled();
    });

    it('ignores unknown action types after applying the local mutation', async () => {
      authMock.state.set({ mode: 'authenticated', uid: 'uid-abc' });
      const service = TestBed.inject(UserDataService);
      const manual = { id: 'm-unknown-action' } as ManualShift;

      await service.mutate(state => ({ ...state, manualShifts: [...state.manualShifts, manual] }), {
        type: 'unknown',
        data: manual,
      } as any);

      expect(service.state().manualShifts).toContainEqual(manual);
      expect(firestoreMock.upsertManualShift).not.toHaveBeenCalled();
      expect(firestoreMock.upsertShiftSeries).not.toHaveBeenCalled();
      expect(firestoreMock.upsertShiftOverride).not.toHaveBeenCalled();
      expect(firestoreMock.applyBatch).not.toHaveBeenCalled();
    });
  });
});
