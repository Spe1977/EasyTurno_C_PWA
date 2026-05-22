# Agent Handoff

This repository is worked on by multiple CLI agents: Codex, Claude Code, and sometimes Gemini CLI. Treat this file as the shared handoff log and operating protocol.

## Current Project State

- Project: EasyTurno_C_PWA.
- Main recovery context: `firebase.md`.
- Active implementation plan: `docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md`.
- Completed milestone: Phase 3 Auth + Google login + account deletion.
- Completed milestone: Phase 5a list visibility window.
- Completed current-plan task: Task 1, series/manual/override model plus pure occurrence generator.
- Completed current-plan task: Task 2, `ShiftDataState` persistence behind `ShiftService` (storage key migrated to `easyturno_user_data_v2`; legacy `easyturno_shifts` still read for backward-compat migration).
- Completed current-plan task: Task 3, `UserDataService` extracted as the local store boundary. `ShiftService` now reads `state` through `userDataService.state` (readonly signal) and routes all mutations through `userDataService.setState(...)` / `userDataService.update(...)`.
- Completed current-plan task: Task 4, `FirestoreUserDataService` added with realtime listeners on `users/{uid}/{shiftSeries,manualShifts,shiftOverrides}` via `onSnapshot`, exposes loaded `ShiftDataState` as readonly signal, Firestore `persistentLocalCache` enabled in `FirebaseAppService`. Not yet wired into `UserDataService`/`ShiftService` (deferred to Task 6 per plan).
- Next implementation task: Task 5, add `SyncService` exposing `SyncStatus` (`local|connecting|synced|offline|error`) computed from `AuthService.state` and remote-snapshot readiness, plus header badge with i18n keys (`syncLocal`/`syncConnecting`/`syncSynced`/`syncOffline`/`syncError`).

## Pending Decisions — Device Limit Redesign

Discussed with the user on 2026-05-22 but **NOT to be implemented yet**. Next agent picking this up: do not start without the user explicitly authorizing the work.

Today (`src/services/device.service.ts:4`) the soft limit is `SOFT_DEVICE_LIMIT = 4` and the count includes every browser session — each unique `localStorage` instance burns a slot. The user wants a model that matches intuition: "dispositivo" = telefono/tablet su cui ho installato l'app.

Agreed model:

- Hard model: **max 3 installations** (PWA installed on home screen + future native Android), **unlimited web sessions** (visiting `easyturno.pages.dev` from any browser does not count).
- Add a third `platform` value: `'native'` (Capacitor), `'pwa-installed'` (detected via `window.matchMedia('(display-mode: standalone)').matches` or `navigator.standalone` on iOS), `'web'` (everything else).
- **Sticky upgrade**: once a `deviceId` is observed in standalone mode at least once, its Firestore doc stays `pwa-installed` forever — never downgrade back to `web` even if the user later opens it from a browser tab. Installation is a permanent identity for that `localStorage`/`deviceId`, until uninstall.
- **Limit counting**: only `platform !== 'web'` counts toward the limit. Constant moves from `4` to `3`.
- **Auto-cleanup**: on registration, delete `devices` docs with `lastActive > 90 days`. Applies to every platform. A device that re-logs in at day 100 simply re-registers and takes a fresh slot (or triggers the soft warning if all 3 are taken).
- **Manual removal in Settings**: list every active `device` doc with its platform/lastActive, with a remove button per row. This is the immediate escape hatch — uninstall+reinstall would otherwise keep the orphan slot for up to 90 days.
- **Soft limit**: exceeding 3 shows a warning, does not block. Sync is multi-device-robust by design.
- **User-facing communication is part of the deliverable**: a short paragraph (it/en) inside the Settings device list explaining (a) what counts toward the limit, (b) what does not (browser web access), (c) how to free a slot via manual removal. Without this onboarding text the limit is opaque.

Files likely impacted when implemented:

- `src/services/device.service.ts` — constant `4 → 3`; platform detection helper.
- `src/services/firestore-user-data.service.ts` — `registerDevice` writes the new `platform` enum, sticky-upgrade logic, and inline cleanup of stale docs; `activeDeviceCount` signal exposes only `platform !== 'web'`.
- `src/services/user-data.service.ts` — readonly bridge for the new split counts (`installedDeviceCount`, `webSessionCount`).
- `src/app.component.ts` — `deviceLimitExceeded` already wired; add separate display for installed vs web.
- `src/app.component.html` — Settings drawer device list + per-row remove button + explanatory copy.
- `src/assets/i18n/{it,en}.json` — new keys for the device list, limit explanation, and remove confirmation.
- Tests in `src/services/device.service.spec.ts`, `firestore-user-data.service.spec.ts`, `user-data.service.spec.ts`, `app.component.spec.ts`.

