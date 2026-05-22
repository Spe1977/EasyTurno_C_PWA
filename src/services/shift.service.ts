import { Injectable, signal, computed, effect, inject, isDevMode } from '@angular/core';
import {
  Shift,
  Repetition,
  ShiftColor,
  Allowance,
  ManualShift,
  ShiftDataState,
  ShiftOverride,
  ShiftSeries,
} from '../shift.model';
import { ToastService } from './toast.service';
import { NotificationService } from './notification.service';
import { CryptoService } from './crypto.service';
import { UserDataService } from './user-data.service';
import { generateOccurrencesForRange } from './occurrence-generator';
import {
  EMPTY_SHIFT_DATA_STATE,
  LEGACY_SHIFT_STORAGE_KEY,
  USER_DATA_STORAGE_KEY,
} from './user-data.model';

@Injectable({ providedIn: 'root' })
export class ShiftService {
  private readonly STORAGE_KEY_V2 = USER_DATA_STORAGE_KEY;
  private readonly STORAGE_KEY_LEGACY = LEGACY_SHIFT_STORAGE_KEY;
  // Per-series generation window (matches the legacy eager-materialization
  // behavior of MAX_YEARS_AHEAD = 2 from the pre-v2 ShiftService).
  private readonly MAX_YEARS_PER_SERIES = 2;
  private readonly MAX_NOTIFICATION_PREVIEW = 10;
  private readonly MAX_IMPORT_SIZE_BYTES = 5 * 1024 * 1024;
  static readonly MAX_TITLE_LENGTH = 200;
  static readonly MAX_NOTES_LENGTH = 2000;
  private readonly storageReady = signal(false);
  private latestSaveRequestId = 0;

  private toastService = inject(ToastService);
  private notificationService = inject(NotificationService);
  private cryptoService = inject(CryptoService);
  private userDataService = inject(UserDataService);

  private readonly state = this.userDataService.state;

  shifts = computed<Shift[]>(() => this.materializeOccurrences(this.state()));

  /**
   * Becomes true only after the initial load from storage completes
   * (either synchronously for legacy data, or after async decryption).
   * Saves are blocked until this flag is set to prevent the effect() from
   * overwriting stored data with an empty state before decryption finishes.
   */
  private isLoaded = false;

  /**
   * Set to true when decryption fails so that the UI can prompt the user
   * to decide whether to reset data or keep the (unreadable) ciphertext.
   */
  decryptionError = signal(false);

  private logError(message: string, error: unknown): void {
    if (isDevMode()) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }

  constructor() {
    this.loadFromStorage();
    effect(() => {
      if (!this.storageReady()) {
        return;
      }
      this.saveStateToStorage(this.state());
    });
  }

  // ------------------------------------------------------------------
  // Load / migration
  // ------------------------------------------------------------------

  private loadFromStorage(): void {
    const v2 = localStorage.getItem(this.STORAGE_KEY_V2);
    if (v2) {
      this.decodeAndLoad(v2, parsed => this.applyV2Parsed(parsed));
      return;
    }

    const legacy = localStorage.getItem(this.STORAGE_KEY_LEGACY);
    if (legacy) {
      this.decodeAndLoad(legacy, parsed => this.applyLegacyParsed(parsed));
      return;
    }

    this.isLoaded = true;
    this.userDataService.setState(EMPTY_SHIFT_DATA_STATE);
    this.storageReady.set(true);
  }

  private decodeAndLoad(raw: string, apply: (parsed: unknown) => void): void {
    if (this.cryptoService.isEncrypted(raw)) {
      this.cryptoService
        .decrypt(raw)
        .then(decrypted => {
          this.isLoaded = true;
          try {
            apply(JSON.parse(decrypted));
          } catch (error) {
            this.logError('Failed to parse decrypted data', error);
            this.userDataService.setState(EMPTY_SHIFT_DATA_STATE);
          }
          this.storageReady.set(true);
        })
        .catch(error => {
          this.logError('Failed to decrypt user data', error);
          this.decryptionError.set(true);
        });
      return;
    }

    try {
      apply(JSON.parse(raw));
      this.isLoaded = true;
    } catch (error) {
      this.logError('Failed to parse stored user data', error);
      this.isLoaded = true;
      this.userDataService.setState(EMPTY_SHIFT_DATA_STATE);
    }
    this.storageReady.set(true);
  }

