import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Shift, ShiftColor } from '../shift.model';
import { TranslatePipe } from '../pipes/translate.pipe';

const STATS_STYLE_MAP: Record<ShiftColor, { bar: string; labelBg: string; text: string }> = {
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

/**
 * Responsive statistics drawer displaying shift totals, hours, overtime, and allowances.
 */
@Component({
  selector: 'app-statistics-drawer',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="modal-fade-in sm:border-b-auto flex max-h-[92vh] w-full max-w-2xl flex-col self-end overflow-hidden rounded-t-3xl border border-b-0 border-slate-100 bg-white shadow-2xl sm:self-center sm:rounded-2xl dark:border-slate-700/50 dark:bg-slate-800 dark:text-slate-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="statisticsDrawerTitle"
      tabindex="-1"
      (click)="$event.stopPropagation()"
    >
      <!-- Drawer Handle for Mobile -->
      <div
        class="mx-auto my-3 h-1 w-12 shrink-0 rounded-full bg-slate-200 sm:hidden dark:bg-slate-700"
      ></div>

      <!-- Header -->
      <div
        class="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4 sm:pt-6 dark:border-slate-700/50"
      >
        <div>
          <h3
            id="statisticsDrawerTitle"
            class="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100"
          >
            {{ 'statistics' | translate }}
          </h3>
          <p class="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {{ 'statsSubtitle' | translate }}
          </p>
        </div>
        <button
          type="button"
          (click)="closed.emit()"
          [attr.aria-label]="'cancel' | translate"
          class="rounded-full p-2 text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-700 active:scale-95 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
            aria-hidden="true"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="space-y-6 overflow-y-auto p-6 pt-4">
        <!-- Quick Date Presets -->
        <div>
          <span
            id="stats-preset-label"
            class="mb-2 block text-xs font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
            >{{ 'presetTitle' | translate }}</span
          >
          <div
            role="group"
            aria-labelledby="stats-preset-label"
            class="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            <button
              type="button"
              (click)="setStatsPreset('thisMonth')"
              class="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:border-indigo-500 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-400"
            >
              {{ 'presetThisMonth' | translate }}
            </button>
            <button
              type="button"
              (click)="setStatsPreset('lastMonth')"
              class="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:border-indigo-500 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-400"
            >
              {{ 'presetLastMonth' | translate }}
            </button>
            <button
              type="button"
              (click)="setStatsPreset('last30Days')"
              class="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:border-indigo-500 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-400"
            >
              {{ 'presetLast30Days' | translate }}
            </button>
            <button
              type="button"
              (click)="setStatsPreset('thisYear')"
              class="cursor-pointer rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition-all hover:border-indigo-500 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-indigo-400"
            >
              {{ 'presetThisYear' | translate }}
            </button>
          </div>
        </div>

        <!-- Custom Date Range inputs -->
        <div class="grid grid-cols-2 gap-4">
          <div class="group relative">
            <label
              for="stats-start-date"
              class="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase transition-colors group-focus-within:text-indigo-500 dark:text-slate-400"
              >{{ 'periodFrom' | translate }}</label
            >
            <input
              id="stats-start-date"
              type="date"
              [ngModel]="statsStartDate()"
              (ngModelChange)="statsStartDate.set($event)"
              name="statsStartDate"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-sm font-semibold tracking-tight transition-all outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-indigo-400"
            />
          </div>
          <div class="group relative">
            <label
              for="stats-end-date"
              class="mb-1 block text-[11px] font-bold tracking-wider text-slate-500 uppercase transition-colors group-focus-within:text-indigo-500 dark:text-slate-400"
              >{{ 'periodTo' | translate }}</label
            >
            <input
              id="stats-end-date"
              type="date"
              [ngModel]="statsEndDate()"
              (ngModelChange)="statsEndDate.set($event)"
              name="statsEndDate"
              class="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-sm font-semibold tracking-tight transition-all outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-100 dark:focus:border-indigo-400"
            />
          </div>
        </div>

        @if (statsData().totalShifts > 0) {
          <!-- Integrated Metric Cards Grid -->
          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <!-- Active Workload Metric Card -->
            <div
              class="relative rounded-2xl border border-indigo-100/50 bg-gradient-to-br from-indigo-50/70 to-indigo-100/30 p-5 dark:border-indigo-950/30 dark:from-indigo-950/20 dark:to-slate-900/30"
            >
              <span
                class="block text-xs font-semibold tracking-wider text-indigo-600 uppercase dark:text-indigo-400"
                >{{ 'totalShifts' | translate }}</span
              >
              <div class="mt-2 flex items-baseline gap-2">
                <span
                  class="text-4xl font-extrabold tracking-tight text-indigo-950 dark:text-indigo-100"
                  >{{ statsData().totalShifts }}</span
                >
                <span
                  class="rounded-full bg-indigo-100/50 px-2.5 py-0.5 text-xs font-semibold text-indigo-500 dark:bg-indigo-950/40 dark:text-indigo-400"
                  >{{
                    (statsData().totalShifts === 1 ? 'statsShiftSingular' : 'statsShiftPlural')
                      | translate
                  }}</span
                >
              </div>
              <div
                class="mt-4 flex w-fit items-center gap-1.5 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-medium text-indigo-500 dark:bg-indigo-950/20 dark:text-indigo-400"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-3.5 w-3.5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                {{ 'statsCalculatedLocally' | translate }}
              </div>
            </div>

            <!-- Cumulative Hours Split-Panel -->
            <div
              class="flex flex-col justify-between rounded-2xl border border-slate-100 bg-slate-50/20 p-5 dark:border-slate-700/50 dark:bg-slate-900/10"
            >
              <div>
                <span
                  class="block text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400"
                  >{{ 'totalHours' | translate }}</span
                >
                <span
                  class="mt-1.5 block text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100"
                >
                  {{ statsData().totalHours.toFixed(1) }}
                  <span
                    class="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400"
                    >{{ 'hours' | translate }}</span
                  >
                </span>
              </div>

              <div
                class="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-700/60"
              >
                <div>
                  <span
                    class="block text-[10px] font-bold tracking-wide text-amber-600 uppercase dark:text-amber-500"
                    >{{ 'totalOvertime' | translate }}</span
                  >
                  <span
                    class="block text-lg font-bold tracking-tight text-amber-900 dark:text-amber-400"
                  >
                    +{{ statsData().totalOvertime.toFixed(1) }}
                    <span
                      class="text-xs font-semibold text-slate-500 uppercase dark:text-slate-400"
                      >{{ 'hours' | translate }}</span
                    >
                  </span>
                </div>
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400"
                  aria-hidden="true"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <!-- Proportional Distribution: Shifts by Type -->
          @if (statsShiftTitles().length > 0) {
            <div
              class="rounded-2xl border border-slate-100 bg-slate-50/10 p-5 dark:border-slate-700/50 dark:bg-slate-900/10"
            >
              <h4
                class="mb-4 text-sm font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
              >
                {{ 'shiftsByType' | translate }}
              </h4>
              <div class="space-y-4">
                @for (title of statsShiftTitles(); track title) {
                  @let count = statsData().shiftsByTitle[title] ?? 0;
                  @let percentage = (count / statsData().totalShifts) * 100;
                  @let styles = getShiftStylesForTitle(title);
                  <div class="space-y-1.5">
                    <div class="flex items-center justify-between text-sm">
                      <span class="font-bold text-slate-700 dark:text-slate-200">{{ title }}</span>
                      <span
                        class="rounded-full px-2.5 py-0.5 text-xs font-bold {{ styles.labelBg }} {{
                          styles.text
                        }}"
                      >
                        {{ count }}
                        {{ (count === 1 ? 'statsShiftSingular' : 'statsShiftPlural') | translate }}
                        ({{ percentage.toFixed(0) }}%)
                      </span>
                    </div>
                    <!-- Proportional visual bar -->
                    <div
                      class="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700"
                    >
                      <div
                        class="h-full rounded-full transition-all duration-500 ease-out-quint {{
                          styles.bar
                        }}"
                        [style.width.%]="percentage"
                      ></div>
                    </div>
                  </div>
                }
              </div>
            </div>
          }

          <!-- Financial Allowances Portfolio -->
          @if (statsAllowanceNames().length > 0) {
            <div
              class="rounded-2xl border border-slate-100 bg-slate-50/10 p-5 dark:border-slate-700/50 dark:bg-slate-900/10"
            >
              <h4
                class="mb-4 text-sm font-bold tracking-wider text-slate-500 uppercase dark:text-slate-400"
              >
                {{ 'allowancesByType' | translate }}
              </h4>
              <div class="space-y-3">
                @for (name of statsAllowanceNames(); track name) {
                  @let amount = statsData().allowancesByName[name] ?? 0;
                  <div
                    class="flex items-center justify-between rounded-xl border border-slate-100 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/80"
                  >
                    <div class="flex items-center gap-3">
                      <div
                        class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400"
                        aria-hidden="true"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2.5"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M5.25 8.25h15M5.25 15.75h15M10 3.75l-2 16.5M16 3.75l-2 16.5"
                          />
                        </svg>
                      </div>
                      <span class="text-sm font-bold text-slate-700 dark:text-slate-200">{{
                        name
                      }}</span>
                    </div>
                    <span
                      class="rounded-full bg-emerald-50 px-3 py-1 text-sm font-extrabold text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                    >
                      {{ formatAllowanceAmount(amount) }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }
        } @else {
          <!-- High-Fidelity Empty State -->
          <div class="py-16 text-center">
            <div
              class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-50 text-slate-400 dark:bg-slate-900 dark:text-slate-500"
              aria-hidden="true"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <h4 class="text-base font-bold text-slate-700 dark:text-slate-300">
              {{ 'noData' | translate }}
            </h4>
            <p class="mx-auto mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              {{ 'statsNoShiftsDescription' | translate }}
            </p>
          </div>
        }
      </div>

      <!-- Footer -->
      <div
        class="flex shrink-0 items-center justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4 dark:border-slate-700/50 dark:bg-slate-900/40"
      >
        <button
          type="button"
          (click)="closed.emit()"
          class="w-full cursor-pointer rounded-xl bg-slate-200 px-6 py-3 text-sm font-bold text-slate-800 transition-all hover:bg-slate-300 active:scale-95 sm:w-auto dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          {{ 'cancel' | translate }}
        </button>
      </div>
    </div>
  `,
})
export class StatisticsDrawerComponent {
  private readonly datePipe = inject(DatePipe);
  private readonly STATS_DEFAULT_DAYS = 30;

  readonly shifts = input<Shift[]>([]);
  readonly closed = output<void>();

  readonly statsStartDate = signal('');
  readonly statsEndDate = signal('');

  constructor() {
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
  }

  private readonly statsDateRange = computed(() => {
    const start = new Date(this.statsStartDate());
    start.setHours(0, 0, 0, 0);
    const end = new Date(this.statsEndDate());
    end.setHours(23, 59, 59, 999);
    return {
      startTime: start.getTime(),
      endTime: end.getTime(),
    };
  });

  private readonly filteredStatsShifts = computed(() => {
    const { startTime, endTime } = this.statsDateRange();
    return this.shifts().filter(shift => {
      const shiftStart = Date.parse(shift.start);
      return shiftStart >= startTime && shiftStart <= endTime;
    });
  });

  private readonly colorByTitle = computed(() => {
    const map = new Map<string, ShiftColor>();
    for (const shift of this.filteredStatsShifts()) {
      if (!map.has(shift.title)) {
        map.set(shift.title, shift.color);
      }
    }
    return map;
  });

  readonly statsData = computed(() => {
    const shifts = this.filteredStatsShifts();

    if (shifts.length === 0) {
      return {
        totalShifts: 0,
        totalHours: 0,
        totalOvertime: 0,
        shiftsByTitle: {} as Record<string, number>,
        allowancesByName: {} as Record<string, number>,
      };
    }

    const stats = {
      totalShifts: shifts.length,
      totalHours: 0,
      totalOvertime: 0,
      shiftsByTitle: {} as Record<string, number>,
      allowancesByName: {} as Record<string, number>,
    };

    for (const shift of shifts) {
      const hours = (Date.parse(shift.end) - Date.parse(shift.start)) / 3_600_000;
      stats.totalHours += hours;
      stats.totalOvertime += shift.overtimeHours ?? 0;
      stats.shiftsByTitle[shift.title] = (stats.shiftsByTitle[shift.title] ?? 0) + 1;

      if (shift.allowances?.length) {
        for (const { name, amount } of shift.allowances) {
          stats.allowancesByName[name] = (stats.allowancesByName[name] ?? 0) + amount;
        }
      }
    }

    return stats;
  });

  readonly statsShiftTitles = computed(() => Object.keys(this.statsData().shiftsByTitle));
  readonly statsAllowanceNames = computed(() => Object.keys(this.statsData().allowancesByName));

  getShiftColorForTitle(title: string): ShiftColor {
    return this.colorByTitle().get(title) ?? 'indigo';
  }

  getShiftStylesForTitle(title: string) {
    const color = this.getShiftColorForTitle(title);
    return STATS_STYLE_MAP[color] ?? STATS_STYLE_MAP.indigo;
  }

  setStatsPreset(preset: 'thisMonth' | 'lastMonth' | 'last30Days' | 'thisYear'): void {
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

  formatAllowanceAmount(amount: number): string {
    if (!Number.isFinite(amount) || amount <= 0) {
      return '0';
    }
    return String(Math.floor(amount));
  }
}
