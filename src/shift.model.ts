export type ShiftColor =
  | 'sky'
  | 'green'
  | 'amber'
  | 'rose'
  | 'indigo'
  | 'teal'
  | 'fuchsia'
  | 'slate';

export interface Repetition {
  frequency: 'days' | 'weeks' | 'months' | 'years';
  interval: number;
}

export interface Allowance {
  name: string; // Custom name for the allowance
  amount: number; // Amount of the allowance
}

export interface AllowanceWithId extends Allowance {
  _id: string; // Internal ID for tracking in UI (not persisted)
}

export interface Shift {
  id: string; // Unique ID for this specific shift instance
  seriesId: string; // ID to group recurring shifts
  title: string;
  start: string; // ISO Date string
  end: string; // ISO Date string
  color: ShiftColor; // e.g., 'sky', 'green'
  isRecurring: boolean;
  repetition?: Repetition;
  notes?: string; // Optional notes field
  overtimeHours?: number; // Overtime hours
  allowances?: Allowance[]; // Array of allowances
  timezone?: string; // IANA timezone identifier (e.g., 'Europe/Rome')
}

export interface ShiftBase {
  title: string;
  start: string;
  end: string;
  color: ShiftColor;
  notes?: string;
  overtimeHours?: number;
  allowances?: Allowance[];
  timezone?: string;
}

export interface ShiftSeries extends ShiftBase {
  id: string;
  repetition: Repetition;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ManualShift extends ShiftBase {
  id: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ShiftOverride extends Partial<ShiftBase> {
  id: string;
  seriesId: string;
  occurrenceStart: string;
  action: 'modified' | 'deleted';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface ShiftDataState {
  schemaVersion: 2;
  shiftSeries: ShiftSeries[];
  manualShifts: ManualShift[];
  shiftOverrides: ShiftOverride[];
}
