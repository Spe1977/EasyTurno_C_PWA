import { Component, ChangeDetectionStrategy, signal, computed, inject, WritableSignal, effect } from '@angular/core';
import { CommonModule, DatePipe, DOCUMENT } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Shift, Repetition } from './shift.model';
import { ShiftService } from './services/shift.service';
import { TranslationService } from './services/translation.service';
import { TranslatePipe } from './pipes/translate.pipe';
import { LangDatePipe } from './pipes/date-format.pipe';

type View = 'list' | 'week' | 'month';
type Modal = 'none' | 'form' | 'settings' | 'deleteConfirm' | 'deleteSeriesConfirm' | 'resetConfirm' | 'editSeriesConfirm';

interface Day {
    date: Date;
    isToday: boolean;
    isCurrentMonth: boolean;
    shifts: Shift[];
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, LangDatePipe],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`
    .calendar-grid {
        display: grid;
        grid-template-columns: repeat(7, minmax(0, 1fr));
    }
    .scrollbar-hidden::-webkit-scrollbar {
        display: none;
    }
    .scrollbar-hidden {
        -ms-overflow-style: none;  /* IE and Edge */
        scrollbar-width: none;  /* Firefox */
    }
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
  
  // UI State
  theme: WritableSignal<'light' | 'dark'>;
  currentView = signal<View>('list');
  activeModal = signal<Modal>('none');
  currentDate = signal(new Date());
  
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

  // Confirmation state
  shiftToDelete = signal<Shift | null>(null);

  // Constants
  colors = ['sky', 'green', 'amber', 'rose', 'indigo', 'teal', 'fuchsia', 'slate'];
  repFrequencies = ['days', 'weeks', 'months', 'year'];
  repIntervals = {
    days: [1, 3, 5, 8, 10, 15],
    weeks: [1, 2, 3, 4, 5, 6],
    months: [1, 2, 3, 4, 6],
    year: [1]
  };

  // Derived State (Computed Signals)
  monthDays = computed(() => this.generateMonth(this.currentDate()));
  weekDays = computed(() => this.generateWeek(this.currentDate()));
  listShifts = computed(() => this.generateList(this.currentDate()));
  
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
  }
  
  private generateMonth(date: Date): Day[] {
    const shifts = this.shiftService.shifts();
    const startDate = new Date(date.getFullYear(), date.getMonth(), 1);
    const endDate = new Date(date.getFullYear(), date.getMonth() + 1, 0);

    const days: Day[] = [];
    
    // Day of the week (0=Sun, 1=Mon...). We want Monday to be the first day.
    let dayOfWeek = startDate.getDay();
    if (dayOfWeek === 0) dayOfWeek = 7; // Sunday is 7

    // Add padding days from previous month
    for (let i = 1; i < dayOfWeek; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() - (dayOfWeek - i));
        days.push({ date: d, isToday: false, isCurrentMonth: false, shifts: [] });
    }
    
    // Add days of current month
    for (let i = 1; i <= endDate.getDate(); i++) {
        const d = new Date(date.getFullYear(), date.getMonth(), i);
        const dayShifts = shifts.filter(s => this.isSameDay(new Date(s.start), d)).sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        days.push({ date: d, isToday: this.isSameDay(d, new Date()), isCurrentMonth: true, shifts: dayShifts });
    }

    // Add padding days from next month
    let remaining = 42 - days.length; // 6 weeks * 7 days
    for (let i = 1; i <= remaining; i++) {
        const d = new Date(endDate);
        d.setDate(d.getDate() + i);
        days.push({ date: d, isToday: false, isCurrentMonth: false, shifts: [] });
    }

    return days;
  }
  
  private generateWeek(date: Date) {
    const shifts = this.shiftService.shifts();
    const startOfWeek = new Date(date);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    startOfWeek.setDate(diff);
    
    const week: Day[] = [];
    for (let i=0; i<7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(d.getDate() + i);
        const dayShifts = shifts.filter(s => this.isSameDay(new Date(s.start), d)).sort((a,b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        week.push({ date: d, isToday: this.isSameDay(d, new Date()), isCurrentMonth: true, shifts: dayShifts });
    }
    return week;
  }
  
  private generateList(date: Date) {
    return this.shiftService.shifts()
      .filter(s => new Date(s.start) >= new Date())
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 50); // Limit to next 50 shifts
  }

  isSameDay(d1: Date, d2: Date) {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  }

  changeMonth(offset: number) {
    const newDate = new Date(this.currentDate());
    newDate.setMonth(newDate.getMonth() + offset);
    this.currentDate.set(newDate);
  }

  changeWeek(offset: number) {
    const newDate = new Date(this.currentDate());
    newDate.setDate(newDate.getDate() + (offset * 7));
    this.currentDate.set(newDate);
  }

  goToToday() {
    this.currentDate.set(new Date());
  }

  openModal(modal: Modal) {
    this.activeModal.set(modal);
  }

  closeModal() {
    this.activeModal.set('none');
    this.resetForm();
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
    };

    const editing = this.editingShift();
    if (editing) {
      this.pendingShiftData.set(shiftData);
      if(editing.isRecurring) {
        this.openModal('editSeriesConfirm');
      } else {
        const updatedShift: Shift = { ...editing, ...shiftData };
        this.shiftService.updateShift(updatedShift);
        this.closeModal();
      }
    } else {
        this.shiftService.addShift(shiftData);
        this.closeModal();
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
    this.closeModal();
    this.pendingShiftData.set(null);
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
    this.closeModal();
    this.shiftToDelete.set(null);
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

  // Helper for Tailwind classes
  getColorClasses(color: string, type: 'bg' | 'text' | 'border'): string {
    const intensity = { bg: 100, text: 700, border: 500 };
    const darkIntensity = { bg: 500, text: 300, border: 400 };
    return `bg-${color}-${intensity.bg} text-${color}-${intensity.text} border-${color}-${intensity.border} dark:bg-${color}-${darkIntensity.bg}/20 dark:text-${color}-${darkIntensity.text} dark:border-${color}-${darkIntensity.border}`;
  }
}