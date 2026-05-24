# Security Findings Remediation Plan

> Context: Codex security scan saved at `/tmp/codex-security-scans/EasyTurno_C_PWA/b733367_20260521T100746+0200/report.md`.
> Goal: close the validated security findings before production / Play Store release without disturbing unrelated dirty worktree changes.

## Status: COMPLETE (verified 2026-05-24, Claude Code)

All four tasks are implemented in the worktree. Verified state:

- **Task 1 (FCM token logging)** — ✅ `src/services/push-notification.service.ts:33` logs `'Push registration success'`, not `token.value`; `this._token.set(token.value)` preserved.
- **Task 2 (Android backup)** — ✅ `android/app/src/main/AndroidManifest.xml:4` → `android:allowBackup="false"`.
- **Task 3 (tooling advisories)** — ⚠️ `firebase-tools@^15.18.0`, `@capacitor/assets` removed. **Residual risk accepted**: `npm audit --audit-level=low` shows 6 `moderate` advisories, all transitive inside firebase-tools (`firebase-tools → gaxios → uuid <11.1.1`, GHSA-w5hq-g745-h8pq). `firebase-tools@15.18.0` is the latest on npm and still pulls that chain; the only `npm audit fix --force` downgrades firebase-tools to `1.2.0` (breaking, forbidden by this plan, line 24). firebase-tools is a dev/release-only CLI — **never bundled into the shipped PWA or APK**, so there is no runtime exposure. Re-evaluate when upstream publishes a firebase-tools that drops `uuid<11.1.1`.
- **Task 4 (FileProvider paths)** — ✅ `android/app/src/main/res/xml/file_paths.xml` keeps only `cache-path`; broad `external-path path="."` removed.

The task checklists below are retained as historical detail.

## Current Findings

The scan found no critical or high runtime application vulnerability. Three reportable issues remain:

- **P2 / medium**: `android/app/src/main/AndroidManifest.xml:4` has `android:allowBackup="true"`, which can back up WebView, IndexedDB, localStorage, and Firestore cache data. This may preserve encrypted user data together with local key/cache material.
- **P2 / medium**: `npm audit --audit-level=low` reports 13 vulnerabilities in dev/release tooling dependency paths, mainly `firebase-tools`, nested `@capacitor/assets` / `@capacitor/cli`, `tar`, `minimatch`, and `@tootallnate/once`.
- **P3 / low**: `src/services/push-notification.service.ts:33` logs the raw FCM registration token.

Deferred hardening:

- `android/app/src/main/res/xml/file_paths.xml:3` uses a broad `external-path path="."`. The scan did not prove a reachable arbitrary file share/read flow because the provider is non-exported, but this should still be narrowed before release if possible.

## Rules For The Next Agent

- Use `cli-collaboration`; read `AGENT_HANDOFF.md`, `firebase.md`, and this plan before editing.
- Do not clean, reset, revert, or delete unrelated dirty worktree files.
- Do not commit without explicit user permission.
- Use TDD where behavior changes are covered by tests. For Android manifest/dependency updates, run verification commands and document results.
- Do not run `npm audit fix --force` blindly. It can make broad breaking changes; update the specific packages intentionally.

## Task 1: Remove Raw FCM Token Logging

Files:

- Modify: `src/services/push-notification.service.ts`
- Modify: `src/services/push-notification.service.spec.ts`

Steps:

- [ ] Add or update a unit test proving the registration callback does not log `token.value`.
- [ ] Change the registration listener from logging the raw token to either no log or a generic message.
- [ ] Keep `this._token.set(token.value)` unchanged so Firestore device registration still receives the token.
- [ ] Run:
  - `npm test -- src/services/push-notification.service.spec.ts --runInBand`
  - `npm run lint`

Expected implementation shape:

```ts
await PushNotifications.addListener('registration', (token: Token) => {
  console.info('Push registration success');
  this._token.set(token.value);
});
```

If avoiding the log entirely is cleaner for the tests, remove the `console.info` line.

## Task 2: Disable Or Constrain Android Backup

