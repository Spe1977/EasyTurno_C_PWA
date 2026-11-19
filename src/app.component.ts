import {
  Component,
  ChangeDetectionStrategy,
  ElementRef,
  afterEveryRender,
  signal,
  computed,
  inject,
  WritableSignal,
  effect,
  untracked,
} from '@angular/core';
import { DatePipe, DOCUMENT } from '@angular/common';
import { Capacitor } from '@capacitor/core';
import { Shift } from './shift.model';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { ToastService } from './services/toast.service';
import { NotificationService } from './services/notification.service';
import { SwUpdateService } from './services/sw-update.service';
import { CryptoService } from './services/crypto.service';
import { AuthService, mapReauthErrorKey } from './services/auth.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { LangDatePipe } from './pipes/date-format.pipe';
import { ToastContainerComponent } from './components/toast-container.component';
import { ShiftListItemComponent } from './components/shift-list-item.component';
import { CalendarComponent } from './components/calendar.component';
import { AuthScreenComponent } from './components/auth-screen.component';
import { EmailVerificationScreenComponent } from './components/email-verification-screen.component';
import {
  ShiftFormModalComponent,
  type ShiftFormSaveEvent,
} from './components/shift-form-modal.component';
import { StatisticsDrawerComponent } from './components/statistics-drawer.component';
import { SettingsDrawerComponent } from './components/settings-drawer.component';
import {
  ConfirmDialogComponent,
  type ResetConfirmationPayload,
  type SecondaryDialogMode,
} from './components/confirm-dialog.component';
import { SyncService } from './services/sync.service';
import { PushNotificationService } from './services/push-notification.service';

export type Modal = 'none' | 'form' | 'settings' | 'statistics' | SecondaryDialogMode;

type PasswordPromptMode = 'export' | 'import';