## Files To Preserve

Do not delete or reset these files unless the user explicitly asks:

- `AGENT_HANDOFF.md`
- `firebase.md`
- `docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md`
- `src/services/occurrence-generator.ts`
- `src/services/occurrence-generator.spec.ts`
- `src/services/user-data.model.ts`
- `src/services/user-data.service.ts`
- `src/services/user-data.service.spec.ts`
- `src/services/firestore-user-data.service.ts`
- `src/services/firestore-user-data.service.spec.ts`

## Worktree Policy

The worktree is expected to be dirty because multiple agents may alternate on this project.

- Always run `git status --short --branch` before starting.
- Treat unknown changes as user/other-agent work.
- Do not run destructive cleanup commands.
- Do not revert, reset, delete, or overwrite changes you did not make.
- If a file you need is already modified, read it first and work with the current content.
- If two active agents would touch the same file set, stop and ask the user which agent owns that task.

## Start-Of-Shift Checklist

Every CLI agent must do this before editing:

1. Read this file.
2. Read `firebase.md`.
3. Read the active plan.
4. Run `git status --short --branch`.
5. State:

```text
Ho letto AGENT_HANDOFF.md.
Task corrente:
File che tocchero':
Test rosso previsto:
Condizioni di stop:
```

## End-Of-Shift Checklist

Before stopping, update the latest handoff section or tell the user exactly what should be written there.

Use this format:

```text
Agent:
Date/time:
Task:
Status:
Files changed:
Tests red:
Tests green:
Open concerns:
Next agent starts from:
Do not touch:
```

## Development Rules

- Follow the active plan task-by-task unless the user changes direction.
- Use TDD for implementation work: write failing test, verify red, implement minimal code, verify green.
- Do not commit without explicit user permission.
- Keep edits scoped to the current task.
- Prefer focused verification over broad test runs when context/time is low.
- If context budget is low and the next task is large, stop at a clean handoff instead of starting a risky refactor.
- Per `cli-collaboration` skill: keep at most the last three detailed handoff blocks below; collapse older entries into the "Older Handoffs (summarized)" section.

## Current Handoff

Agent: Claude Code (Opus 4.7)
Date/time: 2026-05-22T16:55:00+02:00
Task: Two small UX fixes — (1) allowances are integer counts displayed without currency symbols in statistics; (2) the remove "X" button on an allowance row stays visible on narrow mobile screens.
Status: done; not committed (per repo policy).
Files changed:
- `src/app.component.ts` (modified) — `updateAllowanceAmount()` now floors the raw input value (`Math.floor`) so decimals can never be stored; added `formatAllowanceAmount(amount)` helper returning `String(Math.floor(amount))` (or `'0'` for non-finite/negative). No currency.
- `src/app.component.html` (modified) —
  - Allowance form row: added `min-w-0` to the name input so it can shrink; changed amount input from `w-28` to `w-20 shrink-0` and from `step="0.01"` to `step="1"` with `inputmode="numeric"`; added `shrink-0` to the remove button. The "X" is now always visible without horizontal scroll on narrow mobile widths.
  - Statistics "Financial Portfolio" badge: replaced `€ {{ amount.toFixed(2) }}` with `{{ formatAllowanceAmount(amount) }}`. Green color theme kept (user-confirmed). The "$" SVG icon (currency-circle Heroicon) was swapped for a neutral hashtag-bars icon (`M5.25 8.25h15…`) so the section reads as a count portfolio rather than a money portfolio.