Files:

- Modify: `android/app/src/main/AndroidManifest.xml`
- Optionally create: `android/app/src/main/res/xml/backup_rules.xml`
- Optionally create: `android/app/src/main/res/xml/data_extraction_rules.xml`

Preferred fix:

- [ ] Set `android:allowBackup="false"` on the `<application>` element.

Reason: EasyTurno already has Firestore sync and password-protected manual backup/export. Android platform backup is not needed for app-private WebView/IndexedDB/localStorage data and can undermine the local encryption/key boundary.

Alternative fix, only if Android system backup must stay enabled:

- [ ] Keep `android:allowBackup="true"`.
- [ ] Add Android backup/data extraction rules that exclude WebView storage, IndexedDB, localStorage, Firestore persistent cache, shared preferences, and app cache.
- [ ] Reference those rules from the manifest with `android:fullBackupContent` and `android:dataExtractionRules`.

Verification:

- [ ] Run `npm run build`.
- [ ] Run `npm run cap:sync` or `npx cap sync android` if native assets/config need regeneration.
- [ ] If JDK 21 is available, run `cd android && ./gradlew assembleDebug` or the existing release build command used by the project.

## Task 3: Close Tooling Dependency Advisories

Files:

- Modify: `package.json`
- Modify: `package-lock.json`

Known state from scan:

- `firebase-tools@13.35.1` is installed. Current checked version from npm during scan was `15.18.0`.
- `@capacitor/assets@3.0.5` is current, but it still depends on old nested tooling including `@capacitor/cli@5.x`, `tar`, and `minimatch` chains.

Steps:

- [ ] Update Firebase CLI intentionally:

```bash
npm install -D firebase-tools@15.18.0
```

- [ ] Re-run Firebase emulator smoke:

```bash
npm run test:firebase
```

- [ ] If `firebase-tools@15.18.0` is incompatible with local Java/tooling, document the blocker and leave the exact audit finding open rather than downgrading silently.
- [ ] For `@capacitor/assets`, prefer removal if the asset generation work is complete:

```bash
npm uninstall @capacitor/assets
```

- [ ] If `@capacitor/assets` is still required, keep it only as a documented release-time tool and verify whether upstream has published a fixed release before final release packaging.
- [ ] Re-run:

```bash
npm audit --audit-level=low
npm run lint
npm test -- --runInBand
npm run build
```

Acceptance:

- `npm audit --audit-level=low` should be clean, or any remaining advisory must be explicitly documented with package path, reason it cannot be removed, and release risk.

## Task 4: Narrow FileProvider Paths Before Release

Files:

- Modify: `android/app/src/main/res/xml/file_paths.xml`
- Search supporting code before editing: usages of `Share`, `FileProvider`, generated export files, and Capacitor share flows.

Current state:

```xml
<external-path name="my_images" path="." />
<cache-path name="my_cache_images" path="." />
```

Preferred direction:

- [ ] Remove broad `external-path path="."` if no first-party feature needs it.
- [ ] Keep only `cache-path` or a narrow app-controlled subdirectory used for exported files.
- [ ] If a share/export flow needs file URI grants, write exported files to a dedicated cache subdirectory and grant only that path.

Verification:

- [ ] Run build/sync.
- [ ] Smoke test backup export/import and any Android share flow if available.

## Final Verification Checklist

After implementing the fixes:

- [ ] `npm run lint`
- [ ] `npm test -- --runInBand`
- [ ] `npm run build`
- [ ] `npm audit --audit-level=low`
- [ ] `npm run test:firebase` if Firebase tooling was changed
- [ ] Android Gradle build if JDK 21 is available
- [ ] Update `AGENT_HANDOFF.md` with files changed, tests red/green, remaining advisories, and exact next step

## Expected End State

- No raw FCM token value is logged.
- Android backup no longer includes app-private local data by default, or exclusions are documented and enforced.
- Tooling dependency advisories are resolved or explicitly risk-accepted with rationale.
- FileProvider no longer exposes all external storage through a broad path unless a proven app flow requires it.
