# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EasyTurno is a Progressive Web App (PWA) for work shift management, built with Angular and designed to be offline-first. The application allows users to create, edit, and manage work shifts with support for recurring shifts, overtime tracking, allowances management, statistical analysis, and data export/import.

## Development Commands

- `npm run dev` - Start development server on port 3000
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm install` - Install dependencies

## Architecture

### Core Technologies
- **Angular 20+** with standalone components and signal-based state management
- **TypeScript** (strict mode planned - see CODE_ANALYSIS_ROADMAP.md)
- **Tailwind CSS** for styling with dark mode support
- **PWA** features with service worker and manifest

### Application Structure

The app follows a simple, flat structure optimized for a single-page application:

- `src/app.component.ts` - Main component containing all application logic and state
- `src/services/` - Core services for business logic
- `src/models/` - TypeScript interfaces and types
- `src/pipes/` - Custom Angular pipes for data transformation

### State Management

The application uses Angular's signal-based reactive state management:
- All state is managed in the main `AppComponent` using Angular signals
- `ShiftService` handles data persistence to localStorage with automatic sync
- UI state includes modal management, form state, and list pagination

### Key Services

- **ShiftService** (`src/services/shift.service.ts`) - Manages shift CRUD operations, recurring shift generation, and encrypted localStorage persistence
- **CryptoService** (`src/services/crypto.service.ts`) - Handles AES-GCM 256-bit encryption/decryption for secure data storage
- **TranslationService** (`src/services/translation.service.ts`) - Handles internationalization
- **NotificationService** (`src/services/notification.service.ts`) - Manages local notifications for shift reminders (Capacitor native platforms)
- **ToastService** (`src/services/toast.service.ts`) - Displays temporary toast notifications to users

### Data Models

- **Shift** interface defines work shift structure with support for:
  - Recurring patterns via `Repetition` interface
  - Optional notes field
  - Overtime hours tracking (`overtimeHours`)
  - Multiple allowances via `Allowance[]` array
- **Repetition** interface defines recurring shift frequency and intervals (daily, weekly, monthly, yearly)
- **Allowance** interface defines custom allowances with name and amount
- Shifts are generated up to 2 years in advance for recurring patterns

### PWA Features

- Offline-first design with encrypted localStorage persistence
- Web app manifest with shortcuts for quick shift creation
- Service worker for caching (sw.js)
- Responsive design supporting mobile and desktop
- Content Security Policy (CSP) for XSS protection
- Subresource Integrity (SRI) for CDN scripts
- AES-GCM 256-bit encryption for sensitive data at rest

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

### Security Features

- **Content Security Policy (CSP)**: Restricts resource origins to prevent XSS attacks
- **Subresource Integrity (SRI)**: Validates CDN scripts to prevent tampering
- **Data Encryption**: AES-GCM 256-bit encryption for localStorage data
- **Device-Based Key**: Encryption key derived from device fingerprint (no password required)
- **Backward Compatibility**: Automatic detection and migration of legacy unencrypted data
- **Secure Error Handling**: Graceful degradation when encryption fails

### Development Notes

- Uses Angular's OnPush change detection strategy for performance
- All dates stored as ISO strings for consistency
- Theme persistence with automatic system preference detection
- ESLint configured for TypeScript with recommended rules
- Computed signals for reactive statistics calculations
- Object.keys() made available in templates for iterating over statistical data
- Automatic date/time synchronization: when start date/time is changed, end date/time automatically aligns
- Color-coded shift cards with customizable left border (3px width)
- CryptoService uses Web Crypto API (mocked in Jest tests for compatibility)

### Code Quality & Roadmap

See `ROADMAP.md` for:
- Comprehensive code quality analysis
- Performance optimization opportunities
- Type safety improvements
- Planned enhancements and technical debt
- Implementation roadmap with priorities