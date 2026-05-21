# Gemini CLI Instructions

This repository is shared with Codex and Claude Code through a CLI handoff workflow.

Before editing, read:

1. `AGENT_HANDOFF.md`
2. `firebase.md`
3. `docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md`
4. `docs/superpowers/plans/2026-05-21-test-coverage-hardening-95.md`

Then follow the start-of-shift checklist in `AGENT_HANDOFF.md` and declare the task, files you will touch, expected red test, and stop conditions.

Important:

- A dirty worktree is expected.
- Do not clean, reset, or revert other agents' changes.
- Use TDD for implementation work.
- Do not commit unless the user explicitly asks.
- At the end of the turn, update or report the end-of-shift handoff block from `AGENT_HANDOFF.md`.

## Context Summary
- **Fase 3 (Auth UI + Firebase Auth)**: Completata. Supporta registrazione/login e-mail/password con verifica e-mail, Google Login nativo e web, eliminazione account cloud-safe con re-autenticazione.
- **Fase 5a (Finestra Visibilità Liste)**: Completata. Turni filtrati su [oggi - 12 mesi, oggi + 24 mesi], pagination da 50 turni, bottone sticky "Vai a oggi" ad autocaricamento rapido e toast di ricerca fuori range.
- **Fase 4 + 5b (Firestore Sync + Refactor Serie/Override)**: Completata. Modello dati sdoppiato in `ShiftSeries`, `ManualShift` e `ShiftOverride`. Creati `UserDataService` come boundary unico locale e `FirestoreUserDataService` con realtime listener persistenti ed IndexedDB cache. Logica di scrittura atomica via `writeBatch` in Firestore per gli utenti autenticati con integrazione trasparente in `ShiftService`.
- **Fase 6 (Android FCM + Capacitor Native Setup)**: Completata. Package name `com.spe1977.easyturno` configurato, Capacitor Android con Firebase SDK nativo, FCM Push Notifications funzionanti e sincronizzate su Firestore, adaptive icons, splash screen e release keystore configurati. UI Warning per il limite soft di 4 dispositivi attivi completato. Verificata la release build Gradle con JDK 21.
- **Fase 7 (Advanced Features & Premium Design)**: Completata. Il vecchio modal delle statistiche è stato riprogettato in una Dashboard Drawer PWA premium con sliding drawer animato per mobile, presets temporali rapidi (Mese, Mese Scorso, 30gg, Anno), layout asimmetrico delle metriche ordinarie e straordinarie, barre proporzionali basate dinamicamente sui colori assegnati ai turni, portafoglio indennità ed empty state grafico.
- **Stato del Progetto**: Tutte le 25 suite Jest sono superate con successo (582/582 test passanti). Raggiunto l'obiettivo di copertura globale superiore al 95% per Statements, Functions e Lines. Linter eslint pulito, build di produzione riuscito. Il prossimo step pianificato è quello di portare anche la copertura dei test del Branch al 95%.

