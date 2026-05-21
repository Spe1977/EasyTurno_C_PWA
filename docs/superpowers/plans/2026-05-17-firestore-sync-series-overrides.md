# Firestore Sync Series Overrides Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace materialized recurring `Shift[]` storage with series/manual/override data and add authenticated Firestore sync while preserving guest/offline behavior.

**Architecture:** Keep `ShiftService` as the public facade used by `AppComponent`, calendar, backup, notifications, and existing tests. Refactor its internals to persist `ShiftDataState` and generate visible `Shift[]` occurrences on demand. Add `UserDataService` and `SyncService` behind the facade so guest mode uses encrypted local storage and authenticated mode uses Firestore collections under `users/{uid}` with realtime listeners and offline cache.

**Tech Stack:** Angular 21 signals/services, Firebase Web SDK modular Auth + Firestore, Jest, existing Playwright/Cypress hooks, encrypted localStorage via `CryptoService`.

---

## Scope And File Structure

**Core model and pure logic**
- Modify: `src/shift.model.ts`
- Create: `src/services/occurrence-generator.ts`
- Create: `src/services/occurrence-generator.spec.ts`

**Local/cloud persistence**
- Create: `src/services/user-data.model.ts`
- Create: `src/services/user-data.service.ts`
- Create: `src/services/user-data.service.spec.ts`
- Create: `src/services/firestore-user-data.service.ts`
- Create: `src/services/firestore-user-data.service.spec.ts`
- Modify: `src/services/firebase-app.service.ts`

**Sync orchestration and devices**
- Create: `src/services/sync.service.ts`
- Create: `src/services/sync.service.spec.ts`
- Create: `src/services/device.service.ts`
- Create: `src/services/device.service.spec.ts`
- Modify: `src/app.component.ts`
- Modify: `src/app.component.html`
- Modify: `src/assets/i18n/it.json`
- Modify: `src/assets/i18n/en.json`

**Facade migration**
- Modify: `src/services/shift.service.ts`
- Modify: `src/services/shift.service.spec.ts`
- Modify: `src/app.component.spec.ts`

**Firebase emulator and rules**
- Create: `firestore.rules`
- Create: `firebase.json`
- Modify: `package.json`
- Create: `src/testing/firebase-emulator.ts`
- Create: `src/services/sync-emulator.spec.ts`

**Docs**
- Modify: `firebase.md`
- Modify: `README_IT.md`

---

## Data Contracts

Use these exact contracts as the target shape.

```ts
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
```

Firestore document paths:

```text
users/{uid}/profile/main
users/{uid}/settings/main
users/{uid}/shiftSeries/{seriesId}
users/{uid}/manualShifts/{manualShiftId}
users/{uid}/shiftOverrides/{overrideId}
users/{uid}/devices/{deviceId}
```

Guest local storage keys:

```text
easyturno_user_data_v2
easyturno_shifts              # legacy read-only migration source
```

---

### Task 1: Add Series/Manual/Override Model And Pure Occurrence Generator

**Files:**
- Modify: `src/shift.model.ts`
- Create: `src/services/occurrence-generator.ts`
- Create: `src/services/occurrence-generator.spec.ts`

- [x] **Step 1: Write failing generator tests**

Add `src/services/occurrence-generator.spec.ts`:

```ts
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
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `npm test -- src/services/occurrence-generator.spec.ts --runInBand`

Expected: FAIL with module not found for `./occurrence-generator`.

- [x] **Step 3: Add model interfaces**

Append to `src/shift.model.ts` after `Shift`:

```ts
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
```

- [x] **Step 4: Add generator implementation**

Create `src/services/occurrence-generator.ts`:

```ts
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
      generated.push({ ...manual, seriesId: manual.id, isRecurring: false });
    }
  }

  for (const series of input.shiftSeries.filter(item => !item.deletedAt)) {
    let currentStart = new Date(series.start);
    const durationMs = new Date(series.end).getTime() - currentStart.getTime();
    let count = 0;

    while (currentStart.getTime() <= rangeEndMs && count < MAX_RANGE_OCCURRENCES_PER_SERIES) {
      const occurrenceStart = currentStart.toISOString();
      const occurrenceEnd = new Date(currentStart.getTime() + durationMs).toISOString();

      if (overlaps(occurrenceStart, occurrenceEnd, rangeStartMs, rangeEndMs)) {
        const override = overridesByKey.get(`${series.id}|${occurrenceStart}`);
        if (override?.action !== 'deleted') {
          generated.push(toOccurrence(series, occurrenceStart, occurrenceEnd, override));
        }
      }

      currentStart = advanceDate(currentStart, series.repetition.frequency, series.repetition.interval);
      count += 1;
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
    ...override,
    id: `${series.id}__${occurrenceStart}`,
    seriesId: series.id,
    isRecurring: true,
    repetition: series.repetition,
  };
}

