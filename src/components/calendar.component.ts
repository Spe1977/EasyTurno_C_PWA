import {
  Component,
  input,
  output,
  signal,
  computed,
  inject,
  ChangeDetectionStrategy,
} from '@angular/core';
import { CalendarService } from '../services/calendar.service';
import { TranslationService } from '../services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';
import { Shift, ShiftColor } from '../shift.model';

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="calendar-container overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800">
      <!-- Calendar Header -->
      <div
        class="calendar-header flex items-center justify-between bg-blue-600 p-4 dark:bg-blue-700"
      >
        <button
          (click)="previousMonth()"
          class="rounded-full p-2 transition-colors hover:bg-blue-700 dark:hover:bg-blue-800"
          [attr.aria-label]="'calendar.previousMonth' | translate"
          data-cy="calendar-prev-month"
        >
          <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div class="flex flex-col items-center">
          <h2 class="text-xl font-bold text-white" data-cy="calendar-month-year">
            {{ monthName() }} {{ calendarService.currentYear() }}
          </h2>
          <button
            (click)="goToToday()"
            class="mt-1 text-sm text-blue-100 underline hover:text-white"
            data-cy="calendar-today"
          >
            {{ 'calendar.today' | translate }}
          </button>
        </div>

        <button
          (click)="nextMonth()"
          class="rounded-full p-2 transition-colors hover:bg-blue-700 dark:hover:bg-blue-800"
          [attr.aria-label]="'calendar.nextMonth' | translate"
          data-cy="calendar-next-month"
        >
          <svg class="h-6 w-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>

      <!-- Weekday Headers -->
      <div
        class="weekday-headers grid grid-cols-7 bg-gray-100 text-center text-sm font-semibold dark:bg-gray-700"
      >
        @for (day of weekdayNames(); track day) {
          <div class="py-2 text-gray-700 dark:text-gray-300">
            {{ day }}
          </div>
        }
      </div>

      <!-- Calendar Grid -->
      <div
        class="calendar-grid grid grid-cols-7"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onTouchEnd()"
        data-cy="calendar-grid"
      >
        @for (day of calendarService.calendarDays(); track day.date.getTime(); let i = $index) {
          <div
            class="calendar-day relative min-h-[60px] cursor-pointer border border-gray-200 transition-colors sm:min-h-[80px] dark:border-gray-600"
            [class.bg-gray-50]="!day.isCurrentMonth"
            [class.dark:bg-gray-900]="!day.isCurrentMonth"
            [class.bg-white]="day.isCurrentMonth"
            [class.dark:bg-gray-800]="day.isCurrentMonth"
            [class.ring-2]="day.isToday"
            [class.ring-blue-500]="day.isToday"
            [class.bg-blue-50]="isSelectedDay(day.date)"
            [class.dark:bg-blue-900]="isSelectedDay(day.date)"
            (click)="onDayClick(day.date)"
            [attr.data-cy]="'calendar-day-' + i"
          >
            <!-- Day Number -->
            <div
              class="day-number p-1 text-center text-sm font-medium"
              [class.text-gray-400]="!day.isCurrentMonth"
              [class.text-gray-900]="day.isCurrentMonth"
              [class.dark:text-gray-300]="day.isCurrentMonth"
              [class.text-blue-600]="day.isToday"
              [class.dark:text-blue-400]="day.isToday"
              [class.font-bold]="day.isToday"
            >
              {{ day.dayNumber }}
            </div>

            <!-- Shift Indicators -->
            <div
              class="shift-indicators flex max-h-[40px] flex-wrap gap-1 overflow-hidden px-1 pb-1"
            >
              @for (
                shift of shiftsByDay()[calendarService.toISODateString(day.date)];
                track shift.id
              ) {
                <div
                  class="h-2 w-2 flex-shrink-0 rounded-full"
                  [style.backgroundColor]="getShiftIndicatorColor(shift)"
                  [attr.title]="shift.title"
                ></div>
              }
            </div>

            <!-- Shift Count Badge -->
            @if ((shiftsByDay()[calendarService.toISODateString(day.date)]?.length ?? 0) > 5) {
              <div
                class="absolute right-1 bottom-1 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-xs font-bold text-white dark:bg-blue-500"
                data-cy="calendar-shift-badge"
              >
                {{ shiftsByDay()[calendarService.toISODateString(day.date)]?.length }}
              </div>
            }
          </div>
        }
      </div>

      <!-- Selected Day Details -->
      @if (selectedDate()) {
        <div
          class="selected-day-info max-h-[400px] overflow-y-auto border-t border-blue-200 bg-blue-50 p-4 dark:border-blue-700 dark:bg-blue-900"
          data-cy="calendar-selected-day"
        >
          <div class="mb-3 flex items-center justify-between">
            <h3 class="text-lg font-bold text-gray-900 dark:text-white">
              {{ formatSelectedDate() }}
            </h3>
            <button
              (click)="clearSelection()"
              class="text-sm text-blue-600 hover:underline dark:text-blue-400"
              data-cy="calendar-clear-selection"
            >
              {{ 'calendar.clearSelection' | translate }}
            </button>
          </div>

          <!-- Shift count -->
          <p
            class="mb-3 text-sm font-medium text-gray-700 dark:text-gray-300"
            data-cy="calendar-shift-count"
          >
            {{ selectedDayShifts().length }}
            {{
              selectedDayShifts().length === 1
                ? ('calendar.shift' | translate)
                : ('calendar.shifts' | translate)
            }}
          </p>

          <!-- Shifts list -->
          @if (selectedDayShifts().length > 0) {
            <div class="space-y-2">
              @for (shift of selectedDayShifts(); track shift.id) {
                <div
                  class="cursor-pointer rounded-lg border-l-4 bg-white p-3 shadow-sm transition-all hover:shadow-md dark:bg-gray-800"
                  [style.borderLeftColor]="shift.color"
                  (click)="onShiftClick(shift)"
                  [attr.data-cy]="'calendar-shift-' + shift.id"
                >
                  <!-- Shift title -->
                  <div class="mb-1 flex items-start justify-between">
                    <h4 class="font-semibold text-gray-900 dark:text-white">
                      {{ shift.title }}
                    </h4>
                  </div>

                  <!-- Shift time -->
                  <div class="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <svg class="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>{{ formatShiftTime(shift) }}</span>
                  </div>

                  <!-- Overtime badge -->
                  @if (shift.overtimeHours && shift.overtimeHours > 0) {
                    <div class="mt-2">
                      <span
                        class="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                      >
                        +{{ shift.overtimeHours }}h {{ 'shifts.overtime' | translate }}
                      </span>
                    </div>
                  }

                  <!-- Notes preview -->
                  @if (shift.notes) {
                    <p class="mt-2 truncate text-xs text-gray-500 dark:text-gray-400">
                      {{ shift.notes }}
                    </p>
                  }
                </div>
              }
            </div>
          } @else {
            <!-- Empty state -->
            <div class="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
              {{ 'calendar.noShifts' | translate }}
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: [
    `
      .calendar-day:hover {
        background-color: rgba(59, 130, 246, 0.1);
      }

      .dark .calendar-day:hover {
        background-color: rgba(59, 130, 246, 0.2);
      }

      /* Prevent text selection during swipe */
      .calendar-grid {
        user-select: none;
        -webkit-user-select: none;
        touch-action: pan-y;
      }
    `,
  ],
})
export class CalendarComponent {
  private readonly COLOR_MAP: Record<ShiftColor, string> = {
    sky: '#0EA5E9',
    green: '#22C55E',
    amber: '#F59E0B',
    rose: '#F43F5E',
    indigo: '#6366F1',
    teal: '#14B8A6',
    fuchsia: '#D946EF',
    slate: '#64748B',
  };

  shifts = input<Shift[]>([]);
  daySelected = output<Date | null>();
  shiftClicked = output<Shift>();

  // Touch gesture tracking
  private touchStartX = 0;
  private touchEndX = 0;
  private touchStartY = 0;
  private hasMoved = false;
  private readonly SWIPE_THRESHOLD = 50;
  private readonly MOVEMENT_THRESHOLD = 10;

  // Selected day state
  readonly selectedDate = signal<Date | null>(null);

  calendarService = inject(CalendarService);
  private translationService = inject(TranslationService);

  private readonly locale = computed(() =>
    this.translationService.language() === 'it' ? 'it-IT' : 'en-US'
  );

  // Computed values
  readonly weekdayNames = computed(() => this.calendarService.getWeekdayNames(this.locale()));

  readonly monthName = computed(() =>
    this.calendarService.getMonthName(this.calendarService.currentMonth(), this.locale())
  );

  // Pre-computed shift map indexed by local ISO date string.
  readonly shiftsByDay = computed(() => {
    const map: Record<string, Shift[]> = {};
    for (const shift of this.shifts()) {
      for (const dateStr of this.getShiftDateKeys(shift)) {
        (map[dateStr] ??= []).push(shift);
      }
    }
    return map;
  });

  readonly selectedDayShifts = computed(() => {
    const selected = this.selectedDate();
    if (!selected) return [];
    const dateStr = this.calendarService.toISODateString(selected);
    return this.shiftsByDay()[dateStr] ?? [];
  });

