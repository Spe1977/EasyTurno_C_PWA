# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Multi-Agent Handoff

This repository is also worked on by Codex and Gemini CLI. Before editing, read `AGENT_HANDOFF.md` and `README.md` (or `README_IT.md`), then follow the start-of-shift and end-of-shift checklists in `AGENT_HANDOFF.md`. The worktree may be dirty because another CLI agent or the user has active changes; do not reset, revert, delete, or clean changes you did not make. Do not commit unless the user explicitly asks.

## Project Overview

EasyTurno is a Progressive Web App (PWA) for work shift management, built with Angular and designed to be offline-first. It supports single and recurring shifts, overtime tracking, multiple allowances per shift, a statistics dashboard, encrypted local persistence (`AES-GCM 256-bit`), password-protected encrypted JSON backups, and optional cloud synchronization via Firebase Auth and Firestore.

## Development Commands

### Core Development

- `npm run dev` - Start development server on port 3000 (`NG_CLI_ANALYTICS=false ng serve`)
- `npm run build` - Build for production (enforces `angular.json` bundle budgets)
- `npm run preview` - Preview production build (`ng serve --configuration=production`)
- `npm install` / `npm ci` - Install dependencies (Node `^22.22.3 || ^24.15.0 || >=26.0.0`)

### Code Quality

- `npm run lint` - Run ESLint on `src/**/*.ts`
- `npm run lint:fix` - Fix auto-fixable ESLint errors
- `npm run format` - Format files in `src/` with Prettier
- `npm run format:check` - Check formatting without modifying files
- `npx tsc --noEmit` - Standalone TypeScript check for the app
- `npx tsc -p playwright/tsconfig.json --noEmit` - TypeScript check for Playwright specs

### Testing

- `npm test` - Run Jest unit & script tests (`src/**/*.spec.ts`, `scripts/*.spec.ts`)
- `npm run test:watch` - Run Jest in watch mode
- `npm run test:coverage` - Generate coverage report in `coverage/`
- `npx jest scripts/check-csp.spec.ts` - Verify CSP headers and built `dist/` output
- `npm run test:pw:install` - Install Chromium for Playwright
- `npm run test:pw` - Run full Playwright browser E2E suite (`40` tests across `6` spec files)
- `npm run test:pw:ui` - Playwright UI mode (interactive)
- `npm run test:pw:headed` - Playwright headed mode
- `npm run emulators` - Start local Firebase Auth + Firestore emulators
- `npm run test:firebase` - Run `src/services/sync-emulator.spec.ts` against local emulators (requires JDK 21)

### Mobile Development (Capacitor)

- `npm run build:mobile` - Build app and sync with Capacitor
- `npm run android:dev` - Open Android Studio for development
- `npm run android:build` - Build release APK (`./gradlew assembleRelease`, requires JDK 21 + Android SDK)
- `npm run cap:sync` - Sync web assets to native platforms
- `npm run cap:update` - Build and sync to native platforms

## Architecture

### Core Technologies

- **Angular 22** (`22.2.6` core / `22.2.7` CLI/build) with standalone components, signals, `@defer` code splitting, `OnPush` change detection, and zoneless runtime
- **TypeScript 6.0** (`~6.0.3`) with strict mode enabled
- **Tailwind CSS 4.3** (`4.3.5`) for styling with light/dark mode support (CSS-first config)
- **Firebase 13.4** (`13.4.0`, modular Web SDK loaded lazily via `createLazyLoader`) for Auth, Firestore (`persistentLocalCache`), and native FCM push integration
- **PWA** with Service Worker `v7` (`sw.js`) and `manifest.webmanifest`
- **Capacitor 8** (`8.6.2`) for native Android deployment

### Application Structure

