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

---

Agent: Claude Code (Opus 4.7)
Date/time: 2026-05-24T19:00:00+02:00
Task: Commit and push to `origin/main` all completed uncommitted work, after the user explicitly authorized commit+push this turn.
Status: done; committed and pushed to `origin/main`.
Scope committed (all previously uncommitted, all documented in the blocks below): device-limit redesign (Claude), security-remediation closeout docs (Claude), reload/update app button (Codex), recurring-series list indicator (Codex).
Excluded from commit: `web9.png` (untracked, unknown origin — left untouched per prior handoffs).
Pre-commit verification (this turn): full Jest suite 686/686 green; `npm run lint` clean; `npm run build` OK (1.34 MB raw / 310.26 kB estimated transfer).
Open concerns:
- Push to `main` triggers the Cloudflare Pages production deploy — these changes are now live-bound.
- No authenticated browser (Playwright) smoke for the device list (renders only when logged in); covered by component/unit tests. Worth a manual login check on the deployed build.
Next agent starts from:
- Working tree clean except `web9.png`. Remaining roadmap item is #5 custom domain `easyturno.com` (future) — do not start without explicit user authorization.
Do not touch:
- Do not clean `web9.png` or other unrelated dirty files. Do not commit without explicit user permission.

---

Agent: Claude Code (Opus 4.7)
Date/time: 2026-05-24T18:45:00+02:00
Task: Implement priority #2 — Device-limit redesign ("max 3 installations"), after the user authorized the work this turn.
Status: done; not committed (no explicit commit permission this turn).
Files changed (all uncommitted):
- `src/services/device.service.ts` (+ `.spec.ts`) — `SOFT_DEVICE_LIMIT` `4 → 3`; added `detectPlatform()` (`native`/`pwa-installed`/`web`) and exported `DevicePlatform` + `DeviceRecord` types.
- `src/services/firestore-user-data.service.ts` (+ `.spec.ts`) — devices snapshot now stored as `DeviceRecord[]`; `activeDeviceCount`/`webSessionCount` are `computed` over it (installed = `platform !== 'web'`); `registerDevice(uid, deviceId, platform, fcmToken?)` reads existing doc, applies sticky precedence (`native > pwa-installed > web`), and prunes other docs with `lastActive` > 90 days (never the current device) in the same batch; added `removeDevice(uid, deviceId)`.
- `src/services/sync.service.ts` (+ `.spec.ts`) — passes `deviceService.detectPlatform()` into `registerDevice`.
- `src/services/user-data.service.ts` (+ `.spec.ts`) — bridges `devices`, `installedDeviceCount`, `webSessionCount`; added `removeDevice(deviceId)` (no-op unless authenticated).
- `src/app.component.ts` — `currentDeviceId`, `installedDevices` (computed: `platform !== 'web'`), `devicePendingRemoval`, `devicePlatformLabelKey`, `formatDeviceLastActive`, `promptRemoveDevice`/`cancelRemoveDevice`/`confirmRemoveDevice`.
- `src/app.component.html` — authenticated Settings "Linked devices" section: count `X/3`, explanatory copy, web-sessions count note, per-device row (platform badge, "this device", last-active) with inline trash → Remove/Cancel confirm. The list iterates `installedDevices()` so web sessions are never listed (only counted).
- `src/app.component.spec.ts` — rewrote "Device Limit Warning" tests to drive `_devices` (off at 3 installs, on at 4, web sessions excluded), plus remove-flow + platform-label-key coverage.
- `src/assets/i18n/{it,en}.json` — reworded `deviceLimitExceededBody`; new keys `devicesSectionTitle`, `devicesLimitExplanation`, `devicesWebSessionsNote`, `deviceThisDevice`, `deviceLastActive`, `deviceRemoveAria`, `deviceRemoveConfirm`, `deviceRemoved`, `devicePlatform{Native,Installed,Web}`.
- `AGENT_HANDOFF.md` — marked priority #2 ✅ COMPLETE; this handoff; rolled the oldest detailed block into the summary.
Tests red (then green): `device.service.spec` soft-limit (was 4) + new `detectPlatform`; `firestore-user-data.service.spec` `registerDevice is not a function`/new signature; `user-data.service.spec` device-bridge; `app.component.spec` `_activeDeviceCount` removed; `sync.service.spec` `detectPlatform is not a function`.
Tests green: full Jest suite 686/686 (after the follow-up below); `npm run lint` clean; `npx prettier --check` on all touched files clean; `npm run build` OK (1.34 MB raw / ~310 kB transfer).
Follow-up (same turn, user request): shortened `devicesLimitExplanation` copy (it/en) to "Il limite dei 3 dispositivi si riferisce solo all'installazione di app Android e della PWA sul dispositivo. Gestisci i dispositivi collegati dal box qui sotto." / EN equivalent; the device list now shows installations only (`installedDevices()`), web sessions are excluded from the list but the `devicesWebSessionsNote` count line is kept (user chose "keep as count"). Added an `app.component.spec` test asserting the list excludes web devices.
Open concerns:
- No authenticated browser (Playwright) smoke — the device list only renders when logged in, so it is covered by component DOM/unit tests, not a live UI pass. Worth a manual check on a real login before release.
- `firebase.md` Phase 6/7 logs still mention the historical soft-limit "4"; left as history (not rewritten). The live tracker is item #2 above.
- Codex's prior uncommitted work (recurring-series indicator, reload/update button) and `web9.png` left untouched.
Next agent starts from:
- Priority #2 done. Remaining roadmap items are #5 custom domain `easyturno.com` (future) — do not start without explicit user authorization.
Do not touch:
- Do not clean unrelated dirty worktree files. Do not commit without explicit user permission.

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