type ViewMode = 'list' | 'calendar';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    TranslatePipe,
    LangDatePipe,
    ToastContainerComponent,
    ShiftListItemComponent,
    CalendarComponent,
    AuthScreenComponent,
    EmailVerificationScreenComponent,
    ShiftFormModalComponent,
    StatisticsDrawerComponent,
    SettingsDrawerComponent,
    ConfirmDialogComponent,
  ],
  providers: [DatePipe],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
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
  private elementRef = inject(ElementRef<HTMLElement>);
  private lastFocusedElement: HTMLElement | null = null;
  private pendingDialogFocus = false;
  private pendingFocusRestore = false;
  private readonly MAX_IMPORT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
  private readonly MIN_BACKUP_PASSWORD_LENGTH = 12;
  private readonly BACKUP_REMINDER_THRESHOLD = 5;
  private readonly BACKUP_REMINDER_STORAGE_KEY = 'easyturno_backup_reminder_shown';

  // Native platform detection (wrap to preserve `this` binding on Capacitor)
  isNativePlatform = (): boolean => Capacitor.isNativePlatform();

  // UI State
  theme: WritableSignal<'light' | 'dark'>;
  activeModal = signal<Modal>('none');
  viewMode = signal<ViewMode>('list');
  isImporting = signal(false);
  isExporting = signal(false);

  readonly secondaryDialogMode = computed<SecondaryDialogMode | null>(() => {
    const mode = this.activeModal();
    if (mode === 'none' || mode === 'form' || mode === 'settings' || mode === 'statistics') {
      return null;
    }
    return mode;
  });

  // Form & Edit State
  editingShift: WritableSignal<Shift | null> = signal(null);
  pendingShiftData = signal<Partial<Shift> | null>(null);

  // Confirmation state
  shiftToDelete = signal<Shift | null>(null);
  isDeletingAccount = signal(false);
  isResettingData = signal(false);

  // Password prompt state
  passwordPromptMode = signal<PasswordPromptMode>('export');
  pendingImportData = signal<string | null>(null);

  // List view state
  listVisibleCount = signal(50); // Initialized with INITIAL_LIST_SIZE constant below
  searchDate = signal<Date | null>(null);
  searchDateInput = signal('');

  // Constants
  private readonly INITIAL_LIST_SIZE = 50;
  private readonly LIST_LOAD_INCREMENT = 50;
  // Visible list window around today (Phase 5 / firebase.md §8): the default
  // list shows shifts that intersect [today-12 months, today+24 months].
  // Date search bypasses the window so the user can still look up shifts
  // outside the range; an info toast warns when that happens.
  private readonly PAST_MONTHS_VISIBLE = 12;
  private readonly FUTURE_MONTHS_VISIBLE = 24;

  // Derived State (Computed Signals)
  allListShifts = computed(() => this.generateList());
  listShifts = computed(() => this.allListShifts().slice(0, this.listVisibleCount()));

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
        // Tab = Trap focus inside active modal dialog
        if (e.key === 'Tab' && this.activeModal() !== 'none') {
          this.trapFocusInDialog(e);
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

    // Manage modal dialog focus on open and restore focus to trigger on close
    let previousModal: Modal = 'none';
    effect(() => {
      const currentModal = this.activeModal();
      if (currentModal !== 'none' && currentModal !== previousModal) {
        if (previousModal === 'none' && !this.lastFocusedElement) {
          const active = this.document.activeElement;
          this.lastFocusedElement =
            active instanceof HTMLElement && active !== this.document.body ? active : null;
        }
        this.pendingFocusRestore = false;
        this.pendingDialogFocus = true;
      } else if (previousModal !== 'none' && currentModal === 'none') {
        this.pendingDialogFocus = false;
        this.pendingFocusRestore = true;
      }
      previousModal = currentModal;
    });

    afterEveryRender(() => {
      if (this.pendingDialogFocus) {
        this.tryFocusActiveDialog();
      }
      if (this.pendingFocusRestore) {
        this.tryRestoreFocusAfterModal();
      }
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

    // Initialize search date with proper error handling
    const searchDate = this.datePipe.transform(new Date(), 'yyyy-MM-dd');
    if (!searchDate) {
      console.error('Failed to format search date, using fallback');
      const fallback = new Date().toISOString().split('T')[0];
      this.searchDateInput.set(fallback ?? '');
    } else {
      this.searchDateInput.set(searchDate);
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

  private checkUrlForActions(): void {
    const urlParams = new URLSearchParams(this.document.location.search);
    if (urlParams.get('action') === 'add_shift') {
      this.openNewShiftForm();
      // Clean the URL to avoid re-triggering on reload
      const newUrl = this.document.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }

  // Pre-parse start/end timestamps once per shift change and avoid re-sorting
  // when ShiftService already emits shifts in chronological order.
  private indexedSortedShifts = computed(() => {
    const shifts = this.shiftService.shifts();
    const entries = new Array<{ shift: Shift; startMs: number; endMs: number }>(shifts.length);
    let alreadySorted = true;
    let prevStartMs = -Infinity;

    for (let i = 0; i < shifts.length; i += 1) {
      const shift = shifts[i]!;
      const startMs = Date.parse(shift.start);
      const endMs = Date.parse(shift.end);
      if (startMs < prevStartMs) {
        alreadySorted = false;
      }
      prevStartMs = startMs;
      entries[i] = { shift, startMs, endMs };
    }

    if (!alreadySorted) {
      entries.sort((a, b) => a.startMs - b.startMs);
    }

    return entries;
  });

  // Cache sorted shifts to avoid re-sorting on every computation
  private sortedShifts = computed(() => this.indexedSortedShifts().map(entry => entry.shift));

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
    const entries = this.indexedSortedShifts();
    const search = this.searchDate();

    let windowStartMs: number;
    let windowEndMs: number;

    if (search) {
      const searchDayStart = new Date(search);
      searchDayStart.setHours(0, 0, 0, 0);
      windowStartMs = searchDayStart.getTime();

      const searchDayEnd = new Date(search);
      searchDayEnd.setHours(23, 59, 59, 999);
      windowEndMs = searchDayEnd.getTime();
    } else {
      // Default list: shifts whose interval intersects the visible window.
      const { startTime, endTime } = this.visibleRange();
      windowStartMs = startTime;
      windowEndMs = endTime;
    }

    const filtered: Shift[] = [];
    for (let i = 0; i < entries.length; i += 1) {
      const entry = entries[i]!;
      if (entry.startMs <= windowEndMs && entry.endMs >= windowStartMs) {
        filtered.push(entry.shift);
      }
    }
    return filtered;
  }

  loadMoreShifts(): void {
    this.listVisibleCount.update(c => c + this.LIST_LOAD_INCREMENT);
  }

  // Scrolls the list to the first shift that hasn't ended yet (today or
  // upcoming). If every shift in the visible window is already past, scrolls
  // to the last one so the user lands at the closest item to today.
  // Auto-loads additional pages when the target is beyond the current
  // pagination cutoff.
  goToToday(behavior: ScrollBehavior = 'smooth'): void {
    const list = this.allListShifts();
    if (list.length === 0) return;

    const todayMs = new Date().setHours(0, 0, 0, 0);
    let targetIndex = list.findIndex(s => Date.parse(s.end) >= todayMs);
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

  openModal(modal: Modal): void {
    if (untracked(() => this.activeModal()) === 'none' && modal !== 'none') {
      const active = this.document.activeElement;
      this.lastFocusedElement =
        active instanceof HTMLElement && active !== this.document.body ? active : null;
    }
    this.activeModal.set(modal);
  }

  private getActiveDialogElement(): HTMLElement | null {
    const host = this.elementRef.nativeElement as HTMLElement;
    return host.querySelector('[role="dialog"], [role="alertdialog"]');
  }

  private getFocusableElements(container: HTMLElement): HTMLElement[] {
    const selector =
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
    return Array.from(container.querySelectorAll<HTMLElement>(selector)).filter(el => {
      if (el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true') {
        return false;
      }
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden';
    });
  }

  private tryFocusActiveDialog(): void {
    if (this.activeModal() === 'none') {
      this.pendingDialogFocus = false;
      return;
    }
    const dialog = this.getActiveDialogElement();
    if (!dialog) {
      return;
    }
    this.pendingDialogFocus = false;
    if (!dialog.contains(this.document.activeElement)) {
      const focusables = this.getFocusableElements(dialog);
      const target = focusables[0] ?? dialog;
      target.focus();
    }
  }

  private tryRestoreFocusAfterModal(): void {
    this.pendingFocusRestore = false;
    const target = this.lastFocusedElement;
    this.lastFocusedElement = null;
    if (
      this.activeModal() === 'none' &&
      target &&
      target !== this.document.body &&
      target.isConnected
    ) {
      target.focus();
    }
  }

  private trapFocusInDialog(e: KeyboardEvent): void {
    const dialog = this.getActiveDialogElement();
    if (!dialog) return;

    const focusables = this.getFocusableElements(dialog);
    if (focusables.length === 0) {
      e.preventDefault();
      dialog.focus();
      return;
    }

    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    const active = this.document.activeElement;

    if (e.shiftKey) {
      if (active === first || !dialog.contains(active)) {
        e.preventDefault();
        last.focus();
      }
    } else if (active === last || !dialog.contains(active)) {
      e.preventDefault();
      first.focus();
    }
  }

  closeModal(): void {
    if (this.activeModal() === 'resetConfirm' && this.isResettingData()) {
      return;
    }
    if (this.activeModal() === 'passwordPrompt') {
      this.pendingImportData.set(null);
      this.isImporting.set(false);
    }
    this.activeModal.set('none');
    // Don't reset pending shift state here, as confirmation modals depend on it
  }

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
    this.openModal('deleteAccountConfirm');
  }

  async executeDeleteAccount(credentials: { email: string; password: string }): Promise<void> {
    if (this.isDeletingAccount()) return;

    const accountEmail = this.authService.state().email?.trim().toLowerCase();
    const confirmationEmail = credentials.email.trim().toLowerCase();
    if (!accountEmail || confirmationEmail !== accountEmail) {
      this.toastService.error(this.translationService.translate('authDeleteAccountEmailMismatch'));
      return;
    }

    this.isDeletingAccount.set(true);
    try {
      await this.authService.deleteAccount(this.deleteAccountPayload(credentials.password));
      this.clearLocalAccountData();
      this.activeModal.set('none');
      this.toastService.success(this.translationService.translate('authDeleteAccountSuccess'));
    } catch (error) {
      await this.handleDeleteAccountError(error);
    } finally {
      this.isDeletingAccount.set(false);
    }
  }

  private deleteAccountPayload(password: string): { password?: string } {
    if (!this.authService.hasPasswordProvider()) return {};
    return { password };
  }

  private async handleDeleteAccountError(error: unknown): Promise<void> {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : null;
    if (code === 'auth/requires-recent-login') {
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

  openNewShiftForm(): void {
    this.editingShift.set(null);
    this.pendingShiftData.set(null);
    this.shiftToDelete.set(null);
    this.openModal('form');
  }

  openEditShiftForm(shift: Shift): void {
    this.editingShift.set(shift);
    this.openModal('form');
  }

  handleShiftFormSave({ shiftData, editingShift }: ShiftFormSaveEvent): void {
    if (editingShift) {
      this.editingShift.set(editingShift);
      this.pendingShiftData.set(shiftData);
      if (editingShift.isRecurring) {
        this.openModal('editSeriesConfirm');
      } else {
        const updatedShift: Shift = { ...editingShift, ...shiftData };
        this.shiftService.updateShift(updatedShift);
        this.activeModal.set('none');
        this.editingShift.set(null);
        this.pendingShiftData.set(null);
      }
    } else {
      this.shiftService.addShift(shiftData);
      this.activeModal.set('none');
      this.editingShift.set(null);
      this.maybeSuggestBackupExport();
    }
  }

  // One-time hint to export an encrypted backup once the user reaches the
  // threshold of shifts: there is no recovery path if the encryption key is
  // lost (cleared browser data, switched device), so a backup is the only
  // safety net. Persisted via localStorage so it fires at most once per
  // browser profile.
  private maybeSuggestBackupExport(): void {
    if (localStorage.getItem(this.BACKUP_REMINDER_STORAGE_KEY) === '1') return;
    if (this.shiftService.shifts().length < this.BACKUP_REMINDER_THRESHOLD) return;
    localStorage.setItem(this.BACKUP_REMINDER_STORAGE_KEY, '1');
    this.toastService.info(this.translationService.translate('backupReminderSuggestion'), 8000);
  }

  executeEdit(updateSeries: boolean): void {
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
    this.editingShift.set(null);
    this.pendingShiftData.set(null);
  }

  // --- Deletion Logic ---
  confirmDelete(shift: Shift): void {
    this.shiftToDelete.set(shift);
    if (shift.isRecurring) {
      this.openModal('deleteSeriesConfirm');
    } else {
      this.openModal('deleteConfirm');
    }
  }

  executeDelete(allSeries: boolean = false): void {
    const shift = this.shiftToDelete();
    if (!shift) return;

    if (allSeries) {
      this.shiftService.deleteShiftSeries(shift.seriesId);
    } else {
      this.shiftService.deleteShift(shift.id);
    }
    this.activeModal.set('none');
    this.shiftToDelete.set(null);
    this.editingShift.set(null);
    this.pendingShiftData.set(null);
  }

  // --- Search Logic ---
  handleDateSearch(input: string): void {
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

      this.searchDateInput.set(input);
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

  clearSearch(): void {
    this.searchDate.set(null);
    this.listVisibleCount.set(this.INITIAL_LIST_SIZE); // Reset pagination
  }

  // --- Settings / Backup Logic ---
  exportBackup(): void {
    this.passwordPromptMode.set('export');
    this.openModal('passwordPrompt');
  }

  async confirmPasswordPrompt({
    password,
    confirmPassword,
  }: {
    password: string;
    confirmPassword: string;
  }): Promise<void> {
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

      if (password !== confirmPassword) {
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

  importBackup(event: Event): void {
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

  private finishImport(data: string): void {
    const importResult = this.shiftService.importShifts(data);
    if (importResult.success) {
      const message = `${this.translationService.translate('importSuccess')} (${importResult.imported} shifts)`;
      this.toastService.success(message);
    } else {
      const message = `${this.translationService.translate('importError')}${importResult.error ? ': ' + importResult.error : ''}`;
      this.toastService.error(message, 5000);
    }
  }

  confirmReset(): void {
    this.openModal('resetConfirm');
  }

  async executeReset(payload: ResetConfirmationPayload = {}): Promise<void> {
    if (this.isResettingData()) return;

    if (!this.authService.isAuthenticated()) {
      if (payload.confirmationText?.trim() !== 'RESET') {
        this.toastService.error(this.translationService.translate('resetKeywordInvalid'));
        return;
      }
      this.shiftService.deleteAllShifts();
      this.activeModal.set('none');
      this.toastService.success(this.translationService.translate('resetSuccess'));
      return;
    }

    if (this.authService.hasPasswordProvider() && !payload.password) {
      this.toastService.error(this.translationService.translate('resetPasswordRequired'));
      return;
    }

    this.isResettingData.set(true);
    try {
      await this.authService.reauthenticateForSensitiveAction(
        this.authService.hasPasswordProvider() ? { password: payload.password } : {}
      );
      this.shiftService.deleteAllShifts();
      this.activeModal.set('none');
      this.toastService.success(this.translationService.translate('resetSuccess'));
    } catch (error) {
      this.handleResetError(error);
    } finally {
      this.isResettingData.set(false);
    }
  }

  private handleResetError(error: unknown): void {
    const key = mapReauthErrorKey(error);
    if (key === 'resetErrorPopupClosed') {
      this.toastService.info(this.translationService.translate(key));
      return;
    }
    if (key === 'resetErrorOffline' || key === 'authDeleteAccountReauthRequired') {
      this.toastService.error(this.translationService.translate(key), 6000);
      return;
    }
    this.toastService.error(this.translationService.translate(key));
  }

  executeDecryptionReset(): void {
    this.shiftService.resetAfterDecryptionError();
    this.closeModal();
    this.toastService.success(this.translationService.translate('resetSuccess'));
  }

  dismissDecryptionError(): void {
    // User chooses to keep the unreadable data — just close the modal.
    // The app will remain empty until the user exports/imports a backup.
    this.closeModal();
  }

  openStatistics(): void {
    this.openModal('statistics');
  }

  // Calendar view methods
  toggleViewMode(): void {
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

  setViewMode(mode: ViewMode): void {
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

  onCalendarDaySelected(date: Date | null): void {
    if (date) {
      this.searchDate.set(date);
    } else {
      this.searchDate.set(null);
    }
  }

  onCalendarShiftClick(shift: Shift): void {
    this.openEditShiftForm(shift);
  }
}