- `sw.js` - Service Worker `v7` (explicit same-origin `SKIP_WAITING`, cache-first hashed chunks, stale-while-revalidate + 60-entry LRU pruning, `{ ignoreVary: true }`)
- `src/app.component.ts` / `.html` - Main shell, signals, list visibility window, and lazy `@defer` boundaries
- `src/shift.model.ts` - `Shift`, `ShiftSeries`, `ManualShift`, `ShiftOverride`, `ShiftDataState` (`schemaVersion: 2`), `Repetition`, `Allowance`, `ShiftColor`
- `src/environments/firebase.config.ts` - Firebase web client config
- `src/utils/lazy-loader.ts` - Memoized dynamic import helper with retry-on-error
- `src/components/` - Standalone `OnPush` components:
  - `auth-screen.component.ts` - Email/password sign-in/up, password reset, Google Sign-In, Guest entry
  - `email-verification-screen.component.ts` - Email verification gate & 60s resend cooldown
  - `shift-form-modal.component.ts` - Single/recurring shift creation & edit modal
  - `statistics-drawer.component.ts` - Period analytics drawer (presets, hours, overtime, allowances)
  - `settings-drawer.component.ts` - Theme, language, notifications, account, installed devices, encrypted backup/restore
  - `confirm-dialog.component.ts` - Confirmation, password prompt, account deletion, decryption recovery, and date-search dialogs
  - `calendar.component.ts` - Monthly calendar grid with touch swipe and keyboard navigation
  - `shift-list-item.component.ts` - Shift list card with recurring indicator
  - `toast-container.component.ts` - Global toast notifications
- `src/services/` - Core business & persistence services:
  - `shift.service.ts` - Shift CRUD facade, validation (`MAX_TITLE_LENGTH = 200`, `MAX_NOTES_LENGTH = 2000`), occurrence materialization, legacy migration, and backup import/export
  - `occurrence-generator.ts` - Pure `generateOccurrencesForRange()` materializing `ShiftSeries` + `ManualShift` + `ShiftOverride`
  - `user-data.model.ts` - `EMPTY_SHIFT_DATA_STATE`, `USER_DATA_STORAGE_KEY` (`easyturno_user_data_v2`), `LEGACY_SHIFT_STORAGE_KEY` (`easyturno_shifts`)
  - `user-data.service.ts` - Single store boundary switching transparently between local state and `FirestoreUserDataService`
  - `firestore-user-data.service.ts` - Lazy Firestore `onSnapshot` listeners, `writeBatch` mutations, and device registry
  - `firebase-app.service.ts` - Lazy singleton Firebase app, Auth, and Firestore (`persistentLocalCache`)
  - `auth.service.ts` - Signal-based Firebase Auth + guest mode persistence
  - `sync.service.ts` - Sync status orchestration and device registration
  - `device.service.ts` - Device ID, platform detection (`native` / `pwa-installed` / `web`), soft limit (`3` installed devices; web sessions unlimited)
  - `crypto.service.ts` - AES-GCM 256-bit local storage encryption (`ETBLOB1:` header, non-extractable IndexedDB `CryptoKey`) & `PBKDF2-SHA256` (600,000 iterations) encrypted backups
  - `calendar.service.ts` - Calendar navigation and 42-day grid generation
  - `translation.service.ts` - i18n with per-language lookup cache (`it` / `en`)
  - `notification.service.ts` - Lazy Capacitor local notifications (native platforms only)
  - `push-notification.service.ts` - Lazy Capacitor FCM push registration (native platforms only)
  - `toast.service.ts` - Toast notifications
  - `sw-update.service.ts` - Service Worker update detection & activation
- `src/pipes/` - Memoized translation and date formatting pipes (`translate.pipe.ts`, `date-format.pipe.ts`)
- `src/assets/i18n/` - Translation JSON files (`it.json`, `en.json`)

### State Management & Data Persistence Flow