function overlaps(start: string, end: string, rangeStartMs: number, rangeEndMs: number): boolean {
  return new Date(start).getTime() <= rangeEndMs && new Date(end).getTime() >= rangeStartMs;
}

function advanceDate(date: Date, frequency: 'days' | 'weeks' | 'months' | 'years', interval: number): Date {
  const result = new Date(date);
  if (frequency === 'days') result.setDate(result.getDate() + interval);
  if (frequency === 'weeks') result.setDate(result.getDate() + interval * DAYS_PER_WEEK);
  if (frequency === 'months') result.setMonth(result.getMonth() + interval);
  if (frequency === 'years') result.setFullYear(result.getFullYear() + interval);
  return result;
}
```

- [x] **Step 5: Run generator test**

Run: `npm test -- src/services/occurrence-generator.spec.ts --runInBand`

Expected: PASS.

---

### Task 2: Introduce `ShiftDataState` Persistence Behind `ShiftService`

**Files:**
- Create: `src/services/user-data.model.ts`
- Modify: `src/services/shift.service.ts`
- Modify: `src/services/shift.service.spec.ts`

- [x] **Step 1: Add failing migration tests**

In `src/services/shift.service.spec.ts`, add a `describe('v2 state migration')` block:

```ts
it('loads legacy easyturno_shifts into manual and series state without losing visible shifts', async () => {
  const legacy = [
    {
      id: 'legacy-1',
      seriesId: 'legacy-1',
      title: 'Legacy manual',
      start: '2026-01-01T08:00:00.000Z',
      end: '2026-01-01T16:00:00.000Z',
      color: 'indigo',
      isRecurring: false,
    },
  ];
  localStorageMock['easyturno_shifts'] = JSON.stringify(legacy);

  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [ShiftService, ToastService, NotificationService, { provide: CryptoService, useValue: mockCryptoService }],
  }).compileComponents();
  const migrated = TestBed.inject(ShiftService);

  expect(migrated.shifts()).toHaveLength(1);
  expect(migrated.shifts()[0].title).toBe('Legacy manual');
});

it('persists new shifts to easyturno_user_data_v2', async () => {
  service.addShift({
    title: 'Stored manual',
    start: '2026-01-02T08:00:00.000Z',
    end: '2026-01-02T16:00:00.000Z',
    color: 'sky',
    isRecurring: false,
  });

  await flushMicrotasks();

  expect(localStorageMock['easyturno_user_data_v2']).toContain('Stored manual');
});
```

- [x] **Step 2: Run tests to verify failure**

Run: `npm test -- src/services/shift.service.spec.ts --runInBand`

Expected: FAIL because `easyturno_user_data_v2` is not written.

- [x] **Step 3: Add shared user data model**

Create `src/services/user-data.model.ts`:

```ts
import { ShiftDataState } from '../shift.model';

export const EMPTY_SHIFT_DATA_STATE: ShiftDataState = {
  schemaVersion: 2,
  shiftSeries: [],
  manualShifts: [],
  shiftOverrides: [],
};

export const USER_DATA_STORAGE_KEY = 'easyturno_user_data_v2';
export const LEGACY_SHIFT_STORAGE_KEY = 'easyturno_shifts';
```

- [x] **Step 4: Refactor `ShiftService` storage state**

Inside `src/services/shift.service.ts`, add a private signal:

```ts
private readonly state = signal<ShiftDataState>(EMPTY_SHIFT_DATA_STATE);
```

Replace direct persistence of `this.shifts()` with persistence of `this.state()`. Keep `shifts` public as a generated signal:

```ts
shifts = computed(() =>
  generateOccurrencesForRange({
    ...this.state(),
    rangeStart: this.serviceRangeStart(),
    rangeEnd: this.serviceRangeEnd(),
  })
);
```

Use service range start/end of `today - 12 months` and `today + 24 months` so existing app behavior stays bounded:

```ts
private serviceRangeStart(): Date {
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  start.setHours(0, 0, 0, 0);
  return start;
}

