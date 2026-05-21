import { ShiftDataState } from '../shift.model';

export const EMPTY_SHIFT_DATA_STATE: ShiftDataState = {
  schemaVersion: 2,
  shiftSeries: [],
  manualShifts: [],
  shiftOverrides: [],
};

export const USER_DATA_STORAGE_KEY = 'easyturno_user_data_v2';
export const LEGACY_SHIFT_STORAGE_KEY = 'easyturno_shifts';
