import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  WritableSignal,
  effect,
} from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Shift, Repetition, AllowanceWithId, ShiftColor } from './shift.model';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { ToastService } from './services/toast.service';
import { NotificationService, NotificationSettings } from './services/notification.service';
import { SwUpdateService } from './services/sw-update.service';
import { CryptoService } from './services/crypto.service';
import { AuthService } from './services/auth.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { LangDatePipe } from './pipes/date-format.pipe';
import { ToastContainerComponent } from './components/toast-container.component';
import { ShiftListItemComponent } from './components/shift-list-item.component';
import { CalendarComponent } from './components/calendar.component';
import { AuthScreenComponent } from './components/auth-screen.component';
import { EmailVerificationScreenComponent } from './components/email-verification-screen.component';
import { SyncService } from './services/sync.service';
import { DeviceService } from './services/device.service';
import { UserDataService } from './services/user-data.service';
import { PushNotificationService } from './services/push-notification.service';

type Modal =
  | 'none'
  | 'form'
  | 'settings'
  | 'deleteAccountWarning'
  | 'deleteAccountConfirm'
  | 'deleteConfirm'
  | 'deleteSeriesConfirm'
  | 'resetConfirm'
  | 'editSeriesConfirm'
  | 'searchDate'
  | 'statistics'
  | 'decryptionError'
  | 'passwordPrompt';

type PasswordPromptMode = 'export' | 'import';

type ViewMode = 'list' | 'calendar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    FormsModule,
    TranslatePipe,
    LangDatePipe,
    ToastContainerComponent,
    ShiftListItemComponent,
    CalendarComponent,
    AuthScreenComponent,
    EmailVerificationScreenComponent,
  ],
  providers: [DatePipe],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [
    `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: scale(0.97);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
      .modal-fade-in {
        animation: fadeIn 0.15s ease-out forwards;
      }
    `,
  ],
})
export class AppComponent {
  shiftService = inject(ShiftService);
  translationService = inject(TranslationService);
  toastService = inject(ToastService);
  notificationService = inject(NotificationService);
  swUpdateService = inject(SwUpdateService);
  authService = inject(AuthService);
  cryptoService = inject(CryptoService);
  syncService = inject(SyncService);
  pushNotificationService = inject(PushNotificationService);
  datePipe = inject(DatePipe);
  private document = inject(DOCUMENT);
  private readonly MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  private readonly MIN_BACKUP_PASSWORD_LENGTH = 12;
  private readonly BACKUP_REMINDER_THRESHOLD = 5;
  private readonly BACKUP_REMINDER_STORAGE_KEY = 'easyturno_backup_reminder_shown';

  // Native platform detection (wrap to preserve `this` binding on Capacitor)
  isNativePlatform = (): boolean => Capacitor.isNativePlatform();

  // Notification settings
  notificationSettings = signal<NotificationSettings>(this.notificationService.getSettings());

  // UI State
  theme: WritableSignal<'light' | 'dark'>;
  activeModal = signal<Modal>('none');
  viewMode = signal<ViewMode>('list');
  isImporting = signal(false);
  isExporting = signal(false);

  // Form & Edit State
  editingShift: WritableSignal<Shift | null> = signal(null);
  pendingShiftData = signal<Partial<Shift> | null>(null);
  shiftTitle = signal('');
  shiftStartDate = signal('');
  shiftStartTime = signal('');
  shiftEndDate = signal('');
  shiftEndTime = signal('');
  shiftColor = signal<ShiftColor>('sky');
  shiftIsRecurring = signal(false);
  shiftRepetition = signal<Repetition>({ frequency: 'days', interval: 1 });
  shiftNotes = signal('');
  shiftOvertimeHours = signal<number>(0);
  shiftAllowances = signal<AllowanceWithId[]>([]);

  // Confirmation state
  shiftToDelete = signal<Shift | null>(null);
  deleteAccountEmailInput = signal('');
  deleteAccountPasswordInput = signal('');
  isDeletingAccount = signal(false);

  // Password prompt state
  passwordPromptMode = signal<PasswordPromptMode>('export');
  passwordInput = signal('');
  passwordConfirmInput = signal('');
  pendingImportData = signal<string | null>(null);

  // Statistics state
  statsStartDate = signal('');
  statsEndDate = signal('');

  // List view state
  listVisibleCount = signal(50); // Initialized with INITIAL_LIST_SIZE constant below
  searchDate = signal<Date | null>(null);
  searchDateInput = signal('');

  // Constants
  private readonly STATS_DEFAULT_DAYS = 30;
  private readonly INITIAL_LIST_SIZE = 50;
  private readonly LIST_LOAD_INCREMENT = 50;
  private readonly ONE_HOUR_MS = 60 * 60 * 1000;
  // Visible list window around today (Phase 5 / firebase.md §8): the default
  // list shows shifts that intersect [today-12 months, today+24 months].
  // Date search bypasses the window so the user can still look up shifts
  // outside the range; an info toast warns when that happens.
  private readonly PAST_MONTHS_VISIBLE = 12;
  private readonly FUTURE_MONTHS_VISIBLE = 24;

