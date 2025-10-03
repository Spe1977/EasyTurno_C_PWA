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
  frequency: 'days' | 'weeks' | 'months' | 'year';
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
}
