# Piano di Implementazione - Copertura Test al 95%

Questo piano descrive le modifiche e le aggiunte ai file di test (`*.spec.ts`) per raggiungere almeno il 95% di copertura totale (Statements, Branches, Functions, Lines) e per risolvere il test leak in `FirebaseAppService`.

## User Review Required

> [!IMPORTANT]
> Tutte le modifiche saranno limitate esclusivamente ai file di test (`*.spec.ts`). Non verrà modificata la logica di produzione (files `*.ts` non spec) a meno che non sia strettamente necessario per la testabilità, garantendo così la stabilità e la sicurezza del codice di produzione.

## Open Questions

Non ci sono domande aperte critiche. Procederemo a incrementare la copertura in modo mirato e incrementale basandoci sui report di copertura del tool `Jest`.

## Proposed Changes

### 1. Firebase App Service Specs
#### [MODIFY] [firebase-app.service.spec.ts](file:///home/leospe/PROGETTI/PROGETTI%20COMPLETI/EasyTurno_C_PWA/src/services/firebase-app.service.spec.ts)
- Aggiungere `(getApps as jest.Mock).mockReturnValue([]);` nel blocco `beforeEach` per evitare il leak del valore di ritorno mockato del metodo `getApps` tra i test.

### 2. Service-Worker Update Service Specs
#### [MODIFY] [sw-update.service.spec.ts](file:///home/leospe/PROGETTI/PROGETTI%20COMPLETI/EasyTurno_C_PWA/src/services/sw-update.service.spec.ts)
- Aggiungere un test per la funzione `reloadPage()` che invoca internamente `window.location.reload()`.
- Mockare `window.location` in JSDOM per evitare l'errore di navigazione reale e verificare la chiamata a `reload()`.

### 3. Calendar Service Specs
#### [MODIFY] [calendar.service.spec.ts](file:///home/leospe/PROGETTI/PROGETTI%20COMPLETI/EasyTurno_C_PWA/src/services/calendar.service.spec.ts)
- Coprire i branch con i parametri di default (come `locale = 'it-IT'`).
- Aggiungere un test che invoca `getWeekdayNames()` e `getMonthName()` senza passare argomenti.

### 4. Crypto Service Specs
#### [MODIFY] [crypto.service.spec.ts](file:///home/leospe/PROGETTI/PROGETTI%20COMPLETI/EasyTurno_C_PWA/src/services/crypto.service.spec.ts)
- Testare il blocco `catch` per il fallimento della cifratura di backup PBKDF2 mockando `crypto.subtle.encrypt` affinché sollevi un errore / rifiuti la promessa.
- Testare input nulli o malformati (non-JSON) per la funzione `isPasswordProtectedBackupPayload`.

### 5. Firestore User Data Service Specs
#### [MODIFY] [firestore-user-data.service.spec.ts](file:///home/leospe/PROGETTI/PROGETTI%20COMPLETI/EasyTurno_C_PWA/src/services/firestore-user-data.service.spec.ts)
- Aggiungere test per il callback `onSnapshot` sulle collezioni per verificare che lo stato dei device attivi si aggiorni reattivamente e notifichi il superamento del limite.

### 6. Shift Service Specs
#### [MODIFY] [shift.service.spec.ts](file:///home/leospe/PROGETTI/PROGETTI%20COMPLETI/EasyTurno_C_PWA/src/services/shift.service.spec.ts)
- Aggiungere test per il caricamento di dati V2 e la migrazione in cui i dati V2 sono malformati o non parsabili (JSON.parse fallisce).
- Mockare `JSON.stringify` per far sì che sollevi un errore, verificando la corretta gestione delle eccezioni di serializzazione e quota locale esaurita.
- Aggiungere un test in cui un override di un turno modificato viene sovrascritto/modificato nuovamente.
- Aggiungere un test per l'aggiornamento di una serie non esistente (per coprire il fallback di ricreazione).
- Testare il metodo privato `isValidISODate()` passando valori non stringa per verificare il branch di sicurezza.

### 7. App Component Specs
#### [MODIFY] [app.component.spec.ts](file:///home/leospe/PROGETTI/PROGETTI%20COMPLETI/EasyTurno_C_PWA/src/app.component.spec.ts)
- Aggiungere test per simulare eventi da tastiera globali (`Escape` per chiudere i drawer/modal, `Ctrl+N` per aggiungere un nuovo turno).
- Testare i messaggi di degradamento sicurezza / avviso storage locale.
- Testare l'invocazione delle notifiche native di Capacitor.
- Simulare uno scroll oltre il range visibile e chiamare `goToToday()` per verificare l'incremento corretto delle pagine di paginazione.
- Testare i flussi di uscita dell'utente (logout) autenticato e guest.
- Testare la visualizzazione di errori speciali durante l'autenticazione (es. `auth/network-request-failed`).
- Testare la validazione delle date del form (data di inizio successiva alla data di fine).
- Testare i suggerimenti automatici di backup periodici.
- Testare la modifica di un'intera serie ricorrente partendo da una singola istanza modificata.

---

## Verification Plan

### Automated Tests
- Eseguire i test focalizzati via Jest: `npm test -- <path_to_spec_file>`
- Eseguire il report completo di copertura: `npm run test:coverage -- --runInBand`
- Verificare che il linter sia pulito: `npm run lint`