  // Navigation methods
  previousMonth(): void {
    this.calendarService.previousMonth();
    this.clearSelection();
  }

  nextMonth(): void {
    this.calendarService.nextMonth();
    this.clearSelection();
  }

  goToToday(): void {
    this.calendarService.goToToday();
    this.clearSelection();
  }

  // Day selection
  onDayClick(date: Date): void {
    const current = this.selectedDate();
    if (current && this.calendarService.isSameDay(date, current)) {
      this.clearSelection();
    } else {
      this.selectedDate.set(date);
      this.daySelected.emit(date);
    }
  }

  clearSelection(): void {
    this.selectedDate.set(null);
    this.daySelected.emit(null);
  }

  isSelectedDay(date: Date): boolean {
    const selected = this.selectedDate();
    return selected ? this.calendarService.isSameDay(date, selected) : false;
  }

  getShiftsForDay(date: Date): Shift[] {
    const dateStr = this.calendarService.toISODateString(date);
    return this.shiftsByDay()[dateStr] ?? [];
  }

  getShiftIndicatorColor(shift: Shift): string {
    return this.COLOR_MAP[shift.color] ?? shift.color;
  }

  formatSelectedDate(): string {
    const date = this.selectedDate();
    if (!date) return '';
    return date.toLocaleDateString(this.locale(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // Shift interaction
  onShiftClick(shift: Shift): void {
    this.shiftClicked.emit(shift);
  }

  formatShiftTime(shift: Shift): string {
    const startDate = new Date(shift.start);
    const endDate = new Date(shift.end);

    const loc = this.locale();
    const startTime = startDate.toLocaleTimeString(loc, {
      hour: '2-digit',
      minute: '2-digit',
    });

    const endTime = endDate.toLocaleTimeString(loc, {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isSameDay = this.calendarService.isSameDay(startDate, endDate);

    if (isSameDay) {
      return `${startTime} - ${endTime}`;
    } else {
      const endDateStr = endDate.toLocaleDateString(loc, {
        day: 'numeric',
        month: 'short',
      });
      return `${startTime} - ${endTime} (${endDateStr})`;
    }
  }

  // Touch gesture handlers
  onTouchStart(event: TouchEvent): void {
    this.touchStartX = event.changedTouches[0]?.screenX ?? 0;
    this.touchStartY = event.changedTouches[0]?.screenY ?? 0;
    this.touchEndX = this.touchStartX;
    this.hasMoved = false;
  }

  onTouchMove(event: TouchEvent): void {
    const currentX = event.changedTouches[0]?.screenX ?? 0;
    const currentY = event.changedTouches[0]?.screenY ?? 0;
    this.touchEndX = currentX;

    const horizontalMovement = Math.abs(currentX - this.touchStartX);
    const verticalMovement = Math.abs(currentY - this.touchStartY);

    if (horizontalMovement > this.MOVEMENT_THRESHOLD && horizontalMovement > verticalMovement) {
      this.hasMoved = true;
    }
  }

  onTouchEnd(): void {
    if (!this.hasMoved) {
      this.resetTouchState();
      return;
    }

    const diff = this.touchStartX - this.touchEndX;

    if (diff > this.SWIPE_THRESHOLD) {
      this.nextMonth();
    }

    if (diff < -this.SWIPE_THRESHOLD) {
      this.previousMonth();
    }

    this.resetTouchState();
  }

  private resetTouchState(): void {
    this.touchStartX = 0;
    this.touchEndX = 0;
    this.touchStartY = 0;
    this.hasMoved = false;
  }

  private getShiftDateKeys(shift: Shift): string[] {
    const start = new Date(shift.start);
    const end = new Date(shift.end);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return [];
    }

    const current = new Date(start);
    current.setHours(0, 0, 0, 0);

    const last = new Date(end);
    last.setHours(0, 0, 0, 0);

    const keys: string[] = [];
    while (current.getTime() <= last.getTime()) {
      keys.push(this.calendarService.toISODateString(current));
      current.setDate(current.getDate() + 1);
    }

    return keys;
  }
}
