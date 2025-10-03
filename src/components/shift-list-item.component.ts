import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { Shift } from '../shift.model';
import { TranslatePipe } from '../pipes/translate.pipe';
import { LangDatePipe } from '../pipes/date-format.pipe';

@Component({
  selector: 'app-shift-list-item',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe, LangDatePipe],
  template: `
    <div
      class="relative flex items-center space-x-4 overflow-hidden rounded-xl bg-white p-4 shadow-sm transition-shadow duration-300 hover:shadow-md dark:bg-slate-800/50"
    >
      <div
        class="absolute bottom-0 left-0 top-0 w-1.5"
        [class]="'bg-' + shift().color + '-500'"
      ></div>
      <div class="flex w-16 shrink-0 flex-col items-center justify-center">
        <p
          class="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400"
        >
          {{ shift().start | langDate: 'shortDayName' }}
        </p>
        <p class="-my-0.5 text-2xl font-bold text-slate-800 dark:text-slate-100">
          {{ shift().start | langDate: 'dayNumber' }}
        </p>
        <p class="text-sm font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
          {{ shift().start | langDate: 'shortMonthAndYear' }}
        </p>
      </div>
      <div class="min-w-0 flex-grow border-l border-slate-200 pl-4 dark:border-slate-700">
        <p class="truncate text-lg font-bold">{{ shift().title }}</p>
        <p class="truncate text-slate-500 dark:text-slate-400">
          {{ shift().start | langDate: 'time' }} - {{ shift().end | langDate: 'time' }}
        </p>
        @if (shift().notes) {
          <p class="mt-1 truncate text-sm italic text-slate-400 dark:text-slate-500">
            {{ shift().notes }}
          </p>
        }
      </div>
      <div class="flex shrink-0 items-center space-x-1">
        <button
          data-cy="edit-shift-btn"
          (click)="edit.emit(shift())"
          class="rounded-full p-2 transition-colors hover:bg-slate-200 dark:hover:bg-slate-700"
          [title]="'editShift' | translate"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-slate-500 dark:text-slate-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
            />
          </svg>
        </button>
        <button
          data-cy="delete-shift-btn"
          (click)="deleteShift.emit(shift())"
          class="rounded-full p-2 transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/50"
          [title]="'delete' | translate"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-rose-500 dark:text-rose-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </button>
      </div>
    </div>
  `,
})
export class ShiftListItemComponent {
  shift = input.required<Shift>();
  edit = output<Shift>();
  deleteShift = output<Shift>();
}