  colors: ShiftColor[] = ['sky', 'green', 'amber', 'rose', 'indigo', 'teal', 'fuchsia', 'slate'];
  repFrequencies = ['days', 'weeks', 'months', 'years'];
  repIntervals: Record<Repetition['frequency'], number[]> = {
    days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    years: [1, 2, 3, 4, 5],
  };

  // Derived State (Computed Signals)
  allListShifts = computed(() => this.generateList());
  listShifts = computed(() => this.allListShifts().slice(0, this.listVisibleCount()));
  deviceService = inject(DeviceService);
  userDataService = inject(UserDataService);
  deviceLimitExceeded = computed(() =>
    this.deviceService.isSoftLimitExceeded(this.userDataService.activeDeviceCount())
  );

  // Methods
  constructor() {
    // Check for Service Worker updates
    void this.swUpdateService.checkForUpdates();

    // Initialize Push Notifications
    void this.pushNotificationService.initialize();

    // Initialize theme and create effect
    const storedTheme = localStorage.getItem('easyturno_theme') as 'light' | 'dark' | null;
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    this.theme = signal(storedTheme ?? (prefersDark ? 'dark' : 'light'));

    effect(() => {
      const currentTheme = this.theme();
      localStorage.setItem('easyturno_theme', currentTheme);
      if (currentTheme === 'dark') {
        this.document.documentElement.classList.add('dark');
      } else {
        this.document.documentElement.classList.remove('dark');
      }
    });

    // Sync html lang attribute with current language
    effect(() => {
      this.document.documentElement.lang = this.translationService.language();
    });

    // Keyboard shortcuts
    effect(onCleanup => {
      const handleKeyboard = (e: KeyboardEvent) => {
        // Ctrl/Cmd + N = New shift
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
          e.preventDefault();
          this.openNewShiftForm();
        }
        // Escape = Close modal
        if (e.key === 'Escape' && this.activeModal() !== 'none') {
          e.preventDefault();
          this.closeModal();
        }
        // Ctrl/Cmd + S = Open statistics (when in settings)
        if ((e.ctrlKey || e.metaKey) && e.key === 's' && this.activeModal() === 'settings') {
          e.preventDefault();
          this.openStatistics();
        }
      };

      window.addEventListener('keydown', handleKeyboard);

      // Angular effects use onCleanup callback, not return value
      onCleanup(() => window.removeEventListener('keydown', handleKeyboard));
    });

    // Open decryption-error modal when ShiftService reports a decrypt failure
    effect(() => {
      if (this.shiftService.decryptionError()) {
        this.openModal('decryptionError');
      }
    });

    // On first load, land the list on today's date instead of on the oldest
    // shift in the -12/+24m window. Runs once, with no animation, as soon as
    // the shifts signal becomes populated.
    let initialScrollDone = false;
    effect(() => {
      if (initialScrollDone) return;
      if (!this.isReadyForInitialListScroll()) return;
      if (this.shiftService.shifts().length === 0) return;
      if (this.viewMode() !== 'list') return;
      if (this.searchDate()) return;
      initialScrollDone = true;
      this.goToToday('auto');
    });

    // Warn the user once when the device key falls back to localStorage
    // (IndexedDB unavailable). In that mode the AES key bytes are readable
    // from disk, so the security posture is degraded.
    let secureStorageWarned = false;
    effect(() => {
      if (!this.cryptoService.secureStorageAvailable() && !secureStorageWarned) {
        secureStorageWarned = true;
        this.toastService.error(this.translationService.translate('reducedSecurityStorage'), 6000);
      }
    });

    this.resetForm();

    // Initialize search date with proper error handling
    const searchDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd');
    if (!searchDate) {
      console.error('Failed to format search date, using fallback');
      const fallback = new Date().toISOString().split('T')[0];
      this.searchDateInput.set(fallback ?? '');
    } else {
      this.searchDateInput.set(searchDate);
    }

    // Initialize statistics date range (configurable default days)
    const today = new Date();
    const defaultDaysAgo = new Date(
      today.getTime() - this.STATS_DEFAULT_DAYS * 24 * 60 * 60 * 1000
    );
    const statsStart = this.datePipe.transform(defaultDaysAgo, 'yyyy-MM-dd');
    const statsEnd = this.datePipe.transform(today, 'yyyy-MM-dd');

    if (!statsStart || !statsEnd) {
      console.error('Failed to format stats dates, using fallback');
      const fallbackStart = defaultDaysAgo.toISOString().split('T')[0];
      const fallbackEnd = today.toISOString().split('T')[0];
      this.statsStartDate.set(fallbackStart ?? '');
      this.statsEndDate.set(fallbackEnd ?? '');
    } else {
      this.statsStartDate.set(statsStart);
      this.statsEndDate.set(statsEnd);
    }

    // Initialize notifications (solo su native platform)
    if (Capacitor.isNativePlatform()) {
      void this.notificationService.initialize();
    }