- `src/app.component.spec.ts` (modified) — updated existing "should update allowance amount" test to expect integer storage; added 2 new tests for decimal flooring (`1.5 → 1`, `25.99 → 25`); added 4 unit tests for `formatAllowanceAmount` (integer, fractional flooring, zero, negative/NaN → "0"); added 1 DOM test that the rendered allowance name input has the `min-w-0` class (mocks `authService.state` to `{mode: 'guest'}` and opens the form via `openNewShiftForm()` since the whole template is gated by the auth `@switch`).
- `AGENT_HANDOFF.md` (modified) — added this handoff and then compacted older blocks per `cli-collaboration` skill.
Tests red (then made green):
- `npm test -- src/app.component.spec.ts --runInBand -t "formatAllowanceAmount|allowance form layout|decimal allowance"` → red on 7/7 new tests: `formatAllowanceAmount is not a function`, decimal floors expecting integers, and DOM query for `[data-cy="allowance-name-input"]` returning `null`.
- DOM test was further refined: the first iteration set `activeModal('form')` and called `addAllowance()` but the input was still null because the top-level template is gated by `authService.state().mode`. Fixed by mocking the auth state signal to `{mode: 'guest'}` before `detectChanges()`.
Tests green:
- `npm test -- src/app.component.spec.ts --runInBand -t "formatAllowanceAmount|allowance form layout|allowance amount as integer|decimal allowance"` → 8 tests passed.
- `npm test -- --runInBand` → 25 suites, 665 tests passed (was 658 in the previous Claude handoff, delta = +7 new tests).
- `npm run lint` → clean.
- `npm run build` → OK; initial total 1.33 MB raw / 307.99 kB estimated transfer (unchanged).
Open concerns:
- The existing spec at line 814 (now `should update allowance amount as integer`) was tightened from accepting `25.50 → 25.5` to accepting only integers, because allowances are now an integer-count concept by product intent. No other call site depended on the old decimal behavior.
- Existing stored shifts with decimal allowance amounts will be rendered through `formatAllowanceAmount`, which floors to integer at display time. Storage is not migrated; if a user edits a legacy decimal-amount allowance via the form, the next `updateAllowanceAmount` call will floor and persist as integer.
- Translation files (`it.json`, `en.json`) were intentionally not touched: `allowancesByType` text is unchanged, and there is no €-specific i18n string in the affected path.
- `web9.png` remains untracked and intentionally not committed.
Next agent starts from:
- Browser smoke (optional) on the deployed Pages URL to confirm: (a) calendar→list scrolls back to today, (b) allowance row "X" button is reachable on narrow mobile widths, (c) statistics show integer counts in the green badge with no €. Then commit/push when the user authorizes.
Do not touch:
- Do not clean unrelated dirty worktree files. Do not commit without explicit user permission.

Agent: Claude Code (Opus 4.7)
Date/time: 2026-05-22T16:35:00+02:00
Task: Fix bug — switching Calendar → List left the list at the start of an old recurring series instead of at today.
Status: done; not committed (per repo policy).
Files changed:
- `src/app.component.ts` (modified) — `toggleViewMode()` and `setViewMode()` now call `this.goToToday('auto')` when the transition is `calendar → list`, in addition to the existing search/pagination reset. The initial cold-start effect with `initialScrollDone` was a one-shot, so subsequent returns to list never re-scrolled to today.
- `src/app.component.spec.ts` (modified) — added 4 regression tests inside the `toggleViewMode / setViewMode` describe: (1) `toggleViewMode` calendar→list calls `goToToday('auto')`; (2) `setViewMode('list')` from calendar calls `goToToday('auto')`; (3) `toggleViewMode` list→calendar does NOT call `goToToday`; (4) `setViewMode('list')` while already on list does NOT call `goToToday`.
- `AGENT_HANDOFF.md` (modified) — added this handoff.
Tests red (then made green):
- `npm test -- src/app.component.spec.ts --runInBand -t "toggleViewMode / setViewMode"` → red on the two new "scrolls back to today" tests because `goToTodaySpy` had 0 calls (root cause: neither `toggleViewMode()` nor `setViewMode()` invoked `goToToday()` on calendar→list).
Tests green:
- `npm test -- src/app.component.spec.ts --runInBand -t "toggleViewMode / setViewMode"` → 9 tests passed (5 pre-existing + 4 new).
- `npm test -- --runInBand` → 25 suites, 658 tests passed (was 654, delta = +4 new tests).
- `npm run lint` → clean.
- `npm run build` → OK; initial total 1.33 MB raw / 307.99 kB estimated transfer (unchanged).
Open concerns:
- Existing `goToToday()` has its own retry loop for DOM timing, so calling it right after `viewMode.set('list')` is safe even if the list rows haven't rendered yet.
- No production behavior change beyond the calendar→list scroll; list→calendar, list→list, and calendar→calendar paths are unchanged and explicitly covered by the negative tests.
- `web9.png` remains untracked and intentionally not committed.
Next agent starts from:
- Browser smoke (optional) on the deployed Pages URL to confirm the calendar→list scroll lands on today, then commit/push when the user authorizes.
Do not touch:
- Do not clean unrelated dirty worktree files. Do not commit without explicit user permission.

