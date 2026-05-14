import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { ToastService } from './services/toast.service';
import { NotificationService } from './services/notification.service';
import { CryptoService } from './services/crypto.service';
import { DatePipe, DOCUMENT } from '@angular/common';
import { signal } from '@angular/core';
import { Shift, ShiftColor } from './shift.model';

describe('AppComponent - Integration Tests', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let shiftService: ShiftService;
  let translationService: TranslationService;
  let toastService: ToastService;
  let notificationService: NotificationService;
  let cryptoService: CryptoService;
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

    // Mock CryptoService
    const mockCryptoService = {
      encrypt: jest.fn().mockImplementation(async (data: string) => data),
      decrypt: jest.fn().mockImplementation(async (data: string) => data),
      isEncrypted: jest.fn().mockReturnValue(false),
      encryptBackupWithPassword: jest
        .fn()
        .mockImplementation(async (data: string) => JSON.stringify({ encrypted: data })),
      decryptBackupWithPassword: jest
        .fn()
        .mockImplementation(async (data: string) => JSON.parse(data).encrypted),
      isPasswordProtectedBackupPayload: jest
        .fn()
        .mockImplementation((data: string) => data.includes('"encrypted"')),
      secureStorageAvailable: signal(true),
    };

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        ShiftService,
        TranslationService,
        ToastService,
        NotificationService,
        DatePipe,
        { provide: CryptoService, useValue: mockCryptoService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppComponent);
    component = fixture.componentInstance;
    shiftService = TestBed.inject(ShiftService);
    translationService = TestBed.inject(TranslationService);
    toastService = TestBed.inject(ToastService);
    notificationService = TestBed.inject(NotificationService);
    cryptoService = TestBed.inject(CryptoService);
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
      component.shiftAllowances.set([{ name: 'Transport', amount: 10, _id: 'test-id-1' }]);

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

      // Add test shifts starting from tomorrow to ensure all are in the future
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      for (let i = 0; i < 100; i++) {
        const date = new Date(tomorrow);
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
      // Search for a date 5 days from tomorrow (which should match one shift)
      const searchTarget = new Date();
      searchTarget.setDate(searchTarget.getDate() + 6);
      searchTarget.setHours(0, 0, 0, 0);
      component.searchDate.set(searchTarget);

      const filteredShifts = component.listShifts();

      // Should only show shifts on the target date
      expect(filteredShifts.length).toBeGreaterThan(0);
      filteredShifts.forEach(shift => {
        const shiftDate = new Date(shift.start);
        expect(shiftDate.getDate()).toBe(searchTarget.getDate());
        expect(shiftDate.getMonth()).toBe(searchTarget.getMonth());
        expect(shiftDate.getFullYear()).toBe(searchTarget.getFullYear());
      });
    });

    it('should clear search and show all upcoming shifts', () => {
      component.searchDate.set(new Date('2020-01-01'));
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

  describe('Live form numeric validation (#7)', () => {
    it('should ignore NaN amount from updateAllowanceAmount', () => {
      component.addAllowance();
      component.updateAllowanceAmount(0, { target: { value: '10' } } as any);
      expect(component.shiftAllowances()[0].amount).toBe(10);

      component.updateAllowanceAmount(0, { target: { value: 'abc' } } as any);
      expect(component.shiftAllowances()[0].amount).toBe(10);
    });

    it('should ignore negative amount from updateAllowanceAmount', () => {
      component.addAllowance();
      component.updateAllowanceAmount(0, { target: { value: '5' } } as any);
      component.updateAllowanceAmount(0, { target: { value: '-3' } } as any);
      expect(component.shiftAllowances()[0].amount).toBe(5);
    });

    it('should coerce null/NaN/negative overtime to 0 via updateOvertimeHours', () => {
      component.updateOvertimeHours(2.5);
      expect(component.shiftOvertimeHours()).toBe(2.5);

      component.updateOvertimeHours(null);
      expect(component.shiftOvertimeHours()).toBe(0);

      component.updateOvertimeHours(NaN);
      expect(component.shiftOvertimeHours()).toBe(0);

      component.updateOvertimeHours(-1);
      expect(component.shiftOvertimeHours()).toBe(0);
    });
  });

  describe('closeModal centralized cleanup (#8)', () => {
    it('should clear pending import state when closing passwordPrompt', () => {
      component.pendingImportData.set('{"encrypted":"[]"}');
      component.isImporting.set(true);
      component.passwordInput.set('secret');
      component.passwordConfirmInput.set('secret');
      component.passwordPromptMode.set('import');
      component.openModal('passwordPrompt');

      component.closeModal();

      expect(component.activeModal()).toBe('none');
      expect(component.pendingImportData()).toBeNull();
      expect(component.isImporting()).toBe(false);
      expect(component.passwordInput()).toBe('');
      expect(component.passwordConfirmInput()).toBe('');
    });

    it('should not touch import state when closing a non-passwordPrompt modal', () => {
      component.pendingImportData.set('{"encrypted":"[]"}');
      component.isImporting.set(true);
      component.openModal('settings');

      component.closeModal();

      expect(component.activeModal()).toBe('none');
      expect(component.pendingImportData()).toBe('{"encrypted":"[]"}');
      expect(component.isImporting()).toBe(true);

      // cleanup so subsequent tests are not polluted
      component.pendingImportData.set(null);
      component.isImporting.set(false);
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
    it('should export shifts as encrypted JSON', async () => {
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

      // Open the password modal via exportBackup()
      component.exportBackup();
      expect(component.activeModal()).toBe('passwordPrompt');
      expect(component.passwordPromptMode()).toBe('export');

      // Simulate user entering and confirming password
      component.passwordInput.set('test-password');
      component.passwordConfirmInput.set('test-password');
      await component.confirmPasswordPrompt();

      expect(global.URL.createObjectURL).toHaveBeenCalled();
      expect(clickMock).toHaveBeenCalled();
      expect(cryptoService.encryptBackupWithPassword).toHaveBeenCalledWith(
        expect.any(String),
        'test-password'
      );
      expect(shiftService.shifts()).toHaveLength(1);
    });

    describe('Backup password validation (export mode)', () => {
      beforeEach(() => {
        shiftService.addShift({
          title: 'Backup Source',
          start: '2025-10-15T08:00:00',
          end: '2025-10-15T16:00:00',
          color: 'sky',
          isRecurring: false,
        });
        component.exportBackup();
      });

      it('should reject password shorter than 12 characters, keep modal open and not encrypt', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');

        component.passwordInput.set('shortpass'); // 9 chars
        component.passwordConfirmInput.set('shortpass');
        await component.confirmPasswordPrompt();

        expect(errorSpy).toHaveBeenCalled();
        const message = errorSpy.mock.calls[0][0] as string;
        expect(message).toContain('12');
        expect(component.activeModal()).toBe('passwordPrompt');
        expect(cryptoService.encryptBackupWithPassword).not.toHaveBeenCalled();
      });

      it('should reject an 11-character password (boundary case)', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');

        component.passwordInput.set('elevenchars'); // 11 chars
        component.passwordConfirmInput.set('elevenchars');
        await component.confirmPasswordPrompt();

        expect(errorSpy).toHaveBeenCalled();
        expect(component.activeModal()).toBe('passwordPrompt');
        expect(cryptoService.encryptBackupWithPassword).not.toHaveBeenCalled();
      });

      it('should accept a password of exactly 12 characters and proceed with export', async () => {
        global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = jest.fn();
        jest.spyOn(document, 'createElement').mockReturnValue({ click: jest.fn() } as any);
        const errorSpy = jest.spyOn(toastService, 'error');

        component.passwordInput.set('twelvechars1'); // 12 chars
        component.passwordConfirmInput.set('twelvechars1');
        await component.confirmPasswordPrompt();

        expect(errorSpy).not.toHaveBeenCalled();
        expect(cryptoService.encryptBackupWithPassword).toHaveBeenCalledWith(
          expect.any(String),
          'twelvechars1'
        );
        expect(component.activeModal()).toBe('none');
      });

      it('should reject when password and confirmation differ (length OK)', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');

        component.passwordInput.set('longenoughpassword'); // ≥12
        component.passwordConfirmInput.set('differentpassword!');
        await component.confirmPasswordPrompt();

        expect(errorSpy).toHaveBeenCalled();
        expect(component.activeModal()).toBe('passwordPrompt');
        expect(cryptoService.encryptBackupWithPassword).not.toHaveBeenCalled();
      });

      it('should enforce length check before mismatch check (short + mismatched → length error)', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');

        component.passwordInput.set('shortA'); // short
        component.passwordConfirmInput.set('shortB'); // also short, different
        await component.confirmPasswordPrompt();

        expect(errorSpy).toHaveBeenCalledTimes(1);
        const message = errorSpy.mock.calls[0][0] as string;
        expect(message).toContain('12');
        expect(cryptoService.encryptBackupWithPassword).not.toHaveBeenCalled();
      });

      it('should not apply the length restriction in import mode', async () => {
        component.closeModal();
        component.pendingImportData.set('{"encrypted":"[]"}');
        component.passwordPromptMode.set('import');
        component.openModal('passwordPrompt');

        component.passwordInput.set('abc'); // 3 chars — short, but allowed for import
        await component.confirmPasswordPrompt();

        expect(cryptoService.decryptBackupWithPassword).toHaveBeenCalledWith(
          '{"encrypted":"[]"}',
          'abc'
        );
      });
    });

    it('should handle import of valid shifts', done => {
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
        done();
      }, 100);
    });

    it('should decrypt password-protected backups before importing', done => {
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

      const file = new File(
        [JSON.stringify({ encrypted: JSON.stringify(validData) })],
        'shifts.json',
        {
          type: 'application/json',
        }
      );
      const event = { target: { files: [file] } } as any;

      component.importBackup(event);

      // File reading is async; after it completes the password modal opens
      setTimeout(async () => {
        expect(component.activeModal()).toBe('passwordPrompt');
        expect(component.passwordPromptMode()).toBe('import');

        // Simulate user entering password
        component.passwordInput.set('test-password');
        await component.confirmPasswordPrompt();

        expect(cryptoService.decryptBackupWithPassword).toHaveBeenCalledWith(
          JSON.stringify({ encrypted: JSON.stringify(validData) }),
          'test-password'
        );
        expect(shiftService.shifts()).toHaveLength(1);
        done();
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

  describe('Security flow coverage (T5)', () => {
    describe('handleDateSearch', () => {
      it('should reject dates before 1900 and keep the search modal open', () => {
        const errorSpy = jest.spyOn(toastService, 'error');
        const previousSearchDate = new Date('2025-01-01T00:00:00');

        component.searchDate.set(previousSearchDate);
        component.searchDateInput.set('1899-12-31');
        component.openModal('searchDate');
        component.handleDateSearch();

        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('dateOutOfRange'));
        expect(component.searchDate()).toBe(previousSearchDate);
        expect(component.activeModal()).toBe('searchDate');
      });

      it('should reject dates after 2100 and keep the search modal open', () => {
        const errorSpy = jest.spyOn(toastService, 'error');
        const previousSearchDate = new Date('2025-01-01T00:00:00');

        component.searchDate.set(previousSearchDate);
        component.searchDateInput.set('2101-01-01');
        component.openModal('searchDate');
        component.handleDateSearch();

        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('dateOutOfRange'));
        expect(component.searchDate()).toBe(previousSearchDate);
        expect(component.activeModal()).toBe('searchDate');
      });

      it('should reject invalid date values that parse to NaN', () => {
        const errorSpy = jest.spyOn(toastService, 'error');
        const previousSearchDate = new Date('2025-01-01T00:00:00');

        component.searchDate.set(previousSearchDate);
        component.searchDateInput.set('not-a-date');
        component.openModal('searchDate');
        component.handleDateSearch();

        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('invalidDateFormat'));
        expect(component.searchDate()).toBe(previousSearchDate);
        expect(component.activeModal()).toBe('searchDate');
      });

      it('should show a parse error toast if date construction throws', () => {
        const errorSpy = jest.spyOn(toastService, 'error');
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const RealDate = Date;
        const MockDate = jest.fn((value?: string | number | Date) => {
          if (value === 'throw-dateT00:00:00') {
            throw new Error('date constructor failed');
          }
          return value === undefined ? new RealDate() : new RealDate(value);
        });
        Object.assign(MockDate, {
          now: RealDate.now,
          parse: RealDate.parse,
          UTC: RealDate.UTC,
          prototype: RealDate.prototype,
        });
        jest.spyOn(globalThis, 'Date').mockImplementation(MockDate as unknown as DateConstructor);

        component.searchDateInput.set('throw-date');
        component.openModal('searchDate');
        component.handleDateSearch();

        expect(consoleErrorSpy).toHaveBeenCalledWith('Date parsing error:', expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('failedToParseDate'));
        expect(component.activeModal()).toBe('searchDate');
      });
    });

    it('should reject import files larger than 5 MB before reading them', () => {
      const errorSpy = jest.spyOn(toastService, 'error');
      const readAsTextSpy = jest.spyOn(FileReader.prototype, 'readAsText');
      const oversizedFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'too-large.json', {
        type: 'application/json',
      });

      component.importBackup({ target: { files: [oversizedFile] } } as unknown as Event);

      expect(errorSpy).toHaveBeenCalledWith(
        translationService.translate('backupFileTooLarge'),
        5000
      );
      expect(readAsTextSpy).not.toHaveBeenCalled();
      expect(component.isImporting()).toBe(false);
    });

    it('should reset unreadable encrypted data only after decryption reset confirmation', () => {
      const resetSpy = jest.spyOn(shiftService, 'resetAfterDecryptionError');
      const successSpy = jest.spyOn(toastService, 'success');

      component.openModal('decryptionError');
      component.executeDecryptionReset();

      expect(resetSpy).toHaveBeenCalledTimes(1);
      expect(component.activeModal()).toBe('none');
      expect(successSpy).toHaveBeenCalledWith(translationService.translate('resetSuccess'));
    });

    it('should dismiss decryption errors without resetting stored data', () => {
      const resetSpy = jest.spyOn(shiftService, 'resetAfterDecryptionError');
      const successSpy = jest.spyOn(toastService, 'success');

      component.openModal('decryptionError');
      component.dismissDecryptionError();

      expect(resetSpy).not.toHaveBeenCalled();
      expect(successSpy).not.toHaveBeenCalled();
      expect(component.activeModal()).toBe('none');
    });

    it('should open the shift form from the add_shift URL action and clean the URL', () => {
      const replaceStateSpy = jest.spyOn(window.history, 'replaceState');
      window.history.pushState({}, '', '/?action=add_shift');

      const actionFixture = TestBed.createComponent(AppComponent);
      const actionComponent = actionFixture.componentInstance;

      expect(actionComponent.activeModal()).toBe('form');
      expect(actionComponent.editingShift()).toBeNull();
      expect(replaceStateSpy).toHaveBeenCalledWith({}, '', '/');

      window.history.pushState({}, '', '/');
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
      component.onStartDateChange('2025-10-20');

      expect(component.shiftEndDate()).toBe('2025-10-20');
    });

    it('should sync end time when start time changes', () => {
      component.shiftStartDate.set('2025-10-15');
      component.shiftStartTime.set('08:00');
      component.shiftEndDate.set('2025-10-15');
      component.shiftEndTime.set('16:00');

      // Change start time
      component.onStartTimeChange('10:00');

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

    it('should persist theme and shifts through component recreation', async () => {
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
      // Wait for async encryption/storage to complete
      await fixture.whenStable();

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

  describe('app.component.ts residual coverage (T11)', () => {
    describe('DatePipe ISO fallback', () => {
      it('uses ISO fallback in resetForm() when DatePipe.transform returns null', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(component.datePipe, 'transform').mockReturnValue(null);

        component.resetForm();

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to format reset dates, using ISO fallback'
        );
        expect(component.shiftStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(component.shiftStartTime()).toMatch(/^\d{2}:\d{2}$/);
        expect(component.shiftEndDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(component.shiftEndTime()).toMatch(/^\d{2}:\d{2}$/);
      });

      it('uses ISO fallback in openEditShiftForm() when DatePipe.transform returns null', () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(component.datePipe, 'transform').mockReturnValue(null);

        const shift: Shift = {
          id: 'fallback-1',
          seriesId: 'fallback-1',
          title: 'Fallback Edit',
          start: '2025-06-15T10:30:00.000Z',
          end: '2025-06-15T14:30:00.000Z',
          color: 'sky',
          isRecurring: false,
        };

        component.openEditShiftForm(shift);

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to format shift dates, using ISO fallback'
        );
        expect(component.shiftStartDate()).toBe('2025-06-15');
        expect(component.shiftEndDate()).toBe('2025-06-15');
        expect(component.shiftStartTime()).toMatch(/^\d{2}:\d{2}$/);
        expect(component.shiftEndTime()).toMatch(/^\d{2}:\d{2}$/);
        expect(component.shiftTitle()).toBe('Fallback Edit');
      });

      it('uses ISO fallback in the constructor when DatePipe.transform returns null', async () => {
        const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

        TestBed.resetTestingModule();

        const mockCryptoService = {
          encrypt: jest.fn().mockImplementation(async (data: string) => data),
          decrypt: jest.fn().mockImplementation(async (data: string) => data),
          isEncrypted: jest.fn().mockReturnValue(false),
          encryptBackupWithPassword: jest.fn(),
          decryptBackupWithPassword: jest.fn(),
          isPasswordProtectedBackupPayload: jest.fn().mockReturnValue(false),
          secureStorageAvailable: signal(true),
        };

        await TestBed.configureTestingModule({
          imports: [AppComponent],
          providers: [
            ShiftService,
            TranslationService,
            ToastService,
            NotificationService,
            { provide: CryptoService, useValue: mockCryptoService },
          ],
        })
          .overrideComponent(AppComponent, {
            set: { providers: [{ provide: DatePipe, useValue: { transform: () => null } }] },
          })
          .compileComponents();

        const newFixture = TestBed.createComponent(AppComponent);
        const newComponent = newFixture.componentInstance;

        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to format search date, using fallback'
        );
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to format stats dates, using fallback'
        );
        expect(newComponent.searchDateInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(newComponent.statsStartDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(newComponent.statsEndDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe('executeEdit(false) — single-instance edit from recurring series', () => {
      it('updates only the current instance and detaches it from the recurrence', () => {
        shiftService.deleteAllShifts();
        shiftService.addShift({
          title: 'Weekly Standup',
          start: '2025-11-03T09:00:00',
          end: '2025-11-03T10:00:00',
          color: 'sky',
          isRecurring: true,
          repetition: { frequency: 'weeks', interval: 1 },
        });

        const allInstances = shiftService.shifts();
        expect(allInstances.length).toBeGreaterThan(1);
        const editingInstance = allInstances[0];

        component.openEditShiftForm(editingInstance);
        component.shiftTitle.set('One-off Standup');

        const updateShiftSpy = jest.spyOn(shiftService, 'updateShift');
        const updateShiftSeriesSpy = jest.spyOn(shiftService, 'updateShiftSeries');

        component.handleFormSubmit();
        expect(component.activeModal()).toBe('editSeriesConfirm');
        expect(component.pendingShiftData()).not.toBeNull();

        component.executeEdit(false);

        expect(updateShiftSeriesSpy).not.toHaveBeenCalled();
        expect(updateShiftSpy).toHaveBeenCalledTimes(1);
        const updatedArg = updateShiftSpy.mock.calls[0][0] as Shift;
        expect(updatedArg.id).toBe(editingInstance.id);
        expect(updatedArg.title).toBe('One-off Standup');
        expect(updatedArg.isRecurring).toBe(false);
        expect(updatedArg.repetition).toBeUndefined();

        expect(component.activeModal()).toBe('none');
        expect(component.editingShift()).toBeNull();
        expect(component.pendingShiftData()).toBeNull();
      });

      it('is a no-op when there is no editing target or pending data', () => {
        const updateShiftSpy = jest.spyOn(shiftService, 'updateShift');
        const updateShiftSeriesSpy = jest.spyOn(shiftService, 'updateShiftSeries');

        component.editingShift.set(null);
        component.pendingShiftData.set(null);

        component.executeEdit(false);
        component.executeEdit(true);

        expect(updateShiftSpy).not.toHaveBeenCalled();
        expect(updateShiftSeriesSpy).not.toHaveBeenCalled();
      });
    });

    describe('getColorClasses — all 8 color branches', () => {
      const colors: ShiftColor[] = [
        'sky',
        'green',
        'amber',
        'rose',
        'indigo',
        'teal',
        'fuchsia',
        'slate',
      ];

      colors.forEach(color => {
        it(`returns the full Tailwind class string for "${color}"`, () => {
          const classes = component.getColorClasses(color);

          expect(classes).toContain(`bg-${color}-100`);
          expect(classes).toContain(`text-${color}-700`);
          expect(classes).toContain(`border-${color}-500`);
          expect(classes).toContain(`dark:bg-${color}-500/20`);
          expect(classes).toContain(`dark:text-${color}-300`);
          expect(classes).toContain(`dark:border-${color}-400`);
        });
      });

      it('returns a distinct class string for every supported color', () => {
        const allResults = colors.map(c => component.getColorClasses(c));
        expect(new Set(allResults).size).toBe(colors.length);
      });
    });

    describe('toggleViewMode / setViewMode', () => {
      it('toggleViewMode: list → calendar preserves search and pagination', () => {
        const searchDate = new Date('2025-10-15T00:00:00');
        component.searchDate.set(searchDate);
        component.listVisibleCount.set(123);
        component.viewMode.set('list');

        component.toggleViewMode();

        expect(component.viewMode()).toBe('calendar');
        expect(component.searchDate()).toBe(searchDate);
        expect(component.listVisibleCount()).toBe(123);
      });

      it('toggleViewMode: calendar → list clears search and resets pagination', () => {
        component.searchDate.set(new Date('2025-10-15T00:00:00'));
        component.listVisibleCount.set(200);
        component.viewMode.set('calendar');

        component.toggleViewMode();

        expect(component.viewMode()).toBe('list');
        expect(component.searchDate()).toBeNull();
        expect(component.listVisibleCount()).toBe(50);
      });

      it('setViewMode("list") from calendar clears search and resets pagination', () => {
        component.searchDate.set(new Date('2025-10-15T00:00:00'));
        component.listVisibleCount.set(150);
        component.viewMode.set('calendar');

        component.setViewMode('list');

        expect(component.viewMode()).toBe('list');
        expect(component.searchDate()).toBeNull();
        expect(component.listVisibleCount()).toBe(50);
      });

      it('setViewMode("calendar") from list preserves search and pagination', () => {
        const searchDate = new Date('2025-10-15T00:00:00');
        component.searchDate.set(searchDate);
        component.listVisibleCount.set(100);
        component.viewMode.set('list');

        component.setViewMode('calendar');

        expect(component.viewMode()).toBe('calendar');
        expect(component.searchDate()).toBe(searchDate);
        expect(component.listVisibleCount()).toBe(100);
      });

      it('setViewMode("list") while already on list does not clear search', () => {
        const searchDate = new Date('2025-10-15T00:00:00');
        component.searchDate.set(searchDate);
        component.listVisibleCount.set(75);
        component.viewMode.set('list');

        component.setViewMode('list');

        expect(component.viewMode()).toBe('list');
        expect(component.searchDate()).toBe(searchDate);
        expect(component.listVisibleCount()).toBe(75);
      });
    });
  });
});
