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

Agent: Claude Code (Opus 4.7)
Date/time: 2026-05-24T20:30:00+02:00
Task: Tech-debt items 1 & 2 (user-authorized): (1) remove the deprecated husky preamble from all user hooks; (2) add Playwright to the pre-push hook for CI parity (option chosen by the user: full suite, skippable via `SKIP_PW=1`).
Status: done; committed and pushed to `origin/main` this turn (user-authorized "Commit + push su main").
Files changed: `.husky/pre-commit`, `.husky/post-checkout`, `.husky/post-merge` (removed the deprecated `#!/usr/bin/env sh` + `. "$(dirname -- "$0")/_/husky.sh"` 2-line preamble; `.husky/pre-push` already lacked it); `.husky/pre-push` (added `npm run test:pw` after Jest + build, gated by `if [ "$SKIP_PW" = "1" ]` to allow skipping just the e2e step); `AGENT_HANDOFF.md` (this block + marked both tech-debt items DONE).
Verification: no deprecated preamble or shebang remains in any user hook (grep); `sh -n` syntax-OK on all 4 hooks. End-to-end proof from this push: the new `pre-commit` ran with NO `husky - DEPRECATED` warning, and the new `pre-push` ran Jest + build + the full 17-test Playwright suite green before the push was allowed.
Tests red: none.
Tests green: full Jest suite + `ng build` + Playwright 17/17 (all exercised live by the commit/push hooks this turn).
Open concerns:
- Every push now runs the ~4 min Playwright suite by default. For quick docs/handoff-only pushes use `SKIP_PW=1 git push` (Jest + build still run; only e2e is skipped). Prefer this over `git push --no-verify`, which bypasses ALL checks.
- Push to `main` triggers the Cloudflare Pages production deploy. This turn touched only git hooks (no app/build/source code), so no functional/runtime impact on the deployed app.
Next agent starts from:
- Working tree clean except `web9.png` (ignored). No queued tech-debt items remain. Roadmap item #5 custom domain `easyturno.com` is future — do not start without explicit user authorization.
Do not touch:
- Do not delete `web9.png` (local-only). Do not commit/push without explicit user permission.

---

Agent: Claude Code (Opus 4.7)
Date/time: 2026-05-24T20:10:00+02:00
Task: Delete the 8 stray screenshot PNGs from the GitHub repo + add a `.gitignore` rule (user-authorized; queued by the prior handoff). Also commit the pending `AGENT_HANDOFF.md` changes in the same push (user chose "Include handoff update").
Status: done; committed and pushed to `origin/main` this turn (user-authorized).
Files changed: deleted `web.png`, `web2.png`, `web3.png`, `web4.png`, `web5.png`, `web6.png`, `web7.png`, `web8.png`; `.gitignore` (added `web*.png` rule); `AGENT_HANDOFF.md` (this block + marked the screenshot tech-debt item DONE; also carried in the prior uncommitted "## Maintenance / Tech Debt" notes).
Tests red: none.
Tests green: none run — change is repo-hygiene only (no app/build/source code touched).
Open concerns:
- Push to `main` triggers the Cloudflare Pages production deploy. These are non-code asset deletions, so no functional impact expected.
- `web9.png` remains on disk (local-only, never on GitHub) and is now covered by the `web*.png` ignore rule — left untouched per prior handoffs.
Next agent starts from:
- Working tree clean except `web9.png` (ignored). Remaining open items are optional tech-debt (Husky-deprecation cleanup, Playwright-in-pre-push CI parity) — do NOT do unprompted. Roadmap item #5 custom domain `easyturno.com` is future — do not start without explicit user authorization.
Do not touch:
- Do not delete `web9.png` (local-only). Do not commit/push without explicit user permission.

---

Agent: Claude Code (Opus 4.7)
Date/time: 2026-05-24T19:30:00+02:00
Task: Fix the 2 Playwright tests that went red in GitHub CI after the recurring-series indicator landed.
Status: done; root cause found, fixed, verified locally; committed and pushed to `origin/main` (user-authorized).
Root cause: the recurring-series indicator added an always-present wrapper `<div data-cy="shift-title-row">` around the title `<p>`, inserting one extra DOM nesting level. The two recurring e2e tests (`edits only one recurring occurrence`, `deletes an entire recurring series`) located the action buttons via `getByText(title).locator('../..')` — a hardcoded "up 2 levels" traversal that now lands on the content `<div>` (which does NOT contain the action buttons) instead of the card root → `locator.click` 30s timeout. Slipped through because Jest (686/686) doesn't use that DOM traversal and the pre-push hook runs build+Jest, not Playwright (Playwright is CI-only).
Fix (test-only, no production code change): in `playwright/tests/app-flows.spec.ts` replaced the brittle `getByText(title).first().locator('../..')` with `page.locator('app-shift-list-item').filter({ hasText: title }).first()` for both the edit and delete recurring tests. `app-shift-list-item` is the component host element — a stable per-row container independent of internal nesting depth; the `.filter({ hasText })` idiom is already used elsewhere in this spec.
Verification: reproduced both failures locally (identical 30s timeout) BEFORE the fix; after the fix the 2 recurring tests pass; full Playwright suite 17/17 green (`npx playwright test`).
Files changed: `playwright/tests/app-flows.spec.ts`; `AGENT_HANDOFF.md`.
Open concerns:
- Other tests in this spec click the single edit/delete button directly (only one shift present), so they were unaffected; only the two multi-instance recurring tests needed per-row scoping. The brittle `../..` pattern is now removed from the spec (grep-verified: 0 remaining).
- Consider adding Playwright to the pre-push hook (or a CI-parity local step) so DOM-structure regressions surface before push, not in CI. Not done this turn (out of scope).
Next agent starts from:
- CI should now be green. Remaining roadmap item is #5 custom domain `easyturno.com` (future) — do not start without explicit user authorization.
Do not touch:
- Do not clean `web9.png` or other unrelated dirty files. Do not commit without explicit user permission.

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
