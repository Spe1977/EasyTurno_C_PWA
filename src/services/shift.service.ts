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
  private readonly MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;
  private readonly DAYS_PER_WEEK = 7;
  private readonly storageReady = signal(false);
  private latestSaveRequestId = 0;

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
      if (!this.storageReady()) {
        return;
      }

      this.saveShiftsToStorage(this.shifts());
    });
  }

  private loadShiftsFromStorage() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    if (!data) {
      // Nothing stored yet — allow saves immediately
      this.isLoaded = true;
      this.shifts.set([]);
      this.storageReady.set(true);
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
          this.storageReady.set(true);
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
      this.storageReady.set(true);
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
      const saveRequestId = ++this.latestSaveRequestId;

      // Encrypt data before storing
      this.cryptoService
        .encrypt(data)
        .then(encrypted => {
          if (saveRequestId !== this.latestSaveRequestId) {
            return;
          }

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
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  private advanceDate(date: Date, repetition: Repetition): Date {
    switch (repetition.frequency) {
      case 'days':
        return this.addDays(date, repetition.interval);
      case 'weeks':
        return this.addDays(date, repetition.interval * this.DAYS_PER_WEEK);
      case 'months':
        return this.addMonths(date, repetition.interval);
      case 'years':
        return this.addYears(date, repetition.interval);
    }
  }

  private generateRecurringInstances(
    baseShift: Omit<Shift, 'id'>,
    seriesId: string,
    repetition: Repetition
  ): Shift[] {
    let currentStartDate = new Date(baseShift.start);
    const shiftDuration = new Date(baseShift.end).getTime() - currentStartDate.getTime();
    const maxDateAhead = this.addYears(currentStartDate, this.MAX_YEARS_AHEAD);

    const generatedShifts: Shift[] = [];
    let count = 0;
    while (currentStartDate < maxDateAhead && count < this.MAX_RECURRING_INSTANCES) {
      const currentEndDate = new Date(currentStartDate.getTime() + shiftDuration);
      generatedShifts.push({
        ...baseShift,
        id: crypto.randomUUID(),
        seriesId,
        start: currentStartDate.toISOString(),
        end: currentEndDate.toISOString(),
      });
      currentStartDate = this.advanceDate(currentStartDate, repetition);
      count++;
    }
    return generatedShifts;
  }

  addShift(shiftData: Omit<Shift, 'id' | 'seriesId'> & { repetition?: Repetition }) {
    const settings = this.notificationService.getSettings();

    if (!shiftData.isRecurring || !shiftData.repetition) {
      const id = crypto.randomUUID();
      const newShift: Shift = { ...shiftData, id, seriesId: id };
      this.shifts.update(s => [...s, newShift]);

      void this.notificationService.scheduleShiftNotification(newShift, settings);
    } else {
      const seriesId = crypto.randomUUID();
      const generatedShifts = this.generateRecurringInstances(
        { ...shiftData, seriesId },
        seriesId,
        shiftData.repetition
      );

      this.shifts.update(s => [...s, ...generatedShifts]);

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

    // Find the original shift being edited to get its start date
    const originalShift = this.shifts().find(s => s.id === updatedShift.id);
    if (!originalShift) {
      // If we can't find the original shift, fallback to deleting entire series
      this.deleteShiftSeries(seriesId);
      this.addShift({ ...updatedShift });
      return;
    }

    const originalStartTime = new Date(originalShift.start).getTime();

    // Split the series into three parts:
    // 1. Keep: shifts BEFORE the edited shift (start < originalStartTime)
    // 2. Delete: the edited shift and all AFTER (start >= originalStartTime)
    // 3. Generate new: from updatedShift onwards

    const allShifts = this.shifts();
    const seriesShifts = allShifts.filter(s => s.seriesId === seriesId);

    // Keep shifts that occur before the edited shift
    const shiftsToKeep = seriesShifts.filter(s => new Date(s.start).getTime() < originalStartTime);

    // Shifts to delete (edited shift and all after it)
    const shiftsToDelete = seriesShifts.filter(
      s => new Date(s.start).getTime() >= originalStartTime
    );

    // Cancel notifications for deleted shifts
    shiftsToDelete.forEach(
      shift => void this.notificationService.cancelShiftNotifications(shift.id)
    );

    // Update shifts: remove the series and add back the kept shifts
    this.shifts.update(shifts => {
      // Remove all shifts from this series
      const withoutSeries = shifts.filter(s => s.seriesId !== seriesId);
      // Add back the shifts we want to keep (before the edited shift)
      return [...withoutSeries, ...shiftsToKeep];
    });

    // Generate new series from the updated shift onwards
    if (!updatedShift.isRecurring || !updatedShift.repetition) {
      const newShift: Shift = { ...updatedShift, id: crypto.randomUUID(), seriesId };
      this.shifts.update(s => [...s, newShift]);

      const settings = this.notificationService.getSettings();
      void this.notificationService.scheduleShiftNotification(newShift, settings);
    } else {
      const generatedShifts = this.generateRecurringInstances(
        { ...updatedShift, seriesId },
        seriesId,
        updatedShift.repetition
      );

      this.shifts.update(s => [...s, ...generatedShifts]);

      const settings = this.notificationService.getSettings();
      const upcomingShifts = generatedShifts.slice(0, this.MAX_NOTIFICATION_PREVIEW);
      upcomingShifts.forEach(
        shift => void this.notificationService.scheduleShiftNotification(shift, settings)
      );
    }
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
      if (new Blob([json]).size > this.MAX_IMPORT_SIZE_BYTES) {
        return { success: false, error: 'Backup file too large' };
      }

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

    if (
      !(
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
      )
    ) {
      return false;
    }

    // Validate end is not before start
    return new Date(obj.end as string).getTime() >= new Date(obj.start as string).getTime();
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
