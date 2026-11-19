import { TestBed, ComponentFixture, DeferBlockBehavior } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { ToastService } from './services/toast.service';
import { NotificationService } from './services/notification.service';
import { CryptoService } from './services/crypto.service';
import { AuthService, AuthState } from './services/auth.service';
import { SyncService } from './services/sync.service';
import { SwUpdateService } from './services/sw-update.service';
import { StatisticsDrawerComponent } from './components/statistics-drawer.component';
import { DatePipe } from '@angular/common';
import { signal } from '@angular/core';
import { Shift } from './shift.model';
import translationsIt from './assets/i18n/it.json';
import translationsEn from './assets/i18n/en.json';

describe('AppComponent - Integration Tests', () => {
  let component: AppComponent;
  let fixture: ComponentFixture<AppComponent>;
  let shiftService: ShiftService;
  let translationService: TranslationService;
  let toastService: ToastService;
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
      deferBlockBehavior: DeferBlockBehavior.Playthrough,
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
      expect(component.searchDate()).toBeNull();
      expect(component.searchDateInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(component.listVisibleCount()).toBe(50);
    });

    it('should open new shift form when requested programmatically', () => {
      // Test openNewShiftForm method which is what checkUrlForActions calls
      expect(component.activeModal()).toBe('none');
      expect(component.editingShift()).toBeNull();

      component.openNewShiftForm();

      expect(component.activeModal()).toBe('form');
      expect(component.editingShift()).toBeNull();
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

    it('should open the decryption error modal when ShiftService reports a decrypt failure', () => {
      shiftService.decryptionError.set(true);
      fixture.detectChanges();

      expect(component.activeModal()).toBe('decryptionError');
    });

    it('should stay closed after dismissing decryptionError even while decryptionError signal remains true', () => {
      shiftService.decryptionError.set(true);
      fixture.detectChanges();
      expect(component.activeModal()).toBe('decryptionError');

      component.dismissDecryptionError();
      fixture.detectChanges();

      expect(component.activeModal()).toBe('none');
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

      await component.executeDeleteAccount({
        email: 'wrong@example.com',
        password: 'Password1!',
      });

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

      await component.executeDeleteAccount({
        email: 'delete@example.com',
        password: 'Password1!',
      });

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

      await component.executeDeleteAccount({
        email: 'delete@example.com',
        password: 'Password1!',
      });

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

      await component.executeDeleteAccount({
        email: 'delete@example.com',
        password: 'Password1!',
      });

      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('should show the network error message if account deletion fails offline', async () => {
      const auth = component.authService as any;
      auth.deleteAccount.mockRejectedValueOnce({ code: 'auth/network-request-failed' });
      const toastSpy = jest.spyOn(toastService, 'error');

      component.proceedDeleteAccountConfirmation();

      await component.executeDeleteAccount({
        email: 'delete@example.com',
        password: 'Password1!',
      });

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

      await component.executeDeleteAccount({ email: 'delete@example.com', password: '' });

      expect(component.authService.deleteAccount).toHaveBeenCalledWith({});
    });
  });

  describe('Shift Form - Create Flow', () => {
    beforeEach(() => {
      component.openNewShiftForm();
    });

    it('should create a single shift with all fields and close modal', () => {
      component.handleShiftFormSave({
        editingShift: null,
        shiftData: {
          title: 'Morning Shift',
          start: '2025-10-15T08:00:00.000Z',
          end: '2025-10-15T16:00:00.000Z',
          color: 'green',
          isRecurring: false,
          notes: 'Important shift',
          overtimeHours: 1.5,
          allowances: [{ name: 'Transport', amount: 10 }],
        },
      });

      const shifts = shiftService.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].title).toBe('Morning Shift');
      expect(shifts[0].color).toBe('green');
      expect(shifts[0].notes).toBe('Important shift');
      expect(shifts[0].overtimeHours).toBe(1.5);
      expect(shifts[0].allowances).toEqual([{ name: 'Transport', amount: 10 }]);
      expect(component.activeModal()).toBe('none');
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

    it('should update existing shift and preserve ID', () => {
      const originalId = existingShift.id;

      component.handleShiftFormSave({
        editingShift: existingShift,
        shiftData: {
          title: 'Updated Shift',
          start: existingShift.start,
          end: existingShift.end,
          color: 'rose',
          isRecurring: false,
        },
      });

      const shifts = shiftService.shifts();
      expect(shifts).toHaveLength(1);
      expect(shifts[0].id).toBe(originalId);
      expect(shifts[0].title).toBe('Updated Shift');
      expect(shifts[0].color).toBe('rose');
      expect(component.activeModal()).toBe('none');
    });

    it('should prompt for edit scope when saving an edited recurring shift', () => {
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
      component.handleShiftFormSave({
        editingShift: recurringShift,
        shiftData: {
          title: 'Edited Series',
          start: recurringShift.start,
          end: recurringShift.end,
          color: 'green',
          isRecurring: true,
          repetition: { frequency: 'days', interval: 7 },
        },
      });

      expect(component.activeModal()).toBe('editSeriesConfirm');
      expect(component.pendingShiftData()).not.toBeNull();
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

  describe('closeModal centralized cleanup (#8)', () => {
    it('should clear pending import state when closing passwordPrompt', () => {
      component.pendingImportData.set('{"encrypted":"[]"}');
      component.isImporting.set(true);
      component.passwordPromptMode.set('import');
      component.openModal('passwordPrompt');

      component.closeModal();

      expect(component.activeModal()).toBe('none');
      expect(component.pendingImportData()).toBeNull();
      expect(component.isImporting()).toBe(false);
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

      await component.confirmPasswordPrompt({
        password: 'test-password',
        confirmPassword: 'test-password',
      });

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

        await component.confirmPasswordPrompt({
          password: 'shortpass',
          confirmPassword: 'shortpass',
        });

        expect(errorSpy).toHaveBeenCalled();
        const message = errorSpy.mock.calls[0][0] as string;
        expect(message).toContain('12');
        expect(component.activeModal()).toBe('passwordPrompt');
        expect(cryptoService.encryptBackupWithPassword).not.toHaveBeenCalled();
      });

      it('should reject an 11-character password (boundary case)', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');

        await component.confirmPasswordPrompt({
          password: 'elevenchars',
          confirmPassword: 'elevenchars',
        });

        expect(errorSpy).toHaveBeenCalled();
        expect(component.activeModal()).toBe('passwordPrompt');
        expect(cryptoService.encryptBackupWithPassword).not.toHaveBeenCalled();
      });

      it('should accept a password of exactly 12 characters and proceed with export', async () => {
        global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
        global.URL.revokeObjectURL = jest.fn();
        jest.spyOn(document, 'createElement').mockReturnValue({ click: jest.fn() } as any);
        const errorSpy = jest.spyOn(toastService, 'error');

        await component.confirmPasswordPrompt({
          password: 'twelvechars1',
          confirmPassword: 'twelvechars1',
        });

        expect(errorSpy).not.toHaveBeenCalled();
        expect(cryptoService.encryptBackupWithPassword).toHaveBeenCalledWith(
          expect.any(String),
          'twelvechars1'
        );
        expect(component.activeModal()).toBe('none');
      });

      it('should reject when password and confirmation differ (length OK)', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');

        await component.confirmPasswordPrompt({
          password: 'longenoughpassword',
          confirmPassword: 'differentpassword!',
        });

        expect(errorSpy).toHaveBeenCalled();
        expect(component.activeModal()).toBe('passwordPrompt');
        expect(cryptoService.encryptBackupWithPassword).not.toHaveBeenCalled();
      });

      it('should enforce length check before mismatch check (short + mismatched → length error)', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');

        await component.confirmPasswordPrompt({
          password: 'shortA',
          confirmPassword: 'shortB',
        });

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

        await component.confirmPasswordPrompt({ password: 'abc', confirmPassword: '' });

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

        await component.confirmPasswordPrompt({
          password: 'test-password',
          confirmPassword: '',
        });

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
        component.openModal('searchDate');
        component.handleDateSearch('1899-12-31');

        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('dateOutOfRange'));
        expect(component.searchDate()).toBe(previousSearchDate);
        expect(component.activeModal()).toBe('searchDate');
      });

      it('should reject dates after 2100 and keep the search modal open', () => {
        const errorSpy = jest.spyOn(toastService, 'error');
        const previousSearchDate = new Date('2025-01-01T00:00:00');

        component.searchDate.set(previousSearchDate);
        component.openModal('searchDate');
        component.handleDateSearch('2101-01-01');

        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('dateOutOfRange'));
        expect(component.searchDate()).toBe(previousSearchDate);
        expect(component.activeModal()).toBe('searchDate');
      });

      it('should reject invalid date values that parse to NaN', () => {
        const errorSpy = jest.spyOn(toastService, 'error');
        const previousSearchDate = new Date('2025-01-01T00:00:00');

        component.searchDate.set(previousSearchDate);
        component.openModal('searchDate');
        component.handleDateSearch('not-a-date');

        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('invalidDateFormat'));
        expect(component.searchDate()).toBe(previousSearchDate);
        expect(component.activeModal()).toBe('searchDate');
      });

      it('should close the date search modal when the input is empty', () => {
        component.openModal('searchDate');

        component.handleDateSearch('');

        expect(component.activeModal()).toBe('none');
      });

      it('should show an informational toast for searches before the visible range', () => {
        const infoSpy = jest.spyOn(toastService, 'info');

        component.handleDateSearch('1900-01-01');

        expect(infoSpy).toHaveBeenCalledWith(
          translationService.translate('searchOutsideRange'),
          5000
        );
      });

      it('should show an informational toast for searches after the visible range', () => {
        const infoSpy = jest.spyOn(toastService, 'info');

        component.handleDateSearch('2100-01-01');

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

        component.openModal('searchDate');
        component.handleDateSearch('throw-date');

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

      await component.confirmPasswordPrompt({ password: '', confirmPassword: '' });

      expect(component.activeModal()).toBe('passwordPrompt');
      expect(component.isExporting()).toBe(false);
    });

    it('should return from import password confirmation when pending import data is missing', async () => {
      component.openModal('passwordPrompt');
      component.passwordPromptMode.set('import');
      component.pendingImportData.set(null);

      await component.confirmPasswordPrompt({ password: 'secret', confirmPassword: '' });

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

  describe('Integration - Complete Workflow', () => {
    it('should handle complete shift lifecycle: create -> edit -> delete', () => {
      // 1. Create shift
      component.openNewShiftForm();
      component.handleShiftFormSave({
        editingShift: null,
        shiftData: {
          title: 'Lifecycle Test',
          start: '2025-10-15T08:00:00.000Z',
          end: '2025-10-15T16:00:00.000Z',
          color: 'indigo',
          isRecurring: false,
          overtimeHours: 1,
          allowances: [{ name: 'Meal', amount: 15 }],
        },
      });

      expect(shiftService.shifts()).toHaveLength(1);
      const createdShift = shiftService.shifts()[0];

      // 2. Edit shift
      component.openEditShiftForm(createdShift);
      component.handleShiftFormSave({
        editingShift: createdShift,
        shiftData: {
          title: 'Updated Lifecycle Test',
          start: createdShift.start,
          end: createdShift.end,
          color: 'indigo',
          isRecurring: false,
          overtimeHours: 2,
          allowances: [{ name: 'Meal', amount: 15 }],
        },
      });

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
      component.openNewShiftForm();
      component.handleShiftFormSave({
        editingShift: null,
        shiftData: {
          title: 'Shift 1',
          start: '2025-10-15T08:00:00.000Z',
          end: '2025-10-15T16:00:00.000Z',
          color: 'indigo',
          isRecurring: false,
        },
      });

      component.openNewShiftForm();
      component.handleShiftFormSave({
        editingShift: null,
        shiftData: {
          title: 'Shift 2',
          start: '2025-10-16T09:00:00.000Z',
          end: '2025-10-16T17:00:00.000Z',
          color: 'indigo',
          isRecurring: false,
        },
      });

      expect(shiftService.shifts()).toHaveLength(2);

      const shifts = shiftService.shifts();
      expect(shifts.find(s => s.title === 'Shift 1')).toBeTruthy();
      expect(shifts.find(s => s.title === 'Shift 2')).toBeTruthy();
    });

    it('should persist theme and shifts through component recreation', async () => {
      component.theme.set('dark');
      component.openNewShiftForm();
      component.handleShiftFormSave({
        editingShift: null,
        shiftData: {
          title: 'Persistent Shift',
          start: '2025-10-15T08:00:00.000Z',
          end: '2025-10-15T16:00:00.000Z',
          color: 'indigo',
          isRecurring: false,
        },
      });

      fixture.detectChanges();
      await fixture.whenStable();

      expect(localStorageMock['easyturno_theme']).toBe('dark');
      expect(localStorageMock['easyturno_user_data_v2']).toBeTruthy();

      const newFixture = TestBed.createComponent(AppComponent);
      const newComponent = newFixture.componentInstance;

      expect(newComponent.theme()).toBe('dark');
      expect(shiftService.shifts()).toHaveLength(1);
      expect(shiftService.shifts()[0].title).toBe('Persistent Shift');
    });
  });

  describe('app.component.ts residual coverage (T11)', () => {
    describe('DatePipe ISO fallback', () => {
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
        expect(newComponent.searchDateInput()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
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

        const updateShiftSpy = jest.spyOn(shiftService, 'updateShift');
        const updateShiftSeriesSpy = jest.spyOn(shiftService, 'updateShiftSeries');

        component.handleShiftFormSave({
          editingShift: editingInstance,
          shiftData: {
            title: 'One-off Standup',
            start: editingInstance.start,
            end: editingInstance.end,
            color: 'sky',
            isRecurring: true,
            repetition: { frequency: 'weeks', interval: 1 },
          },
        });
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

    describe('allowance form layout', () => {
      it('allowance name input has min-w-0 so the remove button stays visible on narrow screens', async () => {
        const authStateSignal = signal({ mode: 'guest' });
        component.authService = {
          ...(component.authService as any),
          state: authStateSignal,
          isGuest: () => true,
        } as any;
        fixture.detectChanges();
        component.openNewShiftForm();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        (host.querySelector('[data-cy="add-allowance-btn"]') as HTMLButtonElement).click();
        fixture.detectChanges();

        const nameInput: HTMLInputElement | null = host.querySelector(
          '[data-cy="allowance-name-input"]'
        );

        expect(nameInput).not.toBeNull();
        expect(nameInput!.classList.contains('min-w-0')).toBe(true);
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

  describe('Fase 3 UI Fixes (Steps 3.1, 3.2, 3.4)', () => {
    const setupAuthMode = (initialMode: AuthState['mode'] = 'guest') => {
      const authState = signal<AuthState>({
        mode: initialMode,
        email: initialMode === 'email-not-verified' ? 'user@example.com' : undefined,
      });
      component.authService = {
        ...(component.authService as unknown as Record<string, unknown>),
        state: authState.asReadonly(),
        isAuthenticated: () => authState().mode === 'authenticated',
        isGuest: () => authState().mode === 'guest',
        hasPasswordProvider: () => false,
      } as unknown as AuthService;
      return authState;
    };

    describe('Step 3.1: Toast container visibility outside activeModal and across auth modes', () => {
      it('renders a single app-toast-container when activeModal is none', () => {
        setupAuthMode('guest');
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        expect(component.activeModal()).toBe('none');
        expect(host.querySelectorAll('app-toast-container').length).toBe(1);
      });

      it('renders toast in the DOM after executeReset() closes the modal', () => {
        jest.useFakeTimers();
        try {
          setupAuthMode('guest');
          fixture.detectChanges();

          component.confirmReset();
          fixture.detectChanges();
          component.executeReset();
          fixture.detectChanges();

          const host = fixture.nativeElement as HTMLElement;
          expect(component.activeModal()).toBe('none');
          const alertEl = host.querySelector('app-toast-container [role="alert"]');
          expect(alertEl).not.toBeNull();
          expect(alertEl?.textContent).toContain(translationService.translate('resetSuccess'));
        } finally {
          toastService.dismissAll();
          jest.useRealTimers();
        }
      });

      it('renders toast in the DOM after out-of-range search closes the modal', () => {
        jest.useFakeTimers();
        try {
          setupAuthMode('guest');
          fixture.detectChanges();

          component.openModal('searchDate');
          fixture.detectChanges();

          component.handleDateSearch('1900-01-01');
          fixture.detectChanges();

          const host = fixture.nativeElement as HTMLElement;
          expect(component.activeModal()).toBe('none');
          const alertEl = host.querySelector('app-toast-container [role="alert"]');
          expect(alertEl).not.toBeNull();
          expect(alertEl?.textContent).toContain(
            translationService.translate('searchOutsideRange')
          );
        } finally {
          toastService.dismissAll();
          jest.useRealTimers();
        }
      });

      it('renders a single app-toast-container in auth and email-verification modes too', async () => {
        try {
          const authState = setupAuthMode('unauthenticated');
          fixture.detectChanges();
          await fixture.whenStable();
          fixture.detectChanges();

          const host = fixture.nativeElement as HTMLElement;
          expect(host.querySelector('app-auth-screen')).not.toBeNull();
          expect(host.querySelectorAll('app-toast-container').length).toBe(1);

          jest.useFakeTimers();
          toastService.error('Auth screen error');
          fixture.detectChanges();
          expect(host.querySelector('app-toast-container [role="alert"]')?.textContent).toContain(
            'Auth screen error'
          );

          toastService.dismissAll();
          jest.useRealTimers();
          authState.set({ mode: 'email-not-verified', email: 'verify@example.com' });
          fixture.detectChanges();
          await fixture.whenStable();
          fixture.detectChanges();

          expect(host.querySelector('app-email-verification-screen')).not.toBeNull();
          expect(host.querySelectorAll('app-toast-container').length).toBe(1);

          jest.useFakeTimers();
          toastService.info('Verification info');
          fixture.detectChanges();
          expect(host.querySelector('app-toast-container [role="alert"]')?.textContent).toContain(
            'Verification info'
          );
        } finally {
          toastService.dismissAll();
          jest.useRealTimers();
        }
      });

      it('keeps exactly one app-toast-container when a modal is open', () => {
        setupAuthMode('guest');
        component.openModal('settings');
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelectorAll('app-toast-container').length).toBe(1);
      });
    });

    describe('Step 3.2: Modal backdrop Tailwind v4 opacity', () => {
      it('renders modal backdrop with bg-black/50 and without deprecated bg-opacity-50', async () => {
        setupAuthMode('guest');
        component.openModal('form');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const backdrop = host.querySelector('.fixed.inset-0.z-50') as HTMLElement | null;

        expect(backdrop).not.toBeNull();
        expect(backdrop!.classList.contains('bg-black/50')).toBe(true);
        expect(backdrop!.classList.contains('bg-opacity-50')).toBe(false);
        expect(backdrop!.classList.contains('bg-black')).toBe(false);
      });
    });

    describe('Step 3.4: Statistics modal i18n and translation key parity', () => {
      it('renders Statistics modal in English without hardcoded Italian leftovers when populated', async () => {
        setupAuthMode('guest');
        translationService.setLanguage('en');
        shiftService.deleteAllShifts();

        shiftService.addShift({
          title: 'Morning',
          start: '2025-10-01T08:00:00',
          end: '2025-10-01T16:00:00',
          color: 'sky',
          isRecurring: false,
          overtimeHours: 2,
          allowances: [{ name: 'Meal', amount: 15 }],
        });
        shiftService.addShift({
          title: 'Morning',
          start: '2025-10-02T08:00:00',
          end: '2025-10-02T16:00:00',
          color: 'sky',
          isRecurring: false,
        });
        shiftService.addShift({
          title: 'Night',
          start: '2025-10-03T22:00:00',
          end: '2025-10-04T06:00:00',
          color: 'indigo',
          isRecurring: false,
        });

        component.openStatistics();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const statsDrawer = fixture.debugElement.query(By.directive(StatisticsDrawerComponent))
          .componentInstance as StatisticsDrawerComponent;
        statsDrawer.statsStartDate.set('2025-10-01');
        statsDrawer.statsEndDate.set('2025-10-31');
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const modal = host.querySelector('.modal-fade-in') as HTMLElement | null;
        expect(modal).not.toBeNull();

        const text = modal!.textContent ?? '';
        expect(text).toContain('Statistics');
        expect(text).toContain('hours');
        expect(text).toContain('2 shifts (67%)');
        expect(text).toContain('1 shift (33%)');

        expect(text).not.toContain('Analisi e resoconto');
        expect(text).not.toContain('Dati calcolati in locale');
        expect(text).not.toContain('Non ci sono turni pianificati');
        expect(text).not.toMatch(/\bturn[oi]\b/i);
        expect(text).not.toMatch(/\bore\b/i);

        // Subtitle and local badge must also translate cleanly to Italian when switched back
        translationService.setLanguage('it');
        fixture.detectChanges();
        const itText = modal!.textContent ?? '';
        expect(itText).toContain('Analisi e resoconto');
        expect(itText).toContain('Dati calcolati in locale');
        expect(itText).toContain('ore');
        expect(itText).toContain('2 turni (67%)');
        expect(itText).toContain('1 turno (33%)');
      });

      it('renders Statistics modal empty state in English without hardcoded Italian leftovers', async () => {
        setupAuthMode('guest');
        translationService.setLanguage('en');
        shiftService.deleteAllShifts();

        component.openStatistics();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const statsDrawer = fixture.debugElement.query(By.directive(StatisticsDrawerComponent))
          .componentInstance as StatisticsDrawerComponent;
        statsDrawer.statsStartDate.set('2025-10-01');
        statsDrawer.statsEndDate.set('2025-10-31');
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const modal = host.querySelector('.modal-fade-in') as HTMLElement | null;
        expect(modal).not.toBeNull();

        const text = modal!.textContent ?? '';
        expect(text).toContain(translationService.translate('noData'));
        expect(text).not.toContain('Analisi e resoconto');
        expect(text).not.toContain('Non ci sono turni pianificati');
        expect(text).not.toMatch(/\bturn[oi]\b/i);
        expect(text).not.toMatch(/\bore\b/i);

        const emptyDescEn = modal!.querySelector('p.max-w-sm')?.textContent?.trim() ?? '';
        expect(emptyDescEn.length).toBeGreaterThan(10);

        translationService.setLanguage('it');
        fixture.detectChanges();
        const emptyDescIt = modal!.querySelector('p.max-w-sm')?.textContent?.trim() ?? '';
        expect(emptyDescIt).toContain('Non ci sono turni pianificati');
        expect(emptyDescEn).not.toBe(emptyDescIt);
      });

      it('maintains exact symmetric key parity between it.json and en.json', () => {
        const collectLeafKeys = (obj: Record<string, unknown>, prefix = ''): string[] => {
          const keys: string[] = [];
          for (const [k, v] of Object.entries(obj)) {
            const path = prefix ? `${prefix}.${k}` : k;
            if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
              keys.push(...collectLeafKeys(v as Record<string, unknown>, path));
            } else {
              expect(typeof v).toBe('string');
              expect((v as string).trim().length).toBeGreaterThan(0);
              keys.push(path);
            }
          }
          return keys.sort();
        };

        const itKeys = collectLeafKeys(translationsIt as Record<string, unknown>);
        const enKeys = collectLeafKeys(translationsEn as Record<string, unknown>);

        expect(itKeys).toEqual(enKeys);
        expect(itKeys.length).toBeGreaterThanOrEqual(210);
      });
    });

    describe('Error fallback branches', () => {
      it('shows generic error toast when deleteAccount rejects with an unknown error', async () => {
        const authState = signal<AuthState>({
          mode: 'authenticated',
          uid: 'u-del',
          email: 'user@example.com',
          emailVerified: true,
        });
        component.authService = {
          ...(component.authService as unknown as Record<string, unknown>),
          state: authState.asReadonly(),
          isAuthenticated: () => true,
          isGuest: () => false,
          hasPasswordProvider: () => false,
          deleteAccount: jest.fn().mockRejectedValue('non-object-failure'),
        } as unknown as AuthService;
        const errorSpy = jest.spyOn(toastService, 'error');

        await component.executeDeleteAccount({ email: 'user@example.com', password: '' });

        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('authGenericError'));
        expect(component.isDeletingAccount()).toBe(false);
      });

      it('handles export encryption failure gracefully and resets isExporting', async () => {
        const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
        const errorSpy = jest.spyOn(toastService, 'error');
        (cryptoService.encryptBackupWithPassword as jest.Mock).mockRejectedValueOnce(
          new Error('encrypt boom')
        );
        component.passwordPromptMode.set('export');

        await component.confirmPasswordPrompt({
          password: 'password1234',
          confirmPassword: 'password1234',
        });

        expect(consoleSpy).toHaveBeenCalledWith('Export failed:', expect.any(Error));
        expect(errorSpy).toHaveBeenCalledWith(translationService.translate('exportError'));
        expect(component.isExporting()).toBe(false);
        consoleSpy.mockRestore();
      });

      it('shows invalid password toast when encrypted backup decryption fails during import', async () => {
        const errorSpy = jest.spyOn(toastService, 'error');
        (cryptoService.decryptBackupWithPassword as jest.Mock).mockRejectedValueOnce(
          new Error('bad password')
        );
        component.passwordPromptMode.set('import');
        component.pendingImportData.set('{"encrypted":"payload"}');

        await component.confirmPasswordPrompt({ password: 'wrong-password', confirmPassword: '' });

        expect(errorSpy).toHaveBeenCalledWith(
          translationService.translate('backupPasswordInvalid'),
          5000
        );
      });

      it('returns null secondaryDialogMode for non-dialog primary modals', () => {
        component.openNewShiftForm();
        expect(component.secondaryDialogMode()).toBeNull();
      });
    });

    describe('Step 5.3: Large dataset list sorting and filtering optimization', () => {
      it('skips Array.prototype.sort on already-sorted shifts and still sorts out-of-order shifts', () => {
        const now = Date.now();
        const sortedBulk: Shift[] = Array.from({ length: 730 }, (_, idx) => {
          const start = new Date(now + idx * 3600_000).toISOString();
          const end = new Date(now + idx * 3600_000 + 1800_000).toISOString();
          return {
            id: `bulk-${idx}`,
            seriesId: `bulk-${idx}`,
            title: `Shift ${idx}`,
            start,
            end,
            color: 'indigo',
            isRecurring: false,
          };
        });

        const shiftsSig = signal<Shift[]>(sortedBulk);
        (component.shiftService as unknown as { shifts: typeof shiftsSig }).shifts = shiftsSig;

        const sortSpy = jest.spyOn(Array.prototype, 'sort');
        const list = component.allListShifts();
        expect(list).toHaveLength(730);
        expect(sortSpy).not.toHaveBeenCalled();
        sortSpy.mockRestore();

        // Out-of-order input still gets sorted deterministically
        shiftsSig.set([sortedBulk[10], sortedBulk[0], sortedBulk[5]]);
        expect(component.allListShifts().map(s => s.id)).toEqual(['bulk-0', 'bulk-5', 'bulk-10']);
      });
    });

    describe('Step 5.4: Accessibility, ARIA landmarks & modal focus management', () => {
      it('provides accessible aria-label on settings button, aria-pressed on view toggle, and role=status on update banner', () => {
        setupAuthMode('guest');
        component.swUpdateService.updateAvailable.set(true);
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const settingsBtn = host.querySelector('[data-cy="settings-btn"]') as HTMLButtonElement;
        const listBtn = host.querySelector('[data-cy="view-list"]') as HTMLButtonElement;
        const calendarBtn = host.querySelector('[data-cy="view-calendar"]') as HTMLButtonElement;
        const updateBanner = host.querySelector('[role="status"]');

        expect(settingsBtn.getAttribute('aria-label')).toBe(
          translationService.translate('settings')
        );
        expect(listBtn.getAttribute('aria-pressed')).toBe('true');
        expect(calendarBtn.getAttribute('aria-pressed')).toBe('false');
        expect(updateBanner).not.toBeNull();
        expect(updateBanner?.getAttribute('aria-label')).toBe(
          translationService.translate('updateAvailable')
        );
      });

      it('moves focus into opened modal, traps Tab inside dialog, marks shell inert, and restores focus on close', async () => {
        setupAuthMode('guest');
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const settingsBtn = host.querySelector('[data-cy="settings-btn"]') as HTMLButtonElement;
        settingsBtn.focus();
        expect(document.activeElement).toBe(settingsBtn);

        settingsBtn.click();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();
        await Promise.resolve();

        const shell = host.querySelector('.h-dvh') as HTMLElement;
        expect(shell.hasAttribute('inert')).toBe(true);

        const dialog = host.querySelector('[role="dialog"]') as HTMLElement;
        expect(dialog).not.toBeNull();
        expect(dialog.contains(document.activeElement)).toBe(true);

        const focusableButtons = Array.from(
          dialog.querySelectorAll<HTMLElement>('button:not([disabled])')
        );
        expect(focusableButtons.length).toBeGreaterThan(1);

        const firstBtn = focusableButtons[0]!;
        const lastBtn = focusableButtons[focusableButtons.length - 1]!;

        lastBtn.focus();
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', cancelable: true }));
        expect(document.activeElement).toBe(firstBtn);

        firstBtn.focus();
        window.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true })
        );
        expect(document.activeElement).toBe(lastBtn);

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }));
        fixture.detectChanges();
        await Promise.resolve();

        expect(component.activeModal()).toBe('none');
        expect(shell.hasAttribute('inert')).toBe(false);
        expect(document.activeElement).toBe(settingsBtn);
      });

      it('handles focus edge branches: modal-to-modal switch, zero focusables, hidden controls, and missing dialog', async () => {
        setupAuthMode('guest');
        fixture.detectChanges();

        // Transition directly between two open modals and verify focus updates cleanly
        component.openModal('settings');
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        component.openStatistics();
        fixture.detectChanges();
        await fixture.whenStable();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        const statsDialog = host.querySelector(
          'app-statistics-drawer [role="dialog"]'
        ) as HTMLElement;
        expect(statsDialog).not.toBeNull();
        expect(statsDialog.contains(document.activeElement)).toBe(true);

        // Tab with a middle button focused does not hijack normal sequential tabbing
        const buttons = Array.from(
          statsDialog.querySelectorAll<HTMLElement>('button:not([disabled])')
        );
        if (buttons.length > 2) {
          buttons[1]!.focus();
          const midTab = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
          window.dispatchEvent(midTab);
          expect(midTab.defaultPrevented).toBe(false);
        }

        // Hidden and aria-hidden elements are excluded from focusable queries
        const hiddenBtn = document.createElement('button');
        hiddenBtn.setAttribute('hidden', '');
        statsDialog.appendChild(hiddenBtn);
        const ariaHiddenBtn = document.createElement('button');
        ariaHiddenBtn.setAttribute('aria-hidden', 'true');
        statsDialog.appendChild(ariaHiddenBtn);
        const focusables = (component as any).getFocusableElements(statsDialog) as HTMLElement[];
        expect(focusables).not.toContain(hiddenBtn);
        expect(focusables).not.toContain(ariaHiddenBtn);
        hiddenBtn.remove();
        ariaHiddenBtn.remove();

        // Fallback when dialog contains zero focusable elements focuses dialog container itself
        const emptyDialog = document.createElement('div');
        emptyDialog.setAttribute('role', 'dialog');
        emptyDialog.setAttribute('tabindex', '-1');
        const querySpy = jest
          .spyOn(component as any, 'getActiveDialogElement')
          .mockReturnValue(emptyDialog);
        host.appendChild(emptyDialog);
        const tabEvent = new KeyboardEvent('keydown', { key: 'Tab', cancelable: true });
        (component as any).trapFocusInDialog(tabEvent);
        expect(tabEvent.defaultPrevented).toBe(true);
        expect(document.activeElement).toBe(emptyDialog);
        emptyDialog.remove();

        // No-op guards when activeModal is 'none' or dialog element is not yet mounted
        querySpy.mockReturnValue(null);
        (component as any).trapFocusInDialog(new KeyboardEvent('keydown', { key: 'Tab' }));
        (component as any).tryFocusActiveDialog();
        querySpy.mockRestore();

        component.closeModal();
        fixture.detectChanges();
        (component as any).tryFocusActiveDialog();
      });
    });
  });
});
