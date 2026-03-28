# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyTurno is a Progressive Web App (PWA) for work shift management, built with Angular and designed to be offline-first. The application allows users to create, edit, and manage work shifts with support for recurring shifts, overtime tracking, allowances management, statistical analysis, and data export/import.

## Development Commands

### Core Development

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build for production
- `npm run preview` - Preview production build (serves production build)
- `npm install` - Install dependencies

### Code Quality

- `npm run lint` - Run ESLint on TypeScript files
- `npm run lint:fix` - Fix auto-fixable ESLint errors
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting without modifying files

### Testing

- `npm test` - Run Jest unit tests (single run)
- `npm run test:watch` - Run Jest in watch mode for development
- `npm run test:coverage` - Generate test coverage report (output to `coverage/`)
- `npm run cypress:open` - Open Cypress test runner (interactive)
- `npm run cypress:run` - Run Cypress E2E tests headlessly
- `npm run e2e` - Start dev server and run all E2E tests
- `npm run test:pw` - Run Playwright browser smoke tests on Chromium
- `npm run test:pw:ui` - Playwright UI mode (interactive)
- `npm run test:pw:headed` - Playwright headed mode

### Mobile Development (Capacitor)

- `npm run build:mobile` - Build app and sync with Capacitor
- `npm run android:dev` - Open Android Studio for development
- `npm run android:build` - Build production APK (requires Android SDK)
- `npm run cap:sync` - Sync web assets to native platforms
- `npm run cap:update` - Build and sync to native platforms

## Architecture

### Core Technologies

- **Angular 21+** with standalone components and signal-based state management
- **TypeScript 5.9+** with strict mode enabled for maximum type safety
- **Tailwind CSS 4** for styling with dark mode support (CSS-first config)
- **PWA** features with service worker and manifest
- **Capacitor 8** for native mobile deployments (Android support included)

### Application Structure

The app follows a component-based architecture optimized for a single-page PWA:

- `src/app.component.ts` - Main container component with application state and modal management
- `src/components/` - Reusable standalone components
  - `shift-list-item.component.ts` - Individual shift card display
  - `toast-container.component.ts` - Toast notification UI
  - `calendar.component.ts` - Mobile-optimized calendar view with touch gestures
- `src/services/` - Core business logic services
- `src/pipes/` - Custom Angular pipes for data transformation
  - `translate.pipe.ts` - Internationalization pipe
  - `date-format.pipe.ts` - Locale-aware date formatting
- `src/shift.model.ts` - TypeScript interfaces and type definitions
- `src/assets/i18n/` - Translation JSON files (it.json, en.json)

### State Management

The application uses Angular's signal-based reactive state management:

- All state is managed in the main `AppComponent` using Angular signals
- `ShiftService` handles data persistence to localStorage with automatic sync
- UI state includes modal management, form state, view mode toggle (list/calendar), and list pagination
- Calendar state managed by `CalendarService` with signal-based month/year navigation

### Key Services

- **ShiftService** (`src/services/shift.service.ts`) - Manages shift CRUD operations, recurring shift generation, and encrypted localStorage persistence
- **CryptoService** (`src/services/crypto.service.ts`) - Handles AES-GCM 256-bit encryption/decryption for secure data storage
- **CalendarService** (`src/services/calendar.service.ts`) - Manages calendar state, month/year navigation, and day grid generation (42-day grid for consistent 6-week display)
- **TranslationService** (`src/services/translation.service.ts`) - Handles internationalization with JSON-based translations
- **NotificationService** (`src/services/notification.service.ts`) - Manages local notifications for shift reminders (Capacitor native platforms only)
- **ToastService** (`src/services/toast.service.ts`) - Displays temporary toast notifications to users
- **SwUpdateService** (`src/services/sw-update.service.ts`) - Detects and notifies users of available PWA updates automatically

### Data Models

- **Shift** interface defines work shift structure with support for:
  - Recurring patterns via `Repetition` interface
  - Optional notes field
  - Overtime hours tracking (`overtimeHours`)
  - Multiple allowances via `Allowance[]` array
- **Repetition** interface defines recurring shift frequency and intervals (daily, weekly, monthly, yearly)
- **Allowance** interface defines custom allowances with name and amount
- Shifts are generated up to 2 years in advance for recurring patterns

### PWA & Mobile Features

#### Progressive Web App (PWA)

- Offline-first design with encrypted localStorage persistence
- Web app manifest with shortcuts for quick shift creation
- Service worker for caching (sw.js)
- Automatic update detection with user notification (SwUpdateService)
- Responsive design supporting mobile and desktop
- Content Security Policy (CSP) for XSS protection
- AES-GCM 256-bit encryption for sensitive data at rest

#### Native Mobile (Capacitor)

- **Platform Detection**: `Capacitor.isNativePlatform()` used to conditionally enable native features
- **Local Notifications**: Shift reminders via @capacitor/local-notifications (native platforms only)
- **Haptics**: Tactile feedback for user interactions
- **Share API**: Native share sheet integration
- **Splash Screen**: Branded loading screen with configurable duration
- **Status Bar**: Theme-aware status bar styling
- **Android Build**: Gradle-based APK generation with release signing support
- **Configuration**: `capacitor.config.ts` defines app ID, name, and plugin settings

### Recurring Shifts Logic

The app generates individual shift instances for recurring patterns rather than storing rules:

- Supports daily, weekly, monthly, and yearly repetitions
- Generates up to 200 instances or 2 years ahead
- Each instance has unique ID but shares seriesId for group operations

### Advanced Features

#### Overtime Tracking

- Track overtime hours for each shift (single or recurring)
- Decimal support for precise hour tracking (step 0.5)
- Aggregate overtime calculations in statistics

#### Allowances Management