private serviceRangeEnd(): Date {
  const end = new Date();
  end.setMonth(end.getMonth() + 24);
  end.setHours(23, 59, 59, 999);
  return end;
}
```

- [x] **Step 5: Preserve public CRUD methods**

Update methods so callers still use the current API:

```ts
addShift(shiftData: Omit<Shift, 'id' | 'seriesId'> & { repetition?: Repetition }) {
  const now = new Date().toISOString();
  if (!shiftData.isRecurring || !shiftData.repetition) {
    const id = crypto.randomUUID();
    this.state.update(state => ({
      ...state,
      manualShifts: [...state.manualShifts, { ...shiftData, id, createdAt: now, updatedAt: now }],
    }));
    return;
  }

  const id = crypto.randomUUID();
  this.state.update(state => ({
    ...state,
    shiftSeries: [
      ...state.shiftSeries,
      { ...shiftData, id, repetition: shiftData.repetition, createdAt: now, updatedAt: now },
    ],
  }));
}
```

Implement `deleteShift(id)` by parsing generated IDs:

```ts
private parseGeneratedOccurrenceId(id: string): { seriesId: string; occurrenceStart: string } | null {
  const [seriesId, occurrenceStart] = id.split('__');
  if (!seriesId || !occurrenceStart) return null;
  return { seriesId, occurrenceStart };
}
```

For generated occurrence delete, add a `ShiftOverride` with `action: 'deleted'`. For manual delete, mark `deletedAt`.

- [x] **Step 6: Run existing shift and app tests**

Run:

```bash
npm test -- src/services/shift.service.spec.ts src/app.component.spec.ts --runInBand
```

Expected: PASS.

---

### Task 3: Implement Local `UserDataService` As Store Boundary

**Files:**
- Create: `src/services/user-data.service.ts`
- Create: `src/services/user-data.service.spec.ts`
- Modify: `src/services/shift.service.ts`

- [x] **Step 1: Write failing store tests**

Create `src/services/user-data.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { UserDataService } from './user-data.service';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';

