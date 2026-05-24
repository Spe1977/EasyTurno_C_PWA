import { TestBed, ComponentFixture } from '@angular/core/testing';
import { AppComponent } from './app.component';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { ToastService } from './services/toast.service';
import { NotificationService } from './services/notification.service';
import { CryptoService } from './services/crypto.service';
import { FirestoreUserDataService } from './services/firestore-user-data.service';
import { AuthService } from './services/auth.service';
import { SyncService } from './services/sync.service';
import { SwUpdateService } from './services/sw-update.service';
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
  let firestoreUserDataService: FirestoreUserDataService;
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
    firestoreUserDataService = TestBed.inject(FirestoreUserDataService);
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

  describe('Auth Exit Label', () => {
    it('should expose the correct label for guest and authenticated modes', () => {
      const guestMode = signal(true);
      component.authService = {
        ...(component.authService as any),
        isGuest: () => guestMode(),
      } as any;

      expect(component.authExitLabelKey()).toBe('authLoginLink');

      guestMode.set(false);
      expect(component.authExitLabelKey()).toBe('authLogout');
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

    it('should open the account deletion warning from settings', () => {
      component.openDeleteAccountWarning();

      expect(component.activeModal()).toBe('deleteAccountWarning');
    });

    it('should reset delete account form when closing delete modals', () => {
      component.deleteAccountEmailInput.set('delete@example.com');
      component.deleteAccountPasswordInput.set('secret');
      component.isDeletingAccount.set(true);
      component.openModal('deleteAccountWarning');

      component.closeModal();

      expect(component.activeModal()).toBe('none');
      expect(component.deleteAccountEmailInput()).toBe('');
      expect(component.deleteAccountPasswordInput()).toBe('');
    });

    it('should open the decryption error modal when ShiftService reports a decrypt failure', () => {
      shiftService.decryptionError.set(true);
      fixture.detectChanges();

      expect(component.activeModal()).toBe('decryptionError');
    });
  });

  describe('Account Deletion', () => {
    beforeEach(() => {
      component.authService = {
        state: () => ({
          mode: 'authenticated',
          uid: 'u-delete',
          email: 'delete@example.com',
          emailVerified: true,
          providerIds: ['password'],
        }),
        isGuest: () => false,
        isAuthenticated: () => true,
        hasPasswordProvider: () => true,
        signOut: jest.fn().mockResolvedValue(undefined),
        deleteAccount: jest.fn().mockResolvedValue(undefined),
      } as any;
    });

    it('should block account deletion when the confirmation email does not match', async () => {
      const deleteSpy = component.authService.deleteAccount as jest.Mock;
      const toastSpy = jest.spyOn(toastService, 'error');

      component.proceedDeleteAccountConfirmation();
      component.deleteAccountEmailInput.set('wrong@example.com');
      component.deleteAccountPasswordInput.set('Password1!');

      await component.executeDeleteAccount();

      expect(deleteSpy).not.toHaveBeenCalled();
      expect(component.activeModal()).toBe('deleteAccountConfirm');
      expect(toastSpy).toHaveBeenCalledWith(
        translationService.translate('authDeleteAccountEmailMismatch')
      );
    });

    it('should delete the account, clear local data, and return to auth screen on success', async () => {
      shiftService.addShift({
        title: 'Sensitive shift',
        start: '2026-01-10T08:00:00.000Z',
        end: '2026-01-10T16:00:00.000Z',
        color: 'indigo',
        isRecurring: false,
      });
      localStorageMock['easyturno_shifts'] = 'encrypted-data';
      localStorageMock['easyturno_device_key'] = 'legacy-key';
      localStorageMock['easyturno_backup_reminder_shown'] = '1';
      localStorageMock['easyturno_notification_settings'] = '{}';
      const deleteSpy = component.authService.deleteAccount as jest.Mock;
      const toastSpy = jest.spyOn(toastService, 'success');

      component.proceedDeleteAccountConfirmation();
      component.deleteAccountEmailInput.set('delete@example.com');
      component.deleteAccountPasswordInput.set('Password1!');

      await component.executeDeleteAccount();

      expect(deleteSpy).toHaveBeenCalledWith({ password: 'Password1!' });
      expect(shiftService.shifts()).toEqual([]);
      expect(localStorageMock['easyturno_shifts']).toBeUndefined();
      expect(localStorageMock['easyturno_device_key']).toBeUndefined();
      expect(localStorageMock['easyturno_backup_reminder_shown']).toBeUndefined();
      expect(localStorageMock['easyturno_notification_settings']).toBeUndefined();
      expect(component.activeModal()).toBe('none');
      expect(toastSpy).toHaveBeenCalledWith(
        translationService.translate('authDeleteAccountSuccess')
      );
    });

    it('should force sign out when Firebase requires a recent login for deletion', async () => {
      const auth = component.authService as any;
      auth.deleteAccount.mockRejectedValueOnce({ code: 'auth/requires-recent-login' });
      const toastSpy = jest.spyOn(toastService, 'error');

      component.proceedDeleteAccountConfirmation();
      component.deleteAccountEmailInput.set('delete@example.com');
      component.deleteAccountPasswordInput.set('Password1!');

      await component.executeDeleteAccount();

      expect(auth.signOut).toHaveBeenCalled();
      expect(toastSpy).toHaveBeenCalledWith(
        translationService.translate('authDeleteAccountReauthRequired'),
        6000
      );
      expect(component.activeModal()).toBe('none');
    });

    it('should ignore duplicate account deletion submissions while already deleting', async () => {
      const deleteSpy = component.authService.deleteAccount as jest.Mock;
      component.isDeletingAccount.set(true);

      await component.executeDeleteAccount();

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should show the network error message if account deletion fails offline', async () => {
      const auth = component.authService as any;
      auth.deleteAccount.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
      const toastSpy = jest.spyOn(toastService, 'error');

      component.proceedDeleteAccountConfirmation();
      component.deleteAccountEmailInput.set('delete@example.com');
      component.deleteAccountPasswordInput.set('Password1!');

      await component.executeDeleteAccount();

      expect(toastSpy).toHaveBeenCalledWith(translationService.translate('authErrorNetwork'), 6000);
    });

    it('should omit password payload for non-password account deletion', async () => {
      component.authService = {
        ...(component.authService as any),
        state: () => ({
          mode: 'authenticated',
          uid: 'u-google',
          email: 'delete@example.com',
          emailVerified: true,
          providerIds: ['google.com'],
        }),
        hasPasswordProvider: () => false,
        deleteAccount: jest.fn().mockResolvedValue(undefined),
      } as any;

      component.proceedDeleteAccountConfirmation();
      component.deleteAccountEmailInput.set('delete@example.com');

      await component.executeDeleteAccount();

      expect(component.authService.deleteAccount).toHaveBeenCalledWith({});
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

    it('should fall back to interval 1 for unknown frequency changes', () => {
      component.shiftRepetition.set({ frequency: 'days', interval: 15 });

      component.onFrequencyChange({ target: { value: 'quarters' } } as unknown as Event);

      expect(component.shiftRepetition()).toEqual({ frequency: 'quarters' as any, interval: 1 });
    });

    it('should show the backup reminder only once after reaching the threshold', () => {
      const infoSpy = jest.spyOn(toastService, 'info');

      for (let index = 0; index < 20; index++) {
        shiftService.addShift({
          title: `Reminder ${index}`,
          start: `2026-06-${String(index + 1).padStart(2, '0')}T08:00:00.000Z`,
          end: `2026-06-${String(index + 1).padStart(2, '0')}T16:00:00.000Z`,
          color: 'sky',
          isRecurring: false,
        });
      }

      (component as any).maybeSuggestBackupExport();
      (component as any).maybeSuggestBackupExport();

      expect(infoSpy).toHaveBeenCalledTimes(1);
      expect(localStorageMock['easyturno_backup_reminder_shown']).toBe('1');
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

    it('should show shifts within the -12/+24 month window and hide those outside', () => {
      shiftService.deleteAllShifts();

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const monthMs = 30 * dayMs;

      const isoAt = (offsetMs: number) => new Date(now + offsetMs).toISOString();

      // Far past — outside the -12 month window
      shiftService.addShift({
        title: 'Far Past Shift',
        start: isoAt(-24 * monthMs),
        end: isoAt(-24 * monthMs + 8 * 60 * 60 * 1000),
        color: 'sky',
        isRecurring: false,
      });

      // Recent past — inside the -12 month window
      shiftService.addShift({
        title: 'Recent Past Shift',
        start: isoAt(-3 * monthMs),
        end: isoAt(-3 * monthMs + 8 * 60 * 60 * 1000),
        color: 'sky',
        isRecurring: false,
      });

      // Near future — inside the +24 month window
      shiftService.addShift({
        title: 'Near Future Shift',
        start: isoAt(6 * monthMs),
        end: isoAt(6 * monthMs + 8 * 60 * 60 * 1000),
        color: 'green',
        isRecurring: false,
      });

      // Far future — outside the +24 month window
      shiftService.addShift({
        title: 'Far Future Shift',
        start: isoAt(36 * monthMs),
        end: isoAt(36 * monthMs + 8 * 60 * 60 * 1000),
        color: 'green',
        isRecurring: false,
      });

      const titles = component.listShifts().map(s => s.title);

      expect(titles).toContain('Recent Past Shift');
      expect(titles).toContain('Near Future Shift');
      expect(titles).not.toContain('Far Past Shift');
      expect(titles).not.toContain('Far Future Shift');
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

    it('should update allowance amount as integer', () => {
      component.addAllowance();

      const event = { target: { value: '25' } } as any;
      component.updateAllowanceAmount(0, event);

      expect(component.shiftAllowances()[0].amount).toBe(25);
    });

    it('should floor decimal allowance amounts to integers', () => {
      component.addAllowance();

      const event = { target: { value: '1.5' } } as any;
      component.updateAllowanceAmount(0, event);

      expect(component.shiftAllowances()[0].amount).toBe(1);
    });

    it('should floor multi-decimal allowance amounts to integers', () => {
      component.addAllowance();

      const event = { target: { value: '25.99' } } as any;
      component.updateAllowanceAmount(0, event);

      expect(component.shiftAllowances()[0].amount).toBe(25);
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

    it('should expose statistic keys for template iteration', () => {
      expect(component.statsShiftTitles()).toEqual(['Shift 1', 'Shift 2']);
      expect(component.statsAllowanceNames()).toEqual(['Meal', 'Transport']);
    });

    it('should return the first matching shift color and fall back to indigo', () => {
      expect(component.getShiftColorForTitle('Shift 1')).toBe('sky');
      expect(component.getShiftColorForTitle('Missing')).toBe('indigo');
    });

    it('should map statistic shift colors to bar and label styles', () => {
      expect(component.getShiftStylesForTitle('Shift 2')).toEqual({
        bar: 'bg-emerald-500',
        labelBg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
      });
      expect(component.getShiftStylesForTitle('Missing')).toEqual({
        bar: 'bg-indigo-500',
        labelBg: 'bg-indigo-100/70 dark:bg-indigo-950/40',
        text: 'text-indigo-700 dark:text-indigo-300',
      });
    });

    it('should update statistics date range from quick presets', () => {
      jest.useFakeTimers().setSystemTime(new Date('2026-05-20T12:00:00.000Z'));

      try {
        component.setStatsPreset('thisMonth');
        expect(component.statsStartDate()).toBe('2026-05-01');
        expect(component.statsEndDate()).toBe('2026-05-31');

        component.setStatsPreset('lastMonth');
        expect(component.statsStartDate()).toBe('2026-04-01');
        expect(component.statsEndDate()).toBe('2026-04-30');

        component.setStatsPreset('last30Days');
        expect(component.statsStartDate()).toBe('2026-04-20');
        expect(component.statsEndDate()).toBe('2026-05-20');

        component.setStatsPreset('thisYear');
        expect(component.statsStartDate()).toBe('2026-01-01');
        expect(component.statsEndDate()).toBe('2026-12-31');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('Device Limit Warning', () => {
    const installed = (n: number) =>
      Array.from({ length: n }, (_, i) => ({
        id: `dev-${i}`,
        platform: 'pwa-installed' as const,
        lastActive: null,
      }));
    const setDevices = (devices: unknown[]) =>
      (
        firestoreUserDataService as unknown as { _devices: { set: (value: unknown[]) => void } }
      )._devices.set(devices);

    it('stays off at three installations and turns on at four', () => {
      setDevices(installed(3));
      expect(component.deviceLimitExceeded()).toBe(false);

      setDevices(installed(4));
      expect(component.deviceLimitExceeded()).toBe(true);
    });

    it('does not count web sessions toward the limit', () => {
      setDevices([
        ...installed(3),
        { id: 'web-1', platform: 'web', lastActive: null },
        { id: 'web-2', platform: 'web', lastActive: null },
      ]);
      expect(component.userDataService.installedDeviceCount()).toBe(3);
      expect(component.userDataService.webSessionCount()).toBe(2);
      expect(component.deviceLimitExceeded()).toBe(false);
    });

    it('removes a device through the user-data service and clears the pending state', async () => {
      const removeSpy = jest
        .spyOn(component.userDataService, 'removeDevice')
        .mockResolvedValue(undefined);

      component.promptRemoveDevice('dev-1');
      expect(component.devicePendingRemoval()).toBe('dev-1');

      component.cancelRemoveDevice();
      expect(component.devicePendingRemoval()).toBeNull();

      component.promptRemoveDevice('dev-1');
      await component.confirmRemoveDevice('dev-1');

      expect(removeSpy).toHaveBeenCalledWith('dev-1');
      expect(component.devicePendingRemoval()).toBeNull();
    });

    it('lists only installed devices, excluding web sessions', () => {
      setDevices([
        { id: 'app-1', platform: 'native', lastActive: null },
        { id: 'app-2', platform: 'pwa-installed', lastActive: null },
        { id: 'web-1', platform: 'web', lastActive: null },
      ]);
      expect(component.installedDevices().map(d => d.id)).toEqual(['app-1', 'app-2']);
    });

    it('maps each platform to its translation key', () => {
      expect(component.devicePlatformLabelKey('native')).toBe('devicePlatformNative');
      expect(component.devicePlatformLabelKey('pwa-installed')).toBe('devicePlatformInstalled');
      expect(component.devicePlatformLabelKey('web')).toBe('devicePlatformWeb');
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

      it('should close the date search modal when the input is empty', () => {
        component.searchDateInput.set('');
        component.openModal('searchDate');

        component.handleDateSearch();

        expect(component.activeModal()).toBe('none');
      });

      it('should show an informational toast for searches before the visible range', () => {
        const infoSpy = jest.spyOn(toastService, 'info');
        component.searchDateInput.set('1900-01-01');

        component.handleDateSearch();

        expect(infoSpy).toHaveBeenCalledWith(
          translationService.translate('searchOutsideRange'),
          5000
        );
      });

      it('should show an informational toast for searches after the visible range', () => {
        const infoSpy = jest.spyOn(toastService, 'info');
        component.searchDateInput.set('2100-01-01');

        component.handleDateSearch();

        expect(infoSpy).toHaveBeenCalledWith(
          translationService.translate('searchOutsideRange'),
          5000
        );
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

    it('should show an import error and reset loading when FileReader fails', () => {
      const originalFileReader = globalThis.FileReader;
      const errorSpy = jest.spyOn(toastService, 'error');
      const readAsText = jest.fn(function (this: FileReader) {
        this.onerror?.(new ProgressEvent('error') as ProgressEvent<FileReader>);
      });
      class ErrorFileReader {
        onload: FileReader['onload'] = null;
        onerror: FileReader['onerror'] = null;
        readAsText = readAsText;
      }
      Object.defineProperty(globalThis, 'FileReader', {
        configurable: true,
        writable: true,
        value: ErrorFileReader,
      });

      const file = new File(['not used'], 'broken.json', { type: 'application/json' });
      component.importBackup({ target: { files: [file] } } as unknown as Event);

      expect(readAsText).toHaveBeenCalledWith(file);
      expect(errorSpy).toHaveBeenCalledWith(translationService.translate('importError'));
      expect(component.isImporting()).toBe(false);

      Object.defineProperty(globalThis, 'FileReader', {
        configurable: true,
        writable: true,
        value: originalFileReader,
      });
    });

    it('should ignore import when no file is selected', () => {
      component.importBackup({ target: { files: [] } } as unknown as Event);

      expect(component.isImporting()).toBe(false);
    });

    it('should show import error without suffix when import fails without details', () => {
      jest.spyOn(shiftService, 'importShifts').mockReturnValue({ success: false });
      const errorSpy = jest.spyOn(toastService, 'error');

      (component as any).finishImport('bad-json');

      expect(errorSpy).toHaveBeenCalledWith(translationService.translate('importError'), 5000);
    });

    it('should do nothing when password prompt is confirmed without a password', async () => {
      component.openModal('passwordPrompt');
      component.passwordPromptMode.set('export');
      component.passwordInput.set('');

      await component.confirmPasswordPrompt();

      expect(component.activeModal()).toBe('passwordPrompt');
      expect(component.isExporting()).toBe(false);
    });

    it('should return from import password confirmation when pending import data is missing', async () => {
      component.openModal('passwordPrompt');
      component.passwordPromptMode.set('import');
      component.passwordInput.set('secret');
      component.pendingImportData.set(null);

      await component.confirmPasswordPrompt();

      expect(component.activeModal()).toBe('passwordPrompt');
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
      expect(localStorageMock['easyturno_user_data_v2']).toBeTruthy();

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

      it('updates the whole recurring series when confirmed', () => {
        const editing = {
          id: 'series-1__2026-05-21T08:00:00.000Z',
          seriesId: 'series-1',
          title: 'Old',
          start: '2026-05-21T08:00:00.000Z',
          end: '2026-05-21T16:00:00.000Z',
          color: 'sky' as const,
          isRecurring: true,
          repetition: { frequency: 'days' as const, interval: 1 },
        };
        const shiftData = {
          title: 'Updated series',
          start: '2026-05-21T09:00:00.000Z',
          end: '2026-05-21T17:00:00.000Z',
          color: 'green' as const,
          isRecurring: true,
          repetition: { frequency: 'days' as const, interval: 1 },
          notes: undefined,
          overtimeHours: undefined,
          allowances: undefined,
          timezone: 'Europe/Rome',
        };
        const updateShiftSeriesSpy = jest.spyOn(shiftService, 'updateShiftSeries');

        component.editingShift.set(editing);
        component.pendingShiftData.set(shiftData);

        component.executeEdit(true);

        expect(updateShiftSeriesSpy).toHaveBeenCalledWith({ ...editing, ...shiftData });
        expect(component.activeModal()).toBe('none');
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
      it('renders a reload/update button immediately before the view toggle', () => {
        const authStateSignal = signal({ mode: 'guest' });
        component.authService = {
          ...(component.authService as any),
          state: authStateSignal,
          isAuthenticated: () => false,
          isGuest: () => true,
        } as any;

        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const reloadButton = host.querySelector('[data-cy="reload-update-app"]');
        const viewToggle = host.querySelector('[data-cy="view-toggle"]');
        const listButton = host.querySelector('[data-cy="view-list"]');

        expect(reloadButton).not.toBeNull();
        expect(viewToggle).not.toBeNull();
        expect(listButton).not.toBeNull();
        expect(
          reloadButton!.compareDocumentPosition(viewToggle!) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(
          reloadButton!.compareDocumentPosition(listButton!) & Node.DOCUMENT_POSITION_FOLLOWING
        ).toBeTruthy();
        expect(reloadButton!.getAttribute('aria-label')).toBe(
          translationService.translate('reloadUpdateAppAria')
        );
      });

      it('uses the service-worker update/reload path when the reload button is clicked', () => {
        const authStateSignal = signal({ mode: 'guest' });
        component.authService = {
          ...(component.authService as any),
          state: authStateSignal,
          isAuthenticated: () => false,
          isGuest: () => true,
        } as any;
        const reloadSpy = jest
          .spyOn(TestBed.inject(SwUpdateService), 'reloadOrActivateUpdate')
          .mockImplementation(() => {});

        fixture.detectChanges();

        const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
          '[data-cy="reload-update-app"]'
        );
        button?.click();

        expect(reloadSpy).toHaveBeenCalledTimes(1);
      });

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

      it('toggleViewMode: calendar → list scrolls back to today', () => {
        const goToTodaySpy = jest.spyOn(component, 'goToToday').mockImplementation(() => {});
        component.viewMode.set('calendar');

        component.toggleViewMode();

        expect(component.viewMode()).toBe('list');
        expect(goToTodaySpy).toHaveBeenCalledWith('auto');
      });

      it('setViewMode("list") from calendar scrolls back to today', () => {
        const goToTodaySpy = jest.spyOn(component, 'goToToday').mockImplementation(() => {});
        component.viewMode.set('calendar');

        component.setViewMode('list');

        expect(component.viewMode()).toBe('list');
        expect(goToTodaySpy).toHaveBeenCalledWith('auto');
      });

      it('toggleViewMode: list → calendar does not call goToToday', () => {
        const goToTodaySpy = jest.spyOn(component, 'goToToday').mockImplementation(() => {});
        component.viewMode.set('list');

        component.toggleViewMode();

        expect(component.viewMode()).toBe('calendar');
        expect(goToTodaySpy).not.toHaveBeenCalled();
      });

      it('setViewMode("list") while already on list does not re-scroll to today', () => {
        const goToTodaySpy = jest.spyOn(component, 'goToToday').mockImplementation(() => {});
        component.viewMode.set('list');

        component.setViewMode('list');

        expect(goToTodaySpy).not.toHaveBeenCalled();
      });
    });

    describe('formatAllowanceAmount', () => {
      it('formats an integer as an integer string with no currency symbol', () => {
        expect(component.formatAllowanceAmount(10)).toBe('10');
      });

      it('floors a fractional amount and emits no decimals', () => {
        expect(component.formatAllowanceAmount(10.5)).toBe('10');
      });

      it('returns "0" for zero', () => {
        expect(component.formatAllowanceAmount(0)).toBe('0');
      });

      it('returns "0" for negative or non-finite values', () => {
        expect(component.formatAllowanceAmount(-3)).toBe('0');
        expect(component.formatAllowanceAmount(Number.NaN)).toBe('0');
      });
    });

    describe('allowance form layout', () => {
      it('allowance name input has min-w-0 so the remove button stays visible on narrow screens', () => {
        const authStateSignal = signal({ mode: 'guest' });
        component.authService = {
          ...(component.authService as any),
          state: authStateSignal,
          isGuest: () => true,
        } as any;
        fixture.detectChanges();
        component.openNewShiftForm();
        component.addAllowance();
        fixture.detectChanges();

        const nameInput: HTMLInputElement | null = (
          fixture.nativeElement as HTMLElement
        ).querySelector('[data-cy="allowance-name-input"]');

        expect(nameInput).not.toBeNull();
        expect(nameInput!.classList.contains('min-w-0')).toBe(true);
      });
    });

    describe('onNotificationSettingsChange', () => {
      it('should save notification settings and retrieve the updated settings', () => {
        const spySave = jest.spyOn(component['notificationService'], 'saveSettings');
        const spyGet = jest.spyOn(component['notificationService'], 'getSettings').mockReturnValue({
          enabled: true,
          leadTimeMinutes: 45,
        });

        component.notificationSettings.set({ enabled: true, leadTimeMinutes: 45 });
        component.onNotificationSettingsChange();

        expect(spySave).toHaveBeenCalledWith({ enabled: true, leadTimeMinutes: 45 });
        expect(spyGet).toHaveBeenCalled();
        expect(component.notificationSettings()).toEqual({ enabled: true, leadTimeMinutes: 45 });
      });
    });

    describe('onCalendarDaySelected', () => {
      it('should set searchDate if a date is provided', () => {
        const testDate = new Date('2026-05-21T00:00:00');
        component.onCalendarDaySelected(testDate);
        expect(component.searchDate()).toBe(testDate);
      });

      it('should clear searchDate if date is null', () => {
        component.onCalendarDaySelected(null);
        expect(component.searchDate()).toBeNull();
      });
    });

    describe('onCalendarShiftClick', () => {
      it('should open edit shift form for the clicked shift', () => {
        const testShift: Shift = {
          id: 's-1',
          seriesId: 's-1',
          title: 'Shift 1',
          start: '2026-05-21T08:00:00Z',
          end: '2026-05-21T16:00:00Z',
          color: 'indigo',
          isRecurring: false,
        };
        const spyOpen = jest.spyOn(component, 'openEditShiftForm').mockImplementation(() => {});
        component.onCalendarShiftClick(testShift);
        expect(spyOpen).toHaveBeenCalledWith(testShift);
        spyOpen.mockRestore();
      });
    });

    describe('Hardening & Coverage Improvements (T12)', () => {
      describe('Keyboard Shortcuts', () => {
        beforeEach(() => {
          fixture.detectChanges();
        });

        it('should trigger openNewShiftForm on Ctrl+N', () => {
          const spy = jest.spyOn(component, 'openNewShiftForm').mockImplementation(() => {});
          const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 'n' });
          window.dispatchEvent(event);
          expect(spy).toHaveBeenCalled();
          spy.mockRestore();
        });

        it('should trigger closeModal on Escape when a modal is active', () => {
          const spy = jest.spyOn(component, 'closeModal').mockImplementation(() => {});
          component.activeModal.set('settings'); // Make activeModal !== 'none'
          fixture.detectChanges(); // Trigger effects to update bindings
          const event = new KeyboardEvent('keydown', { key: 'Escape' });
          window.dispatchEvent(event);
          expect(spy).toHaveBeenCalled();
          spy.mockRestore();
        });

        it('should trigger openStatistics on Ctrl+S when in settings modal', () => {
          const spy = jest.spyOn(component, 'openStatistics').mockImplementation(() => {});
          component.activeModal.set('settings');
          fixture.detectChanges(); // Trigger effects to update bindings
          const event = new KeyboardEvent('keydown', { ctrlKey: true, key: 's' });
          window.dispatchEvent(event);
          expect(spy).toHaveBeenCalled();
          spy.mockRestore();
        });

        it('should open the statistics modal when openStatistics runs', () => {
          component.openStatistics();

          expect(component.activeModal()).toBe('statistics');
        });
      });

      describe('Storage Warning', () => {
        it('should display reducedSecurityStorage warning when secureStorageAvailable is false', async () => {
          await TestBed.resetTestingModule();
          const customMockCryptoService = {
            encrypt: jest.fn().mockImplementation(async (data: string) => data),
            decrypt: jest.fn().mockImplementation(async (data: string) => data),
            isEncrypted: jest.fn().mockReturnValue(false),
            secureStorageAvailable: signal(false), // Initialize as false!
          };
          await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [
              ShiftService,
              TranslationService,
              ToastService,
              NotificationService,
              DatePipe,
              { provide: CryptoService, useValue: customMockCryptoService },
            ],
          }).compileComponents();
          const customFixture = TestBed.createComponent(AppComponent);
          const toastSpy = jest.spyOn(TestBed.inject(ToastService), 'error');
          customFixture.detectChanges(); // Trigger effects
          expect(toastSpy).toHaveBeenCalledWith(
            TestBed.inject(TranslationService).translate('reducedSecurityStorage'),
            6000
          );
        });
      });

      describe('Form Validations', () => {
        it('should block shift creation when end date/time is on or before start date/time', () => {
          const toastSpy = jest.spyOn(toastService, 'error');
          component.shiftTitle.set('Valid Title');
          component.shiftStartDate.set('2026-05-21');
          component.shiftStartTime.set('12:00');
          component.shiftEndDate.set('2026-05-21');
          component.shiftEndTime.set('11:00'); // End is before start!

          component.handleFormSubmit();

          expect(toastSpy).toHaveBeenCalledWith(
            translationService.translate('endMustBeAfterStart')
          );
        });
      });

      describe('Logout States', () => {
        it('should call exitGuestMode when in guest mode', async () => {
          const exitGuestSpy = jest.fn();
          component.authService = {
            isGuest: () => true,
            exitGuestMode: exitGuestSpy,
          } as any;

          await component.handleAuthExit();

          expect(exitGuestSpy).toHaveBeenCalled();
        });

        it('should call signOut when authenticated', async () => {
          const signOutSpy = jest.fn().mockResolvedValue(undefined);
          component.authService = {
            isGuest: () => false,
            signOut: signOutSpy,
          } as any;

          await component.handleAuthExit();

          expect(signOutSpy).toHaveBeenCalled();
        });

        it('should toast an error if signOut throws an exception', async () => {
          const signOutSpy = jest.fn().mockRejectedValue(new Error('Signout failed'));
          const toastSpy = jest.spyOn(toastService, 'error');
          component.authService = {
            isGuest: () => false,
            signOut: signOutSpy,
          } as any;

          await component.handleAuthExit();

          expect(toastSpy).toHaveBeenCalledWith(translationService.translate('authGenericError'));
        });
      });

      describe('goToToday Pagination Cutoff', () => {
        it('waits for authenticated sync readiness before completing the initial list scroll', async () => {
          await TestBed.resetTestingModule();

          const authState = signal<any>({ mode: 'loading' });
          const syncStatus = signal<any>({ mode: 'local', labelKey: 'syncLocal' });
          const shifts = signal<Shift[]>([]);
          const mockCryptoService = {
            encrypt: jest.fn().mockImplementation(async (data: string) => data),
            decrypt: jest.fn().mockImplementation(async (data: string) => data),
            isEncrypted: jest.fn().mockReturnValue(false),
            encryptBackupWithPassword: jest.fn(),
            decryptBackupWithPassword: jest.fn(),
            isPasswordProtectedBackupPayload: jest.fn().mockReturnValue(false),
            secureStorageAvailable: signal(true),
          };
          const mockShiftService = {
            shifts,
            decryptionError: signal(false),
          };

          await TestBed.configureTestingModule({
            imports: [AppComponent],
            providers: [
              TranslationService,
              ToastService,
              NotificationService,
              DatePipe,
              { provide: ShiftService, useValue: mockShiftService },
              {
                provide: AuthService,
                useValue: {
                  state: authState,
                  isGuest: () => authState().mode === 'guest',
                  isAuthenticated: () => authState().mode === 'authenticated',
                  hasPasswordProvider: () => false,
                  exitGuestMode: jest.fn(),
                  signOut: jest.fn(),
                  deleteAccount: jest.fn(),
                },
              },
              { provide: SyncService, useValue: { status: syncStatus } },
              { provide: CryptoService, useValue: mockCryptoService },
            ],
          }).compileComponents();

          const customFixture = TestBed.createComponent(AppComponent);
          const customComponent = customFixture.componentInstance;
          const goToTodaySpy = jest
            .spyOn(customComponent, 'goToToday')
            .mockImplementation(() => {});

          shifts.set([
            {
              id: 'local-stale',
              title: 'Local stale',
              start: '2026-05-01T08:00:00.000Z',
              end: '2026-05-01T16:00:00.000Z',
              color: 'sky',
              isRecurring: false,
            },
          ]);
          TestBed.flushEffects();

          expect(goToTodaySpy).not.toHaveBeenCalled();

          authState.set({ mode: 'authenticated', uid: 'uid-1', emailVerified: true });
          syncStatus.set({ mode: 'connecting', labelKey: 'syncConnecting' });
          TestBed.flushEffects();

          expect(goToTodaySpy).not.toHaveBeenCalled();

          shifts.set([
            {
              id: 'remote-current',
              title: 'Remote current',
              start: '2026-05-22T08:00:00.000Z',
              end: '2026-05-22T16:00:00.000Z',
              color: 'emerald',
              isRecurring: false,
            },
          ]);
          syncStatus.set({ mode: 'synced', labelKey: 'syncSynced' });
          TestBed.flushEffects();

          expect(goToTodaySpy).toHaveBeenCalledTimes(1);
          expect(goToTodaySpy).toHaveBeenCalledWith('auto');
        });

        it('should dynamically scale up listVisibleCount when the target index is beyond listVisibleCount', () => {
          shiftService.deleteAllShifts();

          const now = Date.now();
          const hourMs = 60 * 60 * 1000;
          const dayMs = 24 * hourMs;

          for (let i = 0; i < 65; i++) {
            const shiftTime = now - 30 * dayMs + i * hourMs;
            shiftService.addShift({
              title: `Past Shift ${i}`,
              start: new Date(shiftTime).toISOString(),
              end: new Date(shiftTime + 30 * 60 * 1000).toISOString(),
              color: 'sky',
              isRecurring: false,
            });
          }

          component.listVisibleCount.set(50);

          component.goToToday('auto');

          expect(component.listVisibleCount()).toBe(100);
        });

        it('should retry scrolling to the first upcoming shift if the target row is not rendered yet', () => {
          jest.useFakeTimers();
          try {
            jest.setSystemTime(new Date('2026-05-22T10:00:00.000Z'));
            shiftService.deleteAllShifts();
            shiftService.addShift({
              title: 'Upcoming Shift',
              start: '2026-05-25T07:00:00.000Z',
              end: '2026-05-25T15:00:00.000Z',
              color: 'sky',
              isRecurring: false,
            });
            const scrollIntoView = jest.fn();
            const getElementByIdSpy = jest
              .spyOn(document, 'getElementById')
              .mockReturnValueOnce(null)
              .mockReturnValueOnce({ scrollIntoView } as unknown as HTMLElement);

            component.goToToday('auto');
            jest.runOnlyPendingTimers();
            jest.runOnlyPendingTimers();

            expect(getElementByIdSpy).toHaveBeenCalledWith(
              expect.stringMatching(/^shift-[0-9a-f-]/)
            );
            expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
          } finally {
            jest.useRealTimers();
          }
        });
      });
    });
  });
});
