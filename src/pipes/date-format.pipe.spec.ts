import { TestBed } from '@angular/core/testing';
import { DatePipe } from '@angular/common';
import { LangDatePipe } from './date-format.pipe';
import { TranslationService } from '../services/translation.service';

describe('LangDatePipe', () => {
  let pipe: LangDatePipe;
  let translationService: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LangDatePipe, TranslationService, DatePipe],
    });

    pipe = TestBed.inject(LangDatePipe);
    translationService = TestBed.inject(TranslationService);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform with Italian locale', () => {
    beforeEach(() => {
      translationService.setLanguage('it');
    });

    it('should format date as shortDate in Italian format', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'shortDate');
      expect(result).toBe('30/09/2025');
    });

    it('should format date as mediumDate in Italian format', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'mediumDate');
      expect(result).toBe('30/09/2025');
    });

    it('should format date as dayNumber', () => {
      const date = new Date('2025-09-15T10:30:00');
      const result = pipe.transform(date, 'dayNumber');
      expect(result).toBe('15');
    });

    it('should format date as time', () => {
      const date = new Date('2025-09-30T14:45:00');
      const result = pipe.transform(date, 'time');
      expect(result).toBe('14:45');
    });

    it('should format date as shortMonthName', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'shortMonthName');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format date as shortDayName', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'shortDayName');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should format date as shortMonthAndYear (T13)', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'shortMonthAndYear');
      expect(result).toMatch(/^[\p{L}.]+\s\d{2}$/u);
      expect(result).toContain('25');
    });
  });

  describe('transform with English locale', () => {
    beforeEach(() => {
      translationService.setLanguage('en');
    });

    it('should format date as shortDate in English format', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'shortDate');
      expect(result).toBe('09/30/2025');
    });

    it('should format date as mediumDate in English format', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'mediumDate');
      expect(result).toBe('2025-09-30');
    });

    it('should format date as time', () => {
      const date = new Date('2025-09-30T14:45:00');
      const result = pipe.transform(date, 'time');
      expect(result).toBe('14:45');
    });

    it('should format date as shortMonthAndYear in English (T13)', () => {
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date, 'shortMonthAndYear');
      expect(result).toBe('Sep 25');
    });
  });

  describe('input handling', () => {
    beforeEach(() => {
      translationService.setLanguage('en');
    });

    it('should handle ISO string input', () => {
      const isoString = '2025-09-30T10:30:00';
      const result = pipe.transform(isoString, 'shortDate');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle timestamp number input', () => {
      const timestamp = new Date('2025-09-30T10:30:00').getTime();
      const result = pipe.transform(timestamp, 'shortDate');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle null input', () => {
      const result = pipe.transform(null);
      expect(result).toBeNull();
    });

    it('should handle undefined input', () => {
      const result = pipe.transform(undefined);
      expect(result).toBeNull();
    });
  });

  describe('default format', () => {
    it('should use mediumDate format by default in Italian', () => {
      translationService.setLanguage('it');
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date);
      expect(result).toBe('30/09/2025');
    });

    it('should use mediumDate format by default in English', () => {
      translationService.setLanguage('en');
      const date = new Date('2025-09-30T10:30:00');
      const result = pipe.transform(date);
      expect(result).toBe('2025-09-30');
    });
  });

  describe('language switching', () => {
    it('should update format when language changes', () => {
      const date = new Date('2025-09-30T10:30:00');

      translationService.setLanguage('it');
      const italianResult = pipe.transform(date, 'shortDate');
      expect(italianResult).toBe('30/09/2025');

      translationService.setLanguage('en');
      const englishResult = pipe.transform(date, 'shortDate');
      expect(englishResult).toBe('09/30/2025');
    });
  });

  describe('Step 5.3: memoization', () => {
    it('memoizes repeated calls with identical value, format, and language', () => {
      const datePipe = TestBed.inject(DatePipe);
      const transformSpy = jest.spyOn(datePipe, 'transform');
      translationService.setLanguage('it');

      const iso = '2025-09-30T10:30:00';
      expect(pipe.transform(iso, 'shortDate')).toBe('30/09/2025');
      expect(pipe.transform(iso, 'shortDate')).toBe('30/09/2025');
      expect(pipe.transform(iso, 'shortDate')).toBe('30/09/2025');

      expect(transformSpy).toHaveBeenCalledTimes(1);
    });

    it('invalidates memoization when a Date instance is mutated, format changes, or language changes', () => {
      const datePipe = TestBed.inject(DatePipe);
      const transformSpy = jest.spyOn(datePipe, 'transform');
      translationService.setLanguage('it');

      const date = new Date('2025-09-10T10:30:00');
      expect(pipe.transform(date, 'shortDate')).toBe('10/09/2025');

      date.setDate(11);
      expect(pipe.transform(date, 'shortDate')).toBe('11/09/2025');

      expect(pipe.transform(date, 'time')).toBe('10:30');

      translationService.setLanguage('en');
      expect(pipe.transform(date, 'shortDate')).toBe('09/11/2025');

      expect(transformSpy).toHaveBeenCalledTimes(4);
    });

    it('shares formatted output across pipe instances bound to the same DatePipe injector', () => {
      const datePipe = TestBed.inject(DatePipe);
      const transformSpy = jest.spyOn(datePipe, 'transform');
      translationService.setLanguage('en');

      const secondPipe = TestBed.runInInjectionContext(() => new LangDatePipe());
      expect(pipe.transform('2025-09-30T14:45:00', 'time')).toBe('14:45');
      expect(secondPipe.transform('2025-09-30T14:45:00', 'time')).toBe('14:45');

      expect(transformSpy).toHaveBeenCalledTimes(1);
    });

    it('handles invalid Date instances, cache eviction past 1000 entries, and fallback when language signal is absent', () => {
      const datePipe = TestBed.inject(DatePipe);
      expect(() => pipe.transform(new Date('invalid-date'), 'shortDate')).toThrow();

      // Exceed MAX_SHARED_DATE_CACHE_ENTRIES (1000) to verify bounded eviction
      const baseMs = Date.UTC(2025, 0, 1);
      for (let i = 0; i < 1005; i += 1) {
        expect(pipe.transform(baseMs + i * 86_400_000, 'dayNumber')).toBeTruthy();
      }

      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          LangDatePipe,
          DatePipe,
          { provide: TranslationService, useValue: { translate: (k: string) => k } },
        ],
      });
      const fallbackPipe = TestBed.inject(LangDatePipe);
      expect(fallbackPipe.transform('2025-09-30T10:30:00', 'shortDate')).toBe('09/30/2025');
      expect(datePipe).toBeTruthy();
    });
  });
});