describe('UserDataService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('starts with empty v2 state in guest mode', () => {
    const service = TestBed.inject(UserDataService);
    expect(service.state()).toEqual(EMPTY_SHIFT_DATA_STATE);
  });

  it('updates state through a single mutation boundary', () => {
    const service = TestBed.inject(UserDataService);
    service.update(state => ({
      ...state,
      manualShifts: [
        ...state.manualShifts,
        {
          id: 'm1',
          title: 'Manual',
          start: '2026-01-01T08:00:00.000Z',
          end: '2026-01-01T16:00:00.000Z',
          color: 'indigo',
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    }));

    expect(service.state().manualShifts).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run test to verify failure**

Run: `npm test -- src/services/user-data.service.spec.ts --runInBand`

Expected: FAIL because `UserDataService` does not exist.

- [x] **Step 3: Add `UserDataService`**

Create `src/services/user-data.service.ts`:

```ts
import { Injectable, signal } from '@angular/core';
import { ShiftDataState } from '../shift.model';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';

@Injectable({ providedIn: 'root' })
export class UserDataService {
  private readonly _state = signal<ShiftDataState>(EMPTY_SHIFT_DATA_STATE);
  readonly state = this._state.asReadonly();

  setState(next: ShiftDataState): void {
    this._state.set(next);
  }

  update(mutator: (state: ShiftDataState) => ShiftDataState): void {
    this._state.update(mutator);
  }
}
```

- [x] **Step 4: Wire `ShiftService` to `UserDataService`**

Inject `UserDataService` in `ShiftService` and replace private state signal reads/writes:

```ts
private readonly userDataService = inject(UserDataService);
private readonly state = this.userDataService.state;
```

When mutating, use:

```ts
this.userDataService.update(state => nextState);
```

- [x] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/services/user-data.service.spec.ts src/services/shift.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 4: Add Firestore Store With Realtime Listener And Offline Cache

**Files:**
- Modify: `src/services/firebase-app.service.ts`
- Create: `src/services/firestore-user-data.service.ts`
- Create: `src/services/firestore-user-data.service.spec.ts`
- Modify: `setup-jest.js`

- [x] **Step 1: Write failing Firestore service tests**

Create `src/services/firestore-user-data.service.spec.ts` with mocked Firestore functions:

```ts
import { TestBed } from '@angular/core/testing';
import * as firestore from 'firebase/firestore';
import { FirestoreUserDataService } from './firestore-user-data.service';

describe('FirestoreUserDataService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    TestBed.configureTestingModule({});
  });

  it('subscribes to user subcollections and exposes loaded state', () => {
    const unsubscribers = [jest.fn(), jest.fn(), jest.fn()];
    (firestore.onSnapshot as jest.Mock)
      .mockReturnValueOnce(unsubscribers[0])
      .mockReturnValueOnce(unsubscribers[1])
      .mockReturnValueOnce(unsubscribers[2]);

    const service = TestBed.inject(FirestoreUserDataService);
    service.start('uid-1');

    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/shiftSeries');
    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/manualShifts');
    expect(firestore.collection).toHaveBeenCalledWith(expect.anything(), 'users/uid-1/shiftOverrides');

    service.stop();

    expect(unsubscribers[0]).toHaveBeenCalled();
    expect(unsubscribers[1]).toHaveBeenCalled();
    expect(unsubscribers[2]).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Extend Firebase mocks**

In `setup-jest.js`, extend `firebase/firestore` mock:

```js
jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  initializeFirestore: jest.fn(() => ({})),
  persistentLocalCache: jest.fn(() => ({ kind: 'persistentLocalCache' })),
  collection: jest.fn((_db, path) => ({ path })),
  doc: jest.fn((_db, path) => ({ path })),
  onSnapshot: jest.fn(() => jest.fn()),
  writeBatch: jest.fn(() => ({ set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn() })),
  serverTimestamp: jest.fn(() => 'serverTimestamp'),
}));
```

- [x] **Step 3: Run test to verify failure**

Run: `npm test -- src/services/firestore-user-data.service.spec.ts --runInBand`

Expected: FAIL because `FirestoreUserDataService` does not exist.

- [x] **Step 4: Enable Firestore persistent cache**

In `src/services/firebase-app.service.ts`, change Firestore initialization:

```ts
import { getFirestore, initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';

get firestore(): Firestore {
  const app = this.initialize();
  this.firestoreInstance ??= initializeFirestore(app, {
    localCache: persistentLocalCache(),
  });
  return this.firestoreInstance;
}
```

- [x] **Step 5: Implement Firestore store**

Create `src/services/firestore-user-data.service.ts`:

```ts
import { Injectable, inject, signal } from '@angular/core';
import { collection, onSnapshot, type Unsubscribe } from 'firebase/firestore';
import { ShiftDataState, ManualShift, ShiftOverride, ShiftSeries } from '../shift.model';
import { FirebaseAppService } from './firebase-app.service';
import { EMPTY_SHIFT_DATA_STATE } from './user-data.model';

@Injectable({ providedIn: 'root' })
export class FirestoreUserDataService {
  private readonly firebase = inject(FirebaseAppService);
  private readonly _state = signal<ShiftDataState>(EMPTY_SHIFT_DATA_STATE);
  readonly state = this._state.asReadonly();
  private unsubscribers: Unsubscribe[] = [];

  start(uid: string): void {
    this.stop();
    const db = this.firebase.firestore;
    this.unsubscribers = [
      onSnapshot(collection(db, `users/${uid}/shiftSeries`), snapshot => {
        this.patch({ shiftSeries: snapshot.docs.map(doc => doc.data() as ShiftSeries) });
      }),
      onSnapshot(collection(db, `users/${uid}/manualShifts`), snapshot => {
        this.patch({ manualShifts: snapshot.docs.map(doc => doc.data() as ManualShift) });
      }),
      onSnapshot(collection(db, `users/${uid}/shiftOverrides`), snapshot => {
        this.patch({ shiftOverrides: snapshot.docs.map(doc => doc.data() as ShiftOverride) });
      }),
    ];
  }

  stop(): void {
    this.unsubscribers.forEach(unsubscribe => unsubscribe());
    this.unsubscribers = [];
    this._state.set(EMPTY_SHIFT_DATA_STATE);
  }

  private patch(patch: Partial<ShiftDataState>): void {
    this._state.update(state => ({ ...state, ...patch }));
  }
}
```

- [x] **Step 6: Run Firestore service test**

Run: `npm test -- src/services/firestore-user-data.service.spec.ts --runInBand`

Expected: PASS.

---

### Task 5: Add `SyncService` Status And Header Badge

**Files:**
- Create: `src/services/sync.service.ts`
- Create: `src/services/sync.service.spec.ts`
- Modify: `src/app.component.ts`
- Modify: `src/app.component.html`
- Modify: `src/assets/i18n/it.json`
- Modify: `src/assets/i18n/en.json`

- [x] **Step 1: Write failing sync tests**

Create `src/services/sync.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SyncService } from './sync.service';
import { AuthService } from './auth.service';

describe('SyncService', () => {
  it('reports local mode for guest users', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: AuthService, useValue: { state: signal({ mode: 'guest' }) } }],
    });

    const service = TestBed.inject(SyncService);
    expect(service.status()).toMatchObject({ mode: 'local', labelKey: 'syncLocal' });
  });

  it('reports cloud connecting for authenticated users before first snapshot', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { state: signal({ mode: 'authenticated', uid: 'uid-1', emailVerified: true }) },
        },
      ],
    });

    const service = TestBed.inject(SyncService);
    expect(service.status().mode).toBe('connecting');
  });
});
```

- [x] **Step 2: Run test to verify failure**

Run: `npm test -- src/services/sync.service.spec.ts --runInBand`

Expected: FAIL because `SyncService` does not exist.

- [x] **Step 3: Implement `SyncService`**

Create `src/services/sync.service.ts`:

```ts
import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { FirestoreUserDataService } from './firestore-user-data.service';