    this.checkUrlForActions();
  }

  private isReadyForInitialListScroll(): boolean {
    const auth = this.authService.state();
    if (auth.mode === 'guest') return true;
    if (auth.mode !== 'authenticated') return false;
    return this.syncService.status().mode !== 'connecting';
  }

  private checkUrlForActions() {
    const urlParams = new URLSearchParams(this.document.location.search);
    if (urlParams.get('action') === 'add_shift') {
      this.openNewShiftForm();
      // Clean the URL to avoid re-triggering on reload
      const newUrl = this.document.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }

  // Cache sorted shifts to avoid re-sorting on every computation
  private sortedShifts = computed(() => {
    return [...this.shiftService.shifts()].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );
  });

  // Default visible window around today: [today-PAST_MONTHS, today+FUTURE_MONTHS].
  // Date search bypasses this filter — the user can still look up shifts
  // anywhere in the dataset.
  private visibleRange = computed(() => {
    const start = new Date();
    start.setMonth(start.getMonth() - this.PAST_MONTHS_VISIBLE);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setMonth(end.getMonth() + this.FUTURE_MONTHS_VISIBLE);
    end.setHours(23, 59, 59, 999);
    return { startTime: start.getTime(), endTime: end.getTime() };
  });

  private generateList() {
    const allShifts = this.sortedShifts();
    const search = this.searchDate();

    if (search) {
      const searchDayStart = new Date(search);
      searchDayStart.setHours(0, 0, 0, 0);
      const searchDayStartTime = searchDayStart.getTime();

      const searchDayEnd = new Date(search);
      searchDayEnd.setHours(23, 59, 59, 999);
      const searchDayEndTime = searchDayEnd.getTime();

      return allShifts.filter(s => {
        const shiftStartTime = new Date(s.start).getTime();
        const shiftEndTime = new Date(s.end).getTime();
        // A shift is relevant for a given day if it overlaps with that day at any point.
        return shiftStartTime <= searchDayEndTime && shiftEndTime >= searchDayStartTime;
      });
    }

    // Default list: shifts whose interval intersects the visible window.
    const { startTime, endTime } = this.visibleRange();
    return allShifts.filter(s => {
      const shiftStart = new Date(s.start).getTime();
      const shiftEnd = new Date(s.end).getTime();
      return shiftStart <= endTime && shiftEnd >= startTime;
    });
  }

  loadMoreShifts() {
    this.listVisibleCount.update(c => c + this.LIST_LOAD_INCREMENT);
  }

  // Scrolls the list to the first shift that hasn't ended yet (today or
  // upcoming). If every shift in the visible window is already past, scrolls
  // to the last one so the user lands at the closest item to today.
  // Auto-loads additional pages when the target is beyond the current
  // pagination cutoff.
  goToToday(behavior: ScrollBehavior = 'smooth') {
    const list = this.allListShifts();
    if (list.length === 0) return;

    const todayMs = new Date().setHours(0, 0, 0, 0);
    let targetIndex = list.findIndex(s => new Date(s.end).getTime() >= todayMs);
    if (targetIndex === -1) targetIndex = list.length - 1;

    // Make sure the target is rendered before we try to scroll to it.
    if (targetIndex >= this.listVisibleCount()) {
      const needed = targetIndex + 1;
      const rounded = Math.ceil(needed / this.LIST_LOAD_INCREMENT) * this.LIST_LOAD_INCREMENT;
      this.listVisibleCount.set(rounded);
    }

    const targetId = list[targetIndex]?.id;
    if (!targetId) return;

    this.scrollToShiftWhenReady(targetId, behavior);
  }

  private scrollToShiftWhenReady(targetId: string, behavior: ScrollBehavior, attempt = 0): void {
    const maxAttempts = 5;
    // Wait one tick so Angular renders the newly visible rows before scrolling.
    setTimeout(() => {
      const el = this.document.getElementById(`shift-${targetId}`);
      if (el) {
        el.scrollIntoView({ behavior, block: 'start' });
        return;
      }
      if (attempt < maxAttempts) {
        this.scrollToShiftWhenReady(targetId, behavior, attempt + 1);
      }
    }, 0);
  }

  openModal(modal: Modal) {
    this.activeModal.set(modal);
  }

  closeModal() {
    if (this.activeModal() === 'passwordPrompt') {
      this.pendingImportData.set(null);
      this.isImporting.set(false);
      this.passwordInput.set('');
      this.passwordConfirmInput.set('');
    }
    if (
      this.activeModal() === 'deleteAccountWarning' ||
      this.activeModal() === 'deleteAccountConfirm'
    ) {
      this.resetDeleteAccountForm();
    }
    this.activeModal.set('none');
    // Don't reset form here, as it clears pending data for confirmations
  }

  authExitLabelKey = computed(() => (this.authService.isGuest() ? 'authLoginLink' : 'authLogout'));

  async handleAuthExit(): Promise<void> {
    this.closeModal();
    if (this.authService.isGuest()) {
      this.authService.exitGuestMode();
      return;
    }
    try {
      await this.authService.signOut();
    } catch {
      this.toastService.error(this.translationService.translate('authGenericError'));
    }
  }

  openDeleteAccountWarning(): void {
    this.openModal('deleteAccountWarning');
  }

  proceedDeleteAccountConfirmation(): void {
    this.deleteAccountEmailInput.set('');
    this.deleteAccountPasswordInput.set('');
    this.openModal('deleteAccountConfirm');
  }

  async executeDeleteAccount(): Promise<void> {
    if (this.isDeletingAccount()) return;

    const accountEmail = this.authService.state().email?.trim().toLowerCase();
    const confirmationEmail = this.deleteAccountEmailInput().trim().toLowerCase();
    if (!accountEmail || confirmationEmail !== accountEmail) {
      this.toastService.error(this.translationService.translate('authDeleteAccountEmailMismatch'));
      return;
    }

    this.isDeletingAccount.set(true);
    try {
      await this.authService.deleteAccount(this.deleteAccountPayload());
      this.clearLocalAccountData();
      this.resetDeleteAccountForm();
      this.activeModal.set('none');
      this.toastService.success(this.translationService.translate('authDeleteAccountSuccess'));
    } catch (error) {
      await this.handleDeleteAccountError(error);
    } finally {
      this.isDeletingAccount.set(false);
    }
  }

  private deleteAccountPayload(): { password?: string } {
    if (!this.authService.hasPasswordProvider()) return {};
    return { password: this.deleteAccountPasswordInput() };
  }

  private async handleDeleteAccountError(error: unknown): Promise<void> {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : null;
    if (code === 'auth/requires-recent-login') {
      this.resetDeleteAccountForm();
      this.activeModal.set('none');
      this.toastService.error(
        this.translationService.translate('authDeleteAccountReauthRequired'),
        6000
      );
      try {
        await this.authService.signOut();
      } catch {
        // If sign-out also fails, the reauth toast is still the useful user action.
      }
      return;
    }

    if (code === 'auth/network-request-failed') {
      this.toastService.error(this.translationService.translate('authErrorNetwork'), 6000);
      return;
    }

    this.toastService.error(this.translationService.translate('authGenericError'));
  }

  private clearLocalAccountData(): void {
    this.shiftService.deleteAllShifts();
    [
      'easyturno.authMode',
      'easyturno_shifts',
      'easyturno_device_key',
      'easyturno_backup_reminder_shown',
      'easyturno_notification_settings',
      'easyturno_theme',
      'easyturno_lang',
    ].forEach(key => localStorage.removeItem(key));
  }

  private resetDeleteAccountForm(): void {
    this.deleteAccountEmailInput.set('');
    this.deleteAccountPasswordInput.set('');
  }

  openNewShiftForm() {
    this.resetForm();
    this.editingShift.set(null);
    this.openModal('form');
  }

  openEditShiftForm(shift: Shift) {
    this.editingShift.set(shift);
    this.shiftTitle.set(shift.title);

    // Handle date formatting with proper error handling
    const startDate = this.datePipe.transform(shift.start, 'yyyy-MM-dd');
    const startTime = this.datePipe.transform(shift.start, 'HH:mm');
    const endDate = this.datePipe.transform(shift.end, 'yyyy-MM-dd');
    const endTime = this.datePipe.transform(shift.end, 'HH:mm');

    if (!startDate || !startTime || !endDate || !endTime) {
      console.error('Failed to format shift dates, using ISO fallback');
      const start = new Date(shift.start);
      const end = new Date(shift.end);
      this.shiftStartDate.set(start.toISOString().split('T')[0] ?? '');
      this.shiftStartTime.set(start.toTimeString().slice(0, 5));
      this.shiftEndDate.set(end.toISOString().split('T')[0] ?? '');
      this.shiftEndTime.set(end.toTimeString().slice(0, 5));
    } else {
      this.shiftStartDate.set(startDate);
      this.shiftStartTime.set(startTime);
      this.shiftEndDate.set(endDate);
      this.shiftEndTime.set(endTime);
    }

    this.shiftColor.set(shift.color);
    this.shiftIsRecurring.set(shift.isRecurring);
    this.shiftNotes.set(shift.notes || '');
    this.shiftOvertimeHours.set(shift.overtimeHours || 0);
    // Add _id to existing allowances for UI tracking
    const allowancesWithId: AllowanceWithId[] = (shift.allowances || []).map(a => ({
      ...a,
      _id: crypto.randomUUID(),
    }));
    this.shiftAllowances.set(allowancesWithId);
    if (shift.repetition) {
      this.shiftRepetition.set(shift.repetition);
    }
    this.openModal('form');
  }

  handleFormSubmit() {
    // Validate required fields
    if (!this.shiftTitle().trim()) {
      this.toastService.error(this.translationService.translate('titleRequired'));
      return;
    }

    const start = new Date(`${this.shiftStartDate()}T${this.shiftStartTime()}`);
    const end = new Date(`${this.shiftEndDate()}T${this.shiftEndTime()}`);

    // Validate end > start
    if (end <= start) {
      this.toastService.error(this.translationService.translate('endMustBeAfterStart'));
      return;
    }

    // Capture user's timezone
    const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

    const shiftData = {
      title: this.shiftTitle().trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      color: this.shiftColor(),
      isRecurring: this.shiftIsRecurring(),
      repetition: this.shiftIsRecurring() ? this.shiftRepetition() : undefined,
      notes: this.shiftNotes() || undefined,
      overtimeHours: this.shiftOvertimeHours() > 0 ? this.shiftOvertimeHours() : undefined,
      // Remove _id before saving (only for UI tracking)
      allowances:
        this.shiftAllowances().length > 0
          ? this.shiftAllowances().map(({ _id, ...allowance }) => allowance)
          : undefined,
      timezone: userTimezone,
    };

    const editing = this.editingShift();
    if (editing) {
      this.pendingShiftData.set(shiftData);
      if (editing.isRecurring) {
        this.openModal('editSeriesConfirm');
      } else {
        const updatedShift: Shift = { ...editing, ...shiftData };
        this.shiftService.updateShift(updatedShift);
        this.activeModal.set('none');
        this.resetForm();
      }
    } else {
      this.shiftService.addShift(shiftData);
      this.activeModal.set('none');
      this.resetForm();
      this.maybeSuggestBackupExport();
    }
  }

  // One-time hint to export an encrypted backup once the user reaches the
  // threshold of shifts: there is no recovery path if the encryption key is
  // lost (cleared browser data, switched device), so a backup is the only
  // safety net. Persisted via localStorage so it fires at most once per
  // browser profile.
  private maybeSuggestBackupExport() {
    if (localStorage.getItem(this.BACKUP_REMINDER_STORAGE_KEY) === '1') return;
    if (this.shiftService.shifts().length < this.BACKUP_REMINDER_THRESHOLD) return;
    localStorage.setItem(this.BACKUP_REMINDER_STORAGE_KEY, '1');
    this.toastService.info(this.translationService.translate('backupReminderSuggestion'), 8000);
  }

  executeEdit(updateSeries: boolean) {
    const editing = this.editingShift();
    const shiftData = this.pendingShiftData();
    if (!editing || !shiftData) return;

    if (updateSeries) {
      const updatedShift: Shift = { ...editing, ...shiftData };
      this.shiftService.updateShiftSeries(updatedShift);
    } else {
      // Update only this one instance, making it non-recurring
      const updatedShift: Shift = {
        ...editing,
        ...shiftData,
        isRecurring: false,
        repetition: undefined,
      };
      this.shiftService.updateShift(updatedShift);
    }
    this.activeModal.set('none');
    this.resetForm();
  }

  resetForm() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + this.ONE_HOUR_MS);
    this.shiftTitle.set('');

    // Handle date formatting with proper error handling
    const startDate = this.datePipe.transform(now, 'yyyy-MM-dd');
    const startTime = this.datePipe.transform(now, 'HH:mm');
    const endDate = this.datePipe.transform(oneHourLater, 'yyyy-MM-dd');
    const endTime = this.datePipe.transform(oneHourLater, 'HH:mm');

    if (!startDate || !startTime || !endDate || !endTime) {
      console.error('Failed to format reset dates, using ISO fallback');
      this.shiftStartDate.set(now.toISOString().split('T')[0] ?? '');
      this.shiftStartTime.set(now.toTimeString().slice(0, 5));
      this.shiftEndDate.set(oneHourLater.toISOString().split('T')[0] ?? '');
      this.shiftEndTime.set(oneHourLater.toTimeString().slice(0, 5));
    } else {
      this.shiftStartDate.set(startDate);
      this.shiftStartTime.set(startTime);
      this.shiftEndDate.set(endDate);
      this.shiftEndTime.set(endTime);
    }

    this.shiftColor.set('indigo');
    this.shiftIsRecurring.set(false);
    this.shiftRepetition.set({ frequency: 'days', interval: 1 });
    this.shiftNotes.set('');
    this.shiftOvertimeHours.set(0);
    this.shiftAllowances.set([]);
    this.editingShift.set(null);
    this.pendingShiftData.set(null);
    this.shiftToDelete.set(null);
  }

  onFrequencyChange(event: Event) {
    const freq = (event.target as HTMLSelectElement).value as Repetition['frequency'];
    const intervalsForFreq = this.repIntervals[freq];
    const newInterval: number = (intervalsForFreq && intervalsForFreq[0]) ?? 1;
    this.shiftRepetition.update(r => ({ ...r, frequency: freq, interval: newInterval }));
  }

  onRepetitionIntervalChange(event: Event) {
    const interval = Number((event.target as HTMLSelectElement).value);
    this.shiftRepetition.update(r => ({ ...r, interval }));
  }

  onStartDateChange(newStartDate: string) {
    // Align end date to start date automatically
    this.shiftEndDate.set(newStartDate);
  }

  onStartTimeChange(newStartTime: string) {
    // Align end time to start time automatically
    this.shiftEndTime.set(newStartTime);
  }

  // --- Deletion Logic ---
  confirmDelete(shift: Shift) {
    this.shiftToDelete.set(shift);
    if (shift.isRecurring) {
      this.openModal('deleteSeriesConfirm');
    } else {
      this.openModal('deleteConfirm');
    }
  }

  executeDelete(allSeries: boolean = false) {
    const shift = this.shiftToDelete();
    if (!shift) return;

    if (allSeries) {
      this.shiftService.deleteShiftSeries(shift.seriesId);
    } else {
      this.shiftService.deleteShift(shift.id);
    }
    this.activeModal.set('none');
    this.resetForm();
  }

  // --- Search Logic ---
  handleDateSearch() {
    const input = this.searchDateInput();
    if (!input) {
      this.closeModal();
      return;
    }

    try {
      // Parse as local midnight (input is "YYYY-MM-DD" from <input type="date">).
      // Plain `new Date("YYYY-MM-DD")` is parsed as UTC, which can shift the day
      // in negative-offset timezones.
      const date = new Date(`${input}T00:00:00`);

      // Validate the date is valid
      if (isNaN(date.getTime())) {
        this.toastService.error(this.translationService.translate('invalidDateFormat'));
        return;
      }

      // Validate the date is reasonable (not year 0 or negative)
      if (date.getFullYear() < 1900 || date.getFullYear() > 2100) {
        this.toastService.error(this.translationService.translate('dateOutOfRange'));
        return;
      }

      this.searchDate.set(date);
      this.listVisibleCount.set(this.INITIAL_LIST_SIZE); // Reset pagination for new search
      this.closeModal();

      // Inform the user when their search target falls outside the default
      // -12/+24 month window. We still show the day's results (search bypasses
      // the window) but flag that nothing else around it will be visible.
      const { startTime, endTime } = this.visibleRange();
      const searchTime = date.getTime();
      if (searchTime < startTime || searchTime > endTime) {
        this.toastService.info(this.translationService.translate('searchOutsideRange'), 5000);
      }
    } catch (error) {
      console.error('Date parsing error:', error);
      this.toastService.error(this.translationService.translate('failedToParseDate'));
    }
  }

  clearSearch() {
    this.searchDate.set(null);
    this.listVisibleCount.set(this.INITIAL_LIST_SIZE); // Reset pagination
  }

  // --- Settings Logic ---
  exportBackup() {
    this.passwordPromptMode.set('export');
    this.passwordInput.set('');
    this.passwordConfirmInput.set('');
    this.openModal('passwordPrompt');
  }

  async confirmPasswordPrompt() {
    const password = this.passwordInput();
    const mode = this.passwordPromptMode();

    if (!password) {
      return;
    }

    if (mode === 'export') {
      if (password.length < this.MIN_BACKUP_PASSWORD_LENGTH) {
        this.toastService.error(
          this.translationService
            .translate('backupPasswordTooShort')
            .replace('{min}', String(this.MIN_BACKUP_PASSWORD_LENGTH)),
          5000
        );
        return;
      }

      const confirmation = this.passwordConfirmInput();
      if (password !== confirmation) {
        this.toastService.error(this.translationService.translate('backupPasswordMismatch'), 5000);
        return;
      }

      this.closeModal();
      this.isExporting.set(true);
      try {
        const data = this.shiftService.exportBackupPayload();
        const encryptedBackup = await this.cryptoService.encryptBackupWithPassword(data, password);
        const blob = new Blob([encryptedBackup], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'easyturno_backup.json';
        a.click();
        URL.revokeObjectURL(url);
        this.toastService.success(this.translationService.translate('exportSuccess'));
      } catch (error) {
        console.error('Export failed:', error);
        this.toastService.error(this.translationService.translate('exportError'));
      } finally {
        this.isExporting.set(false);
      }
    } else {
      // import mode
      const importData = this.pendingImportData();
      if (!importData) return;

      this.closeModal();
      try {
        const decrypted = await this.cryptoService.decryptBackupWithPassword(importData, password);
        this.finishImport(decrypted);
      } catch {
        this.toastService.error(this.translationService.translate('backupPasswordInvalid'), 5000);
      }
    }
  }

  triggerImport() {
    document.getElementById('importFile')?.click();
  }

  importBackup(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    if (file.size > this.MAX_IMPORT_FILE_SIZE_BYTES) {
      this.toastService.error(this.translationService.translate('backupFileTooLarge'), 5000);
      return;
    }

    this.isImporting.set(true);
    const reader = new FileReader();

    reader.onload = e => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        if (this.cryptoService.isPasswordProtectedBackupPayload(result)) {
          this.pendingImportData.set(result);
          this.passwordPromptMode.set('import');
          this.passwordInput.set('');
          this.passwordConfirmInput.set('');
          this.openModal('passwordPrompt');
          return;
        }

        this.finishImport(result);
      }
      this.isImporting.set(false);
      this.closeModal();
    };

    reader.onerror = () => {
      this.toastService.error(this.translationService.translate('importError'));
      this.isImporting.set(false);
    };

    reader.readAsText(file);
  }

  private finishImport(data: string) {
    const importResult = this.shiftService.importShifts(data);
    if (importResult.success) {
      const message = `${this.translationService.translate('importSuccess')} (${importResult.imported} shifts)`;
      this.toastService.success(message);
    } else {
      const message = `${this.translationService.translate('importError')}${importResult.error ? ': ' + importResult.error : ''}`;
      this.toastService.error(message, 5000);
    }
  }

  confirmReset() {
    this.openModal('resetConfirm');
  }

  executeReset() {
    this.shiftService.deleteAllShifts();
    this.closeModal();
    this.toastService.success(this.translationService.translate('resetSuccess'));
  }

  executeDecryptionReset() {
    this.shiftService.resetAfterDecryptionError();
    this.closeModal();
    this.toastService.success(this.translationService.translate('resetSuccess'));
  }

  dismissDecryptionError() {
    // User chooses to keep the unreadable data — just close the modal.
    // The app will remain empty until the user exports/imports a backup.
    this.closeModal();
  }

  // --- Allowances Management ---
  addAllowance() {
    const newAllowance: AllowanceWithId = {
      name: '',
      amount: 0,
      _id: crypto.randomUUID(),
    };
    this.shiftAllowances.update(allowances => [...allowances, newAllowance]);
  }

  removeAllowance(index: number) {
    this.shiftAllowances.update(allowances => allowances.filter((_, i) => i !== index));
  }

  updateAllowanceName(index: number, event: Event) {
    const name = (event.target as HTMLInputElement).value;
    this.shiftAllowances.update(allowances =>
      allowances.map((a, i) => (i === index ? { ...a, name } : a))
    );
  }

  updateAllowanceAmount(index: number, event: Event) {
    const raw = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(raw) || raw < 0) {
      return;
    }
    const amount = Math.floor(raw);
    this.shiftAllowances.update(allowances =>
      allowances.map((a, i) => (i === index ? { ...a, amount } : a))
    );
  }

  formatAllowanceAmount(amount: number): string {
    if (!Number.isFinite(amount) || amount <= 0) {
      return '0';
    }
    return String(Math.floor(amount));
  }

  updateOvertimeHours(value: number | null) {
    if (value === null || !Number.isFinite(value) || value < 0) {
      this.shiftOvertimeHours.set(0);
      return;
    }
    this.shiftOvertimeHours.set(value);
  }

  // --- Statistics ---
  // Computed date range for stats (memoized)
  private statsDateRange = computed(() => {
    const start = new Date(this.statsStartDate());
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.statsEndDate());
    end.setHours(23, 59, 59, 999);
    return {
      startTime: start.getTime(),
      endTime: end.getTime(),
    };
  });

  // Pre-filtered shifts for stats (memoized separately)
  private filteredStatsShifts = computed(() => {
    const { startTime, endTime } = this.statsDateRange();
    return this.shiftService.shifts().filter(shift => {
      const shiftStart = new Date(shift.start).getTime();
      return shiftStart >= startTime && shiftStart <= endTime;
    });
  });

  // Optimized stats calculation with early exit
  statsData = computed(() => {
    const shifts = this.filteredStatsShifts();

    // Early exit for empty results
    if (shifts.length === 0) {
      return {
        totalShifts: 0,
        totalHours: 0,
        totalOvertime: 0,
        shiftsByTitle: {} as Record<string, number>,
        allowancesByName: {} as Record<string, number>,
      };
    }

    // Single-pass accumulation
    const stats = {
      totalShifts: shifts.length,
      totalHours: 0,
      totalOvertime: 0,
      shiftsByTitle: {} as Record<string, number>,
      allowancesByName: {} as Record<string, number>,
    };

    for (const shift of shifts) {
      // Calculate hours
      const hours = (new Date(shift.end).getTime() - new Date(shift.start).getTime()) / 3_600_000;
      stats.totalHours += hours;
      stats.totalOvertime += shift.overtimeHours ?? 0;

      // Group by title
      stats.shiftsByTitle[shift.title] = (stats.shiftsByTitle[shift.title] ?? 0) + 1;

      // Accumulate allowances
      if (shift.allowances?.length) {
        for (const { name, amount } of shift.allowances) {
          stats.allowancesByName[name] = (stats.allowancesByName[name] ?? 0) + amount;
        }
      }
    }

    return stats;
  });

  // Type-safe computed signals for template iteration (removes Object exposure)
  statsShiftTitles = computed(() => Object.keys(this.statsData().shiftsByTitle));
  statsAllowanceNames = computed(() => Object.keys(this.statsData().allowancesByName));

  getShiftColorForTitle(title: string): ShiftColor {
    const shift = this.filteredStatsShifts().find(s => s.title === title);
    return shift?.color ?? 'indigo';
  }

  getShiftStylesForTitle(title: string) {
    const color = this.getShiftColorForTitle(title);
    const maps: Record<ShiftColor, { bar: string; labelBg: string; text: string }> = {
      sky: {
        bar: 'bg-sky-500',
        labelBg: 'bg-sky-100/70 dark:bg-sky-950/40',
        text: 'text-sky-700 dark:text-sky-300',
      },
      green: {
        bar: 'bg-emerald-500',
        labelBg: 'bg-emerald-100/70 dark:bg-emerald-950/40',
        text: 'text-emerald-700 dark:text-emerald-300',
      },
      amber: {
        bar: 'bg-amber-500',
        labelBg: 'bg-amber-100/70 dark:bg-amber-950/40',
        text: 'text-amber-700 dark:text-amber-300',
      },
      rose: {
        bar: 'bg-rose-500',
        labelBg: 'bg-rose-100/70 dark:bg-rose-950/40',
        text: 'text-rose-700 dark:text-rose-300',
      },
      indigo: {
        bar: 'bg-indigo-500',
        labelBg: 'bg-indigo-100/70 dark:bg-indigo-950/40',
        text: 'text-indigo-700 dark:text-indigo-300',
      },
      teal: {
        bar: 'bg-teal-500',
        labelBg: 'bg-teal-100/70 dark:bg-teal-950/40',
        text: 'text-teal-700 dark:text-teal-300',
      },
      fuchsia: {
        bar: 'bg-fuchsia-500',
        labelBg: 'bg-fuchsia-100/70 dark:bg-fuchsia-950/40',
        text: 'text-fuchsia-700 dark:text-fuchsia-300',
      },
      slate: {
        bar: 'bg-slate-500',
        labelBg: 'bg-slate-100/70 dark:bg-slate-950/40',
        text: 'text-slate-700 dark:text-slate-300',
      },
    };
    return maps[color] ?? maps.indigo;
  }

  setStatsPreset(preset: 'thisMonth' | 'lastMonth' | 'last30Days' | 'thisYear') {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case 'thisMonth': {
        start = new Date(today.getFullYear(), today.getMonth(), 1);
        end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        break;
      }
      case 'lastMonth': {
        start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        end = new Date(today.getFullYear(), today.getMonth(), 0);
        break;
      }
      case 'last30Days': {
        start = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
        end = today;
        break;
      }
      case 'thisYear': {
        start = new Date(today.getFullYear(), 0, 1);
        end = new Date(today.getFullYear(), 11, 31);
        break;
      }
    }

    const formatDate = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    this.statsStartDate.set(formatDate(start));
    this.statsEndDate.set(formatDate(end));
  }

  openStatistics() {
    this.openModal('statistics');
  }

  // --- Notification Settings ---
  onNotificationSettingsChange() {
    this.notificationService.saveSettings(this.notificationSettings());
    this.notificationSettings.set(this.notificationService.getSettings());
  }

  // Calendar view methods
  toggleViewMode() {
    const currentMode = this.viewMode();
    const goingToList = currentMode === 'calendar';
    // Reset search filter when switching from calendar to list view
    if (goingToList) {
      this.searchDate.set(null);
      this.listVisibleCount.set(this.INITIAL_LIST_SIZE);
    }
    this.viewMode.update(mode => (mode === 'list' ? 'calendar' : 'list'));
    if (goingToList) {
      this.goToToday('auto');
    }
  }

  setViewMode(mode: ViewMode) {
    const currentMode = this.viewMode();
    const goingToList = currentMode === 'calendar' && mode === 'list';
    // Reset search filter when switching from calendar to list view
    if (goingToList) {
      this.searchDate.set(null);
      this.listVisibleCount.set(this.INITIAL_LIST_SIZE);
    }
    this.viewMode.set(mode);
    if (goingToList) {
      this.goToToday('auto');
    }
  }

  onCalendarDaySelected(date: Date | null) {
    if (date) {
      this.searchDate.set(date);
      // Optionally switch to list view to show filtered results
      // this.viewMode.set('list');
    } else {
      this.searchDate.set(null);
    }
  }

  onCalendarShiftClick(shift: Shift) {
    // Open shift for editing
    this.openEditShiftForm(shift);
  }

  // Helper for Tailwind classes
  getColorClasses(color: ShiftColor): string {
    const colorMap: Record<ShiftColor, string> = {
      sky: 'bg-sky-100 text-sky-700 border-sky-500 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-400',
      green:
        'bg-green-100 text-green-700 border-green-500 dark:bg-green-500/20 dark:text-green-300 dark:border-green-400',
      amber:
        'bg-amber-100 text-amber-700 border-amber-500 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-400',
      rose: 'bg-rose-100 text-rose-700 border-rose-500 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-400',
      indigo:
        'bg-indigo-100 text-indigo-700 border-indigo-500 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-400',
      teal: 'bg-teal-100 text-teal-700 border-teal-500 dark:bg-teal-500/20 dark:text-teal-300 dark:border-teal-400',
      fuchsia:
        'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-500 dark:bg-fuchsia-500/20 dark:text-fuchsia-300 dark:border-fuchsia-400',
      slate:
        'bg-slate-100 text-slate-700 border-slate-500 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-400',
    };
    return colorMap[color];
  }
}