Agent: Codex
Date/time: 2026-05-22T16:03:36+02:00
Task: Record production verification for Firestore shift persistence after deploying the `undefined` field sanitization fix.
Status: done
Files changed:
- `AGENT_HANDOFF.md` (modified) — added this production verification handoff.
Git / Deploy:
- Commit already pushed: `82565ea1295ddb2eaa315dfab48b4571df2c658b` (`Fix Firestore shift writes`).
- Cloudflare Pages production deploy for project `easyturno` was triggered from `main` for commit `82565ea`.
Production verification:
- User confirmed a newly created shift now creates `manualShifts` in Firestore under the authenticated UID.
- User confirmed the shift remains visible after refreshing the browser page.
Root cause closed:
- Firestore rejected shift documents containing optional fields with `undefined` values.
- `FirestoreUserDataService` now strips `undefined` recursively before writes for manual shifts, series, overrides, and batch writes.
Tests red:
- Regression test in `src/services/firestore-user-data.service.spec.ts` initially failed because `batch.set()` received `notes`, `overtimeHours`, `allowances`, and `timezone` as `undefined`.
Tests green:
- `npm test -- src/services/firestore-user-data.service.spec.ts --runInBand` → 15 tests passed.
- `npm run lint` → clean.
- `npm run format:check` → clean.
- `npm test -- --runInBand` → 25 suites, 654 tests passed.
- `npm run build` → OK.
- Pre-push hook: `npm test -- --coverage --watchAll=false` → 25 suites, 654 tests passed.
- Pre-push hook: `npm run build` → OK.
Open concerns:
- Existing old shifts that were only local before the fix are not automatically migrated to Firestore.
- `web9.png` remains untracked and was intentionally not committed.
Next agent starts from:
- Continue with any remaining release validation, Android/PWA update checks, or old local-data migration/backup flow if requested.
Do not touch:
- Do not clean unrelated dirty worktree files. Do not commit without explicit user permission.

## Older Handoffs (summarized)

Chronological, oldest first. One line per past handoff; full detail is recoverable from git history of this file.