  private applyV2Parsed(parsed: unknown): void {
    if (this.isShiftDataState(parsed)) {
      this.userDataService.setState(parsed);
    } else {
      this.userDataService.setState(EMPTY_SHIFT_DATA_STATE);
    }
  }

  private applyLegacyParsed(parsed: unknown): void {
    if (Array.isArray(parsed)) {
      this.userDataService.setState(this.migrateLegacyShifts(parsed));
    } else {
      this.userDataService.setState(EMPTY_SHIFT_DATA_STATE);
    }
  }

  private migrateLegacyShifts(rawShifts: unknown[]): ShiftDataState {
    const validShifts = rawShifts.filter(item => this.isValidShift(item));
    return this.buildStateFromShifts(validShifts);
  }

  private buildStateFromShifts(validShifts: Shift[]): ShiftDataState {
    const now = new Date().toISOString();
    const seriesById = new Map<string, ShiftSeries>();
    const manualShifts: ManualShift[] = [];

    const recurring = validShifts.filter(s => s.isRecurring && s.repetition);
    const recurringSorted = [...recurring].sort(
      (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
    );

    for (const shift of recurringSorted) {
      if (seriesById.has(shift.seriesId)) continue;
      seriesById.set(shift.seriesId, {
        id: shift.seriesId,
        title: shift.title,
        start: shift.start,
        end: shift.end,
        color: shift.color,
        repetition: shift.repetition!,
        notes: shift.notes,
        overtimeHours: shift.overtimeHours,
        allowances: shift.allowances,
        timezone: shift.timezone,
        createdAt: now,
        updatedAt: now,
      });
    }

    for (const shift of validShifts) {
      if (shift.isRecurring && shift.repetition) continue;
      manualShifts.push({
        id: shift.id,
        title: shift.title,
        start: shift.start,
        end: shift.end,
        color: shift.color,
        notes: shift.notes,
        overtimeHours: shift.overtimeHours,
        allowances: shift.allowances,
        timezone: shift.timezone,
        createdAt: now,
        updatedAt: now,
      });
    }

    return {
      schemaVersion: 2,
      shiftSeries: Array.from(seriesById.values()),
      manualShifts,
      shiftOverrides: [],
    };
  }

  private isShiftDataState(value: unknown): value is ShiftDataState {
    if (typeof value !== 'object' || value === null) return false;
    const obj = value as Record<string, unknown>;
    return (
      obj.schemaVersion === 2 &&
      Array.isArray(obj.shiftSeries) &&
      Array.isArray(obj.manualShifts) &&
      Array.isArray(obj.shiftOverrides)
    );
  }

  /**
   * Called when the user explicitly confirms they want to reset all data
   * after a decryption failure.
   */
  resetAfterDecryptionError(): void {
    localStorage.removeItem(this.STORAGE_KEY_V2);
    localStorage.removeItem(this.STORAGE_KEY_LEGACY);
    this.decryptionError.set(false);
    this.isLoaded = true;
    this.storageReady.set(true);
    this.userDataService.setState(EMPTY_SHIFT_DATA_STATE);
  }

  // ------------------------------------------------------------------
  // Persistence
  // ------------------------------------------------------------------

  private saveStateToStorage(state: ShiftDataState): void {
    if (!this.isLoaded) return;

    try {
      const data = JSON.stringify(state);
      const saveRequestId = ++this.latestSaveRequestId;

      this.cryptoService
        .encrypt(data)
        .then(encrypted => {
          if (saveRequestId !== this.latestSaveRequestId) {
            return;
          }
          try {
            localStorage.setItem(this.STORAGE_KEY_V2, encrypted);
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
          this.logError('Failed to encrypt shifts', error);
          this.toastService.error('Failed to save shifts. Please try again.', 4000);
        });
    } catch (error) {
      this.logError('Failed to save shifts to localStorage', error);
      this.toastService.error('Failed to save shifts. Please try again.', 4000);
    }
  }

  // ------------------------------------------------------------------
  // Occurrence materialization
  // ------------------------------------------------------------------

  private materializeOccurrences(state: ShiftDataState): Shift[] {
    const result: Shift[] = [];

    // Manual shifts are not bounded by the visibility window — the AppComponent
    // applies its own [today-12m, today+24m] filter for the list view.
    const MANUAL_RANGE_START = new Date(-8640000000000000);
    const MANUAL_RANGE_END = new Date(8640000000000000);
    const manualOccurrences = generateOccurrencesForRange({
      shiftSeries: [],
      manualShifts: state.manualShifts,
      shiftOverrides: [],
      rangeStart: MANUAL_RANGE_START,
      rangeEnd: MANUAL_RANGE_END,
    });
    result.push(...manualOccurrences);

    for (const series of state.shiftSeries) {
      if (series.deletedAt) continue;
      const rangeStart = new Date(series.start);
      // Subtract 1 ms so an occurrence falling exactly on +MAX_YEARS_PER_SERIES
      // is excluded (matches the legacy `currentStart < maxDateAhead` semantics).
      const rangeEnd = new Date(this.addYears(rangeStart, this.MAX_YEARS_PER_SERIES).getTime() - 1);
      const occurrences = generateOccurrencesForRange({
        shiftSeries: [series],
        manualShifts: [],
        shiftOverrides: state.shiftOverrides.filter(o => o.seriesId === series.id),
        rangeStart,
        rangeEnd,
      });
      result.push(...occurrences);
    }

    return result.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private addYears(date: Date, years: number): Date {
    const result = new Date(date);
    result.setFullYear(result.getFullYear() + years);
    return result;
  }

  private parseOccurrenceId(id: string): { seriesId: string; occurrenceStart: string } | null {
    const sep = id.indexOf('__');
    if (sep === -1) return null;
    const seriesId = id.slice(0, sep);
    const occurrenceStart = id.slice(sep + 2);
    if (!seriesId || !occurrenceStart) return null;
    return { seriesId, occurrenceStart };
  }

  // ------------------------------------------------------------------
  // Public CRUD
  // ------------------------------------------------------------------

  addShift(shiftData: Omit<Shift, 'id' | 'seriesId'> & { repetition?: Repetition }): void {
    const settings = this.notificationService.getSettings();
    const now = new Date().toISOString();

    if (!shiftData.isRecurring || !shiftData.repetition) {
      const id = crypto.randomUUID();
      const manual: ManualShift = {
        id,
        title: shiftData.title,
        start: shiftData.start,
        end: shiftData.end,
        color: shiftData.color,
        notes: shiftData.notes,
        overtimeHours: shiftData.overtimeHours,
        allowances: shiftData.allowances,
        timezone: shiftData.timezone,
        createdAt: now,
        updatedAt: now,
      };
      void this.userDataService.mutate(s => ({ ...s, manualShifts: [...s.manualShifts, manual] }), {
        type: 'manual',
        data: manual,
      });

      const materialized: Shift = { ...manual, seriesId: id, isRecurring: false };
      void this.notificationService.scheduleShiftNotification(materialized, settings);
      return;
    }

    const seriesId = crypto.randomUUID();
    const series: ShiftSeries = {
      id: seriesId,
      title: shiftData.title,
      start: shiftData.start,
      end: shiftData.end,
      color: shiftData.color,
      repetition: shiftData.repetition,
      notes: shiftData.notes,
      overtimeHours: shiftData.overtimeHours,
      allowances: shiftData.allowances,
      timezone: shiftData.timezone,
      createdAt: now,
      updatedAt: now,
    };
    void this.userDataService.mutate(s => ({ ...s, shiftSeries: [...s.shiftSeries, series] }), {
      type: 'series',
      data: series,
    });

    const upcomingShifts = this.shifts()
      .filter(s => s.seriesId === seriesId)
      .slice(0, this.MAX_NOTIFICATION_PREVIEW);
    upcomingShifts.forEach(
      shift => void this.notificationService.scheduleShiftNotification(shift, settings)
    );
  }

  updateShift(updatedShift: Shift): void {
    const parsed = this.parseOccurrenceId(updatedShift.id);
    if (parsed) {
      // Updating a generated occurrence of a series: persist as a 'modified' override.
      this.upsertOverride(parsed.seriesId, parsed.occurrenceStart, updatedShift);
      return;
    }

    if (updatedShift.isRecurring && updatedShift.repetition) {
      this.convertManualShiftToSeries(updatedShift);
      return;
    }

    // Manual shift: replace fields on the ManualShift document.
    const now = new Date().toISOString();
    void this.userDataService.mutate(
      s => ({
        ...s,
        manualShifts: s.manualShifts.map(m =>
          m.id === updatedShift.id
            ? {
                ...m,
                title: updatedShift.title,
                start: updatedShift.start,
                end: updatedShift.end,
                color: updatedShift.color,
                notes: updatedShift.notes,
                overtimeHours: updatedShift.overtimeHours,
                allowances: updatedShift.allowances,
                timezone: updatedShift.timezone,
                updatedAt: now,
              }
            : m
        ),
      }),
      {
        type: 'manual',
        data: {
          ...updatedShift,
          createdAt:
            this.state().manualShifts.find(m => m.id === updatedShift.id)?.createdAt || now,
          updatedAt: now,
        } as ManualShift,
      }
    );
  }

  private convertManualShiftToSeries(updatedShift: Shift): void {
    const manual = this.state().manualShifts.find(m => m.id === updatedShift.id);
    if (!manual || !updatedShift.repetition) return;

    void this.notificationService.cancelShiftNotifications(updatedShift.id);

    const now = new Date().toISOString();
    const deletedManual: ManualShift = { ...manual, deletedAt: now, updatedAt: now };
    const series: ShiftSeries = {
      id: updatedShift.seriesId || updatedShift.id,
      title: updatedShift.title,
      start: updatedShift.start,
      end: updatedShift.end,
      color: updatedShift.color,
      repetition: updatedShift.repetition,
      notes: updatedShift.notes,
      overtimeHours: updatedShift.overtimeHours,
      allowances: updatedShift.allowances,
      timezone: updatedShift.timezone,
      createdAt: manual.createdAt,
      updatedAt: now,
    };

    void this.userDataService.mutate(
      s => ({
        ...s,
        manualShifts: s.manualShifts.map(m => (m.id === manual.id ? deletedManual : m)),
        shiftSeries: [...s.shiftSeries, series],
      }),
      {
        type: 'batch',
        manuals: [deletedManual],
        series: [series],
      }
    );

    const settings = this.notificationService.getSettings();
    const upcomingShifts = this.shifts()
      .filter(s => s.seriesId === series.id)
      .slice(0, this.MAX_NOTIFICATION_PREVIEW);
    upcomingShifts.forEach(
      shift => void this.notificationService.scheduleShiftNotification(shift, settings)
    );
  }

  private upsertOverride(
    seriesId: string,
    occurrenceStart: string,
    source: Partial<Shift> & { action?: 'modified' | 'deleted' }
  ): void {
    const now = new Date().toISOString();
    const existing = this.state().shiftOverrides.find(
      o => o.seriesId === seriesId && o.occurrenceStart === occurrenceStart
    );
    const action = source.action ?? 'modified';
    const overrideFields: Partial<ShiftOverride> =
      action === 'modified'
        ? {
            title: source.title,
            start: source.start,
            end: source.end,
            color: source.color,
            notes: source.notes,
            overtimeHours: source.overtimeHours,
            allowances: source.allowances,
            timezone: source.timezone,
          }
        : {};

    const finalOverride: ShiftOverride = existing
      ? { ...existing, ...overrideFields, action, updatedAt: now, deletedAt: undefined }
      : {
          id: crypto.randomUUID(),
          seriesId,
          occurrenceStart,
          action,
          ...overrideFields,
          createdAt: now,
          updatedAt: now,
        };

    void this.userDataService.mutate(
      s => ({
        ...s,
        shiftOverrides: existing
          ? s.shiftOverrides.map(o => (o.id === finalOverride.id ? finalOverride : o))
          : [...s.shiftOverrides, finalOverride],
      }),
      { type: 'override', data: finalOverride }
    );
  }

  updateShiftSeries(updatedShift: Shift): void {
    const seriesId = updatedShift.seriesId;
    const series = this.state().shiftSeries.find(s => s.id === seriesId);
    if (!series) {
      // Fall back to deleting (if any) and adding fresh — same as the legacy
      // behavior when the original series cannot be located.
      this.deleteShiftSeries(seriesId);
      this.addShift({ ...updatedShift });
      return;
    }

    const parsed = this.parseOccurrenceId(updatedShift.id);
    const originalStartIso = parsed ? parsed.occurrenceStart : series.start;
    const originalStartMs = new Date(originalStartIso).getTime();

    // Cancel notifications for occurrences at or after the edit start that
    // will receive new properties.
    const allShifts = this.shifts();
    allShifts
      .filter(s => s.seriesId === seriesId && new Date(s.start).getTime() >= originalStartMs)
      .forEach(s => void this.notificationService.cancelShiftNotifications(s.id));

    // Snapshot the original series properties so we can preserve them on the
    // occurrences strictly before originalStart via 'modified' overrides.
    const originalProps = {
      title: series.title,
      color: series.color,
      notes: series.notes,
      overtimeHours: series.overtimeHours,
      allowances: series.allowances,
      timezone: series.timezone,
    };

    const pastOccurrences = allShifts.filter(
      s => s.seriesId === seriesId && new Date(s.start).getTime() < originalStartMs
    );

    const now = new Date().toISOString();
    let updatedSeries: ShiftSeries;
    let nextOverrides: ShiftOverride[] = [];

    const state = this.state();
    nextOverrides = state.shiftOverrides;

    // Add overrides for past occurrences only when they don't already have
    // one (do not clobber prior user customisations).
    for (const occ of pastOccurrences) {
      const key = `${seriesId}|${occ.start}`;
      const exists = nextOverrides.some(
        o => `${o.seriesId}|${o.occurrenceStart}` === key && !o.deletedAt
      );
      if (exists) continue;
      nextOverrides = [
        ...nextOverrides,
        {
          id: crypto.randomUUID(),
          seriesId,
          occurrenceStart: occ.start,
          action: 'modified',
          start: occ.start,
          end: occ.end,
          ...originalProps,
          createdAt: now,
          updatedAt: now,
        },
      ];
    }

    // Remove overrides at or after originalStart (they are about to be
    // recomputed from the new series properties).
    nextOverrides = nextOverrides.filter(
      o => o.seriesId !== seriesId || new Date(o.occurrenceStart).getTime() < originalStartMs
    );

    // Update the series document with the new properties. We preserve the
    // series.start (so the iteration anchor matches the original occurrence
    // grid) and only swap the displayed fields and repetition.
    updatedSeries = {
      ...series,
      title: updatedShift.title,
      color: updatedShift.color,
      notes: updatedShift.notes,
      overtimeHours: updatedShift.overtimeHours,
      allowances: updatedShift.allowances,
      timezone: updatedShift.timezone,
      repetition: updatedShift.repetition ?? series.repetition,
      updatedAt: now,
    };

    void this.userDataService.mutate(
      s => ({
        ...s,
        shiftSeries: s.shiftSeries.map(s => (s.id === seriesId ? updatedSeries : s)),
        shiftOverrides: nextOverrides,
      }),
      {
        type: 'batch',
        series: [updatedSeries],
        overrides: nextOverrides.filter(o => o.seriesId === seriesId),
      }
    );

    const settings = this.notificationService.getSettings();
    const upcoming = this.shifts()
      .filter(s => s.seriesId === seriesId && new Date(s.start).getTime() >= originalStartMs)
      .slice(0, this.MAX_NOTIFICATION_PREVIEW);
    upcoming.forEach(
      shift => void this.notificationService.scheduleShiftNotification(shift, settings)
    );
  }

  deleteShift(id: string): void {
    void this.notificationService.cancelShiftNotifications(id);

    const parsed = this.parseOccurrenceId(id);
    if (parsed) {
      this.upsertOverride(parsed.seriesId, parsed.occurrenceStart, { action: 'deleted' });
      return;
    }

    // Manual shift removal: soft-delete for Firestore sync compatibility.
    const now = new Date().toISOString();
    const manual = this.state().manualShifts.find(m => m.id === id);
    if (manual) {
      const deletedManual = { ...manual, deletedAt: now, updatedAt: now };
      void this.userDataService.mutate(
        s => ({
          ...s,
          manualShifts: s.manualShifts.map(m => (m.id === id ? deletedManual : m)),
        }),
        { type: 'manual', data: deletedManual }
      );
    }
  }

  deleteShiftSeries(seriesId: string): void {
    const seriesShifts = this.shifts().filter(s => s.seriesId === seriesId);
    seriesShifts.forEach(shift => void this.notificationService.cancelShiftNotifications(shift.id));

    const now = new Date().toISOString();
    const series = this.state().shiftSeries.find(s => s.id === seriesId);
    if (series) {
      const deletedSeries = { ...series, deletedAt: now, updatedAt: now };
      const overridesToDelete = this.state().shiftOverrides.filter(o => o.seriesId === seriesId);
      const deletedOverrides = overridesToDelete.map(o => ({
        ...o,
        deletedAt: now,
        updatedAt: now,
      }));

      void this.userDataService.mutate(
        s => ({
          ...s,
          shiftSeries: s.shiftSeries.map(s => (s.id === seriesId ? deletedSeries : s)),
          shiftOverrides: s.shiftOverrides.map(o => {
            const deleted = deletedOverrides.find(d => d.id === o.id);
            return deleted ?? o;
          }),
        }),
        {
          type: 'batch',
          series: [deletedSeries],
          overrides: deletedOverrides,
        }
      );
    }
  }

  deleteAllShifts(): void {
    void this.notificationService.cancelAllNotifications();
    this.userDataService.setState(EMPTY_SHIFT_DATA_STATE);
  }

  exportBackupPayload(): string {
    return JSON.stringify(this.userDataService.state(), null, 2);
  }

  importShifts(json: string): { success: boolean; error?: string; imported?: number } {
    try {
      if (new Blob([json]).size > this.MAX_IMPORT_SIZE_BYTES) {
        return { success: false, error: 'Backup file too large' };
      }

      const data = JSON.parse(json);

      if (this.isShiftDataState(data)) {
        void this.notificationService.cancelAllNotifications();
        this.userDataService.setState(data);
        return { success: true, imported: data.manualShifts.length + data.shiftSeries.length };
      }

      if (!Array.isArray(data)) {
        return { success: false, error: 'Invalid format: expected array' };
      }

      const validShifts = data.filter(item => this.isValidShift(item));

      if (validShifts.length === 0) {
        return { success: false, error: 'No valid shifts found' };
      }

      void this.notificationService.cancelAllNotifications().then(() => {
        const settings = this.notificationService.getSettings();
        const upcoming = validShifts
          .filter(s => new Date(s.start).getTime() > Date.now())
          .slice(0, this.MAX_NOTIFICATION_PREVIEW);
        upcoming.forEach(
          shift => void this.notificationService.scheduleShiftNotification(shift, settings)
        );
      });

      this.userDataService.setState(this.buildStateFromShifts(validShifts));
      return { success: true, imported: validShifts.length };
    } catch (error) {
      console.error('Import failed:', error);
      return { success: false, error: 'Failed to parse JSON' };
    }
  }

  // ------------------------------------------------------------------
  // Validation (re-used for legacy migration and backup import)
  // ------------------------------------------------------------------

  private static readonly VALID_COLORS: ReadonlySet<ShiftColor> = new Set<ShiftColor>([
    'sky',
    'green',
    'amber',
    'rose',
    'indigo',
    'teal',
    'fuchsia',
    'slate',
  ]);

  private static readonly VALID_FREQUENCIES: ReadonlySet<Repetition['frequency']> = new Set<
    Repetition['frequency']
  >(['days', 'weeks', 'months', 'years']);

  private isValidColor(value: unknown): value is ShiftColor {
    return typeof value === 'string' && ShiftService.VALID_COLORS.has(value as ShiftColor);
  }

  private isValidRepetition(value: unknown): value is Repetition {
    if (typeof value !== 'object' || value === null) return false;
    const r = value as Record<string, unknown>;
    return (
      typeof r.frequency === 'string' &&
      ShiftService.VALID_FREQUENCIES.has(r.frequency as Repetition['frequency']) &&
      typeof r.interval === 'number' &&
      Number.isFinite(r.interval) &&
      r.interval >= 1
    );
  }

  private isValidAllowance(value: unknown): value is Allowance {
    if (typeof value !== 'object' || value === null) return false;
    const a = value as Record<string, unknown>;
    return typeof a.name === 'string' && typeof a.amount === 'number' && Number.isFinite(a.amount);
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
        obj.title.length <= ShiftService.MAX_TITLE_LENGTH &&
        'start' in obj &&
        typeof obj.start === 'string' &&
        this.isValidISODate(obj.start) &&
        'end' in obj &&
        typeof obj.end === 'string' &&
        this.isValidISODate(obj.end) &&
        'color' in obj &&
        this.isValidColor(obj.color) &&
        'isRecurring' in obj &&
        typeof obj.isRecurring === 'boolean' &&
        'seriesId' in obj &&
        typeof obj.seriesId === 'string'
      )
    ) {
      return false;
    }

    if (obj.repetition !== undefined && !this.isValidRepetition(obj.repetition)) {
      return false;
    }
    if (
      obj.notes !== undefined &&
      (typeof obj.notes !== 'string' || obj.notes.length > ShiftService.MAX_NOTES_LENGTH)
    ) {
      return false;
    }
    if (
      obj.overtimeHours !== undefined &&
      !(typeof obj.overtimeHours === 'number' && Number.isFinite(obj.overtimeHours))
    ) {
      return false;
    }
    if (obj.allowances !== undefined) {
      if (!Array.isArray(obj.allowances) || !obj.allowances.every(a => this.isValidAllowance(a))) {
        return false;
      }
    }
    if (obj.timezone !== undefined && typeof obj.timezone !== 'string') {
      return false;
    }

    return new Date(obj.end as string).getTime() >= new Date(obj.start as string).getTime();
  }

  private isValidISODate(dateString: unknown): boolean {
    if (typeof dateString !== 'string') {
      return false;
    }
    const date = new Date(dateString);
    return !isNaN(date.getTime());
  }
}
