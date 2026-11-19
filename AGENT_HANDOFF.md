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
- Completed current app change: reload/update app button in the view-toggle bar, with service-worker update activation when an update is waiting and normal reload otherwise.

## Next App Changes — Ordered Priority

Do not implement any item in this section without the user explicitly authorizing the work.

1. **Security remediation** — ✅ COMPLETE (verified 2026-05-24 by Claude Code; implementation was done by Codex on 2026-05-21). All four fixes are in the worktree: FCM token log redacted (`push-notification.service.ts:33`), `android:allowBackup="false"`, `firebase-tools@^15.18.0` + `@capacitor/assets` removed, `file_paths.xml` narrowed to `cache-path`. **One residual advisory is risk-accepted and documented** in `firebase.md` and `docs/superpowers/plans/2026-05-21-security-findings-remediation.md`: 6 `moderate` npm-audit advisories transitive inside firebase-tools (`uuid<11.1.1`, GHSA-w5hq-g745-h8pq) — firebase-tools 15.18.0 is the latest, the only fix is a breaking `--force` downgrade, and the CLI is dev/release-only with no runtime exposure in the shipped PWA/APK. No further action unless upstream ships a firebase-tools without `uuid<11.1.1`.

2. **Device limit redesign** — ✅ COMPLETE (implemented 2026-05-24 by Claude Code, after the user authorized priority #2; agreed model from 2026-05-22). Not committed (no commit permission this turn).

The "max 3 installations" model was implemented in full:

- Hard model: **max 3 installations** (PWA on home screen + native Android), **unlimited web sessions** (a browser tab on `easyturno.pages.dev` does not count).
- Third `platform` enum: `'native'` (Capacitor), `'pwa-installed'` (standalone display-mode / iOS `navigator.standalone`), `'web'`. `DeviceService.detectPlatform()` returns the currently-observed value.
- **Sticky upgrade**: `FirestoreUserDataService.registerDevice` reads the existing doc and never lowers a stored `native`/`pwa-installed` back to `web` (precedence `native > pwa-installed > web`).
- **Limit counting**: `activeDeviceCount` (= installed count) now counts only `platform !== 'web'`; `SOFT_DEVICE_LIMIT` is `3`. `webSessionCount` exposed separately.
- **Auto-cleanup**: `registerDevice` prunes, in the same batch, other `devices` docs whose `lastActive` is older than 90 days; never deletes the current device.
- **Manual removal in Settings**: authenticated Settings drawer lists every device (platform badge, "this device" marker, localized last-active) with a per-row trash button + inline Remove/Cancel confirm → `UserDataService.removeDevice(deviceId)` → `FirestoreUserDataService.removeDevice`.
- **Soft limit**: still a non-blocking warning when installed > 3.
- **User-facing copy**: it/en explanatory paragraph in the device list (what counts, what doesn't, how to free a slot) + reworded `deviceLimitExceededBody`.

Files changed (all uncommitted): `device.service.ts` (+spec), `firestore-user-data.service.ts` (+spec), `user-data.service.ts` (+spec), `sync.service.ts` (+spec — now passes `detectPlatform()` into `registerDevice`), `app.component.ts`/`.html`/`.spec.ts`, `src/assets/i18n/{it,en}.json`. `firestore.rules` unchanged (owner already has write/delete on `users/{uid}/**`). Verification: full Jest suite 685/685 green, lint clean, `ng build` OK (1.34 MB raw / 310.39 kB transfer). No authenticated browser smoke (device list only renders when logged in).

3. **List recurring-series indicator** — completed by Codex on 2026-05-24. Added a repeat-style icon only in **Lista** rows when `shift.isRecurring === true`, near the shift title, with it/en accessibility label. Follow-up polish made it larger, exactly 15px from the title container, and higher contrast in both light and dark mode. Calendar view intentionally unchanged.

4. **Reload/update app button** — completed by Codex on 2026-05-24. Added a small rotating-arrow button in the sticky view-toggle bar. It is positioned in the left grid column so, on mobile, it sits visually between the app's left edge and the "Lista" toggle; in Calendario it stays in the same bar and does not crowd calendar controls. Behavior uses `SwUpdateService.reloadOrActivateUpdate()`: activate the waiting service worker when `updateAvailable()` is true, otherwise reload the current app shell.

5. **Custom domain `easyturno.com`** — future branding/deploy work; details under Future Ideas below.

## Known Bugs

No active known bugs in this section after the 2026-05-24 Codex fix for cold PWA reopen scroll timing.

## Future Ideas

Not scheduled; do not act on these without the user explicitly authorizing the work.

- **Custom domain `easyturno.com`**: noted on 2026-05-22. If the domain turns out to be available, register it and point it at the existing Cloudflare Pages project `easyturno` (today live at `easyturno.pages.dev`). Goal is to ship a real marketing/landing site at the apex domain alongside the PWA. Implications to plan for at that time: (a) Cloudflare Pages custom-domain setup + DNS records, (b) add the new domain to Firebase Auth authorized domains (currently `easyturno.pages.dev`), (c) update the PWA manifest `start_url`/`scope` and CSP `connect-src` if needed, (d) HSTS / canonical redirects from `.pages.dev` to the apex, (e) email/landing copy in `it` + `en`. Keep `easyturno.pages.dev` working in parallel during the cutover.

## Maintenance / Tech Debt

Not scheduled; do not act on these without the user explicitly authorizing the work.

- **Husky deprecation (will fail in husky v10)** — ✅ DONE (2026-05-24 by Claude Code, user-authorized). Removed the deprecated 2-line preamble (`#!/usr/bin/env sh` + `. "$(dirname -- "$0")/_/husky.sh"`) from all user hooks that had it: `.husky/pre-commit`, `.husky/post-checkout`, `.husky/post-merge` (`.husky/pre-push` already lacked it). husky is v9.1.7; hooks now match the v9/v10 format and the `husky - DEPRECATED` warning is gone.
- **CI parity for Playwright (e2e) locally** — ✅ DONE (2026-05-24 by Claude Code, user-authorized). Added the full Playwright suite (`npm run test:pw`, 17 tests) to `.husky/pre-push` after the existing Jest + build steps. It runs by default; quick docs-only pushes can skip just that step with `SKIP_PW=1 git push` (Jest + build still run). Chosen over a smoke-only subset because the regression that motivated this (`shift-title-row`) lives in `app-flows.spec.ts`, not `smoke.spec.ts`, and over a mandatory-only hook because a scoped skip avoids pushing people toward `git push --no-verify` (which bypasses everything).
- **Remove stray screenshot PNGs committed to GitHub** — ✅ DONE (2026-05-24 by Claude Code, user-authorized). `git rm`'d all 8 (`web.png`, `web2.png`–`web8.png`) and added a `web*.png` rule to `.gitignore`. `web9.png` remains on disk (local-only, never on GitHub) and is now ignored too.

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

Agent: Gemini CLI
Date/time: 2026-11-19T11:44:36+01:00
Task: Execute Fase 6 of `update.md` (Steps 6.1–6.3: CI Node matrix & `engines` alignment, post-build `check-csp` & `test:firebase` JDK 21 CI job, full local verification suite, `README.md`/`README_IT.md` sync, commit/push on `chore/pwa-update-plan`, PR to `main`, and superseded Dependabot PR cleanup) under `cli-collaboration` protocol.
Status: in-progress (local verification green; preparing commit, push, PR, and Dependabot closure).
Files changed:
- Added: `scripts/ci-config.spec.ts` (TDD verification for `package.json` `engines`, `.github/workflows/ci.yml`, and `angular.json` bundle budgets).
- Modified: `package.json` (`engines.node` aligned to `^22.22.3 || ^24.15.0 || >=26.0.0`).
- Modified: `.github/workflows/ci.yml` (`test` matrix `[22.x, 24.x]` with `dist-node-${{ matrix.node-version }}` artifacts, `npx tsc --noEmit` + `npx tsc -p playwright/tsconfig.json --noEmit`, post-build `npx jest scripts/check-csp.spec.ts`, new `firebase` job with `actions/setup-java@v4` JDK 21 + `npm run test:firebase`, `playwright` job on `24.x`).
- Modified: `README.md` & `README_IT.md` (removed Cypress/`npm run e2e`, updated tech stack versions, Node requirements, Phase 4/5 architecture tree, Current Status metrics, Playwright specs list, and 3-installed-device soft limit).
- Modified: `update.md` & `AGENT_HANDOFF.md`.
Tests red:
- Step 6.1 TDD: `scripts/ci-config.spec.ts` failed (`7 failed, 2 passed`) before aligning `package.json` `engines.node` and `.github/workflows/ci.yml`.
- Outside local host capability: `npm run test:firebase` blocked locally by missing Java runtime (`java` absent); added `firebase` job with JDK 21 in `.github/workflows/ci.yml` per user choice.
Tests green (verified cleanly after final code/README edits):
- `npm ci` (clean, no `--legacy-peer-deps`)
- `npm audit --omit=dev --audit-level=high` (`0` vulnerabilities)
- `npm run lint` (`0` errors) & `npm run format:check` & Prettier on modified root/CI/script files (clean)
- `npx tsc --noEmit` & `npx tsc -p playwright/tsconfig.json --noEmit` (`0` errors)
- `npm test -- --coverage --watchAll=false` (`33/33` suites, `742/742` passed in 9.36 s; `98.85%` Stmts / `95.25%` Branch / `97.49%` Funcs / `99.64%` Lines)
- `npm run build` (`2.889 s`, Initial total `340.52 kB` raw / `86.56 kB` transfer) & `npx jest scripts/check-csp.spec.ts` (`19/19` passed, 0 skipped)
- `npm run test:pw` (`40/40` passed in 49.3 s)
Open concerns:
- Awaiting GitHub Actions CI run on the PR for live verification of the new `firebase` (`test:firebase` with JDK 21) and `22.x`/`24.x` matrix jobs.
Next agent starts from: Push `chore/pwa-update-plan`, open PR to `main`, close superseded Dependabot PRs, and monitor CI checks.
Do not touch: `.~lock.update.md#` (if present), `web9.png`, `android/`, external `EasyTurno_C_PWA`, `occurrence-generator.*`, `user-data.model.ts`, `user-data.service.*`, `firebase.md`, `docs/superpowers/plans/*`.

---

Agent: Gemini CLI
Date/time: 2026-11-19T11:30:11+01:00
Task: Execute Fase 5 of `update.md` (Steps 5.1–5.4: Service Worker update lifecycle fix, versioned cache strategy + LRU pruning + Vary:Origin resilience, pipe memoization & large-dataset occurrence/sort/calendar optimization, PWA manifest + meta + ARIA dialog focus trap/restore & contrast) on branch `chore/pwa-update-plan` under `cli-collaboration` protocol.
Status: done; committed on branch `chore/pwa-update-plan` (user-authorized, together with Fase 4 working-tree changes).
Files changed:
- Modified: `sw.js` (`CACHE_VERSION = 'v7'`, removed auto `self.skipWaiting()` from `install`, kept same-origin-verified `SKIP_WAITING` handler, added cache-first for `-[A-Za-z0-9_-]{8}\.(js|css|woff2?)$`, `staleWhileRevalidate` for unhashed same-origin runtime assets excluding `/sw.js`, `networkFirstNavigation` HTML shell fallback, `{ ignoreVary: true }` on `cache.match` for Vary:Origin resilience, and `MAX_RUNTIME_CACHE_ENTRIES = 60` LRU eviction).
- Added: `scripts/sw.spec.ts` (VM sandbox unit suite covering Step 5.1 update/pruning lifecycle, Step 5.2 cache-first/SWR/network-first/LRU/Vary:Origin) & `scripts/pwa-manifest.spec.ts` (manifest fields, icon paths, shortcut routes, and index/production PWA meta tag checks).
- Modified: `src/services/sw-update.service.{ts,spec.ts}` (immediate `registration.waiting` detection + duplicate `controllerchange` reload guard + tests).
- Modified: `src/services/translation.service.{ts,spec.ts}`, `src/pipes/translate.pipe.{ts,spec.ts}`, `src/pipes/date-format.pipe.{ts,spec.ts}` (per-language lookup cache, per-instance memoization with mock-safe fallback, shared bounded `WeakMap<DatePipe, Map>` cache + `Date.getTime()` mutation guard + tests).
- Modified: `src/services/shift.service.{ts,spec.ts}` (pre-indexed `overridesBySeries` map, static manual window bounds, `Date.parse` + O(N) sorted fast-path verified on ~7,300 occurrences).
- Modified: `src/app.component.{ts,html,spec.ts}` (imported `untracked` in `openModal` so effect-driven modals such as `decryptionError` do not reopen after dismiss; `indexedSortedShifts` O(N) sorted fast-path & `Date.parse` in `generateList`/`goToToday`; `[attr.inert]` on background shell, `role="status"` update banner, `aria-label` on `settings-btn`, `role="group"` + `aria-pressed` on `view-toggle`, `type="button"`, `afterEveryRender` focus open/restore + `Tab`/`Shift+Tab` dialog trap + regression tests).
- Modified: `src/components/{shift-form-modal,statistics-drawer,settings-drawer,confirm-dialog,shift-list-item,calendar}.component.ts` + corresponding `.spec.ts` (`aria-labelledby`, `<label for>`, `aria-pressed`, `tabindex="-1"`, `Date.parse` + `colorByTitle` map in `StatisticsDrawer`, single-pass `shiftsByDay` & cached `Intl.DateTimeFormat` + keyboard Enter/Space navigation in `Calendar`, AA contrast refinements on helper captions).
- Modified: `manifest.webmanifest` (`"id": "/"`), `index.html`, `index.production.html` (SVG icon link + `apple-mobile-web-app-title`).
- Added: `playwright/tests/fase5-pwa-perf.spec.ts` (+2 E2E tests covering real `@defer` JS chunk caching, offline reload/calendar rendering, SW `v7` → `v8-e2e` `waiting` pause + `SKIP_WAITING` activation + `v7` cache pruning, manifest/icons HTTP 200, shortcut URL, modal focus trap/restore, and keyboard calendar navigation).
- Modified: `update.md` (checked off Steps 5.1–5.4 and recorded Fase 5 execution row) & `AGENT_HANDOFF.md` (this block + collapsed `2026-11-18T15:24:00+01:00` Fase 2 handoff).
Tests red:
- Step 5.1 & 5.2 TDD: `scripts/sw.spec.ts` failed against legacy `v6` auto-skipWaiting `sw.js`, failed on `Vary: Origin` mismatch test before adding `{ ignoreVary: true }`; `sw-update.service.spec.ts` failed for pre-existing `registration.waiting` detection before service update.
- Step 5.3 & 5.4 TDD: pipe/service/accessibility unit tests failed before memoization, O(N) sort optimization, ARIA attributes, and `untracked(() => this.activeModal())` fix (`app.component.spec.ts` `dismissDecryptionError` stayed `'decryptionError'` until `untracked` was added).
- Pre-existing outside Gate: `tsconfig.spec.json` spec diagnostics & `npm run test:firebase` (no local Java runtime).
Tests green (verified after final code/test edit):
- `npm run format:check` & `npx prettier --check sw.js manifest.webmanifest scripts/sw.spec.ts scripts/pwa-manifest.spec.ts playwright/tests/fase5-pwa-perf.spec.ts` (clean)
- `npm run lint` (0 errors) & `npx tsc --noEmit` & `npx tsc -p playwright/tsconfig.json --noEmit` (0 errors)
- `npm test -- --coverage --watchAll=false` (32/32 suites, 733/733 passed in 7.601 s; 98.85% Stmts / 95.25% Branch / 97.49% Funcs / 99.64% Lines)
- `npm run build` (2.938 s; Initial total `340.52 kB` raw / `86.56 kB` transfer)
- `npx jest scripts/check-csp.spec.ts` (19/19 passed)
- `npm audit --omit=dev --audit-level=high` (0 vulnerabilities)
- `npm run test:pw` (40/40 passed in 51.7 s, including `playwright/tests/fase5-pwa-perf.spec.ts`)
Open concerns:
- `npm run test:firebase` still requires an environment with JDK/Java (scheduled in Fase 6).
Next agent starts from: Execute Fase 6 (`update.md` Steps 6.1–6.3: CI alignment for `check-csp` post-build and Node matrix, full verification including `test:firebase`, PR & Dependabot cleanup).
Do not touch: `.~lock.update.md#` (if present), `web9.png`, `android/`, external `EasyTurno_C_PWA`, `occurrence-generator.*`, `user-data.model.ts`, `user-data.service.*`, `firebase.md`, `docs/superpowers/plans/*`.

---

Agent: Gemini CLI
Date/time: 2026-11-19T10:56:55+01:00
Task: Execute Fase 4 of `update.md` (Steps 4.1–4.4: runtime `@angular/compiler` removal, `AppComponent` decomposition into 4 `OnPush` standalone components, `@defer` + lazy Firebase SDK boundaries, `@capacitor/*-notifications` lazy imports, `angular.json` budgets & `inlineCritical` CSP evaluation) on branch `chore/pwa-update-plan` under `cli-collaboration` protocol.
Status: done on working tree (uncommitted; user did not authorize commit).
Files changed:
- Modified: `index.tsx` (removed runtime `import '@angular/compiler';`).
- Modified: `src/styles.css` (moved `.modal-fade-in` and `@keyframes fadeIn` globally so extracted components share transitions).
- Added: `src/utils/lazy-loader.ts` + `.spec.ts` (`createLazyLoader` with promise memoization & error retry reset).
- Added: `src/components/shift-form-modal.component.{ts,spec.ts}`, `src/components/statistics-drawer.component.{ts,spec.ts}`, `src/components/settings-drawer.component.{ts,spec.ts}`, `src/components/confirm-dialog.component.{ts,spec.ts}`.
- Modified: `src/app.component.{ts,html,spec.ts}` (slimmed `AppComponent` from 1,276/1,755 lines to 773/402 lines, wired `@defer (when ...; prefetch on immediate)` on `app-shift-form-modal`/`app-calendar` for deterministic offline reliability and strict on-demand `@defer (when ...)` on `app-auth-screen`/`app-email-verification-screen`/`app-settings-drawer`/`app-statistics-drawer`/`app-confirm-dialog`, `DeferBlockBehavior.Playthrough` + coverage tests in `app.component.spec.ts`).
- Modified: `src/services/firebase-app.service.{ts,spec.ts}`, `src/services/auth.service.{ts,spec.ts}`, `src/services/firestore-user-data.service.{ts,spec.ts}`, `src/services/sync.service.ts`, `src/components/auth-screen.component.ts` (lazy `import('firebase/app' | 'firebase/auth' | 'firebase/firestore')`, `sessionEpoch` guard in `FirestoreUserDataService.start/stop`, removed static `FirebaseError` import in `AuthScreenComponent`).
- Modified: `src/services/notification.service.ts` & `src/services/push-notification.service.ts` (lazy `import('@capacitor/local-notifications' | '@capacitor/push-notifications')` after `Capacitor.isNativePlatform()`).
- Modified: `angular.json` (added `production.budgets` `initial` warn `450kB`/error `600kB` and `anyComponentStyle` `4kB`/`8kB`; evaluated `inlineCritical: true` and reverted to `false` because Beasties inlines an executable `<script>` blocked by strict production CSP `script-src 'self'`).
- Modified: `package.json` (`dev:pw` updated with `--live-reload=false` alongside `--watch=false` to prevent HMR `@ng/component` polling and allow real `@defer` chunk splitting in E2E).
- Added: `playwright/tests/fase4-optimization.spec.ts` (+2 E2E tests covering zero Firebase/deferred chunks on Guest boot + on-demand fetching + Service Worker offline reload serving `@defer` chunks).
- Modified: `update.md` (checked off Steps 4.1–4.4, recorded Fase 4 row and exact before/after bundle comparison) & `AGENT_HANDOFF.md` (this block + collapsed `2026-11-18T14:41:00+01:00` Fase 1 handoff).
Tests red:
- Step 4.2 TDD extracted components: 4/4 red before component implementation.
- Step 4.3 TDD lazy Firebase specs: `firebase-app.service.spec.ts` (5 failed) & `firestore-user-data.service.spec.ts` (1 failed) before lazy service refactor.
- `src/utils/lazy-loader.spec.ts`: red before implementing `lazy-loader.ts`.
- Pre-existing outside Gate: `tsconfig.spec.json` spec diagnostics & `npm run test:firebase` (no local Java runtime).
Tests green (verified cleanly after final edits):
- `npm run lint` & `npm run format:check` & `npx tsc --noEmit` & `npx tsc -p playwright/tsconfig.json --noEmit`
- `npm test -- --coverage --watchAll=false` (30/30 suites, 697/697 passed; 98.85% Stmts / 94.96% Branch / 97.85% Funcs / 99.61% Lines)
- `npm run build` (Initial total `335.24 kB` raw / `85.23 kB` transfer, down from `1.65 MB` / `383.21 kB`; separate lazy chunks for Auth, Firestore, Capacitor notifications, and all 7 `@defer` UI blocks)
- `npx jest scripts/check-csp.spec.ts` (19/19 passed)
- `npm run test:pw` (38/38 passed, including `playwright/tests/fase4-optimization.spec.ts`)
Open concerns:
- Working tree is uncommitted on `chore/pwa-update-plan` awaiting explicit user commit authorization (if desired).
- Branch coverage improved from `94.75%` to `94.96%` (final 0.04% push to ≥95% aligns naturally with Step 6.2).
Next agent starts from: Review or commit Fase 4 changes (if user instructs), then proceed to Fase 5 (`update.md` Steps 5.1–5.3: PWA SW runtime optimization, icons/manifest, UX/runtime responsiveness).
Do not touch: `.~lock.update.md#` (if present), `web9.png`, `android/`, external `EasyTurno_C_PWA`, `occurrence-generator.*`, `user-data.model.ts`, `user-data.service.*`, `firebase.md`, `docs/superpowers/plans/*`.

---

## Older Handoffs (summarized)

Chronological, oldest first. One line per past handoff; full detail is recoverable from git history of this file.
- **2026-05-18 → 05-20, Claude Code + Antigravity — Firestore sync build-out (Tasks 4–12):** `FirestoreUserDataService` realtime `onSnapshot` listeners + `persistentLocalCache`; cloud writes (`upsertManualShift`/`upsertShiftSeries`/`upsertShiftOverride`/`applyBatch` via `writeBatch`) with auth-aware `UserDataService.mutate` and soft-deletes; `firestore.rules`, `firebase.json` emulator + smoke spec; schema-v2 backup compat with legacy auto-conversion; `deleteUserDataTree` wired into account deletion; generator edge cases (leap years, DST → UTC-based `advanceDate`).
- **2026-05-20, Antigravity + Codex — Phase 6 (Android/native):** Android release signing, Firebase SDK in `build.gradle`, `google-services.json` + SHA-1, FCM `PushNotificationService` + `registerDevice` token/platform fields + `SyncService` token sync, device soft-limit warning + i18n.
- **2026-05-20, Antigravity + Codex — Phase 7:** Premium Statistics drawer redesign in `app.component.html` (presets, asymmetric grid, allowance wallet, empty state); README emulator/Android prereqs; Playwright `bootEmptyApp()` guest-mode entry + v2-key decryption-error E2E; coverage + Prettier cleanup.
- **2026-05-21, Antigravity + Codex — polish + coverage:** mobile header (stacked online/offline indicator, removed sync badge); coverage hardened to ≥95% (final 98.45%S / 95.19%B) per `docs/superpowers/plans/2026-05-21-test-coverage-hardening-95.md`; auth UX fix (password-requirements panel opens on focus/input).
- **2026-05-21, Codex — security cycle:** codex-security scan (3 findings) → remediation roadmap in `firebase.md` + plan → implemented (FCM log redacted, `allowBackup="false"`, `firebase-tools@^15.18.0`, `@capacitor/assets` removed, `file_paths.xml` narrowed). Commit `8d27879` (`feat: add auth sync pwa and android release prep`) pushed; Cloudflare Pages production live at `https://easyturno.pages.dev`.
- **2026-05-24, Claude Code — security-remediation closeout (docs-only):** verified all 4 fixes in the worktree (FCM log redacted, `allowBackup="false"`, `firebase-tools@^15.18.0` / `@capacitor/assets` removed, `file_paths.xml` narrowed) and documented them in `firebase.md` + the plan; the 6 moderate `firebase-tools→uuid<11.1.1` advisories are risk-accepted (dev-only, no runtime exposure, no non-breaking fix). Committed in `1c2d8f2`.
- **2026-05-22, Codex + Claude Code — sync read/write + bug fixes:** `UserDataService` mirrors `FirestoreUserDataService.state()` when authenticated so cloud shifts reach `ShiftService.shifts()` (commit `82565ea`, user-verified in prod); cold-start `goToToday()` retry; single→recurring edit soft-deletes manual shift + creates `ShiftSeries` atomically; Calendar→List returns to today; allowances as integer counts + remove button visible on mobile.
- **2026-05-24, Codex — cold PWA reopen fix:** initial auto-scroll waits for Auth app-mode + Firestore `snapshotsReady` (new signal); `SyncStatus.synced` routed through it. Committed/pushed with user authorization.
- **2026-05-24, Codex — recurring-series list indicator:** repeat-style icon in Lista rows when `shift.isRecurring` (15px from title, high-contrast light/dark, it/en aria); calendar unchanged.
- **2026-05-24, Codex — reload/update app button:** `SwUpdateService.reloadOrActivateUpdate()` (activate waiting SW update if any, else reload) wired to an icon-only button in the view-toggle bar (3-col grid, centered left on mobile); it/en `reloadUpdateAppAria`; 175 focused tests + guest Playwright smoke green.
- **2026-05-24, Claude Code — device-limit redesign (priority #2):** max 3 installations + unlimited web sessions; third platform enum (`native`/`pwa-installed`/`web`) via `detectPlatform()`; sticky platform upgrade (`native > pwa-installed > web`); 90-day auto-cleanup of stale device docs; manual device removal in Settings; `installedDevices()` list (web excluded) + count note; it/en copy. Jest 686/686, lint, build green. Committed in `1c2d8f2`.
- **2026-05-24, Claude Code — Playwright recurring-test fix:** the `shift-title-row` wrapper (recurring indicator) added a DOM level that broke `getByText(title).locator('../..')` in the two recurring e2e tests (30s click timeouts in CI); replaced with `app-shift-list-item` host-element scoping + `.filter({ hasText })`. Reproduced red locally, then full Playwright suite 17/17 green. Committed in `89ebd7d`.
- **2026-05-24, Claude Code — commit/push of completed work:** committed + pushed all then-uncommitted work (device-limit redesign, security-remediation closeout docs, reload button, recurring indicator) to `origin/main`; Jest 686/686 + lint + build green; `web9.png` excluded. Commit `1c2d8f2`.
- **2026-05-24, Claude Code — screenshot PNG cleanup:** `git rm`'d the 8 stray `web*.png` (web.png, web2–8) from GitHub + added a `web*.png` `.gitignore` rule; `web9.png` left on disk (local-only). Commit `8fa3f81`.
- **2026-05-24, Claude Code (Opus 4.7) — tech-debt hooks & CI parity:** removed deprecated husky v9 preamble from `.husky/{pre-commit,post-checkout,post-merge}` and added full Playwright suite (`SKIP_PW=1` opt-out) to `.husky/pre-push`; verified live via commit/push.
- **2026-05-24, Claude Code (Opus 4.7) — mobile-web `h-dvh` viewport fix:** replaced `h-screen` with `h-dvh` in `src/app.component.html` so mobile sticky toggle/reload bar is visible on initial load; updated `CLAUDE.md`; user-verified in prod.
- **2026-05-25, Claude Code (Opus 4.7) — initial maintenance schedule (`update.md` doc-only):** created `update.md` 30/60-day check schedule capturing `package.json` + `android/` baseline versions and documenting accepted `firebase-tools→uuid<11.1.1` advisory.
- **2026-05-30, Claude Code (Opus 4.8) — "reset all data" Firestore sync fix:** wired `ShiftService.deleteAllShifts()` → `UserDataService.clearAll()` → `FirestoreUserDataService.clearShiftData(uid)` so resetting shifts clears `shiftSeries`/`manualShifts`/`shiftOverrides` on Firestore while leaving `devices`/`profile`/`settings` intact; Jest 689/689, lint, build green (merged to `main` in `b4ce8d7`).
- **2026-11-18, Gemini CLI (Antigravity Swarm) — Fase 0 (`update.md` Steps 0.1–0.4) on `chore/pwa-update-plan`:** removed stray root artifacts + Cypress (`cypress/` & deps), cleaned `tsconfig.json`, added `playwright/tests/calendar-offline.spec.ts` (+13 E2E tests), moved build/CLI/Android packages to `devDependencies` (`npm audit --omit=dev` 62 → 8 vuln); Lint/Prettier/TSC/Jest (689/689)/build/CSP/Playwright (30/30) green.
- **2026-11-18, Gemini CLI (Antigravity Swarm) — Fase 1 (`update.md` Steps 1.1–1.2) on `chore/pwa-update-plan`:** aligned ESLint 10 / Prettier 3.10.1 / Jest 30.5.2 / `ts-jest@29.4.15` / `jest-preset-angular@16.2.0` / `@playwright/test@1.65.1` without `--legacy-peer-deps`, removed `handlebars` override (`critical` 7 → 5); Lint/Prettier/TSC/Jest (689/689)/build/CSP/Playwright (30/30) green (committed on `chore/pwa-update-plan`).
- **2026-11-18, Gemini CLI (Antigravity Swarm) — Fase 2 (`update.md` Steps 2.1–2.4) on `chore/pwa-update-plan`:** upgraded Angular `22.2.6`/`22.2.7`, TS `~6.0.3`, Tailwind `4.3.5`, Firebase `13.4.0`, Capacitor JS `8.6.2` with clean `npm ci` (`--legacy-peer-deps` removed) and `@grpc/grpc-js: ^1.14.7` override (`0` `--omit=dev` high/critical vulns); Lint/Prettier/TSC/Jest (689/689)/build/CSP/Playwright (30/30) green (`test:firebase` blocked locally by missing Java).
- **2026-11-18, Gemini CLI (Antigravity Swarm) — Fase 3 (`update.md` Steps 3.1–3.4) on `chore/pwa-update-plan`:** moved `<app-toast-container>` out of modal `@if`/`@switch`, replaced `bg-opacity-50` with `bg-black/50`, mapped `CalendarComponent` `borderLeftColor` to hex, internationalized Statistics modal (`212/212` i18n keys); Lint/Prettier/TSC/Jest (701/701)/build/CSP (19/19)/Playwright (36/36) green.
