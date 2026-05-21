import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FirebaseError } from 'firebase/app';

import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { TranslationService } from '../services/translation.service';
import { TranslatePipe } from '../pipes/translate.pipe';

type ViewMode = 'login' | 'register' | 'forgot';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 8;
const UPPERCASE_RE = /[A-Z]/;
const LOWERCASE_RE = /[a-z]/;
const NUMBER_RE = /\d/;
const SPECIAL_RE = /[^A-Za-z0-9]/;

@Component({
  selector: 'app-auth-screen',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  template: `
    <div class="flex min-h-[100dvh] flex-col bg-slate-100 px-4 py-8 dark:bg-slate-900">
      <div class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center">
        <header class="mb-8 text-center">
          <div
            class="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg"
            aria-hidden="true"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              class="h-8 w-8"
            >
              <path
                d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5"
                stroke="currentColor"
                stroke-width="1.5"
                fill="none"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
          </div>
          <h1 class="text-2xl font-bold text-slate-900 dark:text-slate-50">EasyTurno</h1>
          <p class="mt-2 text-sm text-slate-600 dark:text-slate-400">
            @switch (view()) {
              @case ('login') {
                {{ 'authLoginTitle' | translate }}
              }
              @case ('register') {
                {{ 'authRegisterTitle' | translate }}
              }
              @case ('forgot') {
                {{ 'authForgotTitle' | translate }}
              }
            }
          </p>
        </header>

        <form
          (submit)="handleSubmit($event)"
          class="space-y-4 rounded-2xl bg-white p-6 shadow-md dark:bg-slate-800"
          novalidate
        >
          @if (view() === 'register') {
            <div>
              <label
                for="auth-name"
                class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {{ 'authDisplayName' | translate }}
              </label>
              <input
                id="auth-name"
                type="text"
                autocomplete="name"
                [value]="displayName()"
                (input)="displayName.set($any($event.target).value)"
                class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              />
            </div>
          }

          <div>
            <label
              for="auth-email"
              class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
            >
              {{ 'authEmail' | translate }}
            </label>
            <input
              id="auth-email"
              type="email"
              autocomplete="email"
              required
              [value]="email()"
              (input)="email.set($any($event.target).value)"
              class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
              [attr.aria-invalid]="fieldError() === 'email' ? 'true' : null"
            />
            @if (fieldError() === 'email') {
              <p class="mt-1 text-xs text-rose-600 dark:text-rose-400">
                {{ 'authEmailInvalid' | translate }}
              </p>
            }
          </div>

          @if (view() !== 'forgot') {
            <div>
              <div class="mb-1 flex items-center justify-between">
                <label
                  for="auth-password"
                  class="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  {{ 'authPassword' | translate }}
                </label>
                @if (view() === 'register') {
                  <button
                    type="button"
                    (click)="togglePasswordHelp()"
                    [attr.aria-label]="'authPasswordRequirements' | translate"
                    [attr.aria-expanded]="showPasswordHelp()"
                    aria-controls="auth-password-help"
                    class="flex h-5 w-5 items-center justify-center rounded-full border border-slate-300 text-xs font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  >
                    ?
                  </button>
                }
              </div>
              <div class="relative">
                <input
                  id="auth-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  [attr.autocomplete]="view() === 'register' ? 'new-password' : 'current-password'"
                  required
                  [value]="password()"
                  (focus)="showRegistrationPasswordHelp()"
                  (input)="handlePasswordInput($any($event.target).value)"
                  class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  [attr.aria-invalid]="fieldError() === 'password' ? 'true' : null"
                />
                <button
                  type="button"
                  (click)="toggleShowPassword()"
                  [attr.aria-label]="
                    (showPassword() ? 'authPasswordHide' : 'authPasswordShow') | translate
                  "
                  class="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  tabindex="-1"
                >
                  @if (showPassword()) {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  } @else {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  }
                </button>
              </div>

              @if (view() === 'register' && showPasswordHelp()) {
                <div
                  id="auth-password-help"
                  class="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-700 dark:bg-slate-900/40"
                  role="region"
                  [attr.aria-label]="'authPasswordRequirements' | translate"
                >
                  <p class="mb-1.5 font-semibold text-slate-700 dark:text-slate-300">
                    {{ 'authPasswordRequirements' | translate }}
                  </p>
                  <ul class="space-y-1">
                    <li class="flex items-start gap-1.5">
                      <span
                        class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                        [class.text-green-600]="passwordHasMinLength()"
                        [class.dark:text-green-400]="passwordHasMinLength()"
                        [class.text-slate-400]="!passwordHasMinLength()"
                        [class.dark:text-slate-500]="!passwordHasMinLength()"
                        aria-hidden="true"
                      >
                        @if (passwordHasMinLength()) {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-8.25 8.25a.75.75 0 0 1-1.072-.012L3.29 10.31a.75.75 0 1 1 1.08-1.04l3.484 3.62 7.785-7.594a.75.75 0 0 1 1.065-.006Z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        } @else {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <circle cx="10" cy="10" r="3" />
                          </svg>
                        }
                      </span>
                      <span
                        [class.text-slate-700]="passwordHasMinLength()"
                        [class.dark:text-slate-200]="passwordHasMinLength()"
                        [class.text-slate-500]="!passwordHasMinLength()"
                        [class.dark:text-slate-400]="!passwordHasMinLength()"
                      >
                        {{ 'authPasswordReqLength' | translate }}
                      </span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span
                        class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                        [class.text-green-600]="passwordHasUppercase()"
                        [class.dark:text-green-400]="passwordHasUppercase()"
                        [class.text-slate-400]="!passwordHasUppercase()"
                        [class.dark:text-slate-500]="!passwordHasUppercase()"
                        aria-hidden="true"
                      >
                        @if (passwordHasUppercase()) {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-8.25 8.25a.75.75 0 0 1-1.072-.012L3.29 10.31a.75.75 0 1 1 1.08-1.04l3.484 3.62 7.785-7.594a.75.75 0 0 1 1.065-.006Z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        } @else {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <circle cx="10" cy="10" r="3" />
                          </svg>
                        }
                      </span>
                      <span
                        [class.text-slate-700]="passwordHasUppercase()"
                        [class.dark:text-slate-200]="passwordHasUppercase()"
                        [class.text-slate-500]="!passwordHasUppercase()"
                        [class.dark:text-slate-400]="!passwordHasUppercase()"
                      >
                        {{ 'authPasswordReqUppercase' | translate }}
                      </span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span
                        class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                        [class.text-green-600]="passwordHasLowercase()"
                        [class.dark:text-green-400]="passwordHasLowercase()"
                        [class.text-slate-400]="!passwordHasLowercase()"
                        [class.dark:text-slate-500]="!passwordHasLowercase()"
                        aria-hidden="true"
                      >
                        @if (passwordHasLowercase()) {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-8.25 8.25a.75.75 0 0 1-1.072-.012L3.29 10.31a.75.75 0 1 1 1.08-1.04l3.484 3.62 7.785-7.594a.75.75 0 0 1 1.065-.006Z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        } @else {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <circle cx="10" cy="10" r="3" />
                          </svg>
                        }
                      </span>
                      <span
                        [class.text-slate-700]="passwordHasLowercase()"
                        [class.dark:text-slate-200]="passwordHasLowercase()"
                        [class.text-slate-500]="!passwordHasLowercase()"
                        [class.dark:text-slate-400]="!passwordHasLowercase()"
                      >
                        {{ 'authPasswordReqLowercase' | translate }}
                      </span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span
                        class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                        [class.text-green-600]="passwordHasNumber()"
                        [class.dark:text-green-400]="passwordHasNumber()"
                        [class.text-slate-400]="!passwordHasNumber()"
                        [class.dark:text-slate-500]="!passwordHasNumber()"
                        aria-hidden="true"
                      >
                        @if (passwordHasNumber()) {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-8.25 8.25a.75.75 0 0 1-1.072-.012L3.29 10.31a.75.75 0 1 1 1.08-1.04l3.484 3.62 7.785-7.594a.75.75 0 0 1 1.065-.006Z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        } @else {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <circle cx="10" cy="10" r="3" />
                          </svg>
                        }
                      </span>
                      <span
                        [class.text-slate-700]="passwordHasNumber()"
                        [class.dark:text-slate-200]="passwordHasNumber()"
                        [class.text-slate-500]="!passwordHasNumber()"
                        [class.dark:text-slate-400]="!passwordHasNumber()"
                      >
                        {{ 'authPasswordReqNumber' | translate }}
                      </span>
                    </li>
                    <li class="flex items-start gap-1.5">
                      <span
                        class="mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center"
                        [class.text-green-600]="passwordHasSpecial()"
                        [class.dark:text-green-400]="passwordHasSpecial()"
                        [class.text-slate-400]="!passwordHasSpecial()"
                        [class.dark:text-slate-500]="!passwordHasSpecial()"
                        aria-hidden="true"
                      >
                        @if (passwordHasSpecial()) {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <path
                              fill-rule="evenodd"
                              d="M16.704 5.29a.75.75 0 0 1 .006 1.06l-8.25 8.25a.75.75 0 0 1-1.072-.012L3.29 10.31a.75.75 0 1 1 1.08-1.04l3.484 3.62 7.785-7.594a.75.75 0 0 1 1.065-.006Z"
                              clip-rule="evenodd"
                            />
                          </svg>
                        } @else {
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                            class="h-4 w-4"
                          >
                            <circle cx="10" cy="10" r="3" />
                          </svg>
                        }
                      </span>
                      <span
                        [class.text-slate-700]="passwordHasSpecial()"
                        [class.dark:text-slate-200]="passwordHasSpecial()"
                        [class.text-slate-500]="!passwordHasSpecial()"
                        [class.dark:text-slate-400]="!passwordHasSpecial()"
                      >
                        {{ 'authPasswordReqSpecial' | translate }}
                      </span>
                    </li>
                  </ul>
                </div>
              }

              @if (fieldError() === 'password') {
                <p class="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {{ 'authPasswordInvalid' | translate }}
                </p>
              }
            </div>
          }

          @if (view() === 'register') {
            <div>
              <label
                for="auth-password-confirm"
                class="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                {{ 'authConfirmPassword' | translate }}
              </label>
              <div class="relative">
                <input
                  id="auth-password-confirm"
                  [type]="showPasswordConfirm() ? 'text' : 'password'"
                  autocomplete="new-password"
                  required
                  [value]="passwordConfirm()"
                  (input)="passwordConfirm.set($any($event.target).value)"
                  class="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 pr-10 text-slate-900 shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
                  [attr.aria-invalid]="fieldError() === 'passwordConfirm' ? 'true' : null"
                />
                <button
                  type="button"
                  (click)="toggleShowPasswordConfirm()"
                  [attr.aria-label]="
                    (showPasswordConfirm() ? 'authPasswordHide' : 'authPasswordShow') | translate
                  "
                  class="absolute inset-y-0 right-0 flex items-center justify-center px-3 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                  tabindex="-1"
                >
                  @if (showPasswordConfirm()) {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88"
                      />
                    </svg>
                  } @else {
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke-width="1.5"
                      stroke="currentColor"
                      class="h-5 w-5"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                      />
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  }
                </button>
              </div>
              @if (fieldError() === 'passwordConfirm') {
                <p class="mt-1 text-xs text-rose-600 dark:text-rose-400">
                  {{ 'authPasswordMismatch' | translate }}
                </p>
              }
            </div>
          }

          @if (view() === 'login') {
            <div class="text-right">
              <button
                type="button"
                (click)="switchView('forgot')"
                class="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                {{ 'authForgotLink' | translate }}
              </button>
            </div>
          }

          @if (view() === 'forgot') {
            <p class="text-sm text-slate-600 dark:text-slate-400">
              {{ 'authForgotSubtitle' | translate }}
            </p>
          }

          <button
            type="submit"
            [disabled]="loading()"
            class="flex w-full items-center justify-center rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow transition-colors hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-800"
          >
            @if (loading()) {
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
            @switch (view()) {
              @case ('login') {
                {{ 'authLogin' | translate }}
              }
              @case ('register') {
                {{ 'authRegister' | translate }}
              }
              @case ('forgot') {
                {{ 'authSendReset' | translate }}
              }
            }
          </button>

          @if (view() !== 'forgot') {
            <div class="flex items-center gap-3 pt-2">
              <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
              <span class="text-xs text-slate-500 dark:text-slate-400">
                {{ 'authOr' | translate }}
              </span>
              <div class="h-px flex-1 bg-slate-200 dark:bg-slate-700"></div>
            </div>

            <button
              type="button"
              (click)="handleGoogleLogin()"
              [disabled]="loading()"
              class="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600 dark:focus:ring-offset-slate-800"
            >
              <svg
                class="h-5 w-5"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
                aria-hidden="true"
              >
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.83z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.46 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.83C6.71 7.31 9.14 5.38 12 5.38z"
                  fill="#EA4335"
                />
              </svg>
              {{ 'authContinueWithGoogle' | translate }}
            </button>
          }
        </form>

        <div class="mt-4 text-center text-sm">
          @switch (view()) {
            @case ('login') {
              <span class="text-slate-600 dark:text-slate-400">
                {{ 'authNoAccount' | translate }}
              </span>
              <button
                type="button"
                (click)="switchView('register')"
                class="ml-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {{ 'authRegisterLink' | translate }}
              </button>
            }
            @case ('register') {
              <span class="text-slate-600 dark:text-slate-400">
                {{ 'authHasAccount' | translate }}
              </span>
              <button
                type="button"
                (click)="switchView('login')"
                class="ml-1 font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {{ 'authLoginLink' | translate }}
              </button>
            }
            @case ('forgot') {
              <button
                type="button"
                (click)="switchView('login')"
                class="font-semibold text-indigo-600 hover:underline dark:text-indigo-400"
              >
                {{ 'authBackToLogin' | translate }}
              </button>
            }
          }
        </div>

        <div class="mt-6 border-t border-slate-200 pt-4 text-center dark:border-slate-700">
          <button
            type="button"
            (click)="openGuestConfirm()"
            class="text-sm text-slate-500 hover:text-slate-700 hover:underline dark:text-slate-400 dark:hover:text-slate-200"
          >
            {{ 'authContinueAsGuest' | translate }}
          </button>
        </div>
      </div>

      @if (showGuestConfirm()) {
        <div
          class="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/60 px-4 py-6 sm:items-center"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="guest-confirm-title"
          (click)="closeGuestConfirm()"
        >
          <div
            class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-800"
            (click)="$event.stopPropagation()"
          >
            <h2
              id="guest-confirm-title"
              class="mb-2 text-lg font-semibold text-slate-900 dark:text-slate-50"
            >
              {{ 'authGuestWarningTitle' | translate }}
            </h2>
            <p class="mb-5 text-sm text-slate-600 dark:text-slate-400">
              {{ 'authGuestWarningBody' | translate }}
            </p>
            <div class="flex flex-col gap-2 sm:flex-row-reverse">
              <button
                type="button"
                (click)="confirmGuest()"
                class="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-indigo-700"
              >
                {{ 'authGuestWarningContinue' | translate }}
              </button>
              <button
                type="button"
                (click)="closeGuestConfirm()"
                class="flex-1 rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
              >
                {{ 'authGuestWarningCancel' | translate }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class AuthScreenComponent {
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly translation = inject(TranslationService);

  readonly view = signal<ViewMode>('login');
  readonly email = signal('');
  readonly password = signal('');
  readonly passwordConfirm = signal('');
  readonly displayName = signal('');
  readonly loading = signal(false);
  readonly fieldError = signal<'email' | 'password' | 'passwordConfirm' | null>(null);
  readonly showGuestConfirm = signal(false);
  readonly showPassword = signal(false);
  readonly showPasswordConfirm = signal(false);
  readonly showPasswordHelp = signal(false);

  readonly passwordHasMinLength = computed(() => this.password().length >= MIN_PASSWORD_LENGTH);
  readonly passwordHasUppercase = computed(() => UPPERCASE_RE.test(this.password()));
  readonly passwordHasLowercase = computed(() => LOWERCASE_RE.test(this.password()));
  readonly passwordHasNumber = computed(() => NUMBER_RE.test(this.password()));
  readonly passwordHasSpecial = computed(() => SPECIAL_RE.test(this.password()));
  readonly isPasswordValid = computed(
    () =>
      this.passwordHasMinLength() &&
      this.passwordHasUppercase() &&
      this.passwordHasLowercase() &&
      this.passwordHasNumber() &&
      this.passwordHasSpecial()
  );

  switchView(next: ViewMode): void {
    this.view.set(next);
    this.fieldError.set(null);
    this.password.set('');
    this.passwordConfirm.set('');
    this.showPassword.set(false);
    this.showPasswordConfirm.set(false);
    this.showPasswordHelp.set(false);
  }

  toggleShowPassword(): void {
    this.showPassword.update(v => !v);
  }

  toggleShowPasswordConfirm(): void {
    this.showPasswordConfirm.update(v => !v);
  }

  togglePasswordHelp(): void {
    this.showPasswordHelp.update(v => !v);
  }

  showRegistrationPasswordHelp(): void {
    if (this.view() === 'register') {
      this.showPasswordHelp.set(true);
    }
  }

  handlePasswordInput(value: string): void {
    this.password.set(value);
    this.showRegistrationPasswordHelp();
  }

  async handleSubmit(event: Event): Promise<void> {
    event.preventDefault();
    if (this.loading()) return;
    this.fieldError.set(null);

    const email = this.email().trim();
    if (!EMAIL_RE.test(email)) {
      this.fieldError.set('email');
      return;
    }

    if (this.view() === 'login') {
      if (this.password().length === 0) {
        this.fieldError.set('password');
        return;
      }
    }

    if (this.view() === 'register') {
      if (!this.isPasswordValid()) {
        this.fieldError.set('password');
        // Open the help panel so the user can see which criteria are missing.
        this.showPasswordHelp.set(true);
        return;
      }
      if (this.password() !== this.passwordConfirm()) {
        this.fieldError.set('passwordConfirm');
        return;
      }
    }

    this.loading.set(true);
    try {
      switch (this.view()) {
        case 'login':
          await this.auth.loginEmail(email, this.password());
          break;
        case 'register':
          await this.auth.registerEmail(
            email,
            this.password(),
            this.displayName().trim() || undefined
          );
          this.toast.success(this.t('authRegistrationSuccess'));
          break;
        case 'forgot':
          await this.auth.sendPasswordReset(email);
          this.toast.success(this.t('authResetEmailSent'));
          this.switchView('login');
          break;
      }
    } catch (err) {
      this.handleAuthError(err);
    } finally {
      this.loading.set(false);
    }
  }

  async handleGoogleLogin(): Promise<void> {
    if (this.loading()) return;
    this.loading.set(true);
    try {
      await this.auth.loginGoogle();
    } catch (err) {
      this.handleAuthError(err);
    } finally {
      this.loading.set(false);
    }
  }

  openGuestConfirm(): void {
    this.showGuestConfirm.set(true);
  }

  closeGuestConfirm(): void {
    this.showGuestConfirm.set(false);
  }

  confirmGuest(): void {
    this.showGuestConfirm.set(false);
    this.auth.continueAsGuest();
  }

  private handleAuthError(err: unknown): void {
    const code = err instanceof FirebaseError ? err.code : '';
    // Silent: user closed the Google popup intentionally.
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
      return;
    }
    const key = this.errorCodeToKey(code);
    this.toast.error(this.t(key));
  }

  private errorCodeToKey(code: string): string {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'authErrorInvalidCredentials';
      case 'auth/email-already-in-use':
        return 'authErrorEmailInUse';
      case 'auth/user-not-found':
        return 'authErrorUserNotFound';
      case 'auth/weak-password':
        return 'authErrorWeakPassword';
      case 'auth/too-many-requests':
        return 'authErrorTooManyRequests';
      case 'auth/network-request-failed':
        return 'authErrorNetwork';
      case 'auth/popup-blocked':
        return 'authErrorPopupBlocked';
      default:
        return 'authGenericError';
    }
  }

  private t(key: string): string {
    return this.translation.translate(key);
  }
}