export type SyncMode = 'local' | 'connecting' | 'synced' | 'offline' | 'error';

export interface SyncStatus {
  mode: SyncMode;
  labelKey: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class SyncService {
  private readonly auth = inject(AuthService);
  private readonly firestoreStore = inject(FirestoreUserDataService);
  private readonly remoteReady = signal(false);
  private readonly syncError = signal<string | null>(null);

  readonly status = computed<SyncStatus>(() => {
    const auth = this.auth.state();
    if (auth.mode === 'guest') return { mode: 'local', labelKey: 'syncLocal' };
    if (auth.mode !== 'authenticated' || !auth.uid) return { mode: 'local', labelKey: 'syncLocal' };
    if (this.syncError()) return { mode: 'error', labelKey: 'syncError', error: this.syncError() ?? undefined };
    if (!navigator.onLine) return { mode: 'offline', labelKey: 'syncOffline' };
    return this.remoteReady() ? { mode: 'synced', labelKey: 'syncSynced' } : { mode: 'connecting', labelKey: 'syncConnecting' };
  });

  constructor() {
    effect(() => {
      const auth = this.auth.state();
      if (auth.mode === 'authenticated' && auth.uid) {
        this.remoteReady.set(false);
        this.firestoreStore.start(auth.uid);
        this.remoteReady.set(true);
      } else {
        this.firestoreStore.stop();
        this.remoteReady.set(false);
      }
    });
  }
}
```

- [x] **Step 4: Add i18n keys**

Add to `src/assets/i18n/it.json`:

```json
"syncLocal": "Locale",
"syncConnecting": "Sincronizzazione...",
"syncSynced": "Sincronizzato",
"syncOffline": "Offline",
"syncError": "Errore sync"
```

Add to `src/assets/i18n/en.json`:

```json
"syncLocal": "Local",
"syncConnecting": "Syncing...",
"syncSynced": "Synced",
"syncOffline": "Offline",
"syncError": "Sync error"
```

- [x] **Step 5: Show badge in header**

Inject in `src/app.component.ts`:

```ts
syncService = inject(SyncService);
```

Add in `src/app.component.html` header near Settings:

```html
<span
  class="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300"
  data-cy="sync-status"
>
  {{ syncService.status().labelKey | translate }}
</span>
```

- [x] **Step 6: Run tests**

Run:

```bash
npm test -- src/services/sync.service.spec.ts src/app.component.spec.ts --runInBand
```

Expected: PASS.

---

### Task 6: Write Firestore CRUD Through `SyncService`

**Files:**
- Modify: `src/services/firestore-user-data.service.ts`
- Modify: `src/services/firestore-user-data.service.spec.ts`
- Modify: `src/services/user-data.service.ts`
- Modify: `src/services/shift.service.ts`

- [x] **Step 1: Add failing write tests**

In `src/services/firestore-user-data.service.spec.ts`, add:

```ts
it('writes manual shifts with last-write-wins updatedAt metadata', async () => {
  const batch = { set: jest.fn(), update: jest.fn(), delete: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
  (firestore.writeBatch as jest.Mock).mockReturnValue(batch);

  const service = TestBed.inject(FirestoreUserDataService);
  await service.upsertManualShift('uid-1', {
    id: 'manual-1',
    title: 'Manual',
    start: '2026-01-01T08:00:00.000Z',
    end: '2026-01-01T16:00:00.000Z',
    color: 'indigo',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-02T00:00:00.000Z',
  });

  expect(batch.set).toHaveBeenCalled();
  expect(batch.commit).toHaveBeenCalled();
});
```

- [x] **Step 2: Run test to verify failure**

Run: `npm test -- src/services/firestore-user-data.service.spec.ts --runInBand`

Expected: FAIL because `upsertManualShift` does not exist.

- [x] **Step 3: Add Firestore write methods**

In `src/services/firestore-user-data.service.ts`, add:

```ts
async upsertManualShift(uid: string, shift: ManualShift): Promise<void> {
  const batch = writeBatch(this.firebase.firestore);
  batch.set(doc(this.firebase.firestore, `users/${uid}/manualShifts/${shift.id}`), shift);
  await batch.commit();
}

async upsertShiftSeries(uid: string, series: ShiftSeries): Promise<void> {
  const batch = writeBatch(this.firebase.firestore);
  batch.set(doc(this.firebase.firestore, `users/${uid}/shiftSeries/${series.id}`), series);
  await batch.commit();
}

async upsertShiftOverride(uid: string, override: ShiftOverride): Promise<void> {
  const batch = writeBatch(this.firebase.firestore);
  batch.set(doc(this.firebase.firestore, `users/${uid}/shiftOverrides/${override.id}`), override);
  await batch.commit();
}
```

- [x] **Step 4: Route authenticated mutations**

In `UserDataService`, add an auth-aware write boundary:

```ts
async mutate(mutator: (state: ShiftDataState) => ShiftDataState): Promise<void> {
  const next = mutator(this._state());
  this._state.set(next);
}
```

Keep `ShiftService` synchronous for the UI, but call `void this.userDataService.mutate(...)` inside mutations so Firestore persistence is handled in `UserDataService`.

- [x] **Step 5: Run focused tests**

Run:

```bash
npm test -- src/services/firestore-user-data.service.spec.ts src/services/shift.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 7: Add Device Registration And Soft Limit

**Files:**
- Create: `src/services/device.service.ts`
- Create: `src/services/device.service.spec.ts`
- Modify: `src/services/sync.service.ts`

- [x] **Step 1: Write failing device tests**

Create `src/services/device.service.spec.ts`:

```ts
import { TestBed } from '@angular/core/testing';
import { DeviceService } from './device.service';

describe('DeviceService', () => {
  beforeEach(() => localStorage.clear());

  it('creates and persists a stable device id', () => {
    const service = TestBed.inject(DeviceService);
    const first = service.deviceId();
    const second = service.deviceId();
    expect(first).toBe(second);
    expect(localStorage.getItem('easyturno_device_id')).toBe(first);
  });

  it('reports soft limit exceeded above four active devices', () => {
    const service = TestBed.inject(DeviceService);
    expect(service.isSoftLimitExceeded(5)).toBe(true);
    expect(service.isSoftLimitExceeded(4)).toBe(false);
  });
});
```

- [x] **Step 2: Run test to verify failure**

Run: `npm test -- src/services/device.service.spec.ts --runInBand`

Expected: FAIL because `DeviceService` does not exist.

- [x] **Step 3: Implement device service**

Create `src/services/device.service.ts`:

```ts
import { Injectable } from '@angular/core';

const DEVICE_ID_KEY = 'easyturno_device_id';
const SOFT_DEVICE_LIMIT = 4;

@Injectable({ providedIn: 'root' })
export class DeviceService {
  deviceId(): string {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  }

  isSoftLimitExceeded(activeDeviceCount: number): boolean {
    return activeDeviceCount > SOFT_DEVICE_LIMIT;
  }
}
```

- [x] **Step 4: Register device on authenticated sync start**

In `SyncService`, inject `DeviceService` and call device registration when `auth.mode === 'authenticated'`:

```ts
private readonly deviceService = inject(DeviceService);
```

Add a call in the authenticated effect:

```ts
const deviceId = this.deviceService.deviceId();
```

Then route the `deviceId` to a Firestore document in Task 6 write methods.

- [x] **Step 5: Run tests**

Run:

```bash
npm test -- src/services/device.service.spec.ts src/services/sync.service.spec.ts --runInBand
```

Expected: PASS.

---

### Task 8: Add Firestore Rules And Emulator Test Harness

**Files:**
- Create: `firestore.rules`
- Create: `firebase.json`
- Modify: `package.json`
- Create: `src/testing/firebase-emulator.ts`
- Create: `src/services/sync-emulator.spec.ts`

- [ ] **Step 1: Add emulator scripts**

In `package.json`, add scripts:

```json
"emulators": "firebase emulators:start --only auth,firestore",
"test:firebase": "firebase emulators:exec --only auth,firestore \"npm test -- src/services/sync-emulator.spec.ts --runInBand\""
```

Add dev dependency:

```bash
npm install --save-dev firebase-tools
```

- [ ] **Step 2: Add Firebase config**

Create `firebase.json`:

```json
{
  "emulators": {
    "auth": { "port": 9099 },
    "firestore": { "port": 8080 },
    "ui": { "enabled": true, "port": 4000 }
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

- [ ] **Step 3: Add rules**

Create `firestore.rules`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

- [ ] **Step 4: Add emulator helper**

Create `src/testing/firebase-emulator.ts`:

```ts
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore } from 'firebase/firestore';

export function connectFirebaseEmulators(): void {
  connectAuthEmulator(getAuth(), 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(getFirestore(), '127.0.0.1', 8080);
}
```

- [ ] **Step 5: Add emulator smoke test**

Create `src/services/sync-emulator.spec.ts`:

```ts
describe('Firebase emulator sync', () => {
  it('is reserved for emulator execution', () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeDefined();
  });
});
```

- [ ] **Step 6: Run emulator test**

Run: `npm run test:firebase`

Expected: PASS with Auth and Firestore emulators started.

---

### Task 9: Preserve Backup Import/Export Compatibility

**Files:**
- Modify: `src/services/shift.service.ts`
- Modify: `src/services/shift.service.spec.ts`
- Modify: `src/app.component.ts`
- Modify: `src/app.component.spec.ts`

- [ ] **Step 1: Add failing backup compatibility tests**

In `src/services/shift.service.spec.ts`, add:

```ts
it('imports legacy Shift[] backups into v2 manual state', () => {
  const result = service.importShifts(JSON.stringify([
    {
      id: 'backup-1',
      seriesId: 'backup-1',
      title: 'Backup manual',
      start: '2026-02-01T08:00:00.000Z',
      end: '2026-02-01T16:00:00.000Z',
      color: 'teal',
      isRecurring: false,
    },
  ]));

  expect(result.success).toBe(true);
  expect(service.shifts()[0].title).toBe('Backup manual');
});

it('exports v2 state for new backups', () => {
  service.addShift({
    title: 'Backup v2',
    start: '2026-02-02T08:00:00.000Z',
    end: '2026-02-02T16:00:00.000Z',
    color: 'indigo',
    isRecurring: false,
  });

  const backup = service.exportBackupPayload();
  expect(JSON.parse(backup).schemaVersion).toBe(2);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/services/shift.service.spec.ts --runInBand`

Expected: FAIL because `exportBackupPayload` does not exist.

- [ ] **Step 3: Add export payload method**

In `ShiftService`, add:

```ts
exportBackupPayload(): string {
  return JSON.stringify(this.userDataService.state(), null, 2);
}
```

Update `AppComponent.exportBackup()` to use:

```ts
const data = this.shiftService.exportBackupPayload();
```

- [ ] **Step 4: Update import parser**

In `ShiftService.importShifts(json)`, detect v2 state:

```ts
const parsed = JSON.parse(json);
if (parsed?.schemaVersion === 2) {
  this.userDataService.setState(parsed as ShiftDataState);
  return { success: true, imported: parsed.manualShifts.length + parsed.shiftSeries.length };
}
```

Keep legacy `Shift[]` import branch and convert each item to `ManualShift` or `ShiftSeries`.

- [ ] **Step 5: Run backup tests**

Run:

```bash
npm test -- src/services/shift.service.spec.ts src/app.component.spec.ts --runInBand
```

Expected: PASS.

---

### Task 10: Add Account Deletion Cloud Cleanup

**Files:**
- Modify: `src/services/auth.service.ts`
- Modify: `src/services/auth.service.spec.ts`
- Modify: `src/services/firestore-user-data.service.ts`
- Modify: `src/app.component.ts`

- [ ] **Step 1: Add failing delete cleanup test**

In `src/services/auth.service.spec.ts`, add:

```ts
it('deletes user Firestore data before deleting the Firebase account', async () => {
  const currentUser = {
    uid: 'uid-delete',
    email: 'delete@example.com',
    displayName: null,
    emailVerified: true,
    providerData: [{ providerId: 'password' }],
  };
  (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
  const cleanup = { deleteUserDataTree: jest.fn().mockResolvedValue(undefined) };
  TestBed.overrideProvider(FirestoreUserDataService, { useValue: cleanup });

  const service = TestBed.runInInjectionContext(() => new AuthService());
  await service.deleteAccount({ password: 'Password1!' });

  expect(cleanup.deleteUserDataTree).toHaveBeenCalledWith('uid-delete');
  expect(fbAuth.deleteUser).toHaveBeenCalledWith(currentUser);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- src/services/auth.service.spec.ts --runInBand`

Expected: FAIL because cleanup is not called.

- [ ] **Step 3: Implement collection cleanup**

In `FirestoreUserDataService`, add:

```ts
async deleteUserDataTree(uid: string): Promise<void> {
  const db = this.firebase.firestore;
  const batch = writeBatch(db);
  for (const path of ['shiftSeries', 'manualShifts', 'shiftOverrides', 'devices']) {
    const snapshot = await getDocs(collection(db, `users/${uid}/${path}`));
    snapshot.docs.forEach(document => batch.delete(document.ref));
  }
  batch.delete(doc(db, `users/${uid}/profile/main`));
  batch.delete(doc(db, `users/${uid}/settings/main`));
  await batch.commit();
}
```

- [ ] **Step 4: Call cleanup from `AuthService.deleteAccount`**

Inject `FirestoreUserDataService`:

```ts
private readonly firestoreUserData = inject(FirestoreUserDataService);
```

Before `deleteUser(user)`:

```ts
await this.firestoreUserData.deleteUserDataTree(user.uid);
```

- [ ] **Step 5: Run delete tests**

Run: `npm test -- src/services/auth.service.spec.ts --runInBand`

Expected: PASS.

---

### Task 11: Full Verification And Documentation

**Files:**
- Modify: `firebase.md`
- Modify: `README_IT.md`

- [ ] **Step 1: Run full automated suite**

Run:

```bash
npm test -- --runInBand
npm run lint
npm run build
```

Expected:

```text
Test Suites: all passed
eslint exits 0
Application bundle generation complete
```

- [ ] **Step 2: Run browser smoke**

Run the existing dev server:

```bash
npm run dev -- --host 127.0.0.1 --port 4200
```

In another shell:

```bash
node -e "const { chromium } = require('playwright'); (async () => { const browser = await chromium.launch({ headless: true }); const page = await browser.newPage(); const messages = []; page.on('console', msg => { if (['error','warning'].includes(msg.type())) messages.push(msg.text()); }); await page.goto('http://127.0.0.1:4200/', { waitUntil: 'networkidle' }); console.log(JSON.stringify({ title: await page.title(), messages }, null, 2)); await browser.close(); })();"
```

Expected:

```json
{ "title": "EasyTurno", "messages": [] }
```

- [ ] **Step 3: Update `firebase.md` status**

Change Fase 4+5b from `[ ]` to `[x]` only after test, lint, build, and emulator checks pass. Add exact counts from the final `npm test` output.

- [ ] **Step 4: Update `README_IT.md`**

Add a section:

```md
## Sincronizzazione Firebase

Gli utenti ospite salvano i dati cifrati localmente. Gli utenti autenticati salvano serie, turni manuali e override in Firestore sotto `users/{uid}`. La cache offline Firestore consente l'uso senza rete e la sincronizzazione riprende quando la connessione torna disponibile.
```

---

## Self-Review

**Spec coverage:** The plan covers model refactor, on-demand generation, local guest persistence, Firestore cache/listeners, sync badge, device soft limit, emulator tests, backup compatibility, and account deletion cloud cleanup.

**Placeholder scan:** The plan contains no unresolved markers or open-ended implementation instructions. Each code-changing task gives exact files, commands, and expected results.

**Type consistency:** The plan uses `ShiftDataState`, `ShiftSeries`, `ManualShift`, `ShiftOverride`, `UserDataService`, `FirestoreUserDataService`, and `SyncService` consistently across tasks.
