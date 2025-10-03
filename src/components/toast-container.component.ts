import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../services/toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="fixed right-4 top-4 z-50 max-w-md space-y-2"
      role="region"
      aria-live="polite"
      aria-label="Notifications"
    >
      @for (toast of toastService.toasts(); track toast.id) {
        <div
          class="animate-slide-in flex min-w-[300px] items-start gap-3 rounded-lg border-l-4 bg-white p-4 shadow-lg dark:bg-slate-800"
          [class.border-green-500]="toast.type === 'success'"
          [class.border-red-500]="toast.type === 'error'"
          [class.border-amber-500]="toast.type === 'warning'"
          [class.border-blue-500]="toast.type === 'info'"
          role="alert"
          [attr.aria-labelledby]="'toast-' + toast.id"
        >
          <!-- Icon -->
          <div class="mt-0.5 flex-shrink-0">
            @if (toast.type === 'success') {
              <svg
                class="h-5 w-5 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                ></path>
              </svg>
            }
            @if (toast.type === 'error') {
              <svg
                class="h-5 w-5 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M6 18L18 6M6 6l12 12"
                ></path>
              </svg>
            }
            @if (toast.type === 'warning') {
              <svg
                class="h-5 w-5 text-amber-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                ></path>
              </svg>
            }
            @if (toast.type === 'info') {
              <svg
                class="h-5 w-5 text-blue-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                ></path>
              </svg>
            }
          </div>

          <!-- Message -->
          <div class="flex-1">
            <p
              [id]="'toast-' + toast.id"
              class="text-sm font-medium text-slate-900 dark:text-slate-100"
            >
              {{ toast.message }}
            </p>
          </div>

          <!-- Close button -->
          <button
            (click)="toastService.dismiss(toast.id)"
            class="flex-shrink-0 text-slate-400 transition-colors hover:text-slate-600 dark:hover:text-slate-300"
            [attr.aria-label]="'Close notification'"
            type="button"
          >
            <svg
              class="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              ></path>
            </svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: [
    `
      @keyframes slide-in {
        from {
          transform: translateX(100%);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }

      .animate-slide-in {
        animation: slide-in 0.3s ease-out;
      }
    `,
  ],
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}
