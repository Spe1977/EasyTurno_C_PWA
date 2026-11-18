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

Agent: Gemini CLI (Antigravity Swarm)
Date/time: 2026-11-18T16:03:25+01:00
Task: Execute Fase 3 of `update.md` (Steps 3.1–3.4: toast container visibility outside modals, Tailwind v4 `bg-black/50` backdrop, Calendar `borderLeftColor` hex mapping, Statistics modal i18n keys + Fase 3 Gate) on branch `chore/pwa-update-plan` under `cli-collaboration` protocol.
Status: done; committed on branch chore/pwa-update-plan (user-authorized).
Files changed:
- Modified: `src/app.component.html` (moved `<app-toast-container></app-toast-container>` out of `@if (activeModal() !== 'none')` and `@switch` to root level at line 1755; replaced `bg-opacity-50 ... bg-black` at line 331 with `bg-black/50`; wired Statistics modal copy and singular/plural shift units to `| translate`).
- Modified: `src/app.component.spec.ts` (+9 TDD unit tests for toast visibility with closed modal / auth screen, `bg-black/50` backdrop, and EN Statistics modal translation + key parity).
- Modified: `src/assets/i18n/it.json` & `src/assets/i18n/en.json` (+5 symmetric keys: `statsSubtitle`, `statsShiftSingular`, `statsShiftPlural`, `statsCalculatedLocally`, `statsNoShiftsDescription`; `212` leaf keys in exact parity).
- Modified: `src/components/calendar.component.ts` (bound `[style.borderLeftColor]="getShiftIndicatorColor(shift)"` on selected-day shift card preserving `data-cy`, added `Object.hasOwn` guard, `CSS_COLOR_REGEX`, and `COLOR_MAP.slate` `#64748B` fallback).
- Modified: `src/components/calendar.component.spec.ts` (+3 TDD unit tests for `'sky'` `borderLeftColor`, all 8 `ShiftColor` keys, and unknown/empty fallback).
- Added: `playwright/tests/fase3-fixes.spec.ts` (+6 E2E tests covering Steps 3.1–3.4) & Modified: `playwright/tests/helpers.ts` (`createShift` optional `color` param).
- Modified: `update.md` (checked off Steps 3.1–3.4, added Fase 3 row in `Registro Avanzamento Esecuzioni`), `AGENT_HANDOFF.md` (this block + collapsed `2026-11-18T14:25:00` Fase 0 handoff into Older Handoffs).
Tests red:
- Pre-fix TDD baseline: `calendar.component.spec.ts` (`3 failed, 53 passed, 56 total`), `app.component.spec.ts` (`8 failed, 151 passed, 159 total`), `playwright/tests/fase3-fixes.spec.ts` on unpatched HEAD (`6 failed`).
- Outside Gate (pre-existing): `npm run test:firebase` not re-run (local host lacks Java runtime); `npx tsc -p tsconfig.spec.json --noEmit` pre-existing spec diagnostics unchanged.
Tests green (verified on final code/test changes before updating `update.md`/`AGENT_HANDOFF.md`):
- `npm run lint` (0 errors) & `npm run format:check` ("All matched files use Prettier code style!")
- `npx eslint --no-ignore playwright/tests/fase3-fixes.spec.ts playwright/tests/helpers.ts` (0 errors) & `npx prettier --check` (clean)
- `npx tsc --noEmit` & `npx tsc -p playwright/tsconfig.json --noEmit` (0 errors)
- `npm test -- --coverage --watchAll=false` (25/25 suites, 701/701 passed in 6.209 s; 98.32% Stmts / 94.75% Branch / 96.83% Funcs / 99.18% Lines)
- `npm run build` (4.113 s; Initial total `1.65 MB` raw / `383.21 kB` transfer: `main` `1.58 MB` / `371.76 kB`, `styles` `65.25 kB` / `8.29 kB` including `.bg-black\/50`, `chunk` `8.69 kB` / `3.15 kB`; Lazy `web` `4.51 kB` / `1.14 kB`)
- `npx jest scripts/check-csp.spec.ts` (19/19 passed in 0.819 s, 0 skipped)
- `npm run test:pw` (36/36 passed in 49.6 s, including 6/6 in `playwright/tests/fase3-fixes.spec.ts`)
Open concerns:
- `src/` still has 3 legacy `flex-shrink-0` and 3 `flex-grow` utilities (verified still emitted by Tailwind `4.3.5` in `dist/styles-*.css`; 0 `*-opacity-*` classes remain).
- `npm run test:firebase` still awaits an environment with JDK/Java; `Branch` coverage is `94.75%` (target `>=95%` in Step 6.2).
Next agent starts from: Proceed to Fase 4 (`update.md` Steps 4.1–4.4: remove runtime `@angular/compiler` import in `index.tsx`, decompose `AppComponent`, `@defer` + lazy Firebase loading, bundle budgets & critical CSS).
Do not touch: `web9.png` (local-only if present), external folder `EasyTurno_C_PWA`, `android/` (excluded per `update.md` web-only scope).

