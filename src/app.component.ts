import {
  Component,
  ChangeDetectionStrategy,
  signal,
  computed,
  inject,
  WritableSignal,
  effect,
} from '@angular/core';
import { CommonModule, DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Capacitor } from '@capacitor/core';
import { Shift, Repetition, Allowance, ShiftColor } from './shift.model';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { ToastService } from './services/toast.service';
import { NotificationService, NotificationSettings } from './services/notification.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { LangDatePipe } from './pipes/date-format.pipe';
import { ToastContainerComponent } from './components/toast-container.component';
import { ShiftListItemComponent } from './components/shift-list-item.component';
import { ModalFocusDirective } from './directives/modal-focus.directive';

type Modal =
  | 'none'
  | 'form'
  | 'settings'
  | 'deleteConfirm'
  | 'deleteSeriesConfirm'
  | 'resetConfirm'
  | 'editSeriesConfirm'
  | 'searchDate'
  | 'statistics';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslatePipe,
    LangDatePipe,
    ToastContainerComponent,
    ShiftListItemComponent,
    ModalFocusDirective,
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
  datePipe = inject(DatePipe);
  private document = inject(DOCUMENT);

  // Make Object available in template
  Object = Object;

  // Native platform detection
  isNativePlatform = Capacitor.isNativePlatform;

  // Notification settings
  notificationSettings = signal<NotificationSettings>(this.notificationService.getSettings());

  // UI State
  theme: WritableSignal<'light' | 'dark'>;
  activeModal = signal<Modal>('none');

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
  shiftAllowances = signal<Allowance[]>([]);

  // Confirmation state
  shiftToDelete = signal<Shift | null>(null);

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

  colors: ShiftColor[] = ['sky', 'green', 'amber', 'rose', 'indigo', 'teal', 'fuchsia', 'slate'];
  repFrequencies = ['days', 'weeks', 'months', 'year'];
  repIntervals: Record<Repetition['frequency'], number[]> = {
    days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    year: [1, 2, 3, 4, 5],
  };

  // Derived State (Computed Signals)
  allListShifts = computed(() => this.generateList());
  listShifts = computed(() => this.allListShifts().slice(0, this.listVisibleCount()));

  // Methods
  constructor() {
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

    this.resetForm();
    this.searchDateInput.set(this.datePipe.transform(new Date(), 'yyyy-MM-dd') ?? '');

    // Initialize statistics date range (configurable default days)
    const today = new Date();
    const defaultDaysAgo = new Date(
      today.getTime() - this.STATS_DEFAULT_DAYS * 24 * 60 * 60 * 1000
    );
    this.statsStartDate.set(this.datePipe.transform(defaultDaysAgo, 'yyyy-MM-dd') ?? '');
    this.statsEndDate.set(this.datePipe.transform(today, 'yyyy-MM-dd') ?? '');

    // Initialize notifications (solo su native platform)
    if (Capacitor.isNativePlatform()) {
      void this.notificationService.initialize();
    }

    this.checkUrlForActions();
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
    return this.shiftService
      .shifts()
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  });

  // Cache today boundary timestamp to avoid recreating Date object
  private todayBoundary = computed(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return today.getTime();
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

    const todayTime = this.todayBoundary();
    // In the default list, show shifts that haven't ended yet.
    return allShifts.filter(s => new Date(s.end).getTime() >= todayTime);
  }

  loadMoreShifts() {
    this.listVisibleCount.update(c => c + this.LIST_LOAD_INCREMENT);
  }

  openModal(modal: Modal) {
    this.activeModal.set(modal);
  }

  closeModal() {
    this.activeModal.set('none');
    // Don't reset form here, as it clears pending data for confirmations
  }

  openNewShiftForm() {
    this.resetForm();
    this.editingShift.set(null);
    this.openModal('form');
  }

  openEditShiftForm(shift: Shift) {
    this.editingShift.set(shift);
    this.shiftTitle.set(shift.title);
    this.shiftStartDate.set(this.datePipe.transform(shift.start, 'yyyy-MM-dd') ?? '');
    this.shiftStartTime.set(this.datePipe.transform(shift.start, 'HH:mm') ?? '');
    this.shiftEndDate.set(this.datePipe.transform(shift.end, 'yyyy-MM-dd') ?? '');
    this.shiftEndTime.set(this.datePipe.transform(shift.end, 'HH:mm') ?? '');
    this.shiftColor.set(shift.color);
    this.shiftIsRecurring.set(shift.isRecurring);
    this.shiftNotes.set(shift.notes || '');
    this.shiftOvertimeHours.set(shift.overtimeHours || 0);
    this.shiftAllowances.set(shift.allowances || []);
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
      allowances: this.shiftAllowances().length > 0 ? this.shiftAllowances() : undefined,
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
    }
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
    this.shiftStartDate.set(this.datePipe.transform(now, 'yyyy-MM-dd') ?? '');
    this.shiftStartTime.set(this.datePipe.transform(now, 'HH:mm') ?? '');
    this.shiftEndDate.set(this.datePipe.transform(oneHourLater, 'yyyy-MM-dd') ?? '');
    this.shiftEndTime.set(this.datePipe.transform(oneHourLater, 'HH:mm') ?? '');
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

  onStartDateChange(event: Event) {
    const newStartDate = (event.target as HTMLInputElement).value;
    this.shiftStartDate.set(newStartDate);
    // Align end date to start date automatically
    this.shiftEndDate.set(newStartDate);
  }

  onStartTimeChange(event: Event) {
    const newStartTime = (event.target as HTMLInputElement).value;
    this.shiftStartTime.set(newStartTime);
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
    if (this.searchDateInput()) {
      const dateParts = this.searchDateInput().split('-').map(Number);
      const year: number = dateParts[0] ?? 0;
      const month: number = (dateParts[1] ?? 1) - 1; // Month is 0-indexed in JS Date
      const day: number = dateParts[2] ?? 1;
      this.searchDate.set(new Date(year, month, day));
      this.listVisibleCount.set(this.INITIAL_LIST_SIZE); // Reset pagination for new search
    }
    this.closeModal();
  }

  clearSearch() {
    this.searchDate.set(null);
    this.listVisibleCount.set(this.INITIAL_LIST_SIZE); // Reset pagination
  }

  // --- Settings Logic ---
  exportBackup() {
    const data = JSON.stringify(this.shiftService.shifts(), null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'easyturno_backup.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  triggerImport() {
    document.getElementById('importFile')?.click();
  }

  importBackup(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = e => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        const importResult = this.shiftService.importShifts(result);
        if (importResult.success) {
          const message = `${this.translationService.translate('importSuccess')} (${importResult.imported} shifts)`;
          this.toastService.success(message);
        } else {
          const message = `${this.translationService.translate('importError')}${importResult.error ? ': ' + importResult.error : ''}`;
          this.toastService.error(message, 5000);
        }
      }
      this.closeModal();
    };
    reader.readAsText(file);
  }

  confirmReset() {
    this.openModal('resetConfirm');
  }

  executeReset() {
    this.shiftService.deleteAllShifts();
    this.closeModal();
    this.toastService.success(this.translationService.translate('resetSuccess'));
  }

  // --- Allowances Management ---
  addAllowance() {
    const newAllowance: Allowance = { name: '', amount: 0 };
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
    const amount = Number((event.target as HTMLInputElement).value);
    this.shiftAllowances.update(allowances =>
      allowances.map((a, i) => (i === index ? { ...a, amount } : a))
    );
  }

  // --- Statistics ---
  // Optimized single-pass algorithm for calculating all statistics at once
  statsData = computed(() => {
    const start = new Date(this.statsStartDate());
    start.setHours(0, 0, 0, 0);
    const startTime = start.getTime();

    const end = new Date(this.statsEndDate());
    end.setHours(23, 59, 59, 999);
    const endTime = end.getTime();

    // Single-pass algorithm: calculate all stats in one iteration
    return this.shiftService.shifts().reduce(
      (acc, shift) => {
        const shiftStartTime = new Date(shift.start).getTime();

        // Filter and accumulate in one pass
        if (shiftStartTime >= startTime && shiftStartTime <= endTime) {
          // Count total shifts
          acc.totalShifts++;

          // Calculate work hours
          const shiftEndTime = new Date(shift.end).getTime();
          const hours = (shiftEndTime - shiftStartTime) / (1000 * 60 * 60);
          acc.totalHours += hours;

          // Add overtime hours
          acc.totalOvertime += shift.overtimeHours || 0;

          // Group by title
          const currentTitleCount = acc.shiftsByTitle[shift.title];
          acc.shiftsByTitle[shift.title] = (currentTitleCount ?? 0) + 1;

          // Accumulate allowances
          if (shift.allowances) {
            shift.allowances.forEach(allowance => {
              const currentAllowanceTotal = acc.allowancesByName[allowance.name];
              acc.allowancesByName[allowance.name] =
                (currentAllowanceTotal ?? 0) + allowance.amount;
            });
          }
        }

        return acc;
      },
      {
        totalShifts: 0,
        totalHours: 0,
        totalOvertime: 0,
        shiftsByTitle: {} as Record<string, number>,
        allowancesByName: {} as Record<string, number>,
      }
    );
  });

  openStatistics() {
    this.openModal('statistics');
  }

  // --- Notification Settings ---
  onNotificationSettingsChange() {
    this.notificationService.saveSettings(this.notificationSettings());
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
