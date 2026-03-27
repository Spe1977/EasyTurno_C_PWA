# EasyTurno

Offline-first PWA for work shift management, optimized for mobile devices.

Italian documentation is available in [README_IT.md](README_IT.md).

<p align="center">
  <img src="screenshot/Screen1.jpg" width="200" alt="Shift list" />
  <img src="screenshot/Screen2.jpg" width="200" alt="Shift creation" />
  <img src="screenshot/Screen3.jpg" width="200" alt="Calendar view" />
  <img src="screenshot/Screen4.jpg" width="200" alt="Statistics dashboard" />
</p>

## Key Features

- Create, edit, and delete single and recurring shifts (daily, weekly, monthly, yearly)
- List view with date search and pagination, plus monthly calendar view with swipe gestures
- Overtime tracking and multiple allowances per shift
- Statistics dashboard with period summaries for hours, overtime, and allowances
- JSON backup/restore with validation, including password-protected encrypted backups
- Light/dark theme with automatic system preference detection
- Italian/English localization
- Local data encryption with 256-bit AES-GCM
- Service worker with offline-first caching and PWA update detection
- Local notifications on native platforms (Android via Capacitor)

## Tech Stack

| Technology   | Version |
| ------------ | ------- |
| Angular      | 21.2.5  |
| TypeScript   | 5.9.3   |
| Tailwind CSS | 4.2.2   |
| Capacitor    | 8.3.0   |
| Jest         | 30.2.0  |
| Cypress      | 15.3.0  |
| Playwright   | 1.58.2  |

## Quick Start

```bash
# Requires Node.js 22+

# Install dependencies
npm install

# Development server (port 3000)
npm run dev

# Production build
npm run build

# Preview the production build
npm run preview
```

The development app is available by default at `http://localhost:3000/`.

## Useful Commands

```bash
# Linting and formatting
npm run lint            # Check ESLint issues
npm run lint:fix        # Fix auto-fixable ESLint issues
npm run format          # Format with Prettier
npm run format:check    # Verify formatting

# Tests
npm test                # Jest unit tests (single run)
npm run test:watch      # Jest in watch mode
npm run test:coverage   # Coverage report (output in coverage/)
npm run e2e             # Start dev server + run Cypress E2E tests
npm run test:pw:install # Install Chromium for Playwright
npm run test:pw         # Playwright browser smoke/flows
npm run test:pw:ui      # Playwright UI mode
npm run test:pw:headed  # Playwright headed mode
npx tsc --noEmit        # Standalone type check

# Mobile (Capacitor)
npm run build:mobile    # Build + Capacitor sync
npm run android:dev     # Open Android Studio
```

## Architecture

The application uses Angular standalone components with signal-based state management and `OnPush` change detection.

```text
src/
  app.component.ts/html         # Main component, state, and modals
  shift.model.ts                # Shift, Repetition, and Allowance interfaces
  components/
    calendar.component.ts       # Calendar view with touch gestures
    shift-list-item.component.ts  # Shift card
    toast-container.component.ts  # Toast notifications
  services/
    shift.service.ts            # Shift CRUD, recurrences, encrypted persistence
    crypto.service.ts           # 256-bit AES-GCM encryption
    calendar.service.ts         # Calendar navigation and day grid
    translation.service.ts      # Internationalization
    notification.service.ts     # Native local notifications
    toast.service.ts            # Toast UI
    sw-update.service.ts        # PWA update handling
  pipes/
    translate.pipe.ts           # Translation pipe
    date-format.pipe.ts         # Localized date pipe
  directives/
    modal-focus.directive.ts    # Modal focus trap (WCAG 2.1 AA)
  assets/i18n/                  # Translation JSON files (it.json, en.json)
```

## Security

- Data encrypted in `localStorage` with 256-bit AES-GCM
- Device key persisted preferably in IndexedDB; legacy fallback to `localStorage` only when IndexedDB is unavailable
- Exportable backups encrypted with a user password (`PBKDF2` + `AES-GCM`)
- Hardened Content Security Policy (CSP), with `unsafe-inline` still allowed in local development for `ng serve` compatibility
- Automatic migration of legacy unencrypted data

Important note:

- Local storage encryption is useful against casual data exposure, but it is not strong protection against attackers who gain access to the browser execution context.
- The local encryption key is still managed in the same client context as the data, so its real protection level is lower than that of password-protected encrypted backups.
- The two recommended architectural evolutions to close this gap are:
  1. user password for local storage, with a key derived at each unlock and kept only in memory;
  2. a secret kept outside `localStorage`, such as an authenticated backend or Capacitor secure native storage.
- Of the two, the first is the recommended direction for this project in terms of simplicity, security, and reliability.

## Current Status

- Build verified with Angular 21.2.5, TypeScript 5.9.3, and Tailwind CSS 4.2.2
- Unit tests: 319/319 passing
- Cypress E2E: 55/55 passing
- Playwright browser flows: 13/13 passing
- Lint, type check, and local builds verified
- Main remaining open items: native notification validation on a physical device and a future review of the local storage key strategy

## Project Status

See [`P.md`](P.md) for detailed status, open gaps, and the operational plan.

## Browser E2E

The project uses two browser testing layers:

- Cypress for the broader existing E2E suite
- Playwright for fast Chromium smoke/browser flows with automatic server management

Main files:

- `playwright.config.ts` - runner, browser, and web server configuration
- `playwright/tests/smoke.spec.ts` - smoke tests for app bootstrap, calendar toggle, and shift creation
- `playwright/tests/app-flows.spec.ts` - additional browser flows: persistence, basic CRUD, theme/language, calendar, reset, recurring edit/delete, statistics rendering, encrypted backup/import with password, and wrong-password import error handling
- `playwright/tests/helpers.ts` - shared helpers for bootstrap and shift creation

## License

[MIT](LICENSE) - Copyright (c) 2025 Leonardo
