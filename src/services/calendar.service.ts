import { Injectable, signal, computed } from '@angular/core';

/**
 * CalendarService - Manages calendar state and date calculations
 *
 * Provides:
 * - Month/year navigation with signals
 * - Day grid generation (6 weeks max)
 * - Week day calculations respecting locale
 * - Date utilities for shift mapping
 */
@Injectable({
  providedIn: 'root',
})
export class CalendarService {
  // Signal-based state
  private readonly currentDateSignal = signal<Date>(new Date());

  // Computed values for reactive UI
  readonly currentYear = computed(() => this.currentDateSignal().getFullYear());
  readonly currentMonth = computed(() => this.currentDateSignal().getMonth());

  /**
   * Get calendar grid for current month
   * Returns array of 6 weeks (42 days) to maintain consistent height
   */
  readonly calendarDays = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    return this.generateCalendarDays(year, month);
  });

  /**
   * Navigate to previous month
   */
  previousMonth(): void {
    this.currentDateSignal.update(date => {
      const newDate = new Date(date);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  }

  /**
   * Navigate to next month
   */
  nextMonth(): void {
    this.currentDateSignal.update(date => {
      const newDate = new Date(date);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  }

  /**
   * Navigate to today
   */
  goToToday(): void {
    this.currentDateSignal.set(new Date());
  }

  /**
   * Navigate to specific month/year
   */
  goToDate(year: number, month: number): void {
    this.currentDateSignal.set(new Date(year, month, 1));
  }

  /**
   * Generate calendar grid (42 days = 6 weeks)
   * Includes days from previous/next months for complete grid
   */
  private generateCalendarDays(
    year: number,
    month: number
  ): Array<{
    date: Date;
    isCurrentMonth: boolean;
    isToday: boolean;
    dayNumber: number;
  }> {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();

    // Get day of week (0 = Sunday, 1 = Monday, etc.)
    // Adjust to start week on Monday (0 = Monday)
    let firstDayOfWeek = firstDay.getDay() - 1;
    if (firstDayOfWeek < 0) firstDayOfWeek = 6; // Sunday becomes 6

    const days: Array<{
      date: Date;
      isCurrentMonth: boolean;
      isToday: boolean;
      dayNumber: number;
    }> = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Add days from previous month
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
      const date = new Date(year, month - 1, prevMonthLastDay - i);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        dayNumber: prevMonthLastDay - i,
      });
    }

    // Add days from current month
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: true,
        isToday: date.getTime() === today.getTime(),
        dayNumber: day,
      });
    }

    // Add days from next month to complete 6 weeks (42 days)
    const remainingDays = 42 - days.length;
    for (let day = 1; day <= remainingDays; day++) {
      const date = new Date(year, month + 1, day);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isCurrentMonth: false,
        isToday: date.getTime() === today.getTime(),
        dayNumber: day,
      });
    }

    return days;
  }

  /**
   * Get weekday names (short format)
   * Returns: ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']
   */
  getWeekdayNames(locale = 'it-IT'): string[] {
    const baseDate = new Date(2025, 0, 6); // Monday, Jan 6, 2025
    const weekdays: string[] = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(baseDate);
      date.setDate(baseDate.getDate() + i);
      weekdays.push(date.toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3));
    }

    return weekdays;
  }

  /**
   * Get month name for display
   */
  getMonthName(month: number, locale = 'it-IT'): string {
    const date = new Date(2025, month, 1);
    return date.toLocaleDateString(locale, { month: 'long' });
  }

  /**
   * Check if two dates are the same day
   */
  isSameDay(date1: Date, date2: Date): boolean {
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  }

  /**
   * Format date to ISO string (YYYY-MM-DD) for shift filtering
   */
  toISODateString(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