- Add multiple custom allowances per shift
- Each allowance has a customizable name and amount
- Dynamic UI for adding/removing allowances
- Statistics aggregate allowances by name across selected period

#### Statistics Dashboard

- Accessible from Settings menu
- Customizable date range selection (default: last 30 days)
- Real-time computed statistics:
  - Total shifts count
  - Total hours worked
  - Total overtime hours
  - Shifts breakdown by type/title
  - Allowances breakdown by name with totals
- Responsive design with color-coded summary cards
- Empty state handling with appropriate messaging

#### Calendar View

- Toggle between list view and calendar view with signal-based `viewMode` state
- Mobile-optimized monthly calendar grid (6-week layout for consistency)
- Touch gesture support: swipe left/right to navigate months
- Visual shift indicators on calendar days (colored dots)
- Click day to filter shifts, click again to clear selection
- Selected day shows shift count and formatted date
- Shift count badge for days with more than 5 shifts
- Signal-based reactivity for month/year navigation via CalendarService

### Security Features

- **Content Security Policy (CSP)**: Restricts resource origins to prevent XSS attacks
- **Data Encryption**: AES-GCM 256-bit encryption for localStorage data
- **Device Key**: Random AES key persisted in IndexedDB (non-extractable CryptoKey); fallback to localStorage only when IndexedDB is unavailable
- **Password-Protected Backups**: Export/import encrypted with user password (PBKDF2 + AES-GCM)
- **Backward Compatibility**: Automatic detection and migration of legacy unencrypted data
- **Secure Error Handling**: Graceful degradation when encryption fails

### Testing Infrastructure

- **Unit Tests**: Jest with jest-preset-angular
  - Test files use `.spec.ts` extension
  - Mock setup in `setup-jest.js` includes Web Crypto API polyfill
  - Coverage reports generated in `coverage/` directory
  - Services have comprehensive test coverage
- **E2E Tests**: Cypress 15+
  - Test specs in `cypress/e2e/` directory
  - Custom commands defined in `cypress/support/commands.ts`
  - Tests cover: shift management, recurring shifts, offline functionality, advanced features, calendar view
  - Configured for 1280x720 viewport, baseUrl http://localhost:3000
- **Browser Smoke Tests**: Playwright 1.58+
  - Config in `playwright.config.ts` with integrated web server (port 3100)
  - Tests in `playwright/tests/` with shared helpers
  - Covers: app bootstrap, persistence, CRUD, theme/language, calendar, statistics, encrypted backup/import
  - Runs on Chromium with tracing on failure

### Development Notes

- Uses Angular's OnPush change detection strategy for performance
- All dates stored as ISO strings for consistency with optional timezone field
- Theme persistence with automatic system preference detection
- TypeScript strict mode enabled for type safety
- TranslatePipe and LangDatePipe are impure (`pure: false`) to react to language changes
- Computed signals for reactive statistics calculations with memoization
- Single-pass algorithm for statistics (O(n) complexity)
- Automatic date/time synchronization: when start date/time is changed, end date/time automatically aligns
- Color-coded shift cards with customizable left border (3px width)
- Tailwind safelist configuration for dynamic color classes
- CryptoService uses Web Crypto API (mocked in Jest tests for compatibility)
- WCAG 2.1 AA compliant for keyboard navigation and screen readers

### Important Patterns & Conventions

#### Signal-Based State Management

- All component state managed via Angular signals (`signal`, `computed`, `effect`)
- State updates use `.set()` for replacement or `.update()` for transformations
- Computed signals automatically memoize and only recalculate when dependencies change
- Effects handle side effects (theme persistence, keyboard shortcuts, etc.)

#### Modal Management

- Single `activeModal` signal tracks which modal is open (`'none' | 'form' | 'settings' | 'deleteConfirm' | 'statistics' | 'passwordPrompt' | ...`)
- All modals use `role="dialog"` and `aria-modal="true"` for accessibility
- Confirmation modals use `role="alertdialog"` semantic role
- Password input uses dedicated modal instead of `window.prompt()` for security and mobile compatibility

#### View Mode Management

- Single `viewMode` signal toggles between 'list' and 'calendar' views
- Calendar view integrates CalendarComponent with touch gesture navigation
- Calendar day selection emits events to filter shifts in list view
- View mode persists across sessions via localStorage (planned)

#### Form Handling

- Form state managed through individual signals (e.g., `shiftTitle`, `shiftStartDate`)
- Edit vs. Create determined by `editingShift` signal (null = create, Shift = edit)
- Recurring shift edits show confirmation modal for "edit series" vs. "edit single"
- Form validation occurs in `handleFormSubmit()` with toast error notifications

#### Data Persistence Flow

1. User action triggers component method
2. Component calls ShiftService method
3. ShiftService updates signal state
4. ShiftService encrypts data via CryptoService
5. Encrypted data saved to localStorage
6. Component signals react automatically via computed dependencies

#### Type Guards & Validation

- Type guard functions in `shift.service.ts` (`isValidShift`, `isValidISODate`) validate runtime data
- Used during import/export operations to ensure data integrity (includes end >= start check)
- Pattern: `isValidX(value: unknown): value is X` for TypeScript narrowing

#### Performance Optimizations

- Sorted shifts cached in `sortedShifts` computed signal
- Statistics use single-pass algorithm instead of multiple reduce operations
- Recurrence generation extracted into shared `generateRecurringInstances()` helper
- List pagination with configurable load increment (50 items)

### Code Quality & Roadmap

See `P.md` for:

- Comprehensive code quality analysis (all phases completed)
- Performance optimization history
- Type safety improvements implemented
- Security enhancements (encryption, CSP, password-protected backups)
- Accessibility compliance (WCAG 2.1 AA)