- 2026-05-18 — Claude Code (Opus 4.7) — Task 4: added `FirestoreUserDataService` with `onSnapshot` listeners on `users/{uid}/{shiftSeries,manualShifts,shiftOverrides}` and enabled `persistentLocalCache` in `FirebaseAppService`. 18 suites / 457 tests green.
- 2026-05-20T01:00 — Antigravity (Gemini 2.0) — Task 6: implemented Firestore cloud writes (`upsertManualShift`, `upsertShiftSeries`, `upsertShiftOverride`, `applyBatch`) via `writeBatch`; `UserDataService.mutate` now auth-aware; `ShiftService` soft-deletes manual shifts and series. 20 suites / 468 tests.
- 2026-05-20T01:30 — Antigravity (Gemini 3.5) — Tasks 8–10: `firestore.rules`, `firebase.json` emulator config, schema-v2 backup compat with legacy auto-conversion, `deleteUserDataTree` wired into `auth.deleteAccount`, emulator smoke spec. 22 suites / 472 tests.
- 2026-05-20T01:35 — Antigravity (Gemini 3.5) — Task 12 hardening: Auth UI tests, generator edge cases (leap years, DST → UTC-based `advanceDate`), Firestore batch coverage. 21 suites / 489 tests.
- 2026-05-20T01:45 — Antigravity (Gemini 3.5) — Phase 6.3: FCM `PushNotificationService` + `firestore-user-data.registerDevice` token/platform fields + `SyncService` token sync. 24 suites / 509 tests.
- 2026-05-20T02:15 — Antigravity (Gemini 3.5) — Phase 6 completion: Android signing, Firebase SDK in `build.gradle`, `google-services.json` with SHA-1, device-limit UI warning + i18n.
- 2026-05-20T17:05 — Antigravity (Gemini 3.5) — Phase 7 cleanup: fixed 4th-listener (devices) test, lint cleanup in push service, README updates for emulator + Android prereqs.
- 2026-05-20T17:15 — Antigravity (Gemini 2.0) — Phase 7: Premium Statistics drawer redesign in `app.component.html` (quick presets, asymmetric metric grid, allowance wallet, high-fidelity empty state).
- 2026-05-20T17:39 — Codex — coverage hardening: statistics helpers, device soft-limit warning, `firebase-app.service.spec`. 24 suites / 521 tests; coverage 90.54% statements / 79.60% branch.
- 2026-05-20T17:25 — Antigravity (Gemini 3.5) — gap-filling tests for `email-verification-screen` and full `UserDataService.mutate`. 23 suites / 512 tests.
- 2026-05-20T17:59 — Codex — full debug: Playwright `bootEmptyApp()` now enters guest mode via auth screen; decryption-error E2E corrupts the v2 storage key instead of legacy. 17/17 Playwright + 24/521 Jest green.
- 2026-05-20T18:03 — Codex — Prettier-only formatting on the 9 `src/` files previously red on `format:check`. No behavior change.
- 2026-05-21T09:03 — Antigravity (Gemini 3.5) — header polish on mobile: online/offline indicator stacked under "EasyTurno", obsolete right-side sync badge removed.
- 2026-05-21T09:20 — Antigravity (Gemini 3.5) — wrote `docs/superpowers/plans/2026-05-21-test-coverage-hardening-95.md` (95% coverage target).
- 2026-05-21T09:30 — Antigravity (Gemini 3.5) — hardening for `AppComponent`, `SwUpdateService`, `CalendarService`, `CryptoService`, `FirestoreUserDataService`, `ShiftService`; fixed `getApps` mock leak. 25 suites / 582 tests; coverage 95.71% statements / 87.59% branch.
- 2026-05-21T10:03 — Codex — pushed branch coverage to ≥95%: tightened `sw-update`, AppComponent guards, calendar, email-verification, auth, crypto, notification, occurrence, shift, translation, user-data, sync.service Prettier fix. 25/646 green; coverage 98.45%S / 95.19%B.
- 2026-05-21T10:12 — Codex — codex-security scan: 3 findings — Medium `android:allowBackup="true"`, Medium 13 `npm audit` vulns (`firebase-tools`, `@capacitor/assets`), Low FCM raw token logged. Report under `/tmp/codex-security-scans/EasyTurno_C_PWA/`.
- 2026-05-21T10:21 — Codex — documented remediation roadmap in `docs/superpowers/plans/2026-05-21-security-findings-remediation.md` and `firebase.md`.
- 2026-05-21T14:12 — Codex — implemented security roadmap: redacted FCM token log, `allowBackup="false"`, `firebase-tools@^15.18.0`, removed vulnerable `@capacitor/assets`, narrowed `file_paths.xml`. `npm audit` clean; Gradle `assembleDebug` OK.
- 2026-05-21T14:30 — Codex — web/PWA verification + prep for commit/push. Confirmed Pages project `easyturno` connected to `main`; localhost SW disabled by design so PWA proof needs HTTPS Pages URL.
- 2026-05-21T14:58 — Codex — commit `8d27879` (`feat: add auth sync pwa and android release prep`) pushed to `origin/main`; Cloudflare Pages production deploy success at `https://easyturno.pages.dev`. Manifest/SW/security headers verified via curl.
- 2026-05-21T15:32 — Codex — fix auth UX: registration password requirements panel now opens on focus/input (not only on submit error). 25/649 green.
- 2026-05-22T14:56 — Codex — two app bugs: (a) cold-start `goToToday()` now retries when the target row is not yet in the DOM; (b) editing a single manual shift into a recurring one now soft-deletes the original manual shift and creates a `ShiftSeries` atomically. 25/651 green.
- 2026-05-22T15:07 — Codex — Firestore read path fix: `UserDataService` now mirrors `FirestoreUserDataService.state()` into its own state when authenticated, so cloud shifts reach `ShiftService.shifts()`. 25/652 green.
- 2026-05-22T15:37 — Codex — diagnostic regression test proving `ShiftService.addShift()` calls `FirestoreUserDataService.upsertManualShift()` when authenticated; pointed at deployed/PWA cache as next investigation surface. 25/653 green.
