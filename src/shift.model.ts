
export interface Repetition {
  frequency: 'days' | 'weeks' | 'months' | 'year';
  interval: number;
}

export interface Shift {
  id: string; // Unique ID for this specific shift instance
  seriesId: string; // ID to group recurring shifts
  title:string;
  start: string; // ISO Date string
  end: string; // ISO Date string
  color: string; // e.g., 'sky', 'green'
  isRecurring: boolean;
  repetition?: Repetition;
}
