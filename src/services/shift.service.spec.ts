import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ShiftService } from './shift.service';
import { ToastService } from './toast.service';
import { CryptoService } from './crypto.service';
import { NotificationService } from './notification.service';
import { AuthService } from './auth.service';
import { FirestoreUserDataService } from './firestore-user-data.service';

describe('ShiftService', () => {
  let service: ShiftService;
  let toastService: ToastService;
  let cryptoService: CryptoService;
  let localStorageMock: { [key: string]: string };
  let notificationService: NotificationService;

  const createDeferred = <T>() => {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });

    return { promise, resolve, reject };
  };

  const flushAsyncWork = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  };

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return localStorageMock[key] || null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete localStorageMock[key];
    });

    // Mock CryptoService
    const mockCryptoService = {
      encrypt: jest.fn().mockImplementation(async (data: string) => data),
      decrypt: jest.fn().mockImplementation(async (data: string) => data),
      isEncrypted: jest.fn().mockReturnValue(false),
    };

    TestBed.configureTestingModule({
      providers: [
        ShiftService,
        ToastService,
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    });

    service = TestBed.inject(ShiftService);
    toastService = TestBed.inject(ToastService);
    cryptoService = TestBed.inject(CryptoService);
    notificationService = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
    expect(toastService).toBeTruthy();
    expect(cryptoService).toBeTruthy();
    expect(notificationService).toBeTruthy();
  });

  describe('addShift', () => {
    it('should add a single non-recurring shift', () => {
      const shiftData = {
        title: 'Test Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Test Shift');
      expect(shifts[0].id).toBeTruthy();
      expect(shifts[0].seriesId).toBe(shifts[0].id);
    });

    it('should write newly created manual shifts to Firestore when authenticated', async () => {
      TestBed.resetTestingModule();
      const firestoreMock = {
        state: signal({
          schemaVersion: 2,
          shiftSeries: [],
          manualShifts: [],
          shiftOverrides: [],
        }),
        activeDeviceCount: signal(1),
        upsertManualShift: jest.fn().mockResolvedValue(undefined),
        upsertShiftSeries: jest.fn().mockResolvedValue(undefined),
        upsertShiftOverride: jest.fn().mockResolvedValue(undefined),
        applyBatch: jest.fn().mockResolvedValue(undefined),
      };
      TestBed.configureTestingModule({
        providers: [
          ShiftService,
          ToastService,
          { provide: CryptoService, useValue: cryptoService },
          {
            provide: AuthService,
            useValue: { state: () => ({ mode: 'authenticated', uid: 'uid-auth' }) },
          },
          { provide: FirestoreUserDataService, useValue: firestoreMock },
        ],
      });
      const authenticatedService = TestBed.inject(ShiftService);

      authenticatedService.addShift({
        title: 'Cloud Manual',
        start: '2026-05-25T07:00:00.000Z',
        end: '2026-05-25T15:00:00.000Z',
        color: 'sky',
        isRecurring: false,
      });
      await flushAsyncWork();

      expect(firestoreMock.upsertManualShift).toHaveBeenCalledWith(
        'uid-auth',
        expect.objectContaining({ title: 'Cloud Manual' })
      );
    });

    it('should add recurring shifts with daily frequency', () => {
      const shiftData = {
        title: 'Daily Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'green' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts.length).toBeGreaterThan(1);
      expect(shifts.length).toBeLessThanOrEqual(800); // Safety limit

      // All shifts should have the same seriesId
      const seriesId = shifts[0].seriesId;
      expect(shifts.every(s => s.seriesId === seriesId)).toBe(true);
    });

    it('should add recurring shifts with weekly frequency', () => {
      const shiftData = {
        title: 'Weekly Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'amber' as const,
        isRecurring: true,
        repetition: {
          frequency: 'weeks' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts.length).toBeGreaterThan(1);
      expect(shifts.length).toBeLessThan(110); // ~104 weeks in 2 years
    });

    it('should preserve overtime and allowances in recurring shifts', () => {
      const shiftData = {
        title: 'Shift with Overtime',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'rose' as const,
        isRecurring: true,
        overtimeHours: 2,
        allowances: [{ name: 'Transport', amount: 10 }],
        repetition: {
          frequency: 'days' as const,
          interval: 7,
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts.length).toBeGreaterThan(1);
      expect(shifts[0].overtimeHours).toBe(2);
      expect(shifts[0].allowances).toEqual([{ name: 'Transport', amount: 10 }]);
    });

    it('should persist only the latest state when encrypt operations resolve out of order', async () => {
      const firstSave = createDeferred<string>();
      const secondSave = createDeferred<string>();
      let encryptCallCount = 0;

      jest.spyOn(cryptoService, 'encrypt').mockImplementation(async (data: string) => {
        encryptCallCount++;

        if (encryptCallCount === 1) {
          return firstSave.promise;
        }

        return secondSave.promise;
      });

      const stateA = {
        schemaVersion: 2 as const,
        shiftSeries: [],
        manualShifts: [
          {
            id: 'shift-1',
            title: 'First Shift',
            start: '2025-09-30T09:00:00',
            end: '2025-09-30T17:00:00',
            color: 'sky' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        shiftOverrides: [],
      };

      const stateB = {
        schemaVersion: 2 as const,
        shiftSeries: [],
        manualShifts: [
          ...stateA.manualShifts,
          {
            id: 'shift-2',
            title: 'Second Shift',
            start: '2025-10-01T09:00:00',
            end: '2025-10-01T17:00:00',
            color: 'green' as const,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        shiftOverrides: [],
      };

      (service as any).saveStateToStorage(stateA);
      (service as any).saveStateToStorage(stateB);

      expect(encryptCallCount).toBe(2);

      firstSave.resolve('encrypted-first');
      await flushAsyncWork();
      expect(localStorageMock['easyturno_user_data_v2']).toBeUndefined();

      secondSave.resolve('encrypted-second');
      await flushAsyncWork();

      expect(localStorageMock['easyturno_user_data_v2']).toBe('encrypted-second');
    });
  });

  describe('initialization', () => {
    it('should not overwrite encrypted storage before decrypt completes', async () => {
      localStorageMock['easyturno_shifts'] = 'encrypted-payload';

      const decryptReady = createDeferred<string>();
      const encryptSpy = jest.fn().mockResolvedValue('encrypted-after-load');

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          ShiftService,
          ToastService,
          {
            provide: CryptoService,
            useValue: {
              encrypt: encryptSpy,
              decrypt: jest.fn().mockReturnValue(decryptReady.promise),
              isEncrypted: jest.fn().mockReturnValue(true),
            },
          },
        ],
      });

      const delayedService = TestBed.inject(ShiftService);

      expect(delayedService.shifts()).toEqual([]);
      expect(encryptSpy).not.toHaveBeenCalled();
      // The legacy ciphertext must stay intact until decrypt completes.
      expect(localStorageMock['easyturno_shifts']).toBe('encrypted-payload');
      expect(localStorageMock['easyturno_user_data_v2']).toBeUndefined();

      decryptReady.resolve('[]');
      await flushAsyncWork();

      // After successful migration from legacy, the v2 key receives the
      // re-encrypted (empty) state. The legacy key is left alone — a future
      // task may clean it up after a stable v2 release window.
      const persistedState = (encryptSpy as jest.Mock).mock.calls[0][0];
      expect(JSON.parse(persistedState)).toMatchObject({ schemaVersion: 2 });
      expect(localStorageMock['easyturno_user_data_v2']).toBe('encrypted-after-load');
    });
  });

  describe('updateShift', () => {
    it('should update a single shift', () => {
      const shiftData = {
        title: 'Original Title',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      const shiftToUpdate = { ...shifts[0], title: 'Updated Title' };

      service.updateShift(shiftToUpdate);

      const updatedShifts = service.shifts();
      expect(updatedShifts[0].title).toBe('Updated Title');
    });

    it('should convert a single shift into a recurring series without leaving a duplicate manual shift', () => {
      service.addShift({
        title: 'Single Shift',
        start: '2026-05-25T07:00:00.000Z',
        end: '2026-05-25T15:00:00.000Z',
        color: 'sky',
        isRecurring: false,
      });

      const original = service.shifts()[0];

      service.updateShift({
        ...original,
        title: 'Recurring Shift',
        isRecurring: true,
        repetition: { frequency: 'days', interval: 1 },
      });

      const state = (service as any).state();
      expect(state.manualShifts).toHaveLength(1);
      expect(state.manualShifts[0]).toMatchObject({
        id: original.id,
        deletedAt: expect.any(String),
      });
      expect(state.shiftSeries).toHaveLength(1);
      expect(state.shiftSeries[0]).toMatchObject({
        title: 'Recurring Shift',
        start: original.start,
        end: original.end,
        repetition: { frequency: 'days', interval: 1 },
      });

      const visibleShifts = service.shifts();
      expect(visibleShifts.length).toBeGreaterThan(1);
      expect(visibleShifts.filter(shift => shift.start === original.start)).toHaveLength(1);
      expect(visibleShifts.every(shift => shift.isRecurring)).toBe(true);
      expect(visibleShifts.every(shift => shift.seriesId === state.shiftSeries[0].id)).toBe(true);
    });
  });

  describe('updateShiftSeries', () => {
    it('should update all shifts in a recurring series', () => {
      const shiftData = {
        title: 'Original Series',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'weeks' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      const originalCount = shifts.length;
      const seriesId = shifts[0].seriesId;

      // Update the series with new title and color
      const updatedShift = { ...shifts[0], title: 'Updated Series', color: 'green' as const };
      service.updateShiftSeries(updatedShift);

      const updatedShifts = service.shifts();
      // Should have same number of shifts
      expect(updatedShifts.length).toBeGreaterThanOrEqual(originalCount);
      // All shifts should have the updated title and color
      const newSeriesShifts = updatedShifts.filter(s => s.seriesId === seriesId);
      expect(newSeriesShifts.every(s => s.title === 'Updated Series')).toBe(true);
      expect(newSeriesShifts.every(s => s.color === 'green')).toBe(true);
    });

    it('should preserve shifts before the edited shift when updating a middle shift in series', () => {
      // Create a daily recurring series
      const shiftData = {
        title: 'Daily Shift',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);
      const shifts = service
        .shifts()
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      const seriesId = shifts[0].seriesId;
      const totalShifts = shifts.length;

      // Edit the 4th shift in the series (index 3)
      const fourthShift = shifts[3];
      const fourthShiftOriginalStart = fourthShift.start;

      // Count shifts before, at, and after the 4th shift
      const shiftsBeforeFourth = shifts.filter(
        s => new Date(s.start).getTime() < new Date(fourthShiftOriginalStart).getTime()
      );
      const shiftsAtOrAfterFourth = shifts.filter(
        s => new Date(s.start).getTime() >= new Date(fourthShiftOriginalStart).getTime()
      );

      expect(shiftsBeforeFourth.length).toBe(3); // First 3 shifts
      expect(shiftsAtOrAfterFourth.length).toBe(totalShifts - 3); // 4th shift and all after

      // Update the 4th shift with new title
      const updatedFourthShift = { ...fourthShift, title: 'Updated from 4th onwards' };
      service.updateShiftSeries(updatedFourthShift);

      const allShiftsAfterUpdate = service.shifts();
      const seriesShiftsAfterUpdate = allShiftsAfterUpdate
        .filter(s => s.seriesId === seriesId)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

      // The first 3 shifts should still exist with original title
      const firstThreeAfterUpdate = seriesShiftsAfterUpdate.filter(
        s => new Date(s.start).getTime() < new Date(fourthShiftOriginalStart).getTime()
      );
      expect(firstThreeAfterUpdate.length).toBe(3);
      expect(firstThreeAfterUpdate.every(s => s.title === 'Daily Shift')).toBe(true);

      // Shifts from the 4th onwards should have the new title
      const fourthOnwardsAfterUpdate = seriesShiftsAfterUpdate.filter(
        s => new Date(s.start).getTime() >= new Date(fourthShiftOriginalStart).getTime()
      );
      expect(fourthOnwardsAfterUpdate.length).toBeGreaterThan(0);
      expect(fourthOnwardsAfterUpdate.every(s => s.title === 'Updated from 4th onwards')).toBe(
        true
      );
    });
  });

  describe('deleteShift', () => {
    it('should delete a single shift by id', () => {
      const shiftData = {
        title: 'Shift to Delete',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      const shiftId = shifts[0].id;

      service.deleteShift(shiftId);

      expect(service.shifts()).toHaveLength(0);
    });

    it('should delete a single occurrence of a recurring series by setting a deleted override', () => {
      const shiftData = {
        title: 'Recurring Series Instance',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      // An occurrence of a recurring series has an ID of the form "seriesId:occurrenceStartMs"
      const targetShift = shifts[1];
      const shiftId = targetShift.id;

      service.deleteShift(shiftId);

      // Verify that this specific occurrence is deleted/removed from shifts list
      const updatedShifts = service.shifts();
      expect(updatedShifts.find(s => s.id === shiftId)).toBeUndefined();
    });
  });

  describe('deleteShiftSeries', () => {
    it('should delete all shifts in a recurring series', () => {
      const shiftData = {
        title: 'Series to Delete',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'green' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 7,
        },
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      const seriesId = shifts[0].seriesId;
      const initialCount = shifts.length;

      expect(initialCount).toBeGreaterThan(1);

      service.deleteShiftSeries(seriesId);

      expect(service.shifts()).toHaveLength(0);
    });

    it('should delete a recurring series and all its overrides', () => {
      const shiftData = {
        title: 'Series with Overrides',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'green' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      const seriesId = shifts[0].seriesId;

      // Edit a single instance to create an override
      service.updateShift({
        ...shifts[1],
        title: 'Overridden Instance',
        color: 'amber',
      });

      // Now delete the entire series
      service.deleteShiftSeries(seriesId);

      expect(service.shifts()).toHaveLength(0);
      // Verify that overrides for this series are also soft-deleted (deletedAt is set)
      const overrides = (service as any).state().shiftOverrides;
      const seriesOverrides = overrides.filter((o: any) => o.seriesId === seriesId);
      expect(seriesOverrides.every((o: any) => o.deletedAt !== undefined)).toBe(true);
    });
  });

  describe('importShifts', () => {
    it('should import valid shifts from JSON', () => {
      const validShift: Shift = {
        id: 'test-id-1',
        seriesId: 'test-series-1',
        title: 'Imported Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      const json = JSON.stringify([validShift]);
      const result = service.importShifts(json);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(service.shifts()).toHaveLength(1);
      expect(service.shifts()[0].title).toBe('Imported Shift');
    });

    it('should reject invalid JSON format', () => {
      const result = service.importShifts('invalid json');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to parse JSON');
    });

    it('should reject non-array JSON', () => {
      const result = service.importShifts('{"not": "array"}');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid format: expected array');
    });

    it('should reject array with no valid shifts', () => {
      const result = service.importShifts('[{"invalid": "shift"}]');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should filter out invalid shifts and import only valid ones', () => {
      const validShift: Shift = {
        id: 'test-id-1',
        seriesId: 'test-series-1',
        title: 'Valid Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      const json = JSON.stringify([validShift, { invalid: 'shift' }]);
      const result = service.importShifts(json);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(service.shifts()).toHaveLength(1);
    });

    it('should reject oversized backup payloads', () => {
      const oversizedPayload = 'x'.repeat(5 * 1024 * 1024 + 1);

      const result = service.importShifts(oversizedPayload);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Backup file too large');
    });

    it('imports legacy Shift[] backups into v2 manual state', () => {
      const result = service.importShifts(
        JSON.stringify([
          {
            id: 'backup-1',
            seriesId: 'backup-1',
            title: 'Backup manual',
            start: '2026-02-01T08:00:00.000Z',
            end: '2026-02-01T16:00:00.000Z',
            color: 'teal',
            isRecurring: false,
          },
        ])
      );

      expect(result.success).toBe(true);
      expect(service.shifts().some(s => s.title === 'Backup manual')).toBe(true);
    });

    it('exports v2 state for new backups', () => {
      service.addShift({
        title: 'Backup v2',
        start: '2026-02-02T08:00:00.000Z',
        end: '2026-02-02T16:00:00.000Z',
        color: 'indigo',
        isRecurring: false,
      });

      // @ts-ignore - exportBackupPayload might not exist yet
      const backup = service.exportBackupPayload();
      expect(JSON.parse(backup).schemaVersion).toBe(2);
    });
  });

  describe('deleteAllShifts', () => {
    it('should delete all shifts', () => {
      const shiftData = {
        title: 'Test Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);
      service.addShift(shiftData);

      expect(service.shifts().length).toBeGreaterThan(0);

      service.deleteAllShifts();

      expect(service.shifts()).toHaveLength(0);
    });
  });

  describe('localStorage persistence', () => {
    it('should save shifts to localStorage', done => {
      const shiftData = {
        title: 'Persistent Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      // Wait for effect to run
      setTimeout(() => {
        const storedData = localStorageMock['easyturno_user_data_v2'];
        expect(storedData).toBeTruthy();
        const parsed = JSON.parse(storedData);
        expect(parsed.schemaVersion).toBe(2);
        expect(parsed.manualShifts).toHaveLength(1);
        expect(parsed.manualShifts[0].title).toBe('Persistent Shift');
        done();
      }, 100);
    });

    it('should load shifts from localStorage on initialization', () => {
      const shifts: Shift[] = [
        {
          id: 'test-id-1',
          seriesId: 'test-series-1',
          title: 'Pre-existing Shift',
          start: '2025-09-30T09:00:00',
          end: '2025-09-30T17:00:00',
          color: 'sky' as const,
          isRecurring: false,
        },
      ];

      // Reset TestBed and set localStorage before creating service
      TestBed.resetTestingModule();
      localStorageMock['easyturno_shifts'] = JSON.stringify(shifts);

      TestBed.configureTestingModule({
        providers: [ShiftService, ToastService],
      });

      // Create new service instance
      const newService = TestBed.inject(ShiftService);

      expect(newService.shifts()).toHaveLength(1);
      expect(newService.shifts()[0].title).toBe('Pre-existing Shift');
    });

    it('should handle QuotaExceededError gracefully', done => {
      const errorSpy = jest.spyOn(toastService, 'error');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock encrypt to succeed but setItem to throw QuotaExceededError
      (cryptoService.encrypt as jest.Mock).mockImplementation(async (data: string) => data);
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw error;
      });

      const shiftData = {
        title: 'Large Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      // Wait for effect to run
      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'LocalStorage quota exceeded. Cannot save shifts.'
        );
        expect(errorSpy).toHaveBeenCalledWith(
          'Storage limit reached. Please export and remove old shifts to free up space.',
          5000
        );
        consoleErrorSpy.mockRestore();
        done();
      }, 100);
    });

    it('should handle generic storage errors gracefully', done => {
      const errorSpy = jest.spyOn(toastService, 'error');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Mock encrypt to throw generic error
      (cryptoService.encrypt as jest.Mock).mockRejectedValue(new Error('Encryption error'));

      const shiftData = {
        title: 'Shift with Error',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      // Wait for effect to run
      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to encrypt shifts', expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith('Failed to save shifts. Please try again.', 4000);
        consoleErrorSpy.mockRestore();
        done();
      }, 100);
    });

    it('should handle corrupted localStorage data', () => {
      // Reset TestBed and set corrupted data
      TestBed.resetTestingModule();
      localStorageMock['easyturno_shifts'] = 'corrupted-json-data-{';

      // Mock CryptoService
      const mockCryptoService = {
        encrypt: jest.fn().mockImplementation(async (data: string) => data),
        decrypt: jest.fn().mockRejectedValue(new Error('Decryption failed')),
        isEncrypted: jest.fn().mockReturnValue(true),
      };

      TestBed.configureTestingModule({
        providers: [
          ShiftService,
          ToastService,
          { provide: CryptoService, useValue: mockCryptoService },
        ],
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      // Should not throw, but handle error gracefully
      const newService = TestBed.inject(ShiftService);
      expect(newService).toBeTruthy();
      expect(newService.shifts()).toEqual([]);

      consoleErrorSpy.mockRestore();
    });

    it('should handle empty localStorage gracefully', () => {
      TestBed.resetTestingModule();
      delete localStorageMock['easyturno_shifts'];

      TestBed.configureTestingModule({
        providers: [ShiftService, ToastService],
      });

      const newService = TestBed.inject(ShiftService);
      expect(newService.shifts()).toEqual([]);
    });
  });

  describe('Edge Cases - Invalid Date Ranges', () => {
    it('should handle end date before start date', () => {
      const shiftData = {
        title: 'Invalid Date Range',
        start: '2025-09-30T17:00:00',
        end: '2025-09-30T09:00:00', // End before start
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      // Service doesn't validate date logic, just stores it
      expect(new Date(shifts[0].start).getTime()).toBeGreaterThan(
        new Date(shifts[0].end).getTime()
      );
    });

    it('should handle same start and end dates', () => {
      const shiftData = {
        title: 'Zero Duration Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T09:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].start).toBe(shifts[0].end);
    });

    it('should handle dates far in the past', () => {
      const shiftData = {
        title: 'Historical Shift',
        start: '1900-01-01T09:00:00',
        end: '1900-01-01T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Historical Shift');
    });

    it('should handle dates far in the future', () => {
      const shiftData = {
        title: 'Future Shift',
        start: '2999-12-31T09:00:00',
        end: '2999-12-31T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Future Shift');
    });
  });

  describe('Edge Cases - Recurring Shifts Boundary Conditions', () => {
    it('should cap a daily recurrence at MAX_YEARS_AHEAD (≈730 days over 2 years)', () => {
      const shiftData = {
        title: 'Daily Max Test',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      // Daily over a 2-year horizon yields ~730 instances; the count cap
      // (MAX_RECURRING_INSTANCES = 800) is the upper safety bound.
      expect(shifts.length).toBeGreaterThan(720);
      expect(shifts.length).toBeLessThanOrEqual(800);
    });

    it('should respect MAX_YEARS_AHEAD limit (2 years)', () => {
      const shiftData = {
        title: 'Yearly Shift',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'years' as const,
          interval: 1, // Every year
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      // Should generate exactly 2 shifts (2025, 2026) — 2 years from start date (2025-01-01)
      // maxDate = 2027-01-01, so 2027-01-01 is excluded by strict < comparison
      expect(shifts.length).toBe(2);

      // Verify no shift is more than 2 years from the start date
      const startDate = new Date('2025-01-01T09:00:00');
      const twoYearsFromStart = new Date(startDate);
      twoYearsFromStart.setFullYear(twoYearsFromStart.getFullYear() + 2);

      shifts.forEach(shift => {
        expect(new Date(shift.start).getTime()).toBeLessThan(twoYearsFromStart.getTime());
      });
    });

    it('should handle large interval values', () => {
      const shiftData = {
        title: 'Large Interval Shift',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 999, // Very large interval
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      // Should only generate 1 shift since next would be beyond 2 years
      expect(shifts.length).toBeLessThanOrEqual(2);
    });

    it('should handle zero or negative intervals gracefully', () => {
      const shiftData = {
        title: 'Zero Interval Shift',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 0, // Invalid: zero interval
        },
      };

      // This would create an infinite loop without MAX_RECURRING_INSTANCES protection
      service.addShift(shiftData);

      const shifts = service.shifts();
      // Should still respect MAX_RECURRING_INSTANCES limit
      expect(shifts.length).toBeLessThanOrEqual(800);
    });

    it('should handle monthly shifts with different month lengths', () => {
      const shiftData = {
        title: 'Monthly End-of-Month Shift',
        start: '2025-01-31T09:00:00', // January 31st
        end: '2025-01-31T17:00:00',
        color: 'sky' as const,
        isRecurring: true,
        repetition: {
          frequency: 'months' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts.length).toBeGreaterThan(1);

      // Verify dates - February doesn't have 31 days, JS Date handles this
      // by rolling to March 2nd or 3rd
      shifts.slice(0, 5).forEach(shift => {
        const date = new Date(shift.start);
        expect(date.getDate()).toBeGreaterThan(0); // Valid date
      });
    });
  });

  describe('Edge Cases - Overtime and Allowances', () => {
    it('should handle negative overtime hours', () => {
      const shiftData = {
        title: 'Negative Overtime',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        overtimeHours: -5, // Invalid negative value
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].overtimeHours).toBe(-5); // Service stores as-is
    });

    it('should handle extremely large overtime hours', () => {
      const shiftData = {
        title: 'Large Overtime',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        overtimeHours: 999999,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].overtimeHours).toBe(999999);
    });

    it('should handle fractional overtime hours', () => {
      const shiftData = {
        title: 'Fractional Overtime',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        overtimeHours: 2.5,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].overtimeHours).toBe(2.5);
    });

    it('should handle empty allowances array', () => {
      const shiftData = {
        title: 'No Allowances',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        allowances: [],
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].allowances).toEqual([]);
    });

    it('should handle allowances with negative amounts', () => {
      const shiftData = {
        title: 'Negative Allowances',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        allowances: [{ name: 'Deduction', amount: -50 }],
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].allowances).toEqual([{ name: 'Deduction', amount: -50 }]);
    });

    it('should handle allowances with empty name', () => {
      const shiftData = {
        title: 'Empty Allowance Name',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        allowances: [{ name: '', amount: 10 }],
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].allowances?.[0].name).toBe('');
    });

    it('should handle multiple allowances with same name', () => {
      const shiftData = {
        title: 'Duplicate Allowance Names',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        allowances: [
          { name: 'Transport', amount: 10 },
          { name: 'Transport', amount: 20 },
        ],
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].allowances).toHaveLength(2);
    });
  });

  describe('Edge Cases - Update and Delete Operations', () => {
    it('should handle updating non-existent shift', () => {
      const nonExistentShift: Shift = {
        id: 'non-existent-id',
        seriesId: 'non-existent-series',
        title: 'Ghost Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.updateShift(nonExistentShift);

      // Should not throw error, just have no effect
      expect(service.shifts()).toHaveLength(0);
    });

    it('should handle deleting non-existent shift', () => {
      service.deleteShift('non-existent-id');

      // Should not throw error
      expect(service.shifts()).toHaveLength(0);
    });

    it('should handle deleting non-existent series', () => {
      service.deleteShiftSeries('non-existent-series');

      // Should not throw error
      expect(service.shifts()).toHaveLength(0);
    });

    it('should handle concurrent modifications', () => {
      const shiftData = {
        title: 'Shift 1',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      // Add multiple shifts quickly
      service.addShift(shiftData);
      service.addShift({ ...shiftData, title: 'Shift 2' });
      service.addShift({ ...shiftData, title: 'Shift 3' });

      expect(service.shifts()).toHaveLength(3);

      // Delete them in quick succession
      const shifts = service.shifts();
      service.deleteShift(shifts[0].id);
      service.deleteShift(shifts[1].id);
      service.deleteShift(shifts[2].id);

      expect(service.shifts()).toHaveLength(0);
    });

    it('should preserve other shifts when updating one', () => {
      service.addShift({
        title: 'Shift 1',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      });

      service.addShift({
        title: 'Shift 2',
        start: '2025-10-01T09:00:00',
        end: '2025-10-01T17:00:00',
        color: 'green' as const,
        isRecurring: false,
      });

      const shifts = service.shifts();
      const updatedShift = { ...shifts[0], title: 'Updated Shift 1' };
      service.updateShift(updatedShift);

      const finalShifts = service.shifts();
      expect(finalShifts).toHaveLength(2);
      expect(finalShifts.find(s => s.id === shifts[0].id)?.title).toBe('Updated Shift 1');
      expect(finalShifts.find(s => s.id === shifts[1].id)?.title).toBe('Shift 2');
    });
  });

  describe('Edge Cases - Import Validation', () => {
    it('should reject shifts with missing required fields', () => {
      const invalidShift = {
        id: 'test-id',
        // Missing: title, start, end, color, isRecurring, seriesId
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shifts with invalid date formats', () => {
      const invalidShift = {
        id: 'test-id',
        seriesId: 'test-series',
        title: 'Invalid Date Shift',
        start: 'not-a-date',
        end: 'also-not-a-date',
        color: 'sky' as const,
        isRecurring: false,
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject null shifts', () => {
      const result = service.importShifts(JSON.stringify([null]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shifts with non-string dates', () => {
      const invalidShift = {
        id: 'test-id',
        seriesId: 'test-series',
        title: 'Invalid Date Type',
        start: 123456789, // number instead of string
        end: 987654321, // number instead of string
        color: 'sky' as const,
        isRecurring: false,
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should accept shifts with valid extra fields', () => {
      const validShiftWithExtras: Shift = {
        id: 'test-id',
        seriesId: 'test-series',
        title: 'Valid Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
        overtimeHours: 2,
        allowances: [{ name: 'Meal', amount: 15 }],
        notes: 'Test notes',
      };

      const result = service.importShifts(JSON.stringify([validShiftWithExtras]));

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(service.shifts()[0].overtimeHours).toBe(2);
      expect(service.shifts()[0].allowances).toEqual([{ name: 'Meal', amount: 15 }]);
    });

    it('should handle large import files', () => {
      const largeArray = Array.from({ length: 1000 }, (_, i) => ({
        id: `test-id-${i}`,
        seriesId: `test-series-${i}`,
        title: `Shift ${i}`,
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      }));

      const result = service.importShifts(JSON.stringify(largeArray));

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1000);
      expect(service.shifts()).toHaveLength(1000);
    });

    it('should handle empty array', () => {
      const result = service.importShifts('[]');

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should handle null values in shift fields', () => {
      const shiftWithNull = {
        id: 'test-id',
        seriesId: 'test-series',
        title: null, // Invalid: should be string
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      const result = service.importShifts(JSON.stringify([shiftWithNull]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should replace existing shifts on import', () => {
      // Add some shifts
      service.addShift({
        title: 'Existing Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      });

      expect(service.shifts()).toHaveLength(1);

      // Import different shifts
      const importData: Shift[] = [
        {
          id: 'import-id',
          seriesId: 'import-series',
          title: 'Imported Shift',
          start: '2025-10-01T09:00:00',
          end: '2025-10-01T17:00:00',
          color: 'green' as const,
          isRecurring: false,
        },
      ];

      const result = service.importShifts(JSON.stringify(importData));

      expect(result.success).toBe(true);
      expect(service.shifts()).toHaveLength(1);
      expect(service.shifts()[0].title).toBe('Imported Shift');
    });
  });

  describe('Edge Cases - Special Characters and Unicode', () => {
    it('should handle special characters in shift title', () => {
      const shiftData = {
        title: '!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('!@#$%^&*()_+-={}[]|\\:";\'<>?,./~`');
    });

    it('should handle unicode characters in shift title', () => {
      const shiftData = {
        title: '🚀 Turno Straordinario 日本語 中文 한글 العربية',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('🚀 Turno Straordinario 日本語 中文 한글 العربية');
    });

    it('should handle very long shift titles', () => {
      const longTitle = 'A'.repeat(10000);
      const shiftData = {
        title: longTitle,
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky' as const,
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe(longTitle);
    });
  });

  describe('isValidShift — optional field validation (T6)', () => {
    const baseValidShift = {
      id: 'test-id',
      seriesId: 'test-series',
      title: 'Base Shift',
      start: '2025-09-30T09:00:00',
      end: '2025-09-30T17:00:00',
      color: 'sky' as const,
      isRecurring: false,
    };

    it('should reject shift with allowances as non-array (object)', () => {
      const invalidShift = {
        ...baseValidShift,
        allowances: { name: 'Transport', amount: 10 },
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with allowances as string', () => {
      const invalidShift = {
        ...baseValidShift,
        allowances: 'not-an-array',
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with allowance entries containing non-numeric amount', () => {
      const invalidShift = {
        ...baseValidShift,
        allowances: [{ name: 'Transport', amount: 'ten' }],
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with repetition.interval < 1', () => {
      const invalidShift = {
        ...baseValidShift,
        isRecurring: true,
        repetition: { frequency: 'days', interval: 0 },
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with negative repetition.interval', () => {
      const invalidShift = {
        ...baseValidShift,
        isRecurring: true,
        repetition: { frequency: 'weeks', interval: -3 },
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with invalid repetition.frequency', () => {
      const invalidShift = {
        ...baseValidShift,
        isRecurring: true,
        repetition: { frequency: 'hours', interval: 1 },
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with repetition missing frequency field', () => {
      const invalidShift = {
        ...baseValidShift,
        isRecurring: true,
        repetition: { interval: 1 },
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with notes as non-string (number)', () => {
      const invalidShift = {
        ...baseValidShift,
        notes: 42,
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with notes as object', () => {
      const invalidShift = {
        ...baseValidShift,
        notes: { text: 'invalid' },
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with timezone as non-string', () => {
      const invalidShift = {
        ...baseValidShift,
        timezone: 123,
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with overtimeHours = Infinity (via 1e500)', () => {
      const json = JSON.stringify([baseValidShift]).replace(/\}\]$/, ',"overtimeHours":1e500}]');

      const result = service.importShifts(json);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with overtimeHours = -Infinity (via -1e500)', () => {
      const json = JSON.stringify([baseValidShift]).replace(/\}\]$/, ',"overtimeHours":-1e500}]');

      const result = service.importShifts(json);

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should reject shift with overtimeHours as string', () => {
      const invalidShift = {
        ...baseValidShift,
        overtimeHours: '2.5',
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));

      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });

    it('should accept shift with all optional fields valid', () => {
      const validShift = {
        ...baseValidShift,
        isRecurring: true,
        repetition: { frequency: 'weeks', interval: 2 },
        notes: 'Some notes',
        timezone: 'Europe/Rome',
        overtimeHours: 1.5,
        allowances: [{ name: 'Meal', amount: 12 }],
      };

      const result = service.importShifts(JSON.stringify([validShift]));

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
    });

    it('should successfully import a valid v2 schema JSON and cancel old notifications', () => {
      const v2State = {
        schemaVersion: 2,
        shiftSeries: [
          {
            id: 'series-1',
            title: 'Series 1',
            start: '2026-05-20T08:00:00.000Z',
            end: '2026-05-20T16:00:00.000Z',
            color: 'indigo',
            isRecurring: true,
            repetition: { frequency: 'days', interval: 1 },
          },
        ],
        manualShifts: [
          {
            id: 'manual-1',
            title: 'Manual 1',
            start: '2026-05-21T08:00:00.000Z',
            end: '2026-05-21T16:00:00.000Z',
            color: 'green',
            isRecurring: false,
          },
        ],
        shiftOverrides: [],
      };

      const notificationService = (service as any).notificationService;
      const cancelSpy = jest
        .spyOn(notificationService, 'cancelAllNotifications')
        .mockResolvedValue(undefined as any);

      const result = service.importShifts(JSON.stringify(v2State));
      expect(result.success).toBe(true);
      expect(result.imported).toBe(2);
      expect(cancelSpy).toHaveBeenCalled();
      cancelSpy.mockRestore();
    });

    it('should schedule notifications for upcoming shifts in legacy import', async () => {
      const futureDate = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      const legacyShifts = [
        {
          id: 'legacy-future',
          seriesId: 'legacy-future',
          title: 'Future Legacy Shift',
          start: futureDate,
          end: futureDate,
          color: 'indigo',
          isRecurring: false,
        },
      ];

      const notificationService = (service as any).notificationService;
      const scheduleSpy = jest
        .spyOn(notificationService, 'scheduleShiftNotification')
        .mockResolvedValue(undefined as any);

      const result = service.importShifts(JSON.stringify(legacyShifts));
      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);

      // flush promise inside then() callback
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(scheduleSpy).toHaveBeenCalled();
      scheduleSpy.mockRestore();
    });

    it('should fail isValidISODate when non-string is passed to validation', () => {
      const invalidShift = {
        ...baseValidShift,
        start: 1234567890, // number, not string
      };

      const result = service.importShifts(JSON.stringify([invalidShift]));
      expect(result.success).toBe(false);
      expect(result.error).toBe('No valid shifts found');
    });
  });

  describe('resetAfterDecryptionError (T6)', () => {
    it('should clear decryptionError, remove stored ciphertext, and re-enable saves', async () => {
      // Arrange a fresh service that enters the decryption-error state on load
      TestBed.resetTestingModule();
      localStorageMock['easyturno_shifts'] = 'corrupted-ciphertext';

      const mockCryptoService = {
        encrypt: jest.fn().mockImplementation(async (data: string) => `enc:${data}`),
        decrypt: jest.fn().mockRejectedValue(new Error('Decryption failed')),
        isEncrypted: jest.fn().mockReturnValue(true),
      };

      TestBed.configureTestingModule({
        providers: [
          ShiftService,
          ToastService,
          { provide: CryptoService, useValue: mockCryptoService },
        ],
      });

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const newService = TestBed.inject(ShiftService);

      // Wait for the rejected decrypt promise to propagate
      await flushAsyncWork();

      expect(newService.decryptionError()).toBe(true);
      // Ciphertext must still be present — service should not auto-clear on failure
      expect(localStorageMock['easyturno_shifts']).toBe('corrupted-ciphertext');

      // Act
      newService.resetAfterDecryptionError();

      // Assert: state cleared
      expect(newService.decryptionError()).toBe(false);
      expect(newService.shifts()).toEqual([]);

      // Saves are re-enabled: the empty-state save effect must have run and
      // written a fresh (encrypted) value to localStorage under the v2 key.
      // The legacy ciphertext key is removed by the reset.
      await flushAsyncWork();

      const emptyState = JSON.stringify({
        schemaVersion: 2,
        shiftSeries: [],
        manualShifts: [],
        shiftOverrides: [],
      });
      expect(mockCryptoService.encrypt).toHaveBeenCalledWith(emptyState);
      expect(localStorageMock['easyturno_user_data_v2']).toBe(`enc:${emptyState}`);
      expect(localStorageMock['easyturno_shifts']).toBeUndefined();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('v2 state migration', () => {
    it('loads legacy easyturno_shifts into manual and series state without losing visible shifts', async () => {
      const legacy = [
        {
          id: 'legacy-1',
          seriesId: 'legacy-1',
          title: 'Legacy manual',
          start: '2026-01-01T08:00:00.000Z',
          end: '2026-01-01T16:00:00.000Z',
          color: 'indigo',
          isRecurring: false,
        },
      ];
      localStorageMock['easyturno_shifts'] = JSON.stringify(legacy);

      TestBed.resetTestingModule();
      const mockCryptoService = {
        encrypt: jest.fn().mockImplementation(async (data: string) => data),
        decrypt: jest.fn().mockImplementation(async (data: string) => data),
        isEncrypted: jest.fn().mockReturnValue(false),
      };
      TestBed.configureTestingModule({
        providers: [
          ShiftService,
          ToastService,
          { provide: CryptoService, useValue: mockCryptoService },
        ],
      });
      const migrated = TestBed.inject(ShiftService);
      await flushAsyncWork();

      expect(migrated.shifts()).toHaveLength(1);
      expect(migrated.shifts()[0].title).toBe('Legacy manual');
    });

    it('persists new shifts to easyturno_user_data_v2', async () => {
      service.addShift({
        title: 'Stored manual',
        start: '2026-01-02T08:00:00.000Z',
        end: '2026-01-02T16:00:00.000Z',
        color: 'sky',
        isRecurring: false,
      });

      await flushAsyncWork();

      expect(localStorageMock['easyturno_user_data_v2']).toContain('Stored manual');
    });
  });

  describe('Hardening & Coverage Improvements (T12)', () => {
    it('should directly validate dates using isValidISODate', () => {
      expect((service as any).isValidISODate(123)).toBe(false);
      expect((service as any).isValidISODate(null)).toBe(false);
      expect((service as any).isValidISODate(undefined)).toBe(false);
      expect((service as any).isValidISODate('invalid-date')).toBe(false);
      expect((service as any).isValidISODate('2026-05-21')).toBe(true);
    });

    it('should handle malformed JSON v2 parsing failure in loadFromStorage', async () => {
      TestBed.resetTestingModule();
      localStorageMock['easyturno_user_data_v2'] = '{invalid-json-v2';

      const mockCryptoService = {
        encrypt: jest.fn().mockImplementation(async (data: string) => data),
        decrypt: jest.fn().mockImplementation(async (data: string) => data),
        isEncrypted: jest.fn().mockReturnValue(false),
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      TestBed.configureTestingModule({
        providers: [
          ShiftService,
          ToastService,
          { provide: CryptoService, useValue: mockCryptoService },
        ],
      });

      const newService = TestBed.inject(ShiftService);
      await flushAsyncWork();

      expect(newService.shifts()).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle malformed decrypted V2 parsing failure', async () => {
      TestBed.resetTestingModule();
      localStorageMock['easyturno_user_data_v2'] = 'encrypted-v2-data';

      const mockCryptoService = {
        encrypt: jest.fn().mockImplementation(async (data: string) => data),
        decrypt: jest.fn().mockResolvedValue('{invalid decrypted v2 json'),
        isEncrypted: jest.fn().mockReturnValue(true),
      };

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      TestBed.configureTestingModule({
        providers: [
          ShiftService,
          ToastService,
          { provide: CryptoService, useValue: mockCryptoService },
        ],
      });

      const newService = TestBed.inject(ShiftService);
      await flushAsyncWork();

      expect(newService.shifts()).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it('should handle JSON.stringify / Quota Exceeded error on saveStateToStorage', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const toastSpy = jest.spyOn(toastService, 'error');

      const stringifySpy = jest.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new DOMException('QuotaExceededError', 'QuotaExceededError');
      });

      service.addShift({
        title: 'Quota Shift',
        start: '2026-05-21T09:00:00.000Z',
        end: '2026-05-21T17:00:00.000Z',
        color: 'sky',
        isRecurring: false,
      });

      await flushAsyncWork();

      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith('Failed to save shifts. Please try again.', 4000);

      consoleErrorSpy.mockRestore();
      toastSpy.mockRestore();
      stringifySpy.mockRestore();
    });

    it('should reset to an empty state when legacy parsed storage is not an array', () => {
      (service as any).applyLegacyParsed({ invalid: true });

      expect(service.shifts()).toEqual([]);
      expect((service as any).state()).toEqual({
        schemaVersion: 2,
        shiftSeries: [],
        manualShifts: [],
        shiftOverrides: [],
      });
    });

    it('should reject non-object and malformed v2 state shapes', () => {
      expect((service as any).isShiftDataState(null)).toBe(false);
      expect((service as any).isShiftDataState('not-state')).toBe(false);
      expect((service as any).isShiftDataState({ schemaVersion: 2 })).toBe(false);
    });

    it('should not save state before initial loading has completed', () => {
      (service as any).isLoaded = false;

      (service as any).saveStateToStorage({
        schemaVersion: 2,
        shiftSeries: [],
        manualShifts: [],
        shiftOverrides: [],
      });

      expect(cryptoService.encrypt).not.toHaveBeenCalled();
    });

    it('should return null for malformed occurrence IDs', () => {
      expect((service as any).parseOccurrenceId('manual-id')).toBeNull();
      expect((service as any).parseOccurrenceId('__2026-05-21T08:00:00.000Z')).toBeNull();
      expect((service as any).parseOccurrenceId('series-1__')).toBeNull();
    });

    it('should ignore deleted series when materializing occurrences', () => {
      const result = (service as any).materializeOccurrences({
        schemaVersion: 2,
        manualShifts: [],
        shiftOverrides: [],
        shiftSeries: [
          {
            id: 'deleted-series',
            title: 'Deleted',
            start: '2026-05-21T08:00:00.000Z',
            end: '2026-05-21T16:00:00.000Z',
            color: 'sky',
            repetition: { frequency: 'days', interval: 1 },
            createdAt: '2026-05-21T00:00:00.000Z',
            updatedAt: '2026-05-21T00:00:00.000Z',
            deletedAt: '2026-05-22T00:00:00.000Z',
          },
        ],
      });

      expect(result).toEqual([]);
    });

    it('should build state from recurring shifts with identical start dates', () => {
      const sameStart = '2026-05-21T08:00:00.000Z';
      const state = (service as any).buildStateFromShifts([
        {
          id: 'occ-1',
          seriesId: 'series-1',
          title: 'First',
          start: sameStart,
          end: '2026-05-21T16:00:00.000Z',
          color: 'sky',
          isRecurring: true,
          repetition: { frequency: 'days', interval: 1 },
        },
        {
          id: 'occ-2',
          seriesId: 'series-2',
          title: 'Second',
          start: sameStart,
          end: '2026-05-21T17:00:00.000Z',
          color: 'green',
          isRecurring: true,
          repetition: { frequency: 'weeks', interval: 1 },
        },
      ]);

      expect(state.shiftSeries.map((series: any) => series.id)).toEqual(['series-1', 'series-2']);
      expect(state.manualShifts).toEqual([]);
    });

    it('should report generic save failures that are not quota errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const toastSpy = jest.spyOn(toastService, 'error');
      (Storage.prototype.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('storage unavailable');
      });

      service.addShift({
        title: 'Generic Save Failure',
        start: '2026-05-21T09:00:00.000Z',
        end: '2026-05-21T17:00:00.000Z',
        color: 'sky',
        isRecurring: false,
      });

      await flushAsyncWork();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to encrypt shifts', expect.any(Error));
      expect(toastSpy).toHaveBeenCalledWith('Failed to save shifts. Please try again.', 4000);

      consoleErrorSpy.mockRestore();
      toastSpy.mockRestore();
    });

    it('should overwrite / update an existing shift override when modified again', async () => {
      // 1. Add a recurring series
      service.addShift({
        title: 'Recurring Series',
        start: '2026-05-21T08:00:00.000Z',
        end: '2026-05-21T16:00:00.000Z',
        color: 'indigo',
        isRecurring: true,
        repetition: { frequency: 'days', interval: 1 },
      });

      await flushAsyncWork();

      const allShifts = service.shifts();
      const occurrence = allShifts.find(s => s.start.startsWith('2026-05-22'));
      expect(occurrence).toBeTruthy();

      // 2. Modify that occurrence (creates first override)
      const updatedOccurrence1 = {
        ...occurrence!,
        title: 'Modified Once',
      };

      service.updateShift(updatedOccurrence1);
      await flushAsyncWork();

      const overridesAfterFirst = (service as any).state().shiftOverrides;
      expect(overridesAfterFirst).toHaveLength(1);
      expect(overridesAfterFirst[0].action).toBe('modified');
      expect(overridesAfterFirst[0].title).toBe('Modified Once');

      // 3. Modify the same occurrence again (should overwrite the existing override)
      const updatedOccurrence2 = {
        ...updatedOccurrence1,
        title: 'Modified Twice',
      };

      service.updateShift(updatedOccurrence2);
      await flushAsyncWork();

      const overridesAfterSecond = (service as any).state().shiftOverrides;
      expect(overridesAfterSecond).toHaveLength(1); // Still 1, did not duplicate!
      expect(overridesAfterSecond[0].title).toBe('Modified Twice');
    });

    it('should fallback to deleting and adding fresh if series is not found in updateShiftSeries', async () => {
      const deleteSpy = jest.spyOn(service, 'deleteShiftSeries');
      const addSpy = jest.spyOn(service, 'addShift');

      const nonExistentShift = {
        id: 'non-existent-occurrence-id',
        seriesId: 'non-existent-series-id',
        title: 'Ghost Series',
        start: '2026-05-21T09:00:00.000Z',
        end: '2026-05-21T17:00:00.000Z',
        color: 'sky' as const,
        isRecurring: true,
        repetition: { frequency: 'days' as const, interval: 1 },
      };

      service.updateShiftSeries(nonExistentShift);
      await flushAsyncWork();

      expect(deleteSpy).toHaveBeenCalledWith('non-existent-series-id');
      expect(addSpy).toHaveBeenCalled();
    });

    it('should update an existing series when the edited shift ID is not an occurrence ID', async () => {
      service.addShift({
        title: 'Base Series',
        start: '2026-05-21T08:00:00.000Z',
        end: '2026-05-21T16:00:00.000Z',
        color: 'sky',
        isRecurring: true,
        repetition: { frequency: 'days', interval: 1 },
      });
      await flushAsyncWork();
      const series = (service as any).state().shiftSeries[0];

      service.updateShiftSeries({
        id: series.id,
        seriesId: series.id,
        title: 'Updated Direct Series',
        start: series.start,
        end: series.end,
        color: 'green',
        isRecurring: true,
        repetition: { frequency: 'weeks', interval: 1 },
      });
      await flushAsyncWork();

      expect((service as any).state().shiftSeries[0]).toMatchObject({
        title: 'Updated Direct Series',
        repetition: { frequency: 'weeks', interval: 1 },
      });
    });

    it('should reject malformed repetitions and allowances through private validators', () => {
      expect((service as any).isValidRepetition(null)).toBe(false);
      expect((service as any).isValidRepetition({ frequency: 'quarters', interval: 1 })).toBe(
        false
      );
      expect((service as any).isValidRepetition({ frequency: 'days', interval: 0 })).toBe(false);
      expect((service as any).isValidAllowance(null)).toBe(false);
      expect((service as any).isValidAllowance({ name: 'Meal', amount: Number.NaN })).toBe(false);
    });
  });
});