---

Agent: Gemini CLI (Antigravity Swarm)
Date/time: 2026-11-18T15:24:00+01:00
Task: Execute Fase 2 of `update.md` (Steps 2.1–2.4: Angular 22.2.x, TS ~6.0.3, Tailwind 4.3.x, Firebase 13.4.0, Capacitor 8.x JS patches, clean `npm ci` without `--legacy-peer-deps`) on branch `chore/pwa-update-plan` under `cli-collaboration` protocol.
Status: done; committed on branch chore/pwa-update-plan (user-authorized; `npm run test:firebase` blocked locally due to missing Java runtime).
Files changed:
- Modified: `package.json` & `package-lock.json` (Angular `22.2.6` runtime/compiler & `22.2.7` cli/build, removed `@angular/platform-browser-dynamic` and unused direct `vite`; `typescript@~6.0.3`, `zone.js@~0.16.3`, `jest-preset-angular@^17.0.3`; `tailwindcss@^4.3.5`, `@tailwindcss/postcss@^4.3.5`, `postcss@^8.5.33`; `firebase@^13.4.0`, `firebase-tools@^15.36.0`; `@capacitor/{core,cli,android}@^8.6.2` and plugin patches `app@^8.1.2`, `haptics@^8.0.2`, `local-notifications@^8.3.1`, `push-notifications@^8.1.3`, `share@^8.0.3`, `splash-screen@^8.0.2`, `status-bar@^8.0.4`; added `"overrides": { "@grpc/grpc-js": "^1.14.7" }` for Node-only `@firebase/firestore` dependency to clear `GHSA-m9gg-hp2v-232j` / `GHSA-f596-whhp-79r4` in `--omit=dev`).
- Modified: `.github/workflows/ci.yml` (removed `--legacy-peer-deps` from both `npm ci` steps on lines 28 and 76).
- Modified: `setup-jest.js` (migrated to `BrowserTestingModule`, `platformBrowserTesting` from `@angular/platform-browser/testing` + `import '@angular/compiler'`).
- Modified: `tsconfig.json` (removed `disableTypeScriptVersionCheck: true`; kept Angular 22 `strictTemplates` active).
- Modified: `src/components/toast-container.component.ts` (added `ChangeDetectionStrategy.Eager` via Angular v22 migration).
- Modified: `src/app.component.html` (added `?? 0` fallback at lines 1613 and 1658 for Angular 22 strict template checking under `noUncheckedIndexedAccess`).
- Modified: `update.md` (checked off Steps 2.1–2.4 except `npm run test:firebase` left unchecked with host Java note, documented `@grpc/grpc-js` override in Appendice A, added Fase 2 row in `Registro Avanzamento Esecuzioni`), `AGENT_HANDOFF.md` (this block + collapsed `2026-05-30` handoff into Older Handoffs).
Tests red:
- `npm run test:firebase`: blocked locally (`Error: Could not spawn java -version` — no `java` runtime installed on host, identical to baseline; emulator suite cannot execute until run in an environment with JDK).
- `npx tsc -p tsconfig.spec.json --noEmit`: 213 pre-existing errors across 11 `*.spec.ts` files (0 new TypeScript 6 errors vs baseline).
Tests green:
- `npm ci` without `--legacy-peer-deps` (`added 1408 packages, and audited 1415 packages in 11s`)
- `npx tsc --noEmit` & `npx tsc -p playwright/tsconfig.json --noEmit` (0 errors)
- `npm run lint` (0 errors) & `npm run format:check` ("All matched files use Prettier code style!")
- `npm test -- --coverage --watchAll=false` (25/25 suites, 689/689 passed in 8.605 s; 98.32% Stmts / 94.73% Branch / 96.83% Funcs / 99.18% Lines)
- `npm run build` (3.946 s; Initial total `1.65 MB` raw / `382.97 kB` transfer: `main` `1.58 MB` / `371.52 kB`, `styles` `65.25 kB` / `8.29 kB`, `chunk` `8.69 kB` / `3.15 kB`; Lazy `web` `4.51 kB` / `1.14 kB`; Tailwind v4 `@layer`, `.dark`, and all 8 shift palettes verified in `dist/styles-*.css`)
- `npx jest scripts/check-csp.spec.ts` (19/19 passed in 1.169 s, including `dist/index.html` & `dist/_headers`, 0 skipped)
- `npm run test:pw` (30/30 passed in 39.7 s)
- `npm audit --omit=dev --audit-level=high` (0 vulnerabilities; full `npm audit`: 72 total, down from 131, 0 critical)
Open concerns:
- `npm run test:firebase` has not run against live Auth/Firestore emulators yet because no JDK/Java is installed on this host.
- Initial bundle grew from `1.34 MB` / `310.52 kB` to `1.65 MB` / `382.97 kB` after Firebase `13.4.0` (targeted for reduction in Fase 4 via JIT `@angular/compiler` removal + `@defer` + lazy Firebase imports).
- `firebase@13.4.0` subpackages declare `engines.node: >=24.12.0` (`npm ci` on CI Node `22.x` prints `EBADENGINE` warnings unless Node is bumped to `24.x` in Fase 6 Step 6.1).
- `tsconfig.spec.json` still has 213 pre-existing spec diagnostics outside the Gate.
Next agent starts from: Optionally run `npm run test:firebase` on a machine/CI runner with Java installed, and proceed to Fase 3 (`update.md` Steps 3.1–3.4: toast container placement outside activeModal, Tailwind v4 `bg-black/50` modal backdrop, Calendar `borderLeftColor` hex mapping, stats modal i18n keys).
Do not touch: `web9.png` (local-only if present), external folder `EasyTurno_C_PWA`, `android/` (excluded per `update.md` web-only scope).

