import { Injectable, signal, effect, inject } from '@angular/core';
import { Shift, Repetition } from '../shift.model';
import { ToastService } from './toast.service';
import { NotificationService } from './notification.service';
import { CryptoService } from './crypto.service';

@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly STORAGE_KEY = 'easyturno_shifts';
  private readonly MAX_RECURRING_INSTANCES = 200;
  private readonly MAX_YEARS_AHEAD = 2;
  private readonly MAX_NOTIFICATION_PREVIEW = 10;
  private readonly DAYS_PER_WEEK = 7;

  private toastService = inject(ToastService);
  private notificationService = inject(NotificationService);
  private cryptoService = inject(CryptoService);
  shifts = signal<Shift[]>([]);

  /**
   * Becomes true only after the initial load from storage completes
   * (either synchronously for legacy data, or after async decryption).
   * Saves are blocked until this flag is set to prevent the effect() from
   * overwriting stored data with an empty array before decryption finishes.
   */
  private isLoaded = false;

  /**
   * Set to true when decryption fails so that the UI can prompt the user
   * to decide whether to reset data or keep the (unreadable) ciphertext.
   */
  decryptionError = signal(false);

  constructor() {
    this.loadShiftsFromStorage();
    effect(() => {
      this.saveShiftsToStorage(this.shifts());
    });
  }

  private loadShiftsFromStorage() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      // Nothing stored yet — allow saves immediately
      this.isLoaded = true;
      this.shifts.set([]);
      return;
    }

    // Check if data is encrypted
    if (this.cryptoService.isEncrypted(data)) {
      // Decrypt data asynchronously
      this.cryptoService
        .decrypt(data)
        .then(decrypted => {
          // Enable saves BEFORE updating the signal so the effect that fires
          // immediately after the signal change is not blocked.
          this.isLoaded = true;
          this.shifts.set(JSON.parse(decrypted));
        })
        .catch(error => {
          console.error('Failed to decrypt shifts:', error);
          // Do NOT clear data automatically — let the user decide.
          // Saves remain blocked (isLoaded stays false) to avoid overwriting
          // the ciphertext with an empty array.
          this.decryptionError.set(true);
        });
    } else {
      // Legacy unencrypted data — load and re-save encrypted
      try {
        const shifts = JSON.parse(data) as Shift[];
        this.isLoaded = true;
        this.shifts.set(shifts);
        // Will be automatically re-saved as encrypted via effect
      } catch (error) {
        console.error('Failed to parse shifts:', error);
        this.isLoaded = true;
        this.shifts.set([]);
      }
    }
  }

  /**
   * Called when the user explicitly confirms they want to reset all data
   * after a decryption failure.
   */
  resetAfterDecryptionError() {
    this.decryptionError.set(false);
    this.isLoaded = true;
    this.shifts.set([]);
  }

  private saveShiftsToStorage(shifts: Shift[]) {
    // Guard: do not save until the initial load has completed to avoid
    // overwriting stored ciphertext with an empty array.
    if (!this.isLoaded) return;

    try {
      const data = JSON.stringify(shifts);

      // Encrypt data before storing
      this.cryptoService
        .encrypt(data)
        .then(encrypted => {
          try {
            localStorage.setItem(this.STORAGE_KEY, encrypted);
          } catch (error) {
            if (error instanceof DOMException && error.name === 'QuotaExceededError') {
              console.error('LocalStorage quota exceeded. Cannot save shifts.');
              this.toastService.error(
                'Storage limit reached. Please export and remove old shifts to free up space.',
                5000
              );
            } else {
              throw error;
            }
          }
        })
        .catch(error => {
          console.error('Failed to encrypt shifts:', error);
          this.toastService.error('Failed to save shifts. Please try again.', 4000);
        });
    } catch (error) {
      console.error('Failed to save shifts to localStorage:', error);
      this.toastService.error('Failed to save shifts. Please try again.', 4000);
    }
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    const originalDay = date.getDate();
    const result = new Date(date);
    // Set day to 1 first to avoid overflow during the month transition
    // (e.g. Jan 31 + 1 month would otherwise become Mar 3 instead of Feb 28)
    result.setDate(1);
    result.setMonth(result.getMonth() + months);
    // Clamp to the last valid day of the target month
    const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate();
    result.setDate(Math.min(originalDay, lastDay));
    return result;
  }

  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  addShift(shiftData: Omit<Shift, 'id' | 'seriesId'> & { repetition?: Repetition }) {
    const settings = this.notificationService.getSettings();

    if (!shiftData.isRecurring || !shiftData.repetition) {
      const id = crypto.randomUUID();
      const newShift: Shift = { ...shiftData, id, seriesId: id };
      this.shifts.update(s => [...s, newShift]);

      // Schedule notification per il nuovo turno
      void this.notificationService.scheduleShiftNotification(newShift, settings);
    } else {
      const seriesId = crypto.randomUUID();
      const repetition = shiftData.repetition;
      let currentStartDate = new Date(shiftData.start);
      const shiftDuration = new Date(shiftData.end).getTime() - currentStartDate.getTime();

      // Generate for configurable years ahead
      const maxDateAhead = this.addYears(new Date(), this.MAX_YEARS_AHEAD);

      const generatedShifts: Shift[] = [];
      let count = 0;
      while (currentStartDate < maxDateAhead && count < this.MAX_RECURRING_INSTANCES) {
        // Safety break
        const currentEndDate = new Date(currentStartDate.getTime() + shiftDuration);
        const newShift: Shift = {
          ...shiftData,
          id: crypto.randomUUID(),
          seriesId: seriesId,
          start: currentStartDate.toISOString(),
          end: currentEndDate.toISOString(),
        };
        generatedShifts.push(newShift);

        switch (repetition.frequency) {
          case 'days':
            currentStartDate = this.addDays(currentStartDate, repetition.interval);
            break;
          case 'weeks':
            currentStartDate = this.addDays(
              currentStartDate,
              repetition.interval * this.DAYS_PER_WEEK
            );
            break;
          case 'months':
            currentStartDate = this.addMonths(currentStartDate, repetition.interval);
            break;
          case 'year': // legacy value — falls through to 'years'
          case 'years':
            currentStartDate = this.addYears(currentStartDate, repetition.interval);
            break;
        }
        count++;
      }

      // Single signal update for all generated shifts
      this.shifts.update(s => [...s, ...generatedShifts]);

      // Per recurring: schedula solo prossimi N turni configurabili
      const upcomingShifts = generatedShifts.slice(0, this.MAX_NOTIFICATION_PREVIEW);
      upcomingShifts.forEach(
        shift => void this.notificationService.scheduleShiftNotification(shift, settings)
      );
    }
  }

  updateShift(updatedShift: Shift) {
    this.shifts.update(shifts => shifts.map(s => (s.id === updatedShift.id ? updatedShift : s)));
  }

  updateShiftSeries(updatedShift: Shift) {
    const seriesId = updatedShift.seriesId;
    this.deleteShiftSeries(seriesId);
    this.addShift({ ...updatedShift });
  }

  deleteShift(id: string) {
    void this.notificationService.cancelShiftNotifications(id);
    this.shifts.update(shifts => shifts.filter(s => s.id !== id));
  }

  deleteShiftSeries(seriesId: string) {
    // Cancella notifiche per tutti i turni della serie
    const seriesShifts = this.shifts().filter(s => s.seriesId === seriesId);
    seriesShifts.forEach(shift => void this.notificationService.cancelShiftNotifications(shift.id));
    this.shifts.update(shifts => shifts.filter(s => s.seriesId !== seriesId));
  }

  importShifts(json: string): { success: boolean; error?: string; imported?: number } {
    try {
      const data = JSON.parse(json);

      if (!Array.isArray(data)) {
        return { success: false, error: 'Invalid format: expected array' };
      }

      const validShifts = data.filter(item => this.isValidShift(item));

      if (validShifts.length === 0) {
        return { success: false, error: 'No valid shifts found' };
      }

      this.shifts.set(validShifts);
      return { success: true, imported: validShifts.length };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, error: 'Failed to parse JSON' };
    }
  }

  private isValidShift(item: unknown): item is Shift {
    if (typeof item !== 'object' || item === null) {
      return false;
    }

    const obj = item as Record<string, unknown>;

    return (
      'id' in obj &&
      typeof obj.id === 'string' &&
      'title' in obj &&
      typeof obj.title === 'string' &&
      'start' in obj &&
      typeof obj.start === 'string' &&
      this.isValidISODate(obj.start) &&
      'end' in obj &&
      typeof obj.end === 'string' &&
      this.isValidISODate(obj.end) &&
      'color' in obj &&
      typeof obj.color === 'string' &&
      'isRecurring' in obj &&
      typeof obj.isRecurring === 'boolean' &&
      'seriesId' in obj &&
      typeof obj.seriesId === 'string'
    );
  }

  private isValidISODate(dateString: unknown): boolean {
    if (typeof dateString !== 'string') {
      return false;
    }
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }

  deleteAllShifts() {
    this.shifts.set([]);
  }
}
