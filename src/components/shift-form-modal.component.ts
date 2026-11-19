import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AllowanceWithId, Repetition, Shift, ShiftColor } from '../shift.model';
import { ToastService } from '../services/toast.service';
import { TranslationService } from '../services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';

export interface ShiftFormSaveEvent {
  shiftData: Omit<Shift, 'id' | 'seriesId'> & { repetition?: Repetition };
  editingShift: Shift | null;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

/**
 * Modal form for creating or editing a single or recurring shift.
 */
@Component({
  selector: 'app-shift-form-modal',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="modal-fade-in w-full max-w-lg rounded-2xl bg-white shadow-2xl dark:bg-slate-800 dark:text-slate-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shiftFormModalTitle"
      tabindex="-1"
      (click)="$event.stopPropagation()"
    >
      <form (ngSubmit)="handleFormSubmit()">
        <div class="border-b border-slate-200 p-6 dark:border-slate-700">
          <h3 id="shiftFormModalTitle" class="text-2xl font-bold">
            {{ (editingShift() ? 'editShift' : 'newShift') | translate }}
          </h3>
        </div>
        <div class="max-h-[70vh] space-y-5 overflow-y-auto p-6">
          <div>
            <label for="shift-title" class="mb-1 block text-sm font-semibold">{{
              'title' | translate
            }}</label>
            <input
              id="shift-title"
              data-cy="shift-title-input"
              type="text"
              [ngModel]="shiftTitle()"
              (ngModelChange)="shiftTitle.set($event)"
              name="title"
              required
              maxlength="200"
              class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="shift-start-date" class="mb-1 block text-sm font-semibold">{{
                'startDate' | translate
              }}</label>
              <input
                id="shift-start-date"
                data-cy="shift-start-date"
                type="date"
                [ngModel]="shiftStartDate()"
                (ngModelChange)="shiftStartDate.set($event); onStartDateChange($event)"
                name="startDate"
                required
                class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label for="shift-start-time" class="mb-1 block text-sm font-semibold">{{
                'startTime' | translate
              }}</label>
              <input
                id="shift-start-time"
                data-cy="shift-start-time"
                type="time"
                [ngModel]="shiftStartTime()"
                (ngModelChange)="shiftStartTime.set($event); onStartTimeChange($event)"
                name="startTime"
                required
                class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="shift-end-date" class="mb-1 block text-sm font-semibold">{{
                'endDate' | translate
              }}</label>
              <input
                id="shift-end-date"
                data-cy="shift-end-date"
                type="date"
                [ngModel]="shiftEndDate()"
                (ngModelChange)="shiftEndDate.set($event)"
                name="endDate"
                required
                class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
            <div>
              <label for="shift-end-time" class="mb-1 block text-sm font-semibold">{{
                'endTime' | translate
              }}</label>
              <input
                id="shift-end-time"
                data-cy="shift-end-time"
                type="time"
                [ngModel]="shiftEndTime()"
                (ngModelChange)="shiftEndTime.set($event)"
                name="endTime"
                required
                class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          </div>
          <div>
            <span id="shift-color-label" class="mb-2 block text-sm font-semibold">{{
              'color' | translate
            }}</span>
            <div role="group" aria-labelledby="shift-color-label" class="flex flex-wrap gap-2">
              @for (color of colors; track color) {
                <button
                  type="button"
                  (click)="shiftColor.set(color)"
                  [attr.aria-label]="color"
                  [attr.aria-pressed]="shiftColor() === color"
                  class="h-9 w-9 rounded-full transition-transform hover:scale-110"
                  [class.bg-sky-400]="color === 'sky'"
                  [class.bg-green-400]="color === 'green'"
                  [class.bg-amber-400]="color === 'amber'"
                  [class.bg-rose-400]="color === 'rose'"
                  [class.bg-indigo-400]="color === 'indigo'"
                  [class.bg-teal-400]="color === 'teal'"
                  [class.bg-fuchsia-400]="color === 'fuchsia'"
                  [class.bg-slate-400]="color === 'slate'"
                  [class.ring-2]="shiftColor() === color"
                  [class.ring-offset-2]="shiftColor() === color"
                  [class.ring-indigo-500]="shiftColor() === color"
                  [class.dark:ring-offset-slate-800]="shiftColor() === color"
                ></button>
              }
            </div>
          </div>
          <div>
            <label for="shift-notes" class="mb-1 block text-sm font-semibold">{{
              'notes' | translate
            }}</label>
            <textarea
              id="shift-notes"
              [ngModel]="shiftNotes()"
              (ngModelChange)="shiftNotes.set($event)"
              name="notes"
              rows="3"
              maxlength="2000"
              class="w-full resize-none rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
            ></textarea>
          </div>
          <div>
            <label for="shift-overtime" class="mb-1 block text-sm font-semibold">{{
              'overtimeHours' | translate
            }}</label>
            <input
              id="shift-overtime"
              data-cy="overtime-hours-input"
              type="number"
              [ngModel]="shiftOvertimeHours()"
              (ngModelChange)="updateOvertimeHours($event)"
              name="overtimeHours"
              min="0"
              step="0.5"
              class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
            />
          </div>
          <div>
            <div class="mb-2 flex items-center justify-between">
              <span class="text-sm font-semibold">{{ 'allowances' | translate }}</span>
              <button
                data-cy="add-allowance-btn"
                type="button"
                (click)="addAllowance()"
                class="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                + {{ 'addAllowance' | translate }}
              </button>
            </div>
            @if (shiftAllowances().length > 0) {
              <div class="space-y-2">
                @for (allowance of shiftAllowances(); track allowance._id) {
                  <div
                    class="flex items-center space-x-2 rounded-lg bg-slate-100 p-2 dark:bg-slate-700/50"
                  >
                    <input
                      data-cy="allowance-name-input"
                      type="text"
                      [ngModel]="allowance.name"
                      (input)="updateAllowanceName($index, $event)"
                      [name]="'allowanceName' + $index"
                      [attr.aria-label]="'allowanceName' | translate"
                      placeholder="{{ 'allowanceName' | translate }}"
                      class="min-w-0 flex-grow rounded-lg border-0 bg-white p-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-600 dark:text-slate-100"
                    />
                    <input
                      data-cy="allowance-amount-input"
                      type="number"
                      [ngModel]="allowance.amount"
                      (input)="updateAllowanceAmount($index, $event)"
                      [name]="'allowanceAmount' + $index"
                      [attr.aria-label]="'allowanceAmount' | translate"
                      min="0"
                      step="1"
                      inputmode="numeric"
                      placeholder="{{ 'allowanceAmount' | translate }}"
                      class="w-20 shrink-0 rounded-lg border-0 bg-white p-2 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-600 dark:text-slate-100"
                    />
                    <button
                      data-cy="remove-allowance-btn"
                      type="button"
                      (click)="removeAllowance($index)"
                      [attr.aria-label]="'remove' | translate"
                      class="shrink-0 rounded-lg p-2 transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/50"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5 text-rose-500"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke-width="1.5"
                        stroke="currentColor"
                        aria-hidden="true"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                }
              </div>
            }
          </div>
          <div>
            <label class="flex items-center space-x-3 p-1">
              <input
                data-cy="recurring-checkbox"
                type="checkbox"
                [ngModel]="shiftIsRecurring()"
                (ngModelChange)="shiftIsRecurring.set($event)"
                name="isRecurring"
                class="h-4 w-4 rounded border-slate-300 bg-white text-indigo-600 focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700"
              />
              <span class="font-semibold">{{ 'repetition' | translate }}</span>
            </label>
            @if (shiftIsRecurring()) {
              <div
                class="mt-2 grid grid-cols-2 gap-4 rounded-lg bg-slate-100 p-3 dark:bg-slate-700/50"
              >
                <select
                  data-cy="frequency-select"
                  [ngModel]="shiftRepetition().frequency"
                  (change)="onFrequencyChange($event)"
                  name="repFreq"
                  [attr.aria-label]="('repetition' | translate) + ' ' + ('every' | translate)"
                  class="w-full rounded-lg border-0 bg-white p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-600 dark:text-slate-100"
                >
                  @for (freq of repFrequencies; track freq) {
                    <option [value]="freq">
                      {{ ('every' | translate) + ' ' + (freq | translate) }}
                    </option>
                  }
                </select>
                <select
                  data-cy="interval-select"
                  [ngModel]="shiftRepetition().interval"
                  (change)="onRepetitionIntervalChange($event)"
                  name="repInt"
                  [attr.aria-label]="'repetition' | translate"
                  class="w-full rounded-lg border-0 bg-white p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-600 dark:text-slate-100"
                >
                  @for (interval of repIntervals[shiftRepetition().frequency]; track interval) {
                    <option [value]="interval">{{ interval }}</option>
                  }
                </select>
              </div>
            }
          </div>
        </div>
        <div
          class="flex items-center justify-between rounded-b-2xl bg-slate-50 p-4 dark:bg-slate-900/50"
        >
          @if (editingShift()) {
            <button
              type="button"
              (click)="deleteRequested.emit(editingShift()!)"
              class="font-semibold text-rose-600 hover:underline dark:text-rose-400"
            >
              {{ 'delete' | translate }}
            </button>
          } @else {
            <div></div>
          }
          <div class="flex space-x-2">
            <button
              type="button"
              (click)="cancelled.emit()"
              class="rounded-lg bg-slate-200 px-5 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              {{ 'cancel' | translate }}
            </button>
            <button
              data-cy="save-shift-btn"
              type="submit"
              class="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              {{ 'save' | translate }}
            </button>
          </div>
        </div>
      </form>
    </div>
  `,
})
export class ShiftFormModalComponent {
  private readonly toastService = inject(ToastService);
  private readonly translationService = inject(TranslationService);
  private readonly datePipe = inject(DatePipe);

  readonly editingShift = input<Shift | null>(null);
  readonly save = output<ShiftFormSaveEvent>();
  readonly deleteRequested = output<Shift>();
  readonly cancelled = output<void>();

  readonly colors: ShiftColor[] = [
    'sky',
    'green',
    'amber',
    'rose',
    'indigo',
    'teal',
    'fuchsia',
    'slate',
  ];
  readonly repFrequencies: Repetition['frequency'][] = ['days', 'weeks', 'months', 'years'];
  readonly repIntervals: Record<Repetition['frequency'], number[]> = {
    days: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    weeks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    years: [1, 2, 3, 4, 5],
  };

  readonly shiftTitle = signal('');
  readonly shiftStartDate = signal('');
  readonly shiftStartTime = signal('');
  readonly shiftEndDate = signal('');
  readonly shiftEndTime = signal('');
  readonly shiftColor = signal<ShiftColor>('indigo');
  readonly shiftIsRecurring = signal(false);
  readonly shiftRepetition = signal<Repetition>({ frequency: 'days', interval: 1 });
  readonly shiftNotes = signal('');
  readonly shiftOvertimeHours = signal<number>(0);
  readonly shiftAllowances = signal<AllowanceWithId[]>([]);

  constructor() {
    this.resetForm();
    let initialized = false;
    effect(() => {
      const shift = this.editingShift();
      if (shift) {
        initialized = true;
        this.populateFromShift(shift);
      } else if (initialized) {
        this.resetForm();
      } else {
        initialized = true;
      }
    });
  }

  private populateFromShift(shift: Shift): void {
    this.shiftTitle.set(shift.title);

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
    const allowancesWithId: AllowanceWithId[] = (shift.allowances || []).map(a => ({
      ...a,
      _id: crypto.randomUUID(),
    }));
    this.shiftAllowances.set(allowancesWithId);
    if (shift.repetition) {
      this.shiftRepetition.set(shift.repetition);
    }
  }

  resetForm(): void {
    const now = new Date();
    const oneHourLater = new Date(now.getTime() + ONE_HOUR_MS);
    this.shiftTitle.set('');

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
  }

  handleFormSubmit(): void {
    if (!this.shiftTitle().trim()) {
      this.toastService.error(this.translationService.translate('titleRequired'));
      return;
    }

    const start = new Date(`${this.shiftStartDate()}T${this.shiftStartTime()}`);
    const end = new Date(`${this.shiftEndDate()}T${this.shiftEndTime()}`);

    if (end <= start) {
      this.toastService.error(this.translationService.translate('endMustBeAfterStart'));
      return;
    }

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
      allowances:
        this.shiftAllowances().length > 0
          ? this.shiftAllowances().map(({ _id, ...allowance }) => allowance)
          : undefined,
      timezone: userTimezone,
    };

    this.save.emit({ shiftData, editingShift: this.editingShift() });
  }

  onFrequencyChange(event: Event): void {
    const freq = (event.target as HTMLSelectElement).value as Repetition['frequency'];
    const intervalsForFreq = this.repIntervals[freq];
    const newInterval: number = (intervalsForFreq && intervalsForFreq[0]) ?? 1;
    this.shiftRepetition.update(r => ({ ...r, frequency: freq, interval: newInterval }));
  }

  onRepetitionIntervalChange(event: Event): void {
    const interval = Number((event.target as HTMLSelectElement).value);
    this.shiftRepetition.update(r => ({ ...r, interval }));
  }

  onStartDateChange(newStartDate: string): void {
    this.shiftEndDate.set(newStartDate);
  }

  onStartTimeChange(newStartTime: string): void {
    this.shiftEndTime.set(newStartTime);
  }

  addAllowance(): void {
    const newAllowance: AllowanceWithId = {
      name: '',
      amount: 0,
      _id: crypto.randomUUID(),
    };
    this.shiftAllowances.update(allowances => [...allowances, newAllowance]);
  }

  removeAllowance(index: number): void {
    this.shiftAllowances.update(allowances => allowances.filter((_, i) => i !== index));
  }

  updateAllowanceName(index: number, event: Event): void {
    const name = (event.target as HTMLInputElement).value;
    this.shiftAllowances.update(allowances =>
      allowances.map((a, i) => (i === index ? { ...a, name } : a))
    );
  }

  updateAllowanceAmount(index: number, event: Event): void {
    const raw = Number((event.target as HTMLInputElement).value);
    if (!Number.isFinite(raw) || raw < 0) {
      return;
    }
    const amount = Math.floor(raw);
    this.shiftAllowances.update(allowances =>
      allowances.map((a, i) => (i === index ? { ...a, amount } : a))
    );
  }

  updateOvertimeHours(value: number | null): void {
    if (value === null || !Number.isFinite(value) || value < 0) {
      this.shiftOvertimeHours.set(0);
      return;
    }
    this.shiftOvertimeHours.set(value);
  }
}
