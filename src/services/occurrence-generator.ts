import { ManualShift, Shift, ShiftOverride, ShiftSeries } from '../shift.model';

interface GenerateOccurrencesInput {
  shiftSeries: ShiftSeries[];
  manualShifts: ManualShift[];
  shiftOverrides: ShiftOverride[];
  rangeStart: Date;
  rangeEnd: Date;
}

const DAYS_PER_WEEK = 7;
const MAX_RANGE_OCCURRENCES_PER_SERIES = 900;

export function generateOccurrencesForRange(input: GenerateOccurrencesInput): Shift[] {
  const rangeStartMs = input.rangeStart.getTime();
  const rangeEndMs = input.rangeEnd.getTime();
  const overridesByKey = new Map(
    input.shiftOverrides
      .filter(override => !override.deletedAt)
      .map(override => [`${override.seriesId}|${override.occurrenceStart}`, override])
  );

  const generated: Shift[] = [];

  for (const manual of input.manualShifts.filter(shift => !shift.deletedAt)) {
    if (overlaps(manual.start, manual.end, rangeStartMs, rangeEndMs)) {
      generated.push({
        id: manual.id,
        seriesId: manual.id,
        title: manual.title,
        start: manual.start,
        end: manual.end,
        color: manual.color,
        isRecurring: false,
        notes: manual.notes,
        overtimeHours: manual.overtimeHours,
        allowances: manual.allowances,
        timezone: manual.timezone,
      });
    }
  }

  for (const series of input.shiftSeries.filter(item => !item.deletedAt)) {
    let currentStart = new Date(series.start);
    const durationMs = new Date(series.end).getTime() - currentStart.getTime();
    let rangeRelevantCount = 0;
    const generatedKeys = new Set<string>();

    if (series.repetition.interval <= 0) continue;

    while (
      currentStart.getTime() <= rangeEndMs &&
      rangeRelevantCount < MAX_RANGE_OCCURRENCES_PER_SERIES
    ) {
      const occurrenceStart = currentStart.toISOString();
      const occurrenceEnd = new Date(currentStart.getTime() + durationMs).toISOString();
      const occurrenceKey = `${series.id}|${occurrenceStart}`;
      const baseEndsBeforeRange = new Date(occurrenceEnd).getTime() < rangeStartMs;
      const override = overridesByKey.get(occurrenceKey);

      if (!baseEndsBeforeRange || override) {
        rangeRelevantCount += 1;
      }

      if (override?.action !== 'deleted') {
        const occurrence = toOccurrence(series, occurrenceStart, occurrenceEnd, override);
        if (overlaps(occurrence.start, occurrence.end, rangeStartMs, rangeEndMs)) {
          generated.push(occurrence);
          generatedKeys.add(occurrenceKey);
        }
      }

      currentStart = advanceDate(
        currentStart,
        series.repetition.frequency,
        series.repetition.interval
      );
    }

    for (const override of input.shiftOverrides.filter(
      item => !item.deletedAt && item.seriesId === series.id && item.action === 'modified'
    )) {
      const occurrenceKey = `${series.id}|${override.occurrenceStart}`;
      if (generatedKeys.has(occurrenceKey)) continue;

      const overrideStart = new Date(override.occurrenceStart);
      const occurrenceEnd = new Date(overrideStart.getTime() + durationMs).toISOString();
      const occurrence = toOccurrence(series, override.occurrenceStart, occurrenceEnd, override);

      if (overlaps(occurrence.start, occurrence.end, rangeStartMs, rangeEndMs)) {
        generated.push(occurrence);
        generatedKeys.add(occurrenceKey);
      }
    }
  }

  return generated.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

function toOccurrence(
  series: ShiftSeries,
  occurrenceStart: string,
  occurrenceEnd: string,
  override?: ShiftOverride
): Shift {
  const base: Shift = {
    id: `${series.id}__${occurrenceStart}`,
    seriesId: series.id,
    title: series.title,
    start: occurrenceStart,
    end: occurrenceEnd,
    color: series.color,
    isRecurring: true,
    repetition: series.repetition,
    notes: series.notes,
    overtimeHours: series.overtimeHours,
    allowances: series.allowances,
    timezone: series.timezone,
  };

  if (!override || override.action !== 'modified') return base;

  return {
    ...base,
    title: override.title ?? base.title,
    start: override.start ?? base.start,
    end: override.end ?? base.end,
    color: override.color ?? base.color,
    notes: override.notes ?? base.notes,
    overtimeHours: override.overtimeHours ?? base.overtimeHours,
    allowances: override.allowances ?? base.allowances,
    timezone: override.timezone ?? base.timezone,
    id: `${series.id}__${occurrenceStart}`,
    seriesId: series.id,
    isRecurring: true,
    repetition: series.repetition,
  };
}

function overlaps(start: string, end: string, rangeStartMs: number, rangeEndMs: number): boolean {
  return new Date(start).getTime() <= rangeEndMs && new Date(end).getTime() >= rangeStartMs;
}

function advanceDate(
  date: Date,
  frequency: 'days' | 'weeks' | 'months' | 'years',
  interval: number
): Date {
  const result = new Date(date);
  if (frequency === 'days') result.setUTCDate(result.getUTCDate() + interval);
  if (frequency === 'weeks') result.setUTCDate(result.getUTCDate() + interval * DAYS_PER_WEEK);
  if (frequency === 'months') result.setUTCMonth(result.getUTCMonth() + interval);
  if (frequency === 'years') result.setUTCFullYear(result.getUTCFullYear() + interval);
  return result;
}
