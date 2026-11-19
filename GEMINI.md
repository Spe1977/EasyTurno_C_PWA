# Gemini CLI Instructions

This repository is shared with Codex and Claude Code through a CLI handoff workflow.

Before editing, read:

1. `AGENT_HANDOFF.md`
2. `README.md` (or `README_IT.md`) for current architecture and commands
3. Any active plan/notes present locally (historical docs like `firebase.md` and `docs/superpowers/plans/*` are local-only and excluded from GitHub)

Then follow the start-of-shift checklist in `AGENT_HANDOFF.md` and declare the task, files you will touch, expected red test, and stop conditions.

Important:

- A dirty worktree is expected.
- Do not clean, reset, or revert other agents' changes.
- Use TDD for implementation work.
- Do not commit unless the user explicitly asks.
- At the end of the turn, update or report the end-of-shift handoff block from `AGENT_HANDOFF.md`.

## Context Summary

- **Auth UI + Firebase Auth**: Completata. Supporta registrazione/login e-mail/password con verifica e-mail, Google Login nativo e web, modalità ospite offline-first, eliminazione account cloud-safe con re-autenticazione.
- **Finestra Visibilità Liste**: Completata. Turni filtrati su `[oggi - 12 mesi, oggi + 24 mesi]`, paginazione da `50` turni, bottone sticky "Vai a oggi" e toast informativo per ricerca data fuori range.
- **Modello Serie/Override & Firestore Sync**: Modello dati `ShiftDataState` (`schemaVersion: 2`) con `ShiftSeries`, `ManualShift` e `ShiftOverride` + `generateOccurrencesForRange()` puro. `UserDataService` come boundary unico e `FirestoreUserDataService` (SDK lazy + `persistentLocalCache` + `writeBatch`) orchestrati da `SyncService` e `DeviceService` (limite soft `3` installazioni `native`/`pwa-installed`, sessioni `web` illimitate, auto-cleanup >90gg, rimozione manuale in Impostazioni).
- **Android FCM + Capacitor 8 Setup**: Package name `com.spe1977.easyturno`, Capacitor Android con Firebase SDK nativo, Push Notifications FCM sincronizzate su Firestore, adaptive icons, splash screen e release keystore configurati.
- **Ottimizzazione Bundle, Performance & PWA v7**: Rimozione `@angular/compiler` a runtime, componenti standalone `OnPush` estratti (`ShiftFormModal`, `StatisticsDrawer`, `SettingsDrawer`, `ConfirmDialog`), confini `@defer` e `createLazyLoader` per Firebase/Capacitor, `sw.js` `v7` (attesa `SKIP_WAITING` same-origin, cache-first per chunk con hash, SWR + LRU 60 entry, `{ ignoreVary: true }`), pipe memoizzate, path di sort `O(N)` e focus trap/restore accessibile sui modali.
- **Stato del Progetto**: `Angular 22.2.6`, `TypeScript 6.0.3`, `Tailwind CSS 4.3.5`, `Firebase 13.4.0`, `Capacitor 8.6.2`. Suite Jest `33/33` (`742/742` test passanti; `98.85%` Stmts / `95.25%` Branch / `97.49%` Funcs / `99.64%` Lines), `scripts/check-csp.spec.ts` `19/19`, Playwright E2E `40/40` su 6 spec, `lint` e `format:check` puliti; `npm run test:firebase` automatizzato in CI (job `firebase` con JDK 21).
