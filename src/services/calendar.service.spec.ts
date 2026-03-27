import { TestBed } from '@angular/core/testing';
import { CalendarService } from './calendar.service';

describe('CalendarService', () => {
  let service: CalendarService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CalendarService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('Initial state', () => {
    it('should initialize with current date', () => {
      const now = new Date();
      expect(service.currentYear()).toBe(now.getFullYear());
      expect(service.currentMonth()).toBe(now.getMonth());
    });

    it('should generate 42 calendar days (6 weeks)', () => {
      const days = service.calendarDays();
      expect(days.length).toBe(42);
    });
  });

  describe('Navigation', () => {
    it('should navigate to previous month', () => {
      const initialMonth = service.currentMonth();
      const initialYear = service.currentYear();

      service.previousMonth();

      if (initialMonth === 0) {
        // January -> December of previous year
        expect(service.currentMonth()).toBe(11);
        expect(service.currentYear()).toBe(initialYear - 1);
      } else {
        expect(service.currentMonth()).toBe(initialMonth - 1);
        expect(service.currentYear()).toBe(initialYear);
      }
    });

    it('should navigate to next month', () => {
      const initialMonth = service.currentMonth();
      const initialYear = service.currentYear();

      service.nextMonth();

      if (initialMonth === 11) {
        // December -> January of next year
        expect(service.currentMonth()).toBe(0);
        expect(service.currentYear()).toBe(initialYear + 1);
      } else {
        expect(service.currentMonth()).toBe(initialMonth + 1);
        expect(service.currentYear()).toBe(initialYear);
      }
    });

    it('should navigate to today', () => {
      // Navigate away from today
      service.nextMonth();
      service.nextMonth();

      // Navigate back to today
      service.goToToday();

      const now = new Date();
      expect(service.currentYear()).toBe(now.getFullYear());
      expect(service.currentMonth()).toBe(now.getMonth());
    });

    it('should navigate to specific date', () => {
      service.goToDate(2025, 5); // June 2025

      expect(service.currentYear()).toBe(2025);
      expect(service.currentMonth()).toBe(5);
    });
  });

  describe('Calendar grid generation', () => {
    it('should mark current month days correctly', () => {
      service.goToDate(2025, 0); // January 2025
      const days = service.calendarDays();

      const currentMonthDays = days.filter(d => d.isCurrentMonth);

      // January 2025 has 31 days
      expect(currentMonthDays.length).toBe(31);
      expect(currentMonthDays[0].dayNumber).toBe(1);
      expect(currentMonthDays[30].dayNumber).toBe(31);
    });

    it('should include days from previous month', () => {
      service.goToDate(2025, 0); // January 2025 (starts on Wednesday)
      const days = service.calendarDays();

      // First day should be from previous month (December 2024)
      const firstDay = days[0];
      expect(firstDay.isCurrentMonth).toBe(false);
    });

    it('should include days from next month', () => {
      service.goToDate(2025, 0); // January 2025
      const days = service.calendarDays();

      // Last day should be from next month (February 2025)
      const lastDay = days[41];
      expect(lastDay.isCurrentMonth).toBe(false);
    });

    it('should mark today correctly', () => {
      service.goToToday();
      const days = service.calendarDays();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const todayInCalendar = days.find(d => d.isToday);
      expect(todayInCalendar).toBeDefined();
      expect(todayInCalendar!.dayNumber).toBe(today.getDate());
    });

    it('should not mark any day as today when viewing different month', () => {
      service.goToDate(2030, 5); // Far future
      const days = service.calendarDays();

      const todayInCalendar = days.find(d => d.isToday);
      expect(todayInCalendar).toBeUndefined();
    });
  });

  describe('Week starts on Monday', () => {
    it('should start week on Monday for January 2025', () => {
      service.goToDate(2025, 0); // January 2025 (1st is Wednesday)
      const days = service.calendarDays();

      // First day should be Monday before Jan 1
      // January 1, 2025 is Wednesday, so we need 2 days from previous month
      const firstDay = days[0];
      expect(firstDay.isCurrentMonth).toBe(false);
      expect(firstDay.dayNumber).toBe(30); // Dec 30, 2024 (Monday)
    });
  });

  describe('Utility methods', () => {
    it('should get Italian weekday names', () => {
      const weekdays = service.getWeekdayNames('it-IT');

      expect(weekdays.length).toBe(7);
      expect(weekdays[0].toLowerCase()).toContain('lun'); // Monday
      expect(weekdays[6].toLowerCase()).toContain('dom'); // Sunday
    });

    it('should get English weekday names', () => {
      const weekdays = service.getWeekdayNames('en-US');

      expect(weekdays.length).toBe(7);
      expect(weekdays[0].toLowerCase()).toContain('mon');
      expect(weekdays[6].toLowerCase()).toContain('sun');
    });

    it('should get month name in Italian', () => {
      const monthName = service.getMonthName(0, 'it-IT');
      expect(monthName.toLowerCase()).toContain('gennaio');
    });

    it('should get month name in English', () => {
      const monthName = service.getMonthName(0, 'en-US');
      expect(monthName.toLowerCase()).toContain('january');
    });

    it('should check if two dates are the same day', () => {
      const date1 = new Date(2025, 5, 15, 10, 30);
      const date2 = new Date(2025, 5, 15, 18, 45);
      const date3 = new Date(2025, 5, 16, 10, 30);

      expect(service.isSameDay(date1, date2)).toBe(true);
      expect(service.isSameDay(date1, date3)).toBe(false);
    });

    it('should format date to ISO string', () => {
      const date = new Date(2025, 5, 15); // June 15, 2025
      const isoString = service.toISODateString(date);

      expect(isoString).toBe('2025-06-15');
    });

    it('should format single-digit dates with leading zero', () => {
      const date = new Date(2025, 0, 5); // January 5, 2025
      const isoString = service.toISODateString(date);

      expect(isoString).toBe('2025-01-05');
    });
  });

  describe('Edge cases', () => {
    it('should handle year transitions correctly', () => {
      service.goToDate(2025, 0); // January 2025
      service.previousMonth();

      expect(service.currentYear()).toBe(2024);
      expect(service.currentMonth()).toBe(11); // December
    });

    it('should handle leap years correctly', () => {
      service.goToDate(2024, 1); // February 2024 (leap year)
      const days = service.calendarDays();

      const febDays = days.filter(d => d.isCurrentMonth);
      expect(febDays.length).toBe(29); // 29 days in Feb 2024
    });

    it('should handle non-leap years correctly', () => {
      service.goToDate(2025, 1); // February 2025 (non-leap year)
      const days = service.calendarDays();

      const febDays = days.filter(d => d.isCurrentMonth);
      expect(febDays.length).toBe(28); // 28 days in Feb 2025
    });
  });

  describe('Signal reactivity', () => {
    it('should update calendarDays when month changes', () => {
      service.goToDate(2025, 0); // January
      const januaryDays = service.calendarDays();

      service.nextMonth(); // February
      const februaryDays = service.calendarDays();

      expect(januaryDays).not.toEqual(februaryDays);
    });

    it('should maintain computed signal reactivity', () => {
      const initialYear = service.currentYear();
      const initialMonth = service.currentMonth();

      service.nextMonth();

      const newYear = service.currentYear();
      const newMonth = service.currentMonth();

      // At least one should change
      expect(newYear !== initialYear || newMonth !== initialMonth).toBe(true);
    });
  });
});
