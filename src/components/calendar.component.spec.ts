import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { CalendarComponent } from './calendar.component';
import { CalendarService } from '../services/calendar.service';
import { TranslationService } from '../services/translation.service';
import { Shift } from '../shift.model';

describe('CalendarComponent', () => {
  let component: CalendarComponent;
  let fixture: ComponentFixture<CalendarComponent>;
  let calendarService: CalendarService;
  let translationService: TranslationService;

  const mockShifts: Shift[] = [
    {
      id: '1',
      title: 'Morning Shift',
      start: '2025-01-15T09:00:00',
      end: '2025-01-15T17:00:00',
      color: '#3B82F6',
    },
    {
      id: '2',
      title: 'Evening Shift',
      start: '2025-01-15T17:00:00',
      end: '2025-01-16T01:00:00',
      color: '#10B981',
    },
    {
      id: '3',
      title: 'Day Shift',
      start: '2025-01-20T08:00:00',
      end: '2025-01-20T16:00:00',
      color: '#F59E0B',
    },
  ];

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CalendarComponent],
      providers: [CalendarService, TranslationService],
    }).compileComponents();

    fixture = TestBed.createComponent(CalendarComponent);
    component = fixture.componentInstance;
    calendarService = TestBed.inject(CalendarService);
    translationService = TestBed.inject(TranslationService);
    translationService.setLanguage('it');
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  describe('Initialization', () => {
    it('should initialize with empty shifts array', () => {
      expect(component.shifts()).toEqual([]);
    });

    it('should initialize selectedDate as null', () => {
      expect(component.selectedDate()).toBeNull();
    });

    it('should have weekday names', () => {
      expect(component.weekdayNames()).toBeDefined();
      expect(component.weekdayNames().length).toBe(7);
    });

    it('should have month name computed signal', () => {
      expect(component.monthName()).toBeDefined();
      expect(typeof component.monthName()).toBe('string');
    });
  });

  describe('Navigation', () => {
    it('should navigate to previous month', () => {
      const initialMonth = calendarService.currentMonth();

      component.previousMonth();

      const newMonth = calendarService.currentMonth();
      expect(newMonth).not.toBe(initialMonth);
    });

    it('should navigate to next month', () => {
      const initialMonth = calendarService.currentMonth();

      component.nextMonth();

      const newMonth = calendarService.currentMonth();
      expect(newMonth).not.toBe(initialMonth);
    });

    it('should navigate to today', () => {
      // Navigate away first
      calendarService.nextMonth();
      calendarService.nextMonth();

      component.goToToday();

      const now = new Date();
      expect(calendarService.currentYear()).toBe(now.getFullYear());
      expect(calendarService.currentMonth()).toBe(now.getMonth());
    });

    it('should clear selection when navigating to previous month', () => {
      component.selectedDate.set(new Date(2025, 0, 15));
      expect(component.selectedDate()).not.toBeNull();

      component.previousMonth();

      expect(component.selectedDate()).toBeNull();
    });

    it('should clear selection when navigating to next month', () => {
      component.selectedDate.set(new Date(2025, 0, 15));
      expect(component.selectedDate()).not.toBeNull();

      component.nextMonth();

      expect(component.selectedDate()).toBeNull();
    });

    it('should clear selection when navigating to today', () => {
      component.selectedDate.set(new Date(2025, 0, 15));
      expect(component.selectedDate()).not.toBeNull();

      component.goToToday();

      expect(component.selectedDate()).toBeNull();
    });
  });

  describe('Day Selection', () => {
    it('should select a day when clicked', () => {
      const testDate = new Date(2025, 0, 15);
      let emittedDate: Date | null = null;

      component.daySelected.subscribe(date => {
        emittedDate = date;
      });

      component.onDayClick(testDate);

      expect(component.selectedDate()).toEqual(testDate);
      expect(emittedDate).toEqual(testDate);
    });

    it('should deselect day when same day is clicked again', () => {
      const testDate = new Date(2025, 0, 15);
      let emittedDate: Date | null = testDate;

      component.daySelected.subscribe(date => {
        emittedDate = date;
      });

      // First click - select
      component.onDayClick(testDate);
      expect(component.selectedDate()).toEqual(testDate);

      // Second click - deselect
      component.onDayClick(testDate);
      expect(component.selectedDate()).toBeNull();
      expect(emittedDate).toBeNull();
    });

    it('should switch selection when different day is clicked', () => {
      const firstDate = new Date(2025, 0, 15);
      const secondDate = new Date(2025, 0, 20);

      component.onDayClick(firstDate);
      expect(component.selectedDate()).toEqual(firstDate);

      component.onDayClick(secondDate);
      expect(component.selectedDate()).toEqual(secondDate);
    });

    it('should clear selection', () => {
      const testDate = new Date(2025, 0, 15);
      let emittedDate: Date | null = testDate;

      component.daySelected.subscribe(date => {
        emittedDate = date;
      });

      component.selectedDate.set(testDate);
      component.clearSelection();

      expect(component.selectedDate()).toBeNull();
      expect(emittedDate).toBeNull();
    });

    it('should correctly identify selected day', () => {
      const testDate = new Date(2025, 0, 15);
      const otherDate = new Date(2025, 0, 20);

      component.selectedDate.set(testDate);

      expect(component.isSelectedDay(testDate)).toBe(true);
      expect(component.isSelectedDay(otherDate)).toBe(false);
    });

    it('should return false for isSelectedDay when no day is selected', () => {
      const testDate = new Date(2025, 0, 15);
      component.selectedDate.set(null);

      expect(component.isSelectedDay(testDate)).toBe(false);
    });
  });

  describe('Shift Mapping', () => {
    beforeEach(() => {
      fixture.componentRef.setInput('shifts', mockShifts);
    });

    it('should get shifts for a specific day', () => {
      const testDate = new Date(2025, 0, 15);
      const shifts = component.getShiftsForDay(testDate);

      expect(shifts.length).toBe(2);
      expect(shifts[0].title).toBe('Morning Shift');
      expect(shifts[1].title).toBe('Evening Shift');
    });

    it('should return empty array for day with no shifts', () => {
      const testDate = new Date(2025, 0, 10);
      const shifts = component.getShiftsForDay(testDate);

      expect(shifts.length).toBe(0);
    });

    it('should filter shifts by ISO date string', () => {
      const testDate = new Date(2025, 0, 20);
      const shifts = component.getShiftsForDay(testDate);

      expect(shifts.length).toBe(1);
      expect(shifts[0].title).toBe('Day Shift');
    });

    it('should include overnight shifts on the following local day', () => {
      const nextDay = new Date(2025, 0, 16);
      const shifts = component.getShiftsForDay(nextDay);

      expect(shifts.length).toBe(1);
      expect(shifts[0].title).toBe('Evening Shift');
    });

    it('should update selectedDayShifts computed signal', () => {
      const testDate = new Date(2025, 0, 15);
      component.selectedDate.set(testDate);

      const selectedShifts = component.selectedDayShifts();

      expect(selectedShifts.length).toBe(2);
      expect(selectedShifts[0].title).toBe('Morning Shift');
    });

    it('should return empty array from selectedDayShifts when no day selected', () => {
      component.selectedDate.set(null);

      const selectedShifts = component.selectedDayShifts();

      expect(selectedShifts.length).toBe(0);
    });

    it('should map semantic shift colors to visible indicator colors', () => {
      const indicatorColor = component.getShiftIndicatorColor({
        id: '4',
        seriesId: '4',
        title: 'Color Test',
        start: '2025-01-20T09:00:00',
        end: '2025-01-20T17:00:00',
        color: 'indigo',
        isRecurring: false,
      });

      expect(indicatorColor).toBe('#6366F1');
    });
  });

  describe('Date Formatting', () => {
    it('should format selected date in Italian locale', () => {
      const testDate = new Date(2025, 0, 15);
      component.selectedDate.set(testDate);

      const formatted = component.formatSelectedDate();

      expect(formatted).toBeTruthy();
      expect(formatted.toLowerCase()).toContain('gennaio');
      expect(formatted).toContain('2025');
    });

    it('should return empty string when no date is selected', () => {
      component.selectedDate.set(null);

      const formatted = component.formatSelectedDate();

      expect(formatted).toBe('');
    });
  });

  describe('Touch Gesture Handling', () => {
    let mockTouchEvent: Partial<TouchEvent>;

    beforeEach(() => {
      mockTouchEvent = {
        changedTouches: [
          {
            screenX: 0,
            screenY: 0,
          } as Touch,
        ],
      };
    });

    it('should capture touch start position', () => {
      mockTouchEvent.changedTouches![0].screenX = 100;
      mockTouchEvent.changedTouches![0].screenY = 200;

      component.onTouchStart(mockTouchEvent as TouchEvent);

      expect(component['touchStartX']).toBe(100);
      expect(component['touchStartY']).toBe(200);
      expect(component['hasMoved']).toBe(false);
    });

    it('should detect horizontal movement in touchMove', () => {
      // Start touch
      mockTouchEvent.changedTouches![0].screenX = 100;
      mockTouchEvent.changedTouches![0].screenY = 200;
      component.onTouchStart(mockTouchEvent as TouchEvent);

      // Move horizontally (more than MOVEMENT_THRESHOLD)
      mockTouchEvent.changedTouches![0].screenX = 80;
      mockTouchEvent.changedTouches![0].screenY = 202;
      component.onTouchMove(mockTouchEvent as TouchEvent);

      expect(component['hasMoved']).toBe(true);
      expect(component['touchEndX']).toBe(80);
    });

    it('should not trigger navigation on tap without movement', () => {
      const initialMonth = calendarService.currentMonth();

      // Simulate tap (no movement)
      component['touchStartX'] = 100;
      component['touchEndX'] = 100;
      component['hasMoved'] = false;

      component.onTouchEnd();

      // Month should stay the same
      expect(calendarService.currentMonth()).toBe(initialMonth);
    });

    it('should trigger next month on left swipe with movement', () => {
      const initialMonth = calendarService.currentMonth();

      // Simulate swipe left (start at 150, end at 50 = diff of 100)
      component['touchStartX'] = 150;
      component['touchEndX'] = 50;
      component['hasMoved'] = true;

      component.onTouchEnd();

      // Month should advance
      expect(calendarService.currentMonth()).not.toBe(initialMonth);
    });

    it('should trigger previous month on right swipe with movement', () => {
      const initialMonth = calendarService.currentMonth();

      // Simulate swipe right (start at 50, end at 150 = diff of -100)
      component['touchStartX'] = 50;
      component['touchEndX'] = 150;
      component['hasMoved'] = true;

      component.onTouchEnd();

      // Month should go back
      expect(calendarService.currentMonth()).not.toBe(initialMonth);
    });

    it('should not trigger navigation on small horizontal movement', () => {
      const initialMonth = calendarService.currentMonth();

      // Start touch
      mockTouchEvent.changedTouches![0].screenX = 100;
      mockTouchEvent.changedTouches![0].screenY = 200;
      component.onTouchStart(mockTouchEvent as TouchEvent);

      // Small horizontal movement (less than MOVEMENT_THRESHOLD)
      mockTouchEvent.changedTouches![0].screenX = 105;
      mockTouchEvent.changedTouches![0].screenY = 200;
      component.onTouchMove(mockTouchEvent as TouchEvent);

      component.onTouchEnd();

      // Month should stay the same
      expect(calendarService.currentMonth()).toBe(initialMonth);
      expect(component['hasMoved']).toBe(false);
    });

    it('should not trigger navigation on vertical scroll', () => {
      const initialMonth = calendarService.currentMonth();

      // Start touch
      mockTouchEvent.changedTouches![0].screenX = 100;
      mockTouchEvent.changedTouches![0].screenY = 200;
      component.onTouchStart(mockTouchEvent as TouchEvent);

      // Vertical movement (more vertical than horizontal)
      mockTouchEvent.changedTouches![0].screenX = 105;
      mockTouchEvent.changedTouches![0].screenY = 250;
      component.onTouchMove(mockTouchEvent as TouchEvent);

      component.onTouchEnd();

      // Month should stay the same (vertical scroll, not horizontal swipe)
      expect(calendarService.currentMonth()).toBe(initialMonth);
      expect(component['hasMoved']).toBe(false);
    });

    it('should reset touch state after touch end', () => {
      component['touchStartX'] = 100;
      component['touchEndX'] = 50;
      component['touchStartY'] = 200;
      component['hasMoved'] = true;

      component.onTouchEnd();

      expect(component['touchStartX']).toBe(0);
      expect(component['touchEndX']).toBe(0);
      expect(component['touchStartY']).toBe(0);
      expect(component['hasMoved']).toBe(false);
    });

    it('should handle missing touch event gracefully', () => {
      const emptyTouchEvent = {
        changedTouches: [],
      } as unknown as TouchEvent;

      expect(() => {
        component.onTouchStart(emptyTouchEvent);
        component.onTouchMove(emptyTouchEvent);
      }).not.toThrow();

      expect(component['touchStartX']).toBe(0);
      expect(component['touchEndX']).toBe(0);
    });
  });

  describe('Integration with CalendarService', () => {
    it('should use calendar service for day calculations', () => {
      const days = calendarService.calendarDays();
      expect(days.length).toBe(42);
    });

    it('should use calendar service for same day comparison', () => {
      const date1 = new Date(2025, 0, 15);
      const date2 = new Date(2025, 0, 15);

      expect(calendarService.isSameDay(date1, date2)).toBe(true);
    });

    it('should use calendar service for ISO date conversion', () => {
      const date = new Date(2025, 0, 15);
      const isoString = calendarService.toISODateString(date);

      expect(isoString).toBe('2025-01-15');
    });
  });

  describe('Edge Cases', () => {
    it('should handle shifts with multiple days', () => {
      const multiDayShift: Shift = {
        id: '4',
        title: 'Night Shift',
        start: '2025-01-15T22:00:00',
        end: '2025-01-16T06:00:00',
        color: '#8B5CF6',
      };

      fixture.componentRef.setInput('shifts', [multiDayShift]);

      const shiftsDay15 = component.getShiftsForDay(new Date(2025, 0, 15));
      const shiftsDay16 = component.getShiftsForDay(new Date(2025, 0, 16));

      // Shift should appear on each local day it overlaps
      expect(shiftsDay15.length).toBe(1);
      expect(shiftsDay16.length).toBe(1);
    });

    it('should handle empty shifts array', () => {
      fixture.componentRef.setInput('shifts', []);

      const shifts = component.getShiftsForDay(new Date(2025, 0, 15));

      expect(shifts.length).toBe(0);
    });

    it('should handle shift with different color', () => {
      const coloredShift: Shift = {
        id: '5',
        title: 'Special Shift',
        start: '2025-01-15T09:00:00',
        end: '2025-01-15T17:00:00',
        color: '#EF4444',
      };

      fixture.componentRef.setInput('shifts', [coloredShift]);

      const shifts = component.getShiftsForDay(new Date(2025, 0, 15));

      expect(shifts[0].color).toBe('#EF4444');
    });

    it('should handle dates with time components', () => {
      const dateWithTime = new Date(2025, 0, 15, 14, 30, 45);
      const shifts = component.getShiftsForDay(dateWithTime);

      // Should still match shifts on that day regardless of time
      expect(shifts).toBeDefined();
    });
  });

  describe('Output Events', () => {
    it('should emit daySelected event when day is clicked', done => {
      const testDate = new Date(2025, 0, 15);

      component.daySelected.subscribe(date => {
        expect(date).toEqual(testDate);
        done();
      });

      component.onDayClick(testDate);
    });

    it('should emit null when selection is cleared', done => {
      component.selectedDate.set(new Date(2025, 0, 15));

      component.daySelected.subscribe(date => {
        expect(date).toBeNull();
        done();
      });

      component.clearSelection();
    });

    it('should emit shiftClicked event when shift is clicked', done => {
      const testShift = mockShifts[0];

      component.shiftClicked.subscribe(shift => {
        expect(shift).toEqual(testShift);
        done();
      });

      component.onShiftClick(testShift);
    });
  });

  describe('Shift Time Formatting', () => {
    it('should format shift time for same day', () => {
      const shift: Shift = {
        id: '1',
        title: 'Test',
        start: '2025-01-15T09:00:00',
        end: '2025-01-15T17:00:00',
        color: '#3B82F6',
      };

      const formatted = component.formatShiftTime(shift);

      expect(formatted).toContain('09:00');
      expect(formatted).toContain('17:00');
      expect(formatted).toContain('-');
      expect(formatted).not.toContain('gen'); // Should not contain date
    });

    it('should format shift time for multi-day shift', () => {
      const shift: Shift = {
        id: '1',
        title: 'Test',
        start: '2025-01-15T22:00:00',
        end: '2025-01-16T06:00:00',
        color: '#3B82F6',
      };

      const formatted = component.formatShiftTime(shift);

      expect(formatted).toContain('22:00');
      expect(formatted).toContain('06:00');
      expect(formatted).toContain('-');
      expect(formatted).toContain('gen'); // Should contain end date (January = gen in Italian)
    });

    it('should handle shifts with different times', () => {
      const shift: Shift = {
        id: '1',
        title: 'Test',
        start: '2025-01-15T08:30:00',
        end: '2025-01-15T16:45:00',
        color: '#3B82F6',
      };

      const formatted = component.formatShiftTime(shift);

      expect(formatted).toContain('08:30');
      expect(formatted).toContain('16:45');
    });
  });

  describe('Computed Signals', () => {
    it('should reactively update selectedDayShifts when selectedDate changes', () => {
      fixture.componentRef.setInput('shifts', mockShifts);

      component.selectedDate.set(new Date(2025, 0, 15));
      expect(component.selectedDayShifts().length).toBe(2);

      component.selectedDate.set(new Date(2025, 0, 20));
      expect(component.selectedDayShifts().length).toBe(1);

      component.selectedDate.set(null);
      expect(component.selectedDayShifts().length).toBe(0);
    });

    it('should reactively update monthName when month changes', () => {
      calendarService.goToDate(2025, 0); // January
      const januaryName = component.monthName();

      calendarService.goToDate(2025, 1); // February
      fixture.detectChanges();
      const februaryName = component.monthName();

      expect(januaryName).not.toBe(februaryName);
    });
  });
});