- Persistence uses `ShiftDataState` (`schemaVersion: 2`: `shiftSeries`, `manualShifts`, `shiftOverrides`).
- **Guest / offline mode**: `ShiftService` encrypts `ShiftDataState` via `CryptoService` (`ETBLOB1:` + AES-GCM 256-bit) and persists it under `easyturno_user_data_v2` (reading legacy `easyturno_shifts` read-only for backward-compatible migration).
- **Authenticated mode**: `UserDataService` mirrors `FirestoreUserDataService.state()` and routes mutations through Firestore `writeBatch` under `users/{uid}/{shiftSeries,manualShifts,shiftOverrides}` with `persistentLocalCache` offline support.
- `ShiftService.shifts` is a `computed<Shift[]>` materializing manual shifts and recurring series (up to `MAX_YEARS_PER_SERIES = 2`, capped by `MAX_RANGE_OCCURRENCES_PER_SERIES = 900` in `occurrence-generator.ts`).
- `AppComponent` filters the default list view to shifts intersecting `[today - 12 months, today + 24 months]` (`PAST_MONTHS_VISIBLE = 12`, `FUTURE_MONTHS_VISIBLE = 24`) with 50-item pagination (`INITIAL_LIST_SIZE = 50`, `LIST_LOAD_INCREMENT = 50`), while date search bypasses the window and surfaces an info toast when outside range.

### PWA & Mobile Features

#### Progressive Web App (PWA)

- Offline-first caching via `sw.js` (`v7`): pauses new SW in `waiting` until explicit same-origin `SKIP_WAITING`, uses cache-first for hashed build chunks, stale-while-revalidate + 60-entry LRU pruning for unhashed same-origin runtime assets, and `{ ignoreVary: true }` on cache matches
- Strict production Content Security Policy (`index.production.html` + `_headers`, verified by `scripts/check-csp.spec.ts`), `inlineCritical: false` in `angular.json`
- Accessible modals with `role="dialog"` / `role="alertdialog"`, `aria-modal="true"`, `[attr.inert]` on background shell, focus trap, and focus restore on close

#### Native Mobile (Capacitor)

- **Platform Detection**: `Capacitor.isNativePlatform()` gates lazy dynamic imports of `@capacitor/local-notifications` and `@capacitor/push-notifications`
- **Haptics, Share, Splash Screen, Status Bar**: Configured via Capacitor 8 plugins (`com.spe1977.easyturno`)
- **Android Build**: Gradle APK/AAB generation with release signing support (keystore/google-services excluded from Git)

### Testing Infrastructure

- **Unit & Script Tests**: Jest 30 (`jest-preset-angular`)
  - Test files use `.spec.ts` across `src/` and `scripts/` (`check-csp.spec.ts`, `ci-config.spec.ts`, `pwa-manifest.spec.ts`, `sw.spec.ts`)
  - Mock setup in `setup-jest.js` includes Web Crypto API & Firebase modular SDK mocks
  - Current coverage: `33/33` suites, `742/742` tests passing, `>95%` branch coverage
- **Browser E2E Tests**: Playwright `1.65.1`
  - Config in `playwright.config.ts` with `npm run dev:pw` on `http://127.0.0.1:3100`
  - `6` spec files in `playwright/tests/` (`smoke`, `app-flows`, `calendar-offline`, `fase3-fixes`, `fase4-optimization`, `fase5-pwa-perf`), `40/40` tests on Chromium
- **Firebase Emulator Tests**: `npm run test:firebase` runs `src/services/sync-emulator.spec.ts` against local Auth + Firestore emulators (automated in GitHub Actions `firebase` job with JDK 21)

### Important Patterns & Conventions

- Angular `OnPush` change detection across components; `@defer` blocks isolate heavy secondary modals/drawers and Firebase SDK imports from initial boot
- `TranslatePipe` and `LangDatePipe` (`pure: false`) use per-instance memoization (`LangDatePipe` also uses a bounded `WeakMap` cache across `DatePipe` instances)
- Type guards in `shift.service.ts` (`isValidShift`, `isValidISODate`, `isShiftDataState`) validate imported payloads and reject backups > 5 MB or plaintext exports
- Full-height containers use `h-dvh` / `min-h-[100dvh]` (never `h-screen` / `100vh`) so mobile browser URL bars do not push sticky bars off-screen
- Before editing code or docs, always check `AGENT_HANDOFF.md` for current ownership and `Do not touch` boundaries
