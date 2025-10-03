import { TestBed } from '@angular/core/testing';
import { ShiftService } from './shift.service';
import { ToastService } from './toast.service';
import { Shift, Repetition } from '../shift.model';

describe('ShiftService', () => {
  let service: ShiftService;
  let toastService: ToastService;
  let localStorageMock: { [key: string]: string };

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

    TestBed.configureTestingModule({
      providers: [ShiftService, ToastService],
    });

    service = TestBed.inject(ShiftService);
    toastService = TestBed.inject(ToastService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('addShift', () => {
    it('should add a single non-recurring shift', () => {
      const shiftData = {
        title: 'Test Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Test Shift');
      expect(shifts[0].id).toBeTruthy();
      expect(shifts[0].seriesId).toBe(shifts[0].id);
    });

    it('should add recurring shifts with daily frequency', () => {
      const shiftData = {
        title: 'Daily Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'green',
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 1,
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts.length).toBeGreaterThan(1);
      expect(shifts.length).toBeLessThanOrEqual(200); // Safety limit

      // All shifts should have the same seriesId
      const seriesId = shifts[0].seriesId;
      expect(shifts.every(s => s.seriesId === seriesId)).toBe(true);
    });

    it('should add recurring shifts with weekly frequency', () => {
      const shiftData = {
        title: 'Weekly Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'amber',
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
        color: 'rose',
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
  });

  describe('updateShift', () => {
    it('should update a single shift', () => {
      const shiftData = {
        title: 'Original Title',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
        isRecurring: false,
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      const shiftToUpdate = { ...shifts[0], title: 'Updated Title' };

      service.updateShift(shiftToUpdate);

      const updatedShifts = service.shifts();
      expect(updatedShifts[0].title).toBe('Updated Title');
    });
  });

  describe('updateShiftSeries', () => {
    it('should update all shifts in a recurring series', () => {
      const shiftData = {
        title: 'Original Series',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
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
      const updatedShift = { ...shifts[0], title: 'Updated Series', color: 'green' };
      service.updateShiftSeries(updatedShift);

      const updatedShifts = service.shifts();
      // Should have same number of shifts
      expect(updatedShifts.length).toBeGreaterThanOrEqual(originalCount);
      // All shifts should have the updated title and color
      const newSeriesShifts = updatedShifts.filter(s => s.seriesId === seriesId);
      expect(newSeriesShifts.every(s => s.title === 'Updated Series')).toBe(true);
      expect(newSeriesShifts.every(s => s.color === 'green')).toBe(true);
    });
  });

  describe('deleteShift', () => {
    it('should delete a single shift by id', () => {
      const shiftData = {
        title: 'Shift to Delete',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
        isRecurring: false,
      };

      service.addShift(shiftData);
      const shifts = service.shifts();
      const shiftId = shifts[0].id;

      service.deleteShift(shiftId);

      expect(service.shifts()).toHaveLength(0);
    });
  });

  describe('deleteShiftSeries', () => {
    it('should delete all shifts in a recurring series', () => {
      const shiftData = {
        title: 'Series to Delete',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'green',
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
  });

  describe('importShifts', () => {
    it('should import valid shifts from JSON', () => {
      const validShift: Shift = {
        id: 'test-id-1',
        seriesId: 'test-series-1',
        title: 'Imported Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
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
        color: 'sky',
        isRecurring: false,
      };

      const json = JSON.stringify([validShift, { invalid: 'shift' }]);
      const result = service.importShifts(json);

      expect(result.success).toBe(true);
      expect(result.imported).toBe(1);
      expect(service.shifts()).toHaveLength(1);
    });
  });

  describe('deleteAllShifts', () => {
    it('should delete all shifts', () => {
      const shiftData = {
        title: 'Test Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
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
        color: 'sky',
        isRecurring: false,
      };

      service.addShift(shiftData);

      // Wait for effect to run
      setTimeout(() => {
        const storedData = localStorageMock['easyturno_shifts'];
        expect(storedData).toBeTruthy();
        const parsed = JSON.parse(storedData);
        expect(parsed.length).toBeGreaterThanOrEqual(1);
        expect(parsed[0].title).toBe('Persistent Shift');
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
          color: 'sky',
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

      // Mock setItem to throw QuotaExceededError
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        const error = new DOMException('QuotaExceededError', 'QuotaExceededError');
        throw error;
      });

      const shiftData = {
        title: 'Large Shift',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
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

      // Mock setItem to throw generic error
      jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('Generic storage error');
      });

      const shiftData = {
        title: 'Shift with Error',
        start: '2025-09-30T09:00:00',
        end: '2025-09-30T17:00:00',
        color: 'sky',
        isRecurring: false,
      };

      service.addShift(shiftData);

      // Wait for effect to run
      setTimeout(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to save shifts to localStorage:',
          expect.any(Error)
        );
        expect(errorSpy).toHaveBeenCalledWith('Failed to save shifts. Please try again.', 4000);
        consoleErrorSpy.mockRestore();
        done();
      }, 100);
    });

    it('should handle corrupted localStorage data', () => {
      // Reset TestBed and set corrupted data
      TestBed.resetTestingModule();
      localStorageMock['easyturno_shifts'] = 'corrupted-json-data-{';

      TestBed.configureTestingModule({
        providers: [ShiftService, ToastService],
      });

      // Should throw during service initialization
      expect(() => TestBed.inject(ShiftService)).toThrow();
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Future Shift');
    });
  });

  describe('Edge Cases - Recurring Shifts Boundary Conditions', () => {
    it('should respect MAX_RECURRING_INSTANCES limit (200)', () => {
      const shiftData = {
        title: 'Daily Max Test',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky',
        isRecurring: true,
        repetition: {
          frequency: 'days' as const,
          interval: 1, // Daily - would generate many more than 200 in 2 years
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts.length).toBe(200); // Should stop at MAX_RECURRING_INSTANCES
    });

    it('should respect MAX_YEARS_AHEAD limit (2 years)', () => {
      const shiftData = {
        title: 'Yearly Shift',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky',
        isRecurring: true,
        repetition: {
          frequency: 'year' as const,
          interval: 1, // Every year
        },
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      // Should generate at most 3 shifts (2025, 2026, 2027) depending on current date
      expect(shifts.length).toBeLessThanOrEqual(3);
      expect(shifts.length).toBeGreaterThan(0);

      // Verify no shift is more than 2 years ahead
      const twoYearsFromNow = new Date();
      twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);

      shifts.forEach(shift => {
        expect(new Date(shift.start).getTime()).toBeLessThanOrEqual(twoYearsFromNow.getTime());
      });
    });

    it('should handle large interval values', () => {
      const shiftData = {
        title: 'Large Interval Shift',
        start: '2025-01-01T09:00:00',
        end: '2025-01-01T17:00:00',
        color: 'sky',
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
        color: 'sky',
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
      expect(shifts.length).toBeLessThanOrEqual(200);
    });

    it('should handle monthly shifts with different month lengths', () => {
      const shiftData = {
        title: 'Monthly End-of-Month Shift',
        start: '2025-01-31T09:00:00', // January 31st
        end: '2025-01-31T17:00:00',
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
        isRecurring: false,
      });

      service.addShift({
        title: 'Shift 2',
        start: '2025-10-01T09:00:00',
        end: '2025-10-01T17:00:00',
        color: 'green',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
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
          color: 'green',
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
        color: 'sky',
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
        color: 'sky',
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
        color: 'sky',
        isRecurring: false,
      };

      service.addShift(shiftData);

      const shifts = service.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe(longTitle);
    });
  });
});
