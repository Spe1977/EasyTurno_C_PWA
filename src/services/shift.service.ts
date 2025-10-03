import { Injectable, signal, effect, inject } from '@angular/core';
import { Shift, Repetition } from '../shift.model';
import { ToastService } from './toast.service';
import { NotificationService } from './notification.service';

@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly STORAGE_KEY = 'easyturno_shifts';
  private readonly MAX_RECURRING_INSTANCES = 200;
  private readonly MAX_YEARS_AHEAD = 2;
  private readonly MAX_NOTIFICATION_PREVIEW = 10;
  private readonly DAYS_PER_WEEK = 7;

  private toastService = inject(ToastService);
  private notificationService = inject(NotificationService);
  shifts = signal<Shift[]>([]);

  constructor() {
    this.loadShiftsFromStorage();
    effect(() => {
      this.saveShiftsToStorage(this.shifts());
    });
  }

  private loadShiftsFromStorage() {
    const data = localStorage.getItem(this.STORAGE_KEY);
    this.shifts.set(data ? JSON.parse(data) : []);
  }

  private saveShiftsToStorage(shifts: Shift[]) {
    try {
      const data = JSON.stringify(shifts);
      localStorage.setItem(this.STORAGE_KEY, data);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.error('LocalStorage quota exceeded. Cannot save shifts.');
        this.toastService.error(
          'Storage limit reached. Please export and remove old shifts to free up space.',
          5000
        );
      } else {
        console.error('Failed to save shifts to localStorage:', error);
        this.toastService.error('Failed to save shifts. Please try again.', 4000);
      }
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
          case 'year':
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
