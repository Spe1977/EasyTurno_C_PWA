import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';

import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { TranslationService } from '../services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';

@Component({
  selector: 'app-email-verification-screen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="flex min-h-[100dvh] flex-col bg-slate-100 px-4 py-8 dark:bg-slate-900">
      <div class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <div class="rounded-2xl bg-white p-6 shadow-md dark:bg-slate-800">
          <div
            class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-400"
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="1.5"
              stroke="currentColor"
              class="h-7 w-7"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75"
              />
            </svg>
          </div>
          <h1 class="mb-2 text-center text-xl font-semibold text-slate-900 dark:text-slate-50">
            {{ 'authVerificationTitle' | translate }}
          </h1>
          <p class="mb-6 text-center text-sm text-slate-600 dark:text-slate-400">
            {{ bodyMessage() }}
          </p>

          <button
            type="button"
            (click)="handleVerified()"
            [disabled]="checking()"
            class="mb-2 flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            @if (checking()) {
              <svg
                class="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
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
                  d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z"
                ></path>
              </svg>
            }
            {{ 'authVerificationCheck' | translate }}
          </button>

          <button
            type="button"
            (click)="handleResend()"
            [disabled]="resending() || cooldownRemaining() > 0"
            class="flex w-full items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600"
          >
            @if (cooldownRemaining() > 0) {
              {{ 'authVerificationResend' | translate }} ({{ cooldownRemaining() }}s)
            } @else {
              {{ 'authVerificationResend' | translate }}
            }
          </button>

          <div class="mt-6 border-t border-slate-200 pt-4 text-center dark:border-slate-700">
            <button
              type="button"
              (click)="handleSignOut()"
              class="text-sm text-slate-500 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
            >
              {{ 'authLogout' | translate }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
})
export class EmailVerificationScreenComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  readonly checking = signal(false);
  readonly resending = signal(false);
  readonly cooldownRemaining = signal(0);
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  private readonly email = computed(() => this.auth.state().email ?? '');

  bodyMessage(): string {
    const template = this.translation.translate('authVerificationBody');
    return template.replace('{email}', this.email());
  }

  async handleVerified(): Promise<void> {
    if (this.checking()) return;
    this.checking.set(true);
    try {
      await this.auth.refreshUser();
      if (this.auth.state().mode === 'email-not-verified') {
        this.toast.info(this.translation.translate('authVerificationStillPending'));
      }
    } catch {
      this.toast.error(this.translation.translate('authGenericError'));
    } finally {
      this.checking.set(false);
    }
  }

  async handleResend(): Promise<void> {
    if (this.resending() || this.cooldownRemaining() > 0) return;
    this.resending.set(true);
    try {
      const sent = await this.auth.resendVerificationEmail();
      if (sent) {
        this.toast.success(this.translation.translate('authVerificationResent'));
        this.startCooldown(60);
      } else {
        this.toast.info(this.translation.translate('authVerificationCooldown'));
      }
    } catch {
      this.toast.error(this.translation.translate('authGenericError'));
    } finally {
      this.resending.set(false);
    }
  }

  async handleSignOut(): Promise<void> {
    try {
      await this.auth.signOut();
    } catch {
      this.toast.error(this.translation.translate('authGenericError'));
    }
  }

  private startCooldown(seconds: number): void {
    this.cooldownRemaining.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const remaining = this.cooldownRemaining() - 1;
      if (remaining <= 0) {
        this.cooldownRemaining.set(0);
        if (this.cooldownTimer) {
          clearInterval(this.cooldownTimer);
          this.cooldownTimer = null;
        }
      } else {
        this.cooldownRemaining.set(remaining);
      }
    }, 1000);
  }
}
