import { TestBed } from '@angular/core/testing';
import * as firestore from 'firebase/firestore';
import { Capacitor } from '@capacitor/core';
import { FirestoreUserDataService } from './firestore-user-data.service';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';

describe('FirestoreUserDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({});
  });

  it('starts with empty v2 state before any snapshot', () => {
    const service = TestBed.inject(FirestoreUserDataService);
    expect(service.state()).toEqual(EMPTY_SHIFT_DATA_STATE);
  });

  it('subscribes to the user subcollections on start and unsubscribes on stop', () => {
    const unsubscribers = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
    (firestore.onSnapshot as jest.Mock)
      .mockReturnValueOnce(unsubscribers[0])
      .mockReturnValueOnce(unsubscribers[1])
      .mockReturnValueOnce(unsubscribers[2])
      .mockReturnValueOnce(unsubscribers[3]);

    const service = TestBed.inject(FirestoreUserDataService);
    service.start('uid-1');

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/shiftSeries');
    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'users/uid-1/manualShifts'
    );
    expect(firestore.collection).toHaveBeenCalledWith(
      expect.anything(),
      'users/uid-1/shiftOverrides'
    );
    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/devices');
    expect(firestore.onSnapshot).toHaveBeenCalledTimes(4);

    service.stop();

    expect(unsubscribers[0]).toHaveBeenCalledTimes(1);
    expect(unsubscribers[1]).toHaveBeenCalledTimes(1);
    expect(unsubscribers[2]).toHaveBeenCalledTimes(1);
    expect(unsubscribers[3]).toHaveBeenCalledTimes(1);
    expect(service.state()).toEqual(EMPTY_SHIFT_DATA_STATE);
  });

  it('updates state when snapshot callbacks fire for each subcollection', () => {
    const callbacks: Array<(snapshot: { docs: Array<{ data: () => unknown }> }) => void> = [];
    (firestore.onSnapshot as jest.Mock).mockImplementation((_query, cb) => {
      callbacks.push(cb);
      return jest.fn();
    });

    const service = TestBed.inject(FirestoreUserDataService);
    service.start('uid-2');

    const seriesDoc = {
      id: 'series-1',
      title: 'Morning',
      start: '2026-01-01T08:00:00.000Z',
      end: '2026-01-01T16:00:00.000Z',
      color: 'indigo',
      repetition: { frequency: 'days', interval: 1 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const manualDoc = {
      id: 'manual-1',
      title: 'Manual',
      start: '2026-01-02T08:00:00.000Z',
      end: '2026-01-02T16:00:00.000Z',
      color: 'sky',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const overrideDoc = {
      id: 'override-1',
      seriesId: 'series-1',
      occurrenceStart: '2026-01-03T08:00:00.000Z',
      action: 'deleted',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    callbacks[0]({ docs: [{ data: () => seriesDoc }] });
    callbacks[1]({ docs: [{ data: () => manualDoc }] });
    callbacks[2]({ docs: [{ data: () => overrideDoc }] });

    const state = service.state();
    expect(state.shiftSeries).toEqual([seriesDoc]);
    expect(state.manualShifts).toEqual([manualDoc]);
    expect(state.shiftOverrides).toEqual([overrideDoc]);
    expect(state.schemaVersion).toBe(2);
  });

  it('reports snapshots as ready only after all initial listeners have emitted', () => {
    const callbacks: Array<
      (snapshot: { docs: Array<{ data: () => unknown }>; size?: number }) => void
    > = [];
    (firestore.onSnapshot as jest.Mock).mockImplementation((_query, cb) => {
      callbacks.push(cb);
      return jest.fn();
    });

    const service = TestBed.inject(FirestoreUserDataService);
    service.start('uid-ready');

    expect(service.snapshotsReady()).toBe(false);

    callbacks[0]({ docs: [] });
    callbacks[1]({ docs: [] });
    callbacks[2]({ docs: [] });

    expect(service.snapshotsReady()).toBe(false);

    callbacks[3]({ docs: [], size: 1 });

    expect(service.snapshotsReady()).toBe(true);

    service.stop();

    expect(service.snapshotsReady()).toBe(false);
  });

  it('updates active device count when snapshot callback fires for devices', () => {
    const callbacks: Array<(snapshot: { size: number }) => void> = [];
    (firestore.onSnapshot as jest.Mock).mockImplementation((_query, cb) => {
      callbacks.push(cb);
      return jest.fn();
    });

    const service = TestBed.inject(FirestoreUserDataService);
    service.start('uid-devices');

    expect(service.activeDeviceCount()).toBe(0);

    // Trigger devices snapshot callback with 3 active devices
    callbacks[3]({ size: 3 });
    expect(service.activeDeviceCount()).toBe(3);

    // Trigger devices snapshot callback with 5 active devices (above limit)
    callbacks[3]({ size: 5 });
    expect(service.activeDeviceCount()).toBe(5);
  });

  it('tears down previous listeners when start is called twice in a row', () => {
    const firstUnsubs = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
    const secondUnsubs = [jest.fn(), jest.fn(), jest.fn(), jest.fn()];
    (firestore.onSnapshot as jest.Mock)
      .mockReturnValueOnce(firstUnsubs[0])
      .mockReturnValueOnce(firstUnsubs[1])
      .mockReturnValueOnce(firstUnsubs[2])
      .mockReturnValueOnce(firstUnsubs[3])
      .mockReturnValueOnce(secondUnsubs[0])
      .mockReturnValueOnce(secondUnsubs[1])
      .mockReturnValueOnce(secondUnsubs[2])
      .mockReturnValueOnce(secondUnsubs[3]);

    const service = TestBed.inject(FirestoreUserDataService);
    service.start('uid-a');
    service.start('uid-b');

    expect(firstUnsubs[0]).toHaveBeenCalledTimes(1);
    expect(firstUnsubs[1]).toHaveBeenCalledTimes(1);
    expect(firstUnsubs[2]).toHaveBeenCalledTimes(1);
    expect(firstUnsubs[3]).toHaveBeenCalledTimes(1);
    expect(secondUnsubs[0]).not.toHaveBeenCalled();
  });

  it('writes manual shifts with last-write-wins updatedAt metadata', async () => {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

    const service = TestBed.inject(FirestoreUserDataService);
    await service.upsertManualShift('uid-1', {
      id: 'manual-1',
      title: 'Manual',
      start: '2026-01-01T08:00:00.000Z',
      end: '2026-01-01T16:00:00.000Z',
      color: 'indigo',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(batch.set).toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it('omits undefined optional fields before writing manual shifts', async () => {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

    const service = TestBed.inject(FirestoreUserDataService);
    await service.upsertManualShift('uid-1', {
      id: 'manual-undefined',
      title: 'Manual',
      start: '2026-01-01T08:00:00.000Z',
      end: '2026-01-01T16:00:00.000Z',
      color: 'indigo',
      notes: undefined,
      overtimeHours: undefined,
      allowances: undefined,
      timezone: undefined,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });

    expect(batch.set).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({
        notes: undefined,
        overtimeHours: undefined,
        allowances: undefined,
        timezone: undefined,
      })
    );
  });

  it('writes shift series', async () => {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

    const service = TestBed.inject(FirestoreUserDataService);
    await service.upsertShiftSeries('uid-1', {
      id: 'series-1',
      title: 'Morning',
      start: '2026-01-01T08:00:00.000Z',
      end: '2026-01-01T16:00:00.000Z',
      color: 'indigo',
      repetition: { frequency: 'days', interval: 1 },
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(batch.set).toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it('writes shift overrides', async () => {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

    const service = TestBed.inject(FirestoreUserDataService);
    await service.upsertShiftOverride('uid-1', {
      id: 'override-1',
      seriesId: 'series-1',
      occurrenceStart: '2026-01-03T08:00:00.000Z',
      action: 'deleted',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });

    expect(batch.set).toHaveBeenCalled();
    expect(batch.commit).toHaveBeenCalled();
  });

  it('registers device with user agent and timestamp', async () => {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

    const service = TestBed.inject(FirestoreUserDataService);
    await service.registerDevice('uid-1', 'device-123', 'token-abc');

    expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/devices/device-123');
    expect(batch.set).toHaveBeenCalledWith(expect.anything(), {
      id: 'device-123',
      lastActive: 'serverTimestamp',
      userAgent: expect.any(String),
      platform: 'web',
      fcmToken: 'token-abc',
    });
    expect(batch.commit).toHaveBeenCalled();
  });

  it('registers device without fcmToken and defaults platform', async () => {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

    const service = TestBed.inject(FirestoreUserDataService);
    await service.registerDevice('uid-1', 'device-123');

    expect(batch.set).toHaveBeenCalledWith(expect.anything(), {
      id: 'device-123',
      lastActive: 'serverTimestamp',
      userAgent: expect.any(String),
      platform: 'web',
    });
  });

  it('registers device with native platform when Capacitor is native', async () => {
    const batch = {
      set: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      commit: jest.fn().mockResolvedValue(undefined),
    };
    (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

    const isNativeSpy = jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);

    const service = TestBed.inject(FirestoreUserDataService);
    await service.registerDevice('uid-1', 'device-123', 'token-abc');

    expect(batch.set).toHaveBeenCalledWith(expect.anything(), {
      id: 'device-123',
      lastActive: 'serverTimestamp',
      userAgent: expect.any(String),
      platform: 'android',
      fcmToken: 'token-abc',
    });

    isNativeSpy.mockRestore();
  });

  describe('Batch Operations and Deletion', () => {
    let batch: any;

    beforeEach(() => {
      batch = {
        set: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
        commit: jest.fn().mockResolvedValue(undefined),
      };
      (firestore.writeBatch as jest.Mock).mockReturnValue(batch);
    });

    it('applies multiple operations in a single batch via applyBatch', async () => {
      const service = TestBed.inject(FirestoreUserDataService);
      const data = {
        manuals: [{ id: 'm1' } as any],
        series: [{ id: 's1' } as any],
        overrides: [{ id: 'o1' } as any],
      };

      await service.applyBatch('uid-1', data);

      expect(batch.set).toHaveBeenCalledTimes(3);
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/manualShifts/m1');
      expect(firestore.doc).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/shiftSeries/s1');
      expect(firestore.doc).toHaveBeenCalledWith(
        expect.anything(),
        'users/uid-1/shiftOverrides/o1'
      );
    });

    it('deletes all user data collections and profile/settings in deleteUserDataTree', async () => {
      const service = TestBed.inject(FirestoreUserDataService);
      (firestore.getDocs as jest.Mock).mockResolvedValue({
        docs: [{ ref: 'ref-1' }, { ref: 'ref-2' }],
      });

      await service.deleteUserDataTree('uid-1');

      // 4 collections (shiftSeries, manualShifts, shiftOverrides, devices) * 2 docs each = 8
      // + profile/main and settings/main = 10 total deletes
      expect(batch.delete).toHaveBeenCalledTimes(10);
      expect(batch.commit).toHaveBeenCalledTimes(1);
      expect(firestore.getDocs).toHaveBeenCalledTimes(4);
    });

    it('propagates errors if batch commit fails', async () => {
      const service = TestBed.inject(FirestoreUserDataService);
      batch.commit.mockRejectedValueOnce(new Error('Firestore error'));

      await expect(service.upsertManualShift('uid-1', { id: 'm1' } as any)).rejects.toThrow(
        'Firestore error'
      );
    });
  });
});