---

Agent: Gemini CLI (Antigravity Swarm)
Date/time: 2026-11-18T14:41:00+01:00
Task: Execute Fase 1 of `update.md` (Steps 1.1–1.2) on branch `chore/pwa-update-plan` under `cli-collaboration` protocol.
Status: done; committed on branch chore/pwa-update-plan (user-authorized).
Files changed:
- Modified: `package.json` & `package-lock.json` (updated without `--legacy-peer-deps`: `eslint@^10.15.0`, `@eslint/js@^10.0.1`, paired `@typescript-eslint/{eslint-plugin,parser}@^8.73.0`, `prettier@^3.10.1`, `eslint-plugin-prettier@^5.5.7`, `eslint-config-prettier@^10.1.8`, `prettier-plugin-tailwindcss@^0.8.1`, `lint-staged@^17.6.1`, `@types/node@^25.9.9`, `jest@^30.5.2`, `jest-environment-jsdom@^30.5.2`, `ts-jest@^29.4.15`, `jest-preset-angular@^16.2.0`, `@playwright/test@^1.65.1`; removed `"overrides": { "handlebars": "4.7.9" }` so `ts-jest@29.4.15` resolves `handlebars@4.7.10`)
- Modified: `src/services/auth.service.ts`, `src/services/crypto.service.spec.ts`, `src/services/shift.service.ts`, `src/shift.model.ts` (reformatted via `npm run format` for Prettier 3.10.1)
- Modified: `update.md` (checked off Steps 1.1–1.2, updated `handlebars` override note in Appendice A, added Fase 1 row in `Registro Avanzamento Esecuzioni`), `AGENT_HANDOFF.md` (this block + collapsed `2026-05-25` handoff into Older Handoffs).
Tests red: none in the Fase 1 Gate (pre-existing `npx tsc -p tsconfig.spec.json --noEmit` spec typing warnings remain outside the Gate; `npm run test:pw:install` with `--with-deps` cannot run non-interactively because `sudo` requires a password, while `npx playwright install chromium` succeeded and aligned Chromium rev `1255`).
Tests green:
- `npm run lint` (0 errors) & `npm run format:check` ("All matched files use Prettier code style!")
- `npx tsc --noEmit` & `npx tsc -p playwright/tsconfig.json --noEmit` (0 errors)
- `npm test -- --coverage --watchAll=false` (25/25 suites, 689/689 passed in 5.853 s; 98.32% Stmts / 94.73% Branch / 96.83% Funcs / 99.18% Lines)
- `npm run build` (3.223 s; Initial total `1.34 MB` raw / `310.52 kB` transfer; Lazy chunk `web` `3.43 kB` / `925 bytes`) + `npx jest scripts/check-csp.spec.ts` (19/19 passed)
- `npm run test:pw` (30/30 passed in 29.8 s against `127.0.0.1:3100`)
- `npm audit --omit=dev`: 8 vulnerabilities (`2 moderate, 5 high, 1 critical`, unchanged from Fase 0; Angular 22 + Firebase 13 slated for Fase 2); full `npm audit`: reduced from 138 to 131 (`2 low, 37 moderate, 87 high, 5 critical` — 2 critical advisories closed via `handlebars@4.7.10`).
Open concerns:
- Local `npm run test:pw:install` (`--with-deps`) requires interactive `sudo`; CI (`ubuntu-latest`) runs it unattended and was kept unchanged in `package.json`.
- `tsconfig.spec.json` still has pre-existing spec diagnostics (`tsc -p tsconfig.spec.json --noEmit`, tracked outside Fase 1).
Next agent starts from: Proceed to Fase 2 on `chore/pwa-update-plan` (`update.md` Steps 2.1–2.4: Angular `22.2.x`, `typescript ~6.0.3`, `zone.js ~0.16.x`, `jest-preset-angular ^17.0.3`, Tailwind `4.3.x`, Firebase `13.4.0` + emulator verification, and removing `--legacy-peer-deps` from `.github/workflows/ci.yml` if clean).
Do not touch: `web9.png` (local-only if present), external folder `EasyTurno_C_PWA`, `android/` (excluded per `update.md` web-only scope).

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
