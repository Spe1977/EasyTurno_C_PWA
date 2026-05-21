import { generateOccurrencesForRange } from './occurrence-generator';
import { ManualShift, ShiftOverride, ShiftSeries } from '../shift.model';

const baseSeries: ShiftSeries = {
  id: 'series-1',
  title: 'Morning',
  start: '2026-01-01T08:00:00.000Z',
  end: '2026-01-01T16:00:00.000Z',
  color: 'indigo',
  repetition: { frequency: 'days', interval: 1 },
  timezone: 'Europe/Rome',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('generateOccurrencesForRange', () => {
  it('generates daily series occurrences only inside the requested range', () => {
    const result = generateOccurrencesForRange({
      shiftSeries: [baseSeries],
      manualShifts: [],
      shiftOverrides: [],
      rangeStart: new Date('2026-01-02T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-03T23:59:59.999Z'),
    });

    expect(result.map(shift => shift.start)).toEqual([
      '2026-01-02T08:00:00.000Z',
      '2026-01-03T08:00:00.000Z',
    ]);
    expect(result.every(shift => shift.seriesId === 'series-1')).toBe(true);
  });

  it('generates daily series occurrences for future ranges beyond the iteration cap from series start', () => {
    const longRunningSeries: ShiftSeries = {
      ...baseSeries,
      start: '2020-01-01T08:00:00.000Z',
      end: '2020-01-01T16:00:00.000Z',
    };

    const result = generateOccurrencesForRange({
      shiftSeries: [longRunningSeries],
      manualShifts: [],
      shiftOverrides: [],
      rangeStart: new Date('2026-01-02T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-03T23:59:59.999Z'),
    });

    expect(result.map(shift => shift.start)).toEqual([
      '2026-01-02T08:00:00.000Z',
      '2026-01-03T08:00:00.000Z',
    ]);
  });

  it('includes manual shifts that overlap the range', () => {
    const manual: ManualShift = {
      id: 'manual-1',
      title: 'Manual',
      start: '2026-01-04T22:00:00.000Z',
      end: '2026-01-05T06:00:00.000Z',
      color: 'sky',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const result = generateOccurrencesForRange({
      shiftSeries: [],
      manualShifts: [manual],
      shiftOverrides: [],
      rangeStart: new Date('2026-01-05T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-05T23:59:59.999Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'manual-1', seriesId: 'manual-1', title: 'Manual' });
    expect(result[0]).not.toHaveProperty('createdAt');
    expect(result[0]).not.toHaveProperty('updatedAt');
    expect(result[0]).not.toHaveProperty('deletedAt');
  });

  it('excludes manual shifts that do not overlap the requested range', () => {
    const manual: ManualShift = {
      id: 'manual-outside',
      title: 'Outside',
      start: '2026-01-01T08:00:00.000Z',
      end: '2026-01-01T16:00:00.000Z',
      color: 'sky',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };

    const result = generateOccurrencesForRange({
      shiftSeries: [],
      manualShifts: [manual],
      shiftOverrides: [],
      rangeStart: new Date('2026-01-02T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-02T23:59:59.999Z'),
    });

    expect(result).toEqual([]);
  });

  it('applies modified and deleted overrides to generated occurrences', () => {
    const overrides: ShiftOverride[] = [
      {
        id: 'override-delete',
        seriesId: 'series-1',
        occurrenceStart: '2026-01-02T08:00:00.000Z',
        action: 'deleted',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      {
        id: 'override-modify',
        seriesId: 'series-1',
        occurrenceStart: '2026-01-03T08:00:00.000Z',
        action: 'modified',
        title: 'Changed',
        start: '2026-01-03T10:00:00.000Z',
        end: '2026-01-03T18:00:00.000Z',
        color: 'rose',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = generateOccurrencesForRange({
      shiftSeries: [baseSeries],
      manualShifts: [],
      shiftOverrides: overrides,
      rangeStart: new Date('2026-01-02T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-03T23:59:59.999Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'series-1__2026-01-03T08:00:00.000Z',
      title: 'Changed',
      start: '2026-01-03T10:00:00.000Z',
      color: 'rose',
    });
    expect(result[0]).not.toHaveProperty('createdAt');
    expect(result[0]).not.toHaveProperty('updatedAt');
    expect(result[0]).not.toHaveProperty('action');
    expect(result[0]).not.toHaveProperty('occurrenceStart');
    expect(result[0]).not.toHaveProperty('deletedAt');
  });

  it('falls back to the generated occurrence dates when an override omits start and end', () => {
    const overrides: ShiftOverride[] = [
      {
        id: 'override-without-dates',
        seriesId: 'series-1',
        occurrenceStart: '2026-01-02T08:00:00.000Z',
        action: 'modified',
        title: 'Title only override',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = generateOccurrencesForRange({
      shiftSeries: [baseSeries],
      manualShifts: [],
      shiftOverrides: overrides,
      rangeStart: new Date('2026-01-02T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-02T23:59:59.999Z'),
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      title: 'Title only override',
      start: '2026-01-02T08:00:00.000Z',
      end: '2026-01-02T16:00:00.000Z',
    });
  });

  it('includes modified overrides moved into the requested range', () => {
    const overrides: ShiftOverride[] = [
      {
        id: 'override-move-in',
        seriesId: 'series-1',
        occurrenceStart: '2026-01-01T08:00:00.000Z',
        action: 'modified',
        start: '2026-01-03T10:00:00.000Z',
        end: '2026-01-03T18:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = generateOccurrencesForRange({
      shiftSeries: [baseSeries],
      manualShifts: [],
      shiftOverrides: overrides,
      rangeStart: new Date('2026-01-03T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-03T23:59:59.999Z'),
    });

    expect(result.map(shift => shift.id)).toContain('series-1__2026-01-01T08:00:00.000Z');
    expect(result.map(shift => shift.start)).toContain('2026-01-03T10:00:00.000Z');
  });

  it('excludes modified overrides moved out of the requested range', () => {
    const overrides: ShiftOverride[] = [
      {
        id: 'override-move-out',
        seriesId: 'series-1',
        occurrenceStart: '2026-01-03T08:00:00.000Z',
        action: 'modified',
        start: '2026-01-05T10:00:00.000Z',
        end: '2026-01-05T18:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = generateOccurrencesForRange({
      shiftSeries: [baseSeries],
      manualShifts: [],
      shiftOverrides: overrides,
      rangeStart: new Date('2026-01-03T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-03T23:59:59.999Z'),
    });

    expect(result.map(shift => shift.id)).not.toContain('series-1__2026-01-03T08:00:00.000Z');
    expect(result.map(shift => shift.start)).not.toContain('2026-01-05T10:00:00.000Z');
  });

  it('includes future modified overrides moved back into the requested range', () => {
    const overrides: ShiftOverride[] = [
      {
        id: 'override-future-move-in',
        seriesId: 'series-1',
        occurrenceStart: '2026-01-05T08:00:00.000Z',
        action: 'modified',
        start: '2026-01-03T10:00:00.000Z',
        end: '2026-01-03T18:00:00.000Z',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ];

    const result = generateOccurrencesForRange({
      shiftSeries: [baseSeries],
      manualShifts: [],
      shiftOverrides: overrides,
      rangeStart: new Date('2026-01-03T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-03T23:59:59.999Z'),
    });

    expect(result).toContainEqual(
      expect.objectContaining({
        id: 'series-1__2026-01-05T08:00:00.000Z',
        start: '2026-01-03T10:00:00.000Z',
      })
    );
  });

  it('skips series with non-positive recurrence intervals', () => {
    const invalidSeries: ShiftSeries = {
      ...baseSeries,
      repetition: { frequency: 'days', interval: 0 },
    };

    const result = generateOccurrencesForRange({
      shiftSeries: [invalidSeries],
      manualShifts: [],
      shiftOverrides: [],
      rangeStart: new Date('2026-01-01T00:00:00.000Z'),
      rangeEnd: new Date('2026-01-01T23:59:59.999Z'),
    });

    expect(result).toEqual([]);
  });

  describe('Leap Year Edge Cases', () => {
    it('handles yearly shifts starting on February 29th by moving to March 1st in non-leap years', () => {
      const leapYearSeries: ShiftSeries = {
        ...baseSeries,
        start: '2024-02-29T08:00:00.000Z',
        end: '2024-02-29T16:00:00.000Z',
        repetition: { frequency: 'years', interval: 1 },
      };

      const result = generateOccurrencesForRange({
        shiftSeries: [leapYearSeries],
        manualShifts: [],
        shiftOverrides: [],
        rangeStart: new Date('2025-01-01T00:00:00.000Z'),
        rangeEnd: new Date('2025-12-31T23:59:59.999Z'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe('2025-03-01T08:00:00.000Z'); // Standard JS Date behavior
    });

    it('correctly identifies February 29th in leap years (e.g., 2028)', () => {
      const leapYearSeries: ShiftSeries = {
        ...baseSeries,
        start: '2024-02-29T08:00:00.000Z',
        end: '2024-02-29T16:00:00.000Z',
        repetition: { frequency: 'years', interval: 4 },
      };

      const result = generateOccurrencesForRange({
        shiftSeries: [leapYearSeries],
        manualShifts: [],
        shiftOverrides: [],
        rangeStart: new Date('2028-01-01T00:00:00.000Z'),
        rangeEnd: new Date('2028-12-31T23:59:59.999Z'),
      });

      expect(result).toHaveLength(1);
      expect(result[0].start).toBe('2028-02-29T08:00:00.000Z');
    });
  });

  describe('Daylight Saving Time (DST) Edge Cases', () => {
    // Note: The current implementation works in UTC.
    // These tests verify that UTC sequences are preserved.

    it('preserves UTC time across standard DST transition dates (e.g., March 2026)', () => {
      const dstSeries: ShiftSeries = {
        ...baseSeries,
        start: '2026-03-28T08:00:00.000Z',
        end: '2026-03-28T16:00:00.000Z',
        repetition: { frequency: 'days', interval: 1 },
      };

      const result = generateOccurrencesForRange({
        shiftSeries: [dstSeries],
        manualShifts: [],
        shiftOverrides: [],
        rangeStart: new Date('2026-03-28T00:00:00.000Z'),
        rangeEnd: new Date('2026-03-30T23:59:59.999Z'),
      });

      // March 29th 2026 is a DST change in Europe.
      // Since we use UTC (Z), the time remains 08:00Z.
      expect(result.map(s => s.start)).toEqual([
        '2026-03-28T08:00:00.000Z',
        '2026-03-29T08:00:00.000Z',
        '2026-03-30T08:00:00.000Z',
      ]);
    });
  });
});
