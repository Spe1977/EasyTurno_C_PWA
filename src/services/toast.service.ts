import { Injectable, OnDestroy, signal } from '@angular/core';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  duration?: number;
}

@Injectable({ providedIn: 'root' })
export class ToastService implements OnDestroy {
  toasts = signal<Toast[]>([]);
  private timeoutIds = new Map<string, ReturnType<typeof setTimeout>>();

  show(message: string, type: Toast['type'] = 'info', duration = 3000) {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type, duration };

    this.toasts.update(toasts => [...toasts, toast]);

    if (duration > 0) {
      const tid = setTimeout(() => this.dismiss(id), duration);
      this.timeoutIds.set(id, tid);
    }
  }

  success(message: string, duration = 3000) {
    this.show(message, 'success', duration);
  }

  error(message: string, duration = 4000) {
    this.show(message, 'error', duration);
  }

  warning(message: string, duration = 3500) {
    this.show(message, 'warning', duration);
  }

  info(message: string, duration = 3000) {
    this.show(message, 'info', duration);
  }

  dismiss(id: string) {
    const tid = this.timeoutIds.get(id);
    if (tid !== undefined) {
      clearTimeout(tid);
      this.timeoutIds.delete(id);
    }
    this.toasts.update(toasts => toasts.filter(t => t.id !== id));
  }

  dismissAll() {
    this.timeoutIds.forEach(tid => clearTimeout(tid));
    this.timeoutIds.clear();
    this.toasts.set([]);
  }

  ngOnDestroy(): void {
    this.dismissAll();
  }
}
