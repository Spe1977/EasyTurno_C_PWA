import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { AuthService } from '../services/auth.service';
import { DeviceRecord, DeviceService } from '../services/device.service';
import { ToastService } from '../services/toast.service';
import { TranslationService } from '../services/translation.service';
import { UserDataService } from '../services/user-data.service';
import { TranslatePipe } from '../pipes/translate.pipe';

/**
 * Settings modal drawer managing language, theme, statistics entry, account & devices, and encrypted backups.
 */
@Component({
  selector: 'app-settings-drawer',
  standalone: true,
  imports: [TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="modal-fade-in flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-2xl dark:bg-slate-800 dark:text-slate-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settingsDrawerTitle"
      tabindex="-1"
      (click)="$event.stopPropagation()"
    >
      <div class="shrink-0 border-b border-slate-200 p-6 dark:border-slate-700">
        <h3 id="settingsDrawerTitle" class="text-2xl font-bold">{{ 'settings' | translate }}</h3>
      </div>
      <div class="space-y-6 overflow-y-auto p-6">
        <div class="space-y-2">
          <span id="settings-language-label" class="text-sm font-semibold">{{
            'language' | translate
          }}</span>
          <div
            role="group"
            aria-labelledby="settings-language-label"
            class="flex w-min items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-700"
          >
            <button
              type="button"
              data-cy="lang-it-btn"
              (click)="translationService.setLanguage('it')"
              [attr.aria-pressed]="translationService.language() === 'it'"
              [class.bg-white]="translationService.language() === 'it'"
              [class.dark:bg-slate-900]="translationService.language() === 'it'"
              class="rounded-md px-4 py-1.5 text-sm font-bold transition-colors"
            >
              IT
            </button>
            <button
              type="button"
              data-cy="lang-en-btn"
              (click)="translationService.setLanguage('en')"
              [attr.aria-pressed]="translationService.language() === 'en'"
              [class.bg-white]="translationService.language() === 'en'"
              [class.dark:bg-slate-900]="translationService.language() === 'en'"
              class="rounded-md px-4 py-1.5 text-sm font-bold transition-colors"
            >
              EN
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <span id="settings-theme-label" class="text-sm font-semibold">{{
            'theme' | translate
          }}</span>
          <div
            role="group"
            aria-labelledby="settings-theme-label"
            class="flex w-min items-center rounded-lg bg-slate-100 p-1 dark:bg-slate-700"
          >
            <button
              type="button"
              data-cy="theme-light-btn"
              (click)="themeChange.emit('light')"
              [attr.aria-pressed]="theme() === 'light'"
              [class.bg-white]="theme() === 'light'"
              [class.dark:bg-slate-900]="theme() === 'light'"
              class="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.706-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 14.464A1 1 0 106.465 13.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zM5 11a1 1 0 100-2H4a1 1 0 100 2h1zM4.54 5.46a1 1 0 010-1.414l.707-.707a1 1 0 111.414 1.414l-.707.707a1 1 0 01-1.414 0z"
                  clip-rule="evenodd"
                />
              </svg>
              <span>{{ 'light' | translate }}</span>
            </button>
            <button
              type="button"
              data-cy="theme-dark-btn"
              (click)="themeChange.emit('dark')"
              [attr.aria-pressed]="theme() === 'dark'"
              [class.bg-white]="theme() === 'dark'"
              [class.dark:bg-slate-900]="theme() === 'dark'"
              class="flex items-center space-x-2 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-5 w-5"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
              <span>{{ 'dark' | translate }}</span>
            </button>
          </div>
        </div>

        <div class="space-y-2">
          <h4 class="text-sm font-semibold">{{ 'statistics' | translate }}</h4>
          <button
            type="button"
            data-cy="statistics-btn"
            (click)="openStatistics.emit()"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-indigo-100 py-3 font-semibold text-indigo-800 transition-colors hover:bg-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-200 dark:hover:bg-indigo-900/50"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5"
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
            <span>{{ 'statistics' | translate }}</span>
          </button>
        </div>

        <div class="space-y-2">
          <h4 class="text-sm font-semibold">{{ 'account' | translate }}</h4>
          @if (deviceLimitExceeded()) {
            <div
              class="flex items-start space-x-3 rounded-lg bg-rose-50 p-3 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="mt-0.5 h-5 w-5 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="1.5"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M12 9v3.75m0 3.75h.007M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                />
              </svg>
              <div class="text-xs">
                <p class="font-bold">{{ 'deviceLimitExceededTitle' | translate }}</p>
                <p class="mt-0.5">{{ 'deviceLimitExceededBody' | translate }}</p>
              </div>
            </div>
          }
          @if (authService.isAuthenticated()) {
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ authService.state().email }}
            </p>
          } @else if (authService.isGuest()) {
            <p class="text-sm text-slate-500 dark:text-slate-400">
              {{ 'accountGuestMode' | translate }}
            </p>
          }
          @if (authService.isAuthenticated()) {
            <div
              data-cy="device-list-section"
              class="space-y-2 rounded-lg border border-slate-200 p-3 dark:border-slate-700"
            >
              <div class="flex items-center justify-between">
                <h5 class="text-sm font-semibold">
                  {{ 'devicesSectionTitle' | translate }}
                </h5>
                <span class="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {{ userDataService.installedDeviceCount() }}/3
                </span>
              </div>
              <p class="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {{ 'devicesLimitExplanation' | translate }}
              </p>
              @if (userDataService.webSessionCount() > 0) {
                <p class="text-xs text-slate-500 dark:text-slate-400">
                  {{ 'devicesWebSessionsNote' | translate }}
                  {{ userDataService.webSessionCount() }}
                </p>
              }
              <ul class="space-y-2" data-cy="device-list">
                @for (device of installedDevices(); track device.id) {
                  <li
                    class="flex items-center justify-between gap-2 rounded-md bg-slate-50 p-2 dark:bg-slate-800/50"
                  >
                    <div class="min-w-0">
                      <p class="truncate text-sm font-medium">
                        {{ devicePlatformLabelKey(device.platform) | translate }}
                        @if (device.id === currentDeviceId) {
                          <span class="text-xs font-normal text-indigo-600 dark:text-indigo-300">
                            · {{ 'deviceThisDevice' | translate }}
                          </span>
                        }
                      </p>
                      @if (formatDeviceLastActive(device.lastActive); as lastActive) {
                        <p class="text-xs text-slate-500 dark:text-slate-400">
                          {{ 'deviceLastActive' | translate }}: {{ lastActive }}
                        </p>
                      }
                    </div>
                    @if (devicePendingRemoval() === device.id) {
                      <div class="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          data-cy="device-remove-confirm"
                          (click)="confirmRemoveDevice(device.id)"
                          class="rounded-md bg-rose-600 px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
                        >
                          {{ 'deviceRemoveConfirm' | translate }}
                        </button>
                        <button
                          type="button"
                          (click)="cancelRemoveDevice()"
                          class="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
                        >
                          {{ 'cancel' | translate }}
                        </button>
                      </div>
                    } @else {
                      <button
                        type="button"
                        data-cy="device-remove"
                        (click)="promptRemoveDevice(device.id)"
                        [attr.aria-label]="'deviceRemoveAria' | translate"
                        class="shrink-0 rounded-md p-1.5 text-slate-500 transition-colors hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-300"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke-width="1.5"
                          stroke="currentColor"
                          aria-hidden="true"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0"
                          />
                        </svg>
                      </button>
                    }
                  </li>
                }
              </ul>
            </div>
          }
          <button
            type="button"
            data-cy="auth-exit-btn"
            (click)="authExit.emit()"
            class="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-100 py-3 font-semibold text-slate-800 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            <span>{{ authExitLabelKey() | translate }}</span>
          </button>
          @if (authService.isAuthenticated()) {
            <div class="border-t border-slate-200 pt-3 dark:border-slate-700">
              <button
                data-cy="delete-account-btn"
                type="button"
                (click)="deleteAccountRequested.emit()"
                class="flex w-full items-center justify-center space-x-2 rounded-lg bg-rose-50 py-3 font-semibold text-rose-700 transition-colors hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 dark:hover:bg-rose-950/60"
              >
                <span>{{ 'authDeleteAccount' | translate }}</span>
              </button>
            </div>
          }
        </div>

        <div class="space-y-2">
          <h4 class="text-sm font-semibold">{{ 'backupRestore' | translate }}</h4>
          <div class="space-y-2">
            <button
              type="button"
              data-cy="export-btn"
              (click)="exportRequested.emit()"
              [disabled]="isExporting()"
              class="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-100 py-3 font-semibold text-slate-800 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              @if (isExporting()) {
                <svg
                  class="h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              } @else {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
              }
              <span>{{
                isExporting() ? ('exporting' | translate) : ('exportBackup' | translate)
              }}</span>
            </button>
            <button
              type="button"
              data-cy="import-btn"
              (click)="triggerImport()"
              [disabled]="isImporting()"
              class="flex w-full items-center justify-center space-x-2 rounded-lg bg-slate-100 py-3 font-semibold text-slate-800 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
            >
              @if (isImporting()) {
                <svg
                  class="h-5 w-5 animate-spin"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    class="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    stroke-width="4"
                  ></circle>
                  <path
                    class="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              } @else {
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke-width="1.5"
                  stroke="currentColor"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                  />
                </svg>
              }
              <span>{{
                isImporting() ? ('importing' | translate) : ('importBackup' | translate)
              }}</span>
              <input
                type="file"
                id="importFile"
                class="hidden"
                tabindex="-1"
                aria-hidden="true"
                (change)="importFileSelected.emit($event)"
                accept=".json"
              />
            </button>
          </div>
        </div>

        <div class="border-t border-slate-200 pt-4 dark:border-slate-700">
          <button
            type="button"
            (click)="resetRequested.emit()"
            class="w-full rounded-lg bg-rose-100 py-3 font-semibold text-rose-700 transition-colors hover:bg-rose-200 dark:bg-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-900"
          >
            {{ 'resetAllData' | translate }}
          </button>
        </div>
      </div>
      <div class="flex shrink-0 justify-end rounded-b-2xl bg-slate-50 p-4 dark:bg-slate-900/50">
        <button
          type="button"
          (click)="closed.emit()"
          class="rounded-lg bg-slate-200 px-5 py-2.5 font-semibold text-slate-800 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
        >
          {{ 'cancel' | translate }}
        </button>
      </div>
    </div>
  `,
})
export class SettingsDrawerComponent {
  readonly translationService = inject(TranslationService);
  readonly authService = inject(AuthService);
  readonly userDataService = inject(UserDataService);
  private readonly deviceService = inject(DeviceService);
  private readonly toastService = inject(ToastService);
  private readonly document = inject(DOCUMENT);

  readonly theme = input.required<'light' | 'dark'>();
  readonly isExporting = input(false);
  readonly isImporting = input(false);

  readonly themeChange = output<'light' | 'dark'>();
  readonly openStatistics = output<void>();
  readonly authExit = output<void>();
  readonly deleteAccountRequested = output<void>();
  readonly exportRequested = output<void>();
  readonly importFileSelected = output<Event>();
  readonly resetRequested = output<void>();
  readonly closed = output<void>();

  readonly deviceLimitExceeded = computed(() =>
    this.deviceService.isSoftLimitExceeded(this.userDataService.activeDeviceCount())
  );
  readonly currentDeviceId = this.deviceService.deviceId();
  readonly installedDevices = computed(() =>
    this.userDataService.devices().filter(device => device.platform !== 'web')
  );
  readonly devicePendingRemoval = signal<string | null>(null);
  readonly authExitLabelKey = computed(() =>
    this.authService.isGuest() ? 'authLoginLink' : 'authLogout'
  );

  devicePlatformLabelKey(platform: DeviceRecord['platform']): string {
    switch (platform) {
      case 'native':
        return 'devicePlatformNative';
      case 'pwa-installed':
        return 'devicePlatformInstalled';
      default:
        return 'devicePlatformWeb';
    }
  }

  formatDeviceLastActive(lastActive: number | null): string {
    if (!lastActive) return '';
    return new Date(lastActive).toLocaleDateString(this.translationService.language(), {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  promptRemoveDevice(deviceId: string): void {
    this.devicePendingRemoval.set(deviceId);
  }

  cancelRemoveDevice(): void {
    this.devicePendingRemoval.set(null);
  }

  async confirmRemoveDevice(deviceId: string): Promise<void> {
    await this.userDataService.removeDevice(deviceId);
    this.devicePendingRemoval.set(null);
    this.toastService.success(this.translationService.translate('deviceRemoved'));
  }

  triggerImport(): void {
    this.document.getElementById('importFile')?.click();
  }
}
