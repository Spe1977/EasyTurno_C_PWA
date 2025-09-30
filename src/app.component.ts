import { Component, ChangeDetectionStrategy, signal, computed, inject, WritableSignal, effect } from '@angular/core';
import { CommonModule, DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Shift, Repetition, Allowance } from './shift.model';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { LangDatePipe } from './pipes/date-format.pipe';

type Modal = 'none' | 'form' | 'settings' | 'deleteConfirm' | 'deleteSeriesConfirm' | 'resetConfirm' | 'editSeriesConfirm' | 'searchDate' | 'statistics';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LangDatePipe],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    @keyframes fadeIn {
        from { opacity: 0; transform: scale(0.97); }
        to { opacity: 1; transform: scale(1); }
    }
    .modal-fade-in {
        animation: fadeIn 0.15s ease-out forwards;
    }
  `]
})
export class AppComponent {
  shiftService = inject(ShiftService);
  translationService = inject(TranslationService);
  datePipe = inject(DatePipe);
  private document = inject(DOCUMENT);

  // Make Object available in template
  Object = Object;

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
  shiftColor = signal('sky');
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
  listVisibleCount = signal(50);
  searchDate = signal<Date | null>(null);
  searchDateInput = signal('');

  // Constants
  colors = ['sky', 'green', 'amber', 'rose', 'indigo', 'teal', 'fuchsia', 'slate'];
  repFrequencies = ['days', 'weeks', 'months', 'year'];
  repIntervals = {
    days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    year: [1, 2, 3, 4, 5]
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
    this.searchDateInput.set(this.datePipe.transform(new Date(), 'yyyy-MM-dd')!);

    // Initialize statistics date range (last 30 days by default)
    const today = new Date();
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    this.statsStartDate.set(this.datePipe.transform(thirtyDaysAgo, 'yyyy-MM-dd')!);
    this.statsEndDate.set(this.datePipe.transform(today, 'yyyy-MM-dd')!);

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
  
  private generateList() {
    const allShifts = this.shiftService.shifts()
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const search = this.searchDate();
    if (search) {
      const searchDayStart = new Date(search);
      searchDayStart.setHours(0, 0, 0, 0);
      const searchDayEnd = new Date(search);
      searchDayEnd.setHours(23, 59, 59, 999);
      
      return allShifts.filter(s => {
        const shiftStart = new Date(s.start);
        const shiftEnd = new Date(s.end);
        // A shift is relevant for a given day if it overlaps with that day at any point.
        return shiftStart <= searchDayEnd && shiftEnd >= searchDayStart;
      });
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // In the default list, show shifts that haven't ended yet.
    return allShifts.filter(s => new Date(s.end) >= today);
  }

  loadMoreShifts() {
    this.listVisibleCount.update(c => c + 50);
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
    this.shiftStartDate.set(this.datePipe.transform(shift.start, 'yyyy-MM-dd')!);
    this.shiftStartTime.set(this.datePipe.transform(shift.start, 'HH:mm')!);
    this.shiftEndDate.set(this.datePipe.transform(shift.end, 'yyyy-MM-dd')!);
    this.shiftEndTime.set(this.datePipe.transform(shift.end, 'HH:mm')!);
    this.shiftColor.set(shift.color);
    this.shiftIsRecurring.set(shift.isRecurring);
    this.shiftNotes.set(shift.notes || '');
    this.shiftOvertimeHours.set(shift.overtimeHours || 0);
    this.shiftAllowances.set(shift.allowances || []);
    if(shift.repetition) {
        this.shiftRepetition.set(shift.repetition);
    }
    this.openModal('form');
  }

  handleFormSubmit() {
    const start = new Date(`${this.shiftStartDate()}T${this.shiftStartTime()}`).toISOString();
    const end = new Date(`${this.shiftEndDate()}T${this.shiftEndTime()}`).toISOString();

    const shiftData = {
        title: this.shiftTitle(),
        start,
        end,
        color: this.shiftColor(),
        isRecurring: this.shiftIsRecurring(),
        repetition: this.shiftIsRecurring() ? this.shiftRepetition() : undefined,
        notes: this.shiftNotes() || undefined,
        overtimeHours: this.shiftOvertimeHours() > 0 ? this.shiftOvertimeHours() : undefined,
        allowances: this.shiftAllowances().length > 0 ? this.shiftAllowances() : undefined,
    };

    const editing = this.editingShift();
    if (editing) {
      this.pendingShiftData.set(shiftData);
      if(editing.isRecurring) {
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
      const updatedShift: Shift = { ...editing, ...shiftData, isRecurring: false, repetition: undefined };
      this.shiftService.updateShift(updatedShift);
    }
    this.activeModal.set('none');
    this.resetForm();
  }


  resetForm() {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);
    this.shiftTitle.set('');
    this.shiftStartDate.set(this.datePipe.transform(now, 'yyyy-MM-dd')!);
    this.shiftStartTime.set(this.datePipe.transform(now, 'HH:mm')!);
    this.shiftEndDate.set(this.datePipe.transform(oneHourLater, 'yyyy-MM-dd')!);
    this.shiftEndTime.set(this.datePipe.transform(oneHourLater, 'HH:mm')!);
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
      const newInterval = this.repIntervals[freq][0];
      this.shiftRepetition.update(r => ({ ...r, frequency: freq, interval: newInterval }));
  }

  onRepetitionIntervalChange(event: Event) {
    const interval = Number((event.target as HTMLSelectElement).value);
    this.shiftRepetition.update(r => ({ ...r, interval }));
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
      const year = dateParts[0];
      const month = dateParts[1] - 1; // Month is 0-indexed in JS Date
      const day = dateParts[2];
      this.searchDate.set(new Date(year, month, day));
      this.listVisibleCount.set(50); // Reset pagination for new search
    }
    this.closeModal();
  }

  clearSearch() {
    this.searchDate.set(null);
    this.listVisibleCount.set(50); // Reset pagination
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
    reader.onload = (e) => {
        const result = e.target?.result;
        if (typeof result === 'string') {
            if (this.shiftService.importShifts(result)) {
                alert(this.translationService.translate('importSuccess'));
            } else {
                alert(this.translationService.translate('importError'));
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
    alert(this.translationService.translate('resetSuccess'));
  }

  // --- Allowances Management ---
  addAllowance() {
    const newAllowance: Allowance = { name: '', amount: 0 };
    this.shiftAllowances.update(allowances => [...allowances, newAllowance]);
  }

  removeAllowance(index: number) {
    this.shiftAllowances.update(allowances =>
      allowances.filter((_, i) => i !== index)
    );
  }

  updateAllowanceName(index: number, event: Event) {
    const name = (event.target as HTMLInputElement).value;
    this.shiftAllowances.update(allowances =>
      allowances.map((a, i) => i === index ? { ...a, name } : a)
    );
  }

  updateAllowanceAmount(index: number, event: Event) {
    const amount = Number((event.target as HTMLInputElement).value);
    this.shiftAllowances.update(allowances =>
      allowances.map((a, i) => i === index ? { ...a, amount } : a)
    );
  }

  // --- Statistics ---
  statsData = computed(() => {
    const start = new Date(this.statsStartDate());
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.statsEndDate());
    end.setHours(23, 59, 59, 999);

    const filteredShifts = this.shiftService.shifts().filter(shift => {
      const shiftStart = new Date(shift.start);
      return shiftStart >= start && shiftStart <= end;
    });

    const totalShifts = filteredShifts.length;

    // Calculate total work hours
    const totalHours = filteredShifts.reduce((sum, shift) => {
      const start = new Date(shift.start);
      const end = new Date(shift.end);
      const hours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    // Calculate total overtime hours
    const totalOvertime = filteredShifts.reduce((sum, shift) => {
      return sum + (shift.overtimeHours || 0);
    }, 0);

    // Group shifts by title
    const shiftsByTitle = filteredShifts.reduce((acc, shift) => {
      if (!acc[shift.title]) {
        acc[shift.title] = 0;
      }
      acc[shift.title]++;
      return acc;
    }, {} as Record<string, number>);

    // Group allowances by name
    const allowancesByName = filteredShifts.reduce((acc, shift) => {
      if (shift.allowances) {
        shift.allowances.forEach(allowance => {
          if (!acc[allowance.name]) {
            acc[allowance.name] = 0;
          }
          acc[allowance.name] += allowance.amount;
        });
      }
      return acc;
    }, {} as Record<string, number>);

    return {
      totalShifts,
      totalHours,
      totalOvertime,
      shiftsByTitle,
      allowancesByName
    };
  });

  openStatistics() {
    this.openModal('statistics');
  }

  // Helper for Tailwind classes
  getColorClasses(color: string): string {
    const intensity = { bg: 100, text: 700, border: 500 };
    const darkIntensity = { bg: 500, text: 300, border: 400 };
    return `bg-${color}-${intensity.bg} text-${color}-${intensity.text} border-${color}-${intensity.border} dark:bg-${color}-${darkIntensity.bg}/20 dark:text-${color}-${darkIntensity.text} dark:border-${color}-${darkIntensity.border}`;
  }
}