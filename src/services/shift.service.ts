
import { Injectable, signal, effect } from '@angular/core';
import { Shift, Repetition } from '../shift.model';

@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly STORAGE_KEY = 'easyturno_shifts';
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
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(shifts));
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
    if (!shiftData.isRecurring || !shiftData.repetition) {
        const id = crypto.randomUUID();
        const newShift: Shift = { ...shiftData, id, seriesId: id };
        this.shifts.update(s => [...s, newShift]);
    } else {
        const seriesId = crypto.randomUUID();
        const repetition = shiftData.repetition;
        let currentStartDate = new Date(shiftData.start);
        const shiftDuration = new Date(shiftData.end).getTime() - currentStartDate.getTime();
        
        // Generate for 2 years
        const twoYearsFromNow = this.addYears(new Date(), 2);

        let count = 0;
        while (currentStartDate < twoYearsFromNow && count < 200) { // Safety break
            const currentEndDate = new Date(currentStartDate.getTime() + shiftDuration);
            const newShift: Shift = {
                ...shiftData,
                id: crypto.randomUUID(),
                seriesId: seriesId,
                start: currentStartDate.toISOString(),
                end: currentEndDate.toISOString(),
            };
            this.shifts.update(s => [...s, newShift]);

            switch (repetition.frequency) {
                case 'days':
                    currentStartDate = this.addDays(currentStartDate, repetition.interval);
                    break;
                case 'weeks':
                    currentStartDate = this.addDays(currentStartDate, repetition.interval * 7);
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
    }
  }

  updateShift(updatedShift: Shift) {
    this.shifts.update(shifts =>
      shifts.map(s => (s.id === updatedShift.id ? updatedShift : s))
    );
  }

  updateShiftSeries(updatedShift: Shift) {
    const seriesId = updatedShift.seriesId;
    this.deleteShiftSeries(seriesId);
    this.addShift({ ...updatedShift });
  }

  deleteShift(id: string) {
    this.shifts.update(shifts => shifts.filter(s => s.id !== id));
  }

  deleteShiftSeries(seriesId: string) {
    this.shifts.update(shifts => shifts.filter(s => s.seriesId !== seriesId));
  }

  importShifts(json: string): boolean {
    try {
      const data = JSON.parse(json) as Shift[];
      if (Array.isArray(data) && data.every(item => 'id' in item && 'title' in item)) {
        this.shifts.set(data);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  }

  deleteAllShifts() {
    this.shifts.set([]);
  }
}
