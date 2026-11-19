import { ChangeDetectionStrategy, Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '../pipes/translate.pipe';

export type SecondaryDialogMode =
  | 'deleteConfirm'
  | 'deleteSeriesConfirm'
  | 'resetConfirm'
  | 'editSeriesConfirm'
  | 'searchDate'
  | 'deleteAccountWarning'
  | 'deleteAccountConfirm'
  | 'decryptionError'
  | 'passwordPrompt';

/**
 * Secondary confirmation, search, account deletion, decryption error, and backup password dialogs.
 */
@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [FormsModule, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (mode()) {
      @case ('searchDate') {
        <div
          class="modal-fade-in w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-slate-800 dark:text-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="searchDateDialogTitle"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <form (ngSubmit)="searchDateSubmit.emit(searchDateInput())">
            <div class="border-b border-slate-200 p-6 dark:border-slate-700">
              <h3 id="searchDateDialogTitle" class="text-2xl font-bold">
                {{ 'searchDate' | translate }}
              </h3>
            </div>
            <div class="space-y-5 p-6">
              <div>
                <label for="search-date-input" class="mb-1 block text-sm font-semibold">{{
                  'searchDate' | translate
                }}</label>
                <input
                  id="search-date-input"
                  type="date"
                  [ngModel]="searchDateInput()"
                  (ngModelChange)="searchDateInput.set($event)"
                  name="searchDate"
                  required
                  class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
            </div>
            <div
              class="flex justify-end space-x-2 rounded-b-2xl bg-slate-50 p-4 dark:bg-slate-900/50"
            >
              <button
                type="button"
                (click)="closed.emit()"
                class="rounded-lg bg-slate-200 px-5 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'cancel' | translate }}
              </button>
              <button
                type="submit"
                class="rounded-lg bg-indigo-600 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                {{ 'search' | translate }}
              </button>
            </div>
          </form>
        </div>
      }
      @case ('deleteAccountWarning') {
        <div
          class="modal-fade-in w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-800 dark:text-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteAccountWarningTitle"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mx-auto h-12 w-12 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 9v3.75m0 3.75h.007M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
            />
          </svg>
          <h3 id="deleteAccountWarningTitle" class="mt-4 text-lg font-semibold">
            {{ 'authDeleteAccountWarningTitle' | translate }}
          </h3>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            {{ 'authDeleteAccountWarningBody' | translate }}
          </p>
          <div class="mt-6 flex flex-col space-y-2">
            <button
              type="button"
              (click)="deleteAccountProceed.emit()"
              class="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-rose-700"
            >
              {{ 'authDeleteAccountProceed' | translate }}
            </button>
            <button
              type="button"
              (click)="closed.emit()"
              class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              {{ 'authDeleteAccountCancel' | translate }}
            </button>
          </div>
        </div>
      }
      @case ('deleteAccountConfirm') {
        <div
          class="modal-fade-in w-full max-w-sm rounded-2xl bg-white shadow-2xl dark:bg-slate-800 dark:text-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteAccountConfirmTitle"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <form
            (ngSubmit)="
              deleteAccountConfirm.emit({
                email: deleteAccountEmailInput(),
                password: deleteAccountPasswordInput(),
              })
            "
          >
            <div class="border-b border-slate-200 p-6 dark:border-slate-700">
              <h3 id="deleteAccountConfirmTitle" class="text-lg font-semibold">
                {{ 'authDeleteAccountConfirmTitle' | translate }}
              </h3>
            </div>
            <div class="space-y-4 p-6">
              <div>
                <label for="delete-account-email" class="mb-1 block text-sm font-semibold">
                  {{ 'authDeleteAccountConfirmEmailLabel' | translate }}
                </label>
                <input
                  id="delete-account-email"
                  type="email"
                  autocomplete="email"
                  [value]="deleteAccountEmailInput()"
                  (input)="deleteAccountEmailInput.set($any($event.target).value)"
                  class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-rose-500 dark:bg-slate-700 dark:text-slate-100"
                />
              </div>
              @if (hasPasswordProvider()) {
                <div>
                  <label for="delete-account-password" class="mb-1 block text-sm font-semibold">
                    {{ 'authDeleteAccountConfirmPasswordLabel' | translate }}
                  </label>
                  <input
                    id="delete-account-password"
                    type="password"
                    autocomplete="current-password"
                    [value]="deleteAccountPasswordInput()"
                    (input)="deleteAccountPasswordInput.set($any($event.target).value)"
                    class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-rose-500 dark:bg-slate-700 dark:text-slate-100"
                  />
                </div>
              }
            </div>
            <div class="flex flex-col space-y-2 rounded-b-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
              <button
                type="submit"
                [disabled]="isDeletingAccount()"
                class="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {{ 'authDeleteAccount' | translate }}
              </button>
              <button
                type="button"
                (click)="closed.emit()"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'authDeleteAccountCancel' | translate }}
              </button>
            </div>
          </form>
        </div>
      }
      @case ('passwordPrompt') {
        <div
          class="modal-fade-in w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800 dark:text-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="passwordPromptTitle"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <h2 id="passwordPromptTitle" class="mb-4 text-lg font-bold">
            {{
              passwordPromptMode() === 'export'
                ? ('backupPasswordPrompt' | translate)
                : ('backupPasswordImportPrompt' | translate)
            }}
          </h2>
          <div class="space-y-3">
            <input
              type="password"
              [value]="passwordInput()"
              (input)="passwordInput.set($any($event.target).value)"
              class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
              [attr.aria-label]="'backupPasswordPrompt' | translate"
              [attr.placeholder]="'backupPasswordPrompt' | translate"
              [attr.minlength]="passwordPromptMode() === 'export' ? 12 : null"
              maxlength="128"
              data-cy="password-input"
              autocomplete="new-password"
            />
            @if (passwordPromptMode() === 'export') {
              <input
                type="password"
                [value]="passwordConfirmInput()"
                (input)="passwordConfirmInput.set($any($event.target).value)"
                class="w-full rounded-lg border-0 bg-slate-100 p-2.5 transition-shadow outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-slate-100"
                [attr.aria-label]="'backupPasswordConfirmPrompt' | translate"
                [attr.placeholder]="'backupPasswordConfirmPrompt' | translate"
                minlength="12"
                maxlength="128"
                data-cy="password-confirm-input"
                autocomplete="new-password"
              />
              <p class="text-xs text-slate-500 dark:text-slate-400">
                {{ 'backupPasswordHint' | translate }}
              </p>
            }
          </div>
          <div class="mt-4 flex space-x-2">
            <button
              type="button"
              (click)="
                passwordSubmit.emit({
                  password: passwordInput(),
                  confirmPassword: passwordConfirmInput(),
                })
              "
              [disabled]="!passwordInput()"
              class="flex-1 rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              data-cy="password-confirm-btn"
            >
              {{ 'save' | translate }}
            </button>
            <button
              type="button"
              (click)="closed.emit()"
              class="flex-1 rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              {{ 'cancel' | translate }}
            </button>
          </div>
        </div>
      }
      @case ('decryptionError') {
        <div
          class="modal-fade-in w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-800 dark:text-slate-200"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="decryptionErrorTitle"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="mx-auto h-12 w-12 text-rose-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
            />
          </svg>
          <h2
            id="decryptionErrorTitle"
            class="mt-4 text-lg font-bold text-rose-600 dark:text-rose-400"
          >
            {{ 'decryptionErrorTitle' | translate }}
          </h2>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {{ 'decryptionErrorMessage' | translate }}
          </p>
          <div class="mt-6 flex flex-col space-y-2">
            <button
              type="button"
              (click)="decryptionReset.emit()"
              class="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-rose-700"
            >
              {{ 'decryptionResetData' | translate }}
            </button>
            <button
              type="button"
              (click)="decryptionKeep.emit()"
              class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              {{ 'decryptionKeepData' | translate }}
            </button>
          </div>
        </div>
      }
      @default {
        <div
          class="modal-fade-in w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-2xl dark:bg-slate-800 dark:text-slate-200"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirmDialogTitle"
          tabindex="-1"
          (click)="$event.stopPropagation()"
        >
          @if (mode() === 'editSeriesConfirm') {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="mx-auto h-12 w-12 text-indigo-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          } @else {
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="mx-auto h-12 w-12 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
              />
            </svg>
          }

          <p id="confirmDialogTitle" class="mt-4 text-lg font-semibold">
            @switch (mode()) {
              @case ('deleteConfirm') {
                {{ 'deleteShiftConfirm' | translate }}
              }
              @case ('deleteSeriesConfirm') {
                {{ 'deleteSeriesConfirm' | translate }}
              }
              @case ('editSeriesConfirm') {
                {{ 'editSeriesConfirm' | translate }}
              }
              @case ('resetConfirm') {
                {{ 'resetConfirm' | translate }}
              }
            }
          </p>

          <div class="mt-6 flex flex-col space-y-2">
            @if (mode() === 'deleteSeriesConfirm') {
              <button
                type="button"
                (click)="confirmDelete.emit(true)"
                class="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-rose-700"
              >
                {{ 'deleteAllFollowing' | translate }}
              </button>
              <button
                type="button"
                (click)="confirmDelete.emit(false)"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'deleteThisOccurrence' | translate }}
              </button>
              <button
                type="button"
                (click)="closed.emit()"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'cancel' | translate }}
              </button>
            } @else if (mode() === 'editSeriesConfirm') {
              <button
                type="button"
                (click)="confirmEditSeries.emit(true)"
                class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-indigo-700"
              >
                {{ 'editAllFollowing' | translate }}
              </button>
              <button
                type="button"
                (click)="confirmEditSeries.emit(false)"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'editThisOccurrence' | translate }}
              </button>
              <button
                type="button"
                (click)="closed.emit()"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'cancel' | translate }}
              </button>
            } @else if (mode() === 'deleteConfirm') {
              <button
                type="button"
                (click)="confirmDelete.emit(false)"
                class="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-rose-700"
              >
                {{ 'delete' | translate }}
              </button>
              <button
                type="button"
                (click)="closed.emit()"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'cancel' | translate }}
              </button>
            } @else if (mode() === 'resetConfirm') {
              <button
                type="button"
                (click)="confirmReset.emit()"
                class="w-full rounded-lg bg-rose-600 px-4 py-2.5 font-semibold text-white transition-colors hover:bg-rose-700"
              >
                {{ 'resetAllData' | translate }}
              </button>
              <button
                type="button"
                (click)="closed.emit()"
                class="w-full rounded-lg bg-slate-200 px-4 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
              >
                {{ 'cancel' | translate }}
              </button>
            }
          </div>
        </div>
      }
    }
  `,
})
export class ConfirmDialogComponent {
  readonly mode = input.required<SecondaryDialogMode>();
  readonly passwordPromptMode = input<'export' | 'import'>('export');
  readonly hasPasswordProvider = input(false);
  readonly isDeletingAccount = input(false);
  readonly initialSearchDate = input('');

  readonly confirmDelete = output<boolean>();
  readonly confirmEditSeries = output<boolean>();
  readonly confirmReset = output<void>();
  readonly searchDateSubmit = output<string>();
  readonly deleteAccountProceed = output<void>();
  readonly deleteAccountConfirm = output<{ email: string; password: string }>();
  readonly decryptionReset = output<void>();
  readonly decryptionKeep = output<void>();
  readonly passwordSubmit = output<{ password: string; confirmPassword: string }>();
  readonly closed = output<void>();

  readonly searchDateInput = signal('');
  readonly deleteAccountEmailInput = signal('');
  readonly deleteAccountPasswordInput = signal('');
  readonly passwordInput = signal('');
  readonly passwordConfirmInput = signal('');

  constructor() {
    effect(() => {
      const currentMode = this.mode();
      const searchDefault = this.initialSearchDate();
      if (currentMode === 'searchDate') {
        this.searchDateInput.set(searchDefault);
      } else if (currentMode === 'deleteAccountConfirm') {
        this.deleteAccountEmailInput.set('');
        this.deleteAccountPasswordInput.set('');
      } else if (currentMode === 'passwordPrompt') {
        this.passwordInput.set('');
        this.passwordConfirmInput.set('');
      }
    });
  }
}
