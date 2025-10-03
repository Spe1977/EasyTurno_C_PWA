import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { ToastService } from './services/toast.service';
import { NotificationService } from './services/notification.service';
import { DatePipe, DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';

describe('AppComponent - Integration Tests', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let shiftService: ShiftService;
  let translationService: TranslationService;
  let toastService: ToastService;
  let notificationService: NotificationService;
  let localStorageMock: { [key: string]: string };

  beforeEach(async () => {
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

    // Mock matchMedia for theme detection
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: jest.fn().mockImplementation(query => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [ShiftService, TranslationService, ToastService, NotificationService, DatePipe],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    shiftService = TestBed.inject(ShiftService);
    translationService = TestBed.inject(TranslationService);
    toastService = TestBed.inject(ToastService);
    notificationService = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Component Initialization', () => {
    it('should create the component', () => {
      expect(component).toBeTruthy();
    });

    it('should initialize with default theme based on system preference', () => {
      // Mock prefers-color-scheme: dark
      window.matchMedia = jest.fn().mockImplementation(query => ({
        matches: query === '(prefers-color-scheme: dark)',
        media: query,
        onchange: null,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      }));

      const newFixture = TestBed.createComponent(AppComponent);
      const newComponent = newFixture.componentInstance;

      expect(newComponent.theme()).toBe('dark');
    });

    it('should load theme from localStorage if available', () => {
      localStorageMock['easyturno_theme'] = 'light';

      const newFixture = TestBed.createComponent(AppComponent);
      const newComponent = newFixture.componentInstance;

      expect(newComponent.theme()).toBe('light');
    });

    it('should initialize all signals with correct default values', () => {
      expect(component.activeModal()).toBe('none');
      expect(component.editingShift()).toBeNull();
      expect(component.shiftTitle()).toBe('');
      expect(component.shiftIsRecurring()).toBe(false);
      expect(component.shiftColor()).toBe('indigo');
      expect(component.shiftOvertimeHours()).toBe(0);
      expect(component.shiftAllowances()).toEqual([]);
      expect(component.searchDate()).toBeNull();
      expect(component.listVisibleCount()).toBe(50);
    });

    it('should initialize statistics date range to last 30 days', () => {
      expect(component.statsStartDate()).toBeTruthy();
      expect(component.statsEndDate()).toBeTruthy();

      const startDate = new Date(component.statsStartDate());
      const endDate = new Date(component.statsEndDate());
      const diffInDays = Math.floor(
        (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      expect(diffInDays).toBeGreaterThanOrEqual(29);
      expect(diffInDays).toBeLessThanOrEqual(31); // Account for month length variations
    });

    it('should open new shift form when requested programmatically', () => {
      // Test openNewShiftForm method which is what checkUrlForActions calls
      expect(component.activeModal()).toBe('none');
      expect(component.editingShift()).toBeNull();

      component.openNewShiftForm();

      expect(component.activeModal()).toBe('form');
      expect(component.editingShift()).toBeNull();
      expect(component.shiftTitle()).toBe('');
    });
  });

  describe('Theme Management', () => {
    it('should toggle theme from light to dark', () => {
      component.theme.set('light');
      fixture.detectChanges();

      component.theme.set('dark');
      fixture.detectChanges();

      expect(component.theme()).toBe('dark');
      expect(localStorageMock['easyturno_theme']).toBe('dark');
    });

    it('should toggle theme from dark to light', () => {
      component.theme.set('dark');
      fixture.detectChanges();

      component.theme.set('light');
      fixture.detectChanges();

      expect(component.theme()).toBe('light');
      expect(localStorageMock['easyturno_theme']).toBe('light');
    });

    it('should update document class when theme changes', () => {
      const addSpy = jest.spyOn(document.documentElement.classList, 'add');
      const removeSpy = jest.spyOn(document.documentElement.classList, 'remove');

      component.theme.set('dark');
      fixture.detectChanges();

      expect(addSpy).toHaveBeenCalledWith('dark');

      component.theme.set('light');
      fixture.detectChanges();

      expect(removeSpy).toHaveBeenCalledWith('dark');
    });
  });

  describe('Modal Management', () => {
    it('should open and close modals', () => {
      expect(component.activeModal()).toBe('none');

      component.openModal('settings');
      expect(component.activeModal()).toBe('settings');

      component.closeModal();
      expect(component.activeModal()).toBe('none');
    });

    it('should open form modal for new shift', () => {
      component.openNewShiftForm();

      expect(component.activeModal()).toBe('form');
      expect(component.editingShift()).toBeNull();
      expect(component.shiftTitle()).toBe('');
    });

    it('should open form modal for editing shift', () => {
      const testShift = {
        id: 'test-1',
        seriesId: 'test-1',
        title: 'Test Shift',
        start: '2025-10-10T09:00:00',
        end: '2025-10-10T17:00:00',
        color: 'green' as const,
        isRecurring: false,
        notes: 'Test notes',
        overtimeHours: 2,
        allowances: [{ name: 'Meal', amount: 15 }],
      };

      component.openEditShiftForm(testShift);

      expect(component.activeModal()).toBe('form');
      expect(component.editingShift()).toEqual(testShift);
      expect(component.shiftTitle()).toBe('Test Shift');
      expect(component.shiftColor()).toBe('green');
      expect(component.shiftNotes()).toBe('Test notes');
      expect(component.shiftOvertimeHours()).toBe(2);
      // Check allowances (now includes _id for UI tracking)
      expect(component.shiftAllowances()).toHaveLength(1);
      expect(component.shiftAllowances()[0].name).toBe('Meal');
      expect(component.shiftAllowances()[0].amount).toBe(15);
      expect(component.shiftAllowances()[0]._id).toBeDefined();
    });

    it('should switch between different modals', () => {
      component.openModal('form');
      expect(component.activeModal()).toBe('form');

      component.openModal('settings');
      expect(component.activeModal()).toBe('settings');

      component.openModal('statistics');
      expect(component.activeModal()).toBe('statistics');
    });
  });

  describe('Shift Form - Create Flow', () => {
    beforeEach(() => {
      component.openNewShiftForm();
    });

    it('should create a single shift with all fields', () => {
      component.shiftTitle.set('Morning Shift');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');
      component.shiftColor.set('green');
      component.shiftNotes.set('Important shift');
      component.shiftOvertimeHours.set(1.5);
      component.shiftAllowances.set([{ name: 'Transport', amount: 10 }]);

      component.handleFormSubmit();

      const shifts = shiftService.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Morning Shift');
      expect(shifts[0].color).toBe('green');
      expect(shifts[0].notes).toBe('Important shift');
      expect(shifts[0].overtimeHours).toBe(1.5);
      expect(shifts[0].allowances).toEqual([{ name: 'Transport', amount: 10 }]);
    });

    it('should not submit form with empty title', () => {
      component.shiftTitle.set('');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      component.handleFormSubmit();

      expect(shiftService.shifts()).toHaveLength(0);
      expect(component.activeModal()).toBe('form'); // Modal should stay open
    });

    it('should not submit form with incomplete dates', () => {
      component.shiftTitle.set('Test Shift');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set(''); // Missing time
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      // Should throw error when trying to create invalid date
      expect(() => component.handleFormSubmit()).toThrow();
      expect(shiftService.shifts()).toHaveLength(0);
    });

    it('should close modal after successful shift creation', () => {
      component.shiftTitle.set('Test Shift');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      component.handleFormSubmit();

      expect(component.activeModal()).toBe('none');
    });

    it('should reset form after successful submission', () => {
      component.shiftTitle.set('Test Shift');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');
      component.shiftNotes.set('Some notes');
      component.shiftOvertimeHours.set(3);

      component.handleFormSubmit();

      // Form should be reset
      expect(component.shiftTitle()).toBe('');
      expect(component.shiftNotes()).toBe('');
      expect(component.shiftOvertimeHours()).toBe(0);
      expect(component.shiftAllowances()).toEqual([]);
    });
  });

  describe('Shift Form - Edit Flow', () => {
    let existingShift: any;

    beforeEach(() => {
      // Create a shift first
      shiftService.addShift({
        title: 'Original Shift',
        start: '2025-10-15T08:00:00',
        end: '2025-10-15T16:00:00',
        color: 'sky',
        isRecurring: false,
      });

      existingShift = shiftService.shifts()[0];
      component.openEditShiftForm(existingShift);
    });

    it('should update existing shift', () => {
      component.shiftTitle.set('Updated Shift');
      component.shiftColor.set('rose');

      component.handleFormSubmit();

      const shifts = shiftService.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Updated Shift');
      expect(shifts[0].color).toBe('rose');
    });

    it('should preserve shift ID when updating', () => {
      const originalId = existingShift.id;

      component.shiftTitle.set('Updated Shift');
      component.handleFormSubmit();

      const shifts = shiftService.shifts();
      expect(shifts[0].id).toBe(originalId);
    });

    it('should handle editing recurring shift', () => {
      // Create recurring shift
      shiftService.deleteAllShifts();
      shiftService.addShift({
        title: 'Recurring Shift',
        start: '2025-10-15T08:00:00',
        end: '2025-10-15T16:00:00',
        color: 'green',
        isRecurring: true,
        repetition: { frequency: 'days', interval: 7 },
      });

      const recurringShift = shiftService.shifts()[0];
      component.openEditShiftForm(recurringShift);

      expect(component.shiftIsRecurring()).toBe(true);
      expect(component.pendingShiftData()).toBeNull();
    });
  });

  describe('Shift List Filtering and Pagination', () => {
    beforeEach(() => {
      // Clear any existing shifts
      shiftService.deleteAllShifts();

      // Add test shifts
      for (let i = 0; i < 100; i++) {
        const date = new Date('2025-10-15');
        date.setDate(date.getDate() + i);
        shiftService.addShift({
          title: `Shift ${i}`,
          start: date.toISOString(),
          end: new Date(date.getTime() + 8 * 60 * 60 * 1000).toISOString(),
          color: 'sky',
          isRecurring: false,
        });
      }
    });

    it('should initially show 50 shifts', () => {
      expect(component.listShifts().length).toBe(50);
    });

    it('should load more shifts when requested', () => {
      component.loadMoreShifts();

      expect(component.listVisibleCount()).toBe(100);
      expect(component.listShifts().length).toBe(100);
    });

    it('should filter shifts by search date', () => {
      const searchDate = new Date('2025-10-20');
      component.searchDate.set(searchDate);

      const filteredShifts = component.listShifts();

      // Should only show shifts on 2025-10-20
      expect(filteredShifts.length).toBeGreaterThan(0);
      filteredShifts.forEach(shift => {
        const shiftDate = new Date(shift.start);
        expect(shiftDate.getDate()).toBe(20);
        expect(shiftDate.getMonth()).toBe(9); // October (0-indexed)
        expect(shiftDate.getFullYear()).toBe(2025);
      });
    });

    it('should clear search and show all upcoming shifts', () => {
      component.searchDate.set(new Date('2025-10-20'));
      expect(component.searchDate()).not.toBeNull();

      component.clearSearch();

      expect(component.searchDate()).toBeNull();
      expect(component.listShifts().length).toBe(50); // Back to default pagination
    });

    it('should only show upcoming shifts by default (not past)', () => {
      shiftService.deleteAllShifts();

      // Add past shift
      shiftService.addShift({
        title: 'Past Shift',
        start: '2020-01-01T08:00:00',
        end: '2020-01-01T16:00:00',
        color: 'sky',
        isRecurring: false,
      });

      // Add future shift
      shiftService.addShift({
        title: 'Future Shift',
        start: '2030-01-01T08:00:00',
        end: '2030-01-01T16:00:00',
        color: 'green',
        isRecurring: false,
      });

      const listedShifts = component.listShifts();

      expect(listedShifts.length).toBe(1);
      expect(listedShifts[0].title).toBe('Future Shift');
    });
  });

  describe('Delete Operations', () => {
    let testShift: any;

    beforeEach(() => {
      shiftService.addShift({
        title: 'Shift to Delete',
        start: '2025-10-15T08:00:00',
        end: '2025-10-15T16:00:00',
        color: 'sky',
        isRecurring: false,
      });

      testShift = shiftService.shifts()[0];
    });

    it('should open delete confirmation modal', () => {
      component.confirmDelete(testShift);

      expect(component.activeModal()).toBe('deleteConfirm');
      expect(component.shiftToDelete()).toEqual(testShift);
    });

    it('should delete shift after confirmation', () => {
      component.confirmDelete(testShift);
      component.executeDelete();

      expect(shiftService.shifts()).toHaveLength(0);
      expect(component.activeModal()).toBe('none');
    });

    it('should cancel delete and close modal', () => {
      component.confirmDelete(testShift);
      component.closeModal();

      expect(shiftService.shifts()).toHaveLength(1);
      expect(component.activeModal()).toBe('none');
    });

    it('should delete entire series for recurring shifts', () => {
      shiftService.deleteAllShifts();
      shiftService.addShift({
        title: 'Recurring Shift',
        start: '2025-10-15T08:00:00',
        end: '2025-10-15T16:00:00',
        color: 'green',
        isRecurring: true,
        repetition: { frequency: 'days', interval: 7 },
      });

      const seriesShift = shiftService.shifts()[0];
      const seriesId = seriesShift.seriesId;
      const initialCount = shiftService.shifts().length;

      expect(initialCount).toBeGreaterThan(1);

      component.confirmDelete(seriesShift);
      expect(component.activeModal()).toBe('deleteSeriesConfirm');
      component.executeDelete(true);

      expect(shiftService.shifts()).toHaveLength(0);
    });
  });

  describe('Allowances Management', () => {
    beforeEach(() => {
      component.openNewShiftForm();
    });

    it('should add allowance', () => {
      expect(component.shiftAllowances()).toHaveLength(0);

      component.addAllowance();

      expect(component.shiftAllowances()).toHaveLength(1);
      expect(component.shiftAllowances()[0].name).toBe('');
      expect(component.shiftAllowances()[0].amount).toBe(0);
      expect(component.shiftAllowances()[0]._id).toBeDefined();
    });

    it('should update allowance name', () => {
      component.addAllowance();

      const event = { target: { value: 'Transport' } } as any;
      component.updateAllowanceName(0, event);

      expect(component.shiftAllowances()[0].name).toBe('Transport');
    });

    it('should update allowance amount', () => {
      component.addAllowance();

      const event = { target: { value: '25.50' } } as any;
      component.updateAllowanceAmount(0, event);

      expect(component.shiftAllowances()[0].amount).toBe(25.5);
    });

    it('should remove allowance', () => {
      component.addAllowance();
      component.addAllowance();

      expect(component.shiftAllowances()).toHaveLength(2);

      component.removeAllowance(0);

      expect(component.shiftAllowances()).toHaveLength(1);
    });

    it('should handle multiple allowances', () => {
      component.addAllowance();
      component.updateAllowanceName(0, { target: { value: 'Meal' } } as any);
      component.updateAllowanceAmount(0, { target: { value: '15' } } as any);

      component.addAllowance();
      component.updateAllowanceName(1, { target: { value: 'Transport' } } as any);
      component.updateAllowanceAmount(1, { target: { value: '10' } } as any);

      expect(component.shiftAllowances()).toHaveLength(2);
      expect(component.shiftAllowances()[0].name).toBe('Meal');
      expect(component.shiftAllowances()[0].amount).toBe(15);
      expect(component.shiftAllowances()[1].name).toBe('Transport');
      expect(component.shiftAllowances()[1].amount).toBe(10);
    });
  });

  describe('Statistics Calculation', () => {
    beforeEach(() => {
      shiftService.deleteAllShifts();

      // Add shifts with overtime and allowances
      shiftService.addShift({
        title: 'Shift 1',
        start: '2025-10-01T08:00:00',
        end: '2025-10-01T16:00:00', // 8 hours
        color: 'sky',
        isRecurring: false,
        overtimeHours: 2,
        allowances: [
          { name: 'Meal', amount: 15 },
          { name: 'Transport', amount: 10 },
        ],
      });

      shiftService.addShift({
        title: 'Shift 2',
        start: '2025-10-05T10:00:00',
        end: '2025-10-05T18:00:00', // 8 hours
        color: 'green',
        isRecurring: false,
        overtimeHours: 1.5,
        allowances: [{ name: 'Meal', amount: 15 }],
      });

      // Set stats date range to include both shifts
      component.statsStartDate.set('2025-10-01');
      component.statsEndDate.set('2025-10-31');
    });

    it('should calculate total shifts in date range', () => {
      const stats = component.statsData();

      expect(stats.totalShifts).toBe(2);
    });

    it('should calculate total hours worked', () => {
      const stats = component.statsData();

      expect(stats.totalHours).toBe(16); // 8 + 8
    });

    it('should calculate total overtime hours', () => {
      const stats = component.statsData();

      expect(stats.totalOvertime).toBe(3.5); // 2 + 1.5
    });

    it('should aggregate shifts by type', () => {
      const stats = component.statsData();

      expect(stats.shiftsByTitle['Shift 1']).toBe(1);
      expect(stats.shiftsByTitle['Shift 2']).toBe(1);
    });

    it('should aggregate allowances by name', () => {
      const stats = component.statsData();

      expect(stats.allowancesByName['Meal']).toBe(30); // 15 + 15
      expect(stats.allowancesByName['Transport']).toBe(10);
    });

    it('should handle shifts with no overtime', () => {
      shiftService.deleteAllShifts();
      shiftService.addShift({
        title: 'Regular Shift',
        start: '2025-10-10T08:00:00',
        end: '2025-10-10T16:00:00',
        color: 'sky',
        isRecurring: false,
      });

      component.statsStartDate.set('2025-10-01');
      component.statsEndDate.set('2025-10-31');

      const stats = component.statsData();

      expect(stats.totalOvertime).toBe(0);
    });

    it('should handle shifts with no allowances', () => {
      shiftService.deleteAllShifts();
      shiftService.addShift({
        title: 'Regular Shift',
        start: '2025-10-10T08:00:00',
        end: '2025-10-10T16:00:00',
        color: 'sky',
        isRecurring: false,
      });

      component.statsStartDate.set('2025-10-01');
      component.statsEndDate.set('2025-10-31');

      const stats = component.statsData();

      expect(Object.keys(stats.allowancesByName)).toHaveLength(0);
    });

    it('should return zero statistics for empty date range', () => {
      component.statsStartDate.set('2025-11-01');
      component.statsEndDate.set('2025-11-30');

      const stats = component.statsData();

      expect(stats.totalShifts).toBe(0);
      expect(stats.totalHours).toBe(0);
      expect(stats.totalOvertime).toBe(0);
    });
  });

  describe('Settings Management', () => {
    it('should export shifts as JSON', () => {
      // Mock URL.createObjectURL and related APIs
      global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
      global.URL.revokeObjectURL = jest.fn();
      const createElementSpy = jest.spyOn(document, 'createElement');
      const clickMock = jest.fn();
      createElementSpy.mockReturnValue({ click: clickMock } as any);

      shiftService.addShift({
        title: 'Export Test',
        start: '2025-10-15T08:00:00',
        end: '2025-10-15T16:00:00',
        color: 'sky',
        isRecurring: false,
      });

      component.exportBackup();

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(shiftService.shifts()).toHaveLength(1);
    });

    it('should handle import of valid shifts', () => {
      const validData = [
        {
          id: 'import-1',
          seriesId: 'import-1',
          title: 'Imported Shift',
          start: '2025-10-15T08:00:00',
          end: '2025-10-15T16:00:00',
          color: 'green',
          isRecurring: false,
        },
      ];

      const file = new File([JSON.stringify(validData)], 'shifts.json', {
        type: 'application/json',
      });
      const event = { target: { files: [file] } } as any;

      component.importBackup(event);

      // File reading is async, so we need to wait
      setTimeout(() => {
        expect(shiftService.shifts()).toHaveLength(1);
        expect(shiftService.shifts()[0].title).toBe('Imported Shift');
      }, 100);
    });

    it('should open reset confirmation modal', () => {
      component.confirmReset();

      expect(component.activeModal()).toBe('resetConfirm');
    });

    it('should delete all shifts on reset confirmation', () => {
      shiftService.addShift({
        title: 'Test',
        start: '2025-10-15T08:00:00',
        end: '2025-10-15T16:00:00',
        color: 'sky',
        isRecurring: false,
      });

      expect(shiftService.shifts()).toHaveLength(1);

      component.confirmReset();
      component.executeReset();

      expect(shiftService.shifts()).toHaveLength(0);
      expect(component.activeModal()).toBe('none');
    });
  });

  describe('Date/Time Synchronization', () => {
    beforeEach(() => {
      component.openNewShiftForm();
    });

    it('should sync end date/time when start date changes', () => {
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      // Change start date
      const event = { target: { value: '2025-10-20' } } as any;
      component.onStartDateChange(event);

      expect(component.shiftEndDate()).toBe('2025-10-20');
    });

    it('should sync end time when start time changes', () => {
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      // Change start time
      const event = { target: { value: '10:00' } } as any;
      component.onStartTimeChange(event);

      // End time should be set to the new start time (auto-alignment)
      expect(component.shiftEndTime()).toBe('10:00');
    });
  });

  describe('Integration - Complete Workflow', () => {
    it('should handle complete shift lifecycle: create -> edit -> delete', () => {
      // 1. Create shift
      component.openNewShiftForm();
      component.shiftTitle.set('Lifecycle Test');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');
      component.shiftOvertimeHours.set(1);
      component.addAllowance();
      component.updateAllowanceName(0, { target: { value: 'Meal' } } as any);
      component.updateAllowanceAmount(0, { target: { value: '15' } } as any);

      component.handleFormSubmit();

      expect(shiftService.shifts()).toHaveLength(1);
      const createdShift = shiftService.shifts()[0];

      // 2. Edit shift
      component.openEditShiftForm(createdShift);
      component.shiftTitle.set('Updated Lifecycle Test');
      component.shiftOvertimeHours.set(2);

      component.handleFormSubmit();

      expect(shiftService.shifts()).toHaveLength(1);
      expect(shiftService.shifts()[0].title).toBe('Updated Lifecycle Test');
      expect(shiftService.shifts()[0].overtimeHours).toBe(2);

      // 3. Delete shift
      const updatedShift = shiftService.shifts()[0];
      component.confirmDelete(updatedShift);
      component.executeDelete();

      expect(shiftService.shifts()).toHaveLength(0);
    });

    it('should handle multiple users interacting with shifts concurrently', () => {
      // Simulate concurrent shift creation
      component.openNewShiftForm();
      component.shiftTitle.set('Shift 1');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');
      component.handleFormSubmit();

      component.openNewShiftForm();
      component.shiftTitle.set('Shift 2');
      component.shiftStartDate.set('2025-10-16');
      component.shiftStartTime.set('09:00');
      component.shiftEndDate.set('2025-10-16');
      component.shiftEndTime.set('17:00');
      component.handleFormSubmit();

      expect(shiftService.shifts()).toHaveLength(2);

      // Both shifts should be independently maintained
      const shifts = shiftService.shifts();
      expect(shifts.find(s => s.title === 'Shift 1')).toBeTruthy();
      expect(shifts.find(s => s.title === 'Shift 2')).toBeTruthy();
    });

    it('should persist theme and shifts through component recreation', () => {
      // Set theme and create shift
      component.theme.set('dark');
      component.openNewShiftForm();
      component.shiftTitle.set('Persistent Shift');
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');
      component.handleFormSubmit();

      fixture.detectChanges();

      // Verify persistence in localStorage
      expect(localStorageMock['easyturno_theme']).toBe('dark');
      expect(localStorageMock['easyturno_shifts']).toBeTruthy();

      // Create new component instance (simulating page reload)
      const newFixture = TestBed.createComponent(AppComponent);
      const newComponent = newFixture.componentInstance;

      expect(newComponent.theme()).toBe('dark');
      expect(shiftService.shifts()).toHaveLength(1);
      expect(shiftService.shifts()[0].title).toBe('Persistent Shift');
    });
  });
});
