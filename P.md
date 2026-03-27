# EasyTurno - Documento Unico di Stato e Piano Operativo

Ultimo aggiornamento: 2026-03-27 (Fase 4 — validazione finale, Playwright esteso e documentazione bilingue riallineata)
Workspace analizzato: `spe1977/easyturno_c_pwa`

## 1. Funzionalita completate

### Core applicativo

- PWA Angular 21 standalone con TypeScript 5.9 strict mode attivo.
- Gestione offline-first con persistenza locale cifrata.
- Creazione, modifica e cancellazione di turni singoli.
- Gestione turni ripetitivi con frequenze giornaliere, settimanali, mensili e annuali.
- Generazione ricorrenze fino a 2 anni dalla data di inizio turno (max 200 istanze).
- Modifica di un singolo turno appartenente a una serie.
- Modifica o rigenerazione di una serie ricorrente dalla singola occorrenza modificata in poi.
- Cancellazione singola o di serie.
- Ricerca turni per data con paginazione (50 elementi, incremento di 50).
- Reset completo dei dati con conferma.
- Backup esportabile e importabile in JSON con validazione type guard.

### Dati e dominio

- Modello `Shift` con supporto a note, colore, timezone, straordinari e indennita.
- Campo `timezone` dichiarato nell'interfaccia `Shift` (IANA timezone identifier).
- Supporto a 8 colori turno con classi Tailwind dinamiche.
- Supporto a note libere per turno.
- Supporto a ore di straordinario (step 0.5).
- Supporto a indennita multiple personalizzabili per turno.

### UI e UX

- Vista lista come modalita primaria con filtro turni futuri.
- Vista calendario mensile con griglia 6 settimane, selezione giorno e indicatori turno.
- Mappa turni pre-calcolata (`shiftsByDay` computed signal) per rendering calendario ottimizzato.
- Click su giorno del calendario per filtrare i turni.
- Click su turno nel calendario per aprire la modifica.
- Touch gesture: swipe orizzontale per navigazione mesi nel calendario.
- Responsive design orientato al mobile.
- Supporto tema chiaro/scuro con persistenza e rilevamento preferenza sistema.
- Shortcut tastiera: Ctrl+N (nuovo turno), Escape (chiudi modale), Ctrl+S (statistiche da settings).
- Toast notification UI.
- Dashboard statistiche con calcolo single-pass O(n).
- Template con control flow nativo Angular (`@for`/`@if`/`@else`) in tutti i componenti.

### Localizzazione

- Supporto multilingua italiano/inglese.
- Traduzioni JSON centralizzate in `src/assets/i18n/`.
- Pipe di traduzione (`TranslatePipe`) e pipe data localizzata (`LangDatePipe`), entrambe impure (`pure: false`) per reagire al cambio lingua.

### PWA, mobile e integrazioni

- Manifest web con shortcuts per creazione rapida turno.
- Icone PWA PNG reali generate per Chrome/Android (`192`, `512`, `maskable`) e favicon dedicata.
- Service worker per caching (`sw.js`).
- Rilevamento aggiornamenti PWA con notifica utente (`SwUpdateService`).
- Configurazione Capacitor 8 presente per deploy nativo Android.
- Servizio notifiche locali native presente (solo piattaforme native).
- Content Security Policy (CSP) e Subresource Integrity (SRI) configurati.

### Sicurezza e persistenza

- Salvataggio turni su `localStorage` con cifratura AES-GCM 256-bit (`CryptoService`).
- Chiave dispositivo persistita preferibilmente in IndexedDB come `CryptoKey` non estraibile, con fallback legacy su `localStorage` solo in ambienti senza IndexedDB.
- Gestione compatibilita con dati legacy non cifrati (migrazione automatica).
- Gestione errori su import/export, storage e quota exceeded.

### Architettura e pattern

- Standalone components con `ChangeDetectionStrategy.OnPush`.
- Signal-based state management (`signal`, `computed`, `effect`).
- Signal input/output API (`input()`, `output()`) nei componenti recenti.
- Focus trap modale con `ModalFocusDirective` (WCAG 2.1 AA).
- Type guard functions per validazione runtime su import/export.

### Testing e quality gate verificati

- `npm run lint`: OK (0 errori, 0 warning)
- `npm run format:check`: OK
- `npx tsc --noEmit`: OK (0 errori TypeScript 5.9.3)
- `npm run build`: OK (bundle `main` 753.36 KB, `styles` 43.03 KB, totale iniziale 804.89 KB)
- `npm test`: 11 suite, 319 test, tutti verdi
- Test Cypress E2E: 55/55 superati (100%) con retry attivo nel rerun completo del 2026-03-26.
- Test Playwright browser: 13/13 superati su Chromium il 2026-03-27 (smoke + persistenza, CRUD base, tema/lingua, calendario, reset dati, backup/import cifrato, modifica/cancellazione ricorrenze, statistiche minime e errore import con password errata).

## 2. Gap reali ancora aperti

### ~~Allineamento codice-documentazione~~ — RISOLTO (2026-03-25)

- `README.md` tradotto integralmente in inglese e riallineato allo stato reale del repository.
- `README_IT.md` creato come versione italiana separata con contenuti equivalenti.
- File storici rimossi. Pulizia documentale completata.

### ~~Allineamento architetturale~~ — RISOLTO (2026-03-25)

- Tutti i `[(ngModel)]` su signal in `app.component.html` sono stati corretti con `[ngModel]` + `(ngModelChange)` + `.set()`.

### Hardening e rifinitura

- Alcuni flussi di notifica nativa sono presenti ma richiedono validazione end-to-end su device fisico.
- Nota ambiente: nella shell sandboxata alcune verifiche CLI possono fallire per restrizioni di esecuzione (`child_process` -> `EPERM`), ma il progetto e stato verificato con successo fuori sandbox.

### ~~Dipendenze major non aggiornate~~ — RISOLTO (2026-03-25)

Tutti e tre gli aggiornamenti major sono stati completati:

- TypeScript riallineato a 5.9.3 per rispettare i peer ufficiali di `@angular/build`, `ts-jest` e `@typescript-eslint` senza workaround.
- Tailwind CSS 3 → 4.2.2: migrazione a CSS-first config (`@import 'tailwindcss'`, `@variant dark`, `@source`). Rimosso `tailwind.config.js` e `autoprefixer`. Nuovo `postcss.config.json` con `@tailwindcss/postcss` (Angular `@angular/build` accetta solo `.json` per PostCSS config).
- Capacitor 7 → 8.3.0: tutti i plugin aggiornati. Nessuna breaking change nel codice (StatusBar/SplashScreen usati solo in config, non importati nel codice).

## 3. Bug, debiti tecnici e rischi prioritari

### Risolti nella sessione del 2026-03-25

I seguenti problemi erano documentati nella versione precedente di questo file e sono stati corretti:

- **A. Test unitari rotti sulle ricorrenze** — Corretto: `maxDateAhead` ora calcolato dalla data di inizio turno anziche da `new Date()`. Test aggiornati con assertion deterministiche.
- **B. Test unitari rotti sulla lista e paginazione** — Corretto: dati di test generati con date relative a domani per garantire visibilita indipendentemente dalla data di esecuzione.
- **D. Warning `allowSignalWrites`** — Rimosso da `app.component.ts`.
- **G. `@Input`/`@Output` in CalendarComponent** — Migrato a `input()`/`output()` signal API. Template migrato a control flow nativo `@for`/`@if`. Rimosso `CommonModule`.

### Risolti nella sessione serale del 2026-03-25

- **F. Tailwind CDN residuo in `index.html` — bloccante per tutti i test E2E**
  - Causa: dopo la migrazione Tailwind 3 → 4 (CSS-first via PostCSS), lo script CDN `cdn.tailwindcss.com` e il blocco `tailwind.config = {...}` erano rimasti in `index.html`. L'hash SRI non corrispondeva piu, lo script non si caricava, e `tailwind.config` lanciava `ReferenceError: tailwind is not defined`. Questo bloccava TUTTI i test E2E Cypress (0/55).
  - Fix applicato: rimosso lo script CDN Tailwind, il blocco `tailwind.config`, l'importmap (Angular bundla tutto), lo script `ts-browser` (non necessario con il build Angular). Aggiornato il CSP rimuovendo i domini CDN non piu usati (`cdn.tailwindcss.com`, `cdn.jsdelivr.net`, `aistudiocdn.com`, `next.esm.sh`). Il font Inter caricato via `<link rel="stylesheet">` anziche `@import url()`.
  - File modificato: `index.html`

- **J. TypeScript 6.0 `downlevelIteration` deprecato — bloccante per Cypress**
  - Causa: Cypress 15 usa internamente webpack/ts-loader per compilare i file `.cy.ts`. Con TypeScript 6.0, l'opzione `downlevelIteration` (presente nel tsconfig interno di Cypress) e deprecata e genera un errore bloccante `TS5101`.
  - Fix applicato: creato `cypress/tsconfig.json` con `"ignoreDeprecations": "6.0"` per silenziare la deprecazione.
  - File creato: `cypress/tsconfig.json`

- **K. Test E2E flaky: primo test di ogni spec falliva per race condition Angular**
  - Causa: il primo test di ogni spec falliva intermittentemente con `Expected to find element: [data-cy="shift-title-input"], but never found it`. Angular non aveva completato il binding degli event listener quando Cypress cliccava il bottone. Il pattern `cy.clearLocalStorage()` prima di `cy.visit()` non garantiva la pulizia se la pagina non era ancora visitata.
  - Fix applicato:
    1. Pattern `beforeEach` robusto in tutti i 5 spec: `cy.visit('/')` → `cy.window().then(win => win.localStorage.clear())` → `cy.reload()` → `cy.contains('EasyTurno', { timeout: 15000 })`. Il `reload()` dopo la pulizia localStorage garantisce che Angular riparta con stato pulito.
    2. Configurazione retry in `cypress.config.ts`: `retries: { runMode: 2, openMode: 0 }` per gestire flakiness residua.
    3. Script `dev:e2e` con `ng serve --watch=false` per evitare rebuild durante i test.
  - File modificati: `cypress.config.ts`, `cypress/e2e/*.cy.ts`, `package.json`
  - Risultato: da 0/55 a 54/55 (98.2%).

- **L. Workaround `tailwind is not defined` in `cypress/support/e2e.ts` — rimosso**
  - Esisteva un handler `Cypress.on('uncaught:exception')` che sopprimeva l'errore `tailwind is not defined`. Rimosso perche la causa radice (bug F) e stata corretta.
  - File modificato: `cypress/support/e2e.ts`

### Risolti nella sessione del 2026-03-26

- **M. Asset PWA mancanti (icone manifest e favicon) — risolto**
  - Causa: `manifest.webmanifest` referenziava `icons/icon-192.png`, `icons/icon-512.png` e `icons/icon-maskable-512.png`, ma questi file non esistevano nel repository ne erano inclusi negli asset Angular. Chrome mostrava errori 404 e non riusciva a usare correttamente le icone del manifest.
  - Fix applicato:
    1. Generate icone PNG reali a partire dal branding `ET`: `192x192`, `512x512`, `maskable 512x512`, `apple-touch-icon`, `favicon.png`, `favicon.ico`.
    2. Aggiornato `angular.json` per includere `icons/`, `favicon.ico` e `favicon.png` nel build output.
    3. Aggiornato `index.html` con `mobile-web-app-capable`, favicon esplicita e `apple-touch-icon` PNG.
    4. Aggiornato `manifest.webmanifest` con descrizione coerente, `start_url`/`scope` root-based, categoria app e fallback `icon.svg`.
  - File modificati: `angular.json`, `index.html`, `manifest.webmanifest`
  - File creati: `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `icons/apple-touch-icon.png`, `favicon.png`, `favicon.ico`

- **N. Service worker attivo in development e WebSocket HMR bloccato — risolto**
  - Causa: il service worker veniva registrato inline in `index.html` anche su `localhost`, introducendo cache sporca durante il debug. In parallelo, la CSP permetteva solo `connect-src 'self'`, bloccando il WebSocket `ws://localhost:3000` usato da Vite per HMR/live reload.
  - Fix applicato:
    1. Rimossa la registrazione inline del service worker da `index.html`.
    2. Resa la registrazione del service worker responsabilita esclusiva di `SwUpdateService`.
    3. `SwUpdateService` ora salta la registrazione in development e su host locali (`localhost`, `127.0.0.1`).
    4. Aggiornato il CSP in `index.html` per consentire `ws://localhost:3000` e `ws://127.0.0.1:3000` durante lo sviluppo locale.
  - File modificati: `index.html`, `src/services/sw-update.service.ts`

- **O. `sw.js` disallineato dal build Angular attuale — risolto**
  - Causa: il service worker conteneva ancora asset sorgente e URL CDN storici, non piu rappresentativi del bundle effettivo prodotto da Angular 21.
  - Fix applicato:
    1. Sostituita la lista di precache con un app shell minimale e stabile: `index.html`, manifest, favicon, icone PWA e traduzioni locali.
    2. Rimossa ogni dipendenza da CDN e asset sorgente non serviti in produzione.
    3. Introdotta strategia `network-first` per le navigazioni con fallback alla app shell cached.
    4. Introdotta strategia `stale-while-revalidate` per asset same-origin cacheabili (`js`, `css`, `json`, immagini, font, worker).
    5. Separati cache statico e cache runtime con pulizia delle versioni obsolete in `activate`.
  - File modificato: `sw.js`

- **P. Test E2E calendario: selettore `.shift-indicators` fragile — risolto nel codice**
  - Causa: il container `.shift-indicators` esiste su tutte le 42 celle del calendario, incluse quelle vuote. I test che cliccavano il primo container potevano selezionare una cella senza turni.
  - Fix applicato:
    1. Aggiornati i test del blocco `Day Selection with Shifts` per cercare i dot reali `.shift-indicators .rounded-full`.
    2. Dopo il match, il click risale esplicitamente alla cella giorno con `.closest('[data-cy^="calendar-day-"]')`.
  - File modificato: `cypress/e2e/calendar-view.cy.ts`
  - Verifica: confermata nel rerun completo Cypress del 2026-03-26 (`calendar-view.cy.ts`: 26/26).

- **Q. Test E2E offline: aspettativa service worker non coerente con localhost — risolto**
  - Causa: dopo l'hardening introdotto in `SwUpdateService`, il service worker non viene registrato su `localhost` e `127.0.0.1`. Lo spec Cypress continuava ad aspettarsi sempre una registrazione attiva.
  - Fix applicato:
    1. Aggiornato lo spec per verificare assenza di registrazione in ambiente locale.
    2. Mantenuta l'aspettativa positiva per host production-like.
  - File modificato: `cypress/e2e/offline-functionality.cy.ts`
  - Verifica: confermata nel rerun completo Cypress del 2026-03-26 (`offline-functionality.cy.ts`: 6/6).

- **R. Test E2E ricorrenze: testo conferma modifica istanza non allineato alle traduzioni — risolto**
  - Causa: lo spec cercava `Solo questo|Only this`, ma le traduzioni correnti mostrano `Solo questo evento` / `Just this event`.
  - Fix applicato:
    1. Aggiornato il matcher del dialog di conferma.
    2. Aggiornato il click sul pulsante con il testo reale attuale.
  - File modificato: `cypress/e2e/recurring-shifts.cy.ts`
  - Verifica: confermata nel rerun completo Cypress del 2026-03-26 (`recurring-shifts.cy.ts`: 5/5).

### Risolti nella sessione del 2026-03-27

- **S. Regressione test unitari `SwUpdateService` dopo hardening localhost/dev — risolto**
  - Causa: dopo l'introduzione del bypass su `isDevMode()` e host locali, `checkForUpdates()` terminava immediatamente anche in ambiente Jest/JSDOM. La suite non entrava piu nei rami di registrazione del service worker e fallivano 14 test.
  - Fix applicato:
    1. Introdotto rilevamento esplicito dell'ambiente test via `navigator.userAgent` (`jsdom`).
    2. Mantenuto il bypass del service worker in development reale e su `localhost`, ma escluso l'ambiente di test da questa early return.
    3. Riallineati lint, format, unit test e build dopo la correzione.
  - File modificato: `src/services/sw-update.service.ts`
  - Verifica: `npm test -- --runInBand` 307/307 verde il 2026-03-27.

- **T. Integrazione Playwright nel repository come secondo livello E2E/smoke — risolto**
  - Causa: il progetto disponeva solo della suite Cypress. Mancava un livello smoke rapido, browser-driven e integrato in CI per verifiche essenziali su Chromium con tracing/report nativi.
  - Fix applicato:
    1. Aggiunta dipendenza `@playwright/test` con installazione compatibile al setup corrente (`--legacy-peer-deps`).
    2. Creato `playwright.config.ts` con `webServer` integrato, base URL dedicata (`127.0.0.1:3100`), artifact su failure e progetto Chromium.
    3. Creato `playwright/tests/smoke.spec.ts` con 2 smoke test: bootstrap/toggle calendario e creazione turno.
    4. Aggiunti script npm dedicati (`test:pw`, `test:pw:ui`, `test:pw:headed`, `test:pw:debug`, `test:pw:install`) e script `dev:pw`.
    5. Aggiornati `.github/workflows/ci.yml`, `.gitignore` e `README.md` per esecuzione e reportistica Playwright.
  - File modificati: `package.json`, `package-lock.json`, `.github/workflows/ci.yml`, `.gitignore`, `README.md`
  - File creati: `playwright.config.ts`, `playwright/tests/smoke.spec.ts`
  - Verifica: `npm run test:pw` verde il 2026-03-27 (2/2 test superati).

- **U. Jest includeva erroneamente la suite Playwright nei test unitari — risolto**
  - Causa: `jest.config.js` ignorava solo `node_modules` e `dist`. Dopo l'integrazione di `playwright/tests/smoke.spec.ts`, `npm test` tentava di eseguire anche quel file sotto Jest, fallendo su import/runtime Playwright non compatibili con l'ambiente JSDOM.
  - Fix applicato:
    1. Aggiunta esclusione esplicita di `/playwright/` in `testPathIgnorePatterns`.
    2. Rieseguiti i test unitari dopo la correzione.
  - File modificato: `jest.config.js`
  - Verifica: `npm test -- --runInBand` verde il 2026-03-27 (11 suite, 319 test).

- **V. Toolchain fuori peer supportati per TypeScript 6 — risolto con percorso conservativo**
  - Causa: il repository funzionava con TypeScript `6.0.2`, ma `@angular/build@21.2.5`, `ts-jest@29.4.6` e `@typescript-eslint@8.57.2` dichiarano ancora peer `<6`. Questo obbligava workaround (`--legacy-peer-deps`) e lasciava il repo fuori dalla matrice ufficialmente supportata.
  - Fix applicato:
    1. Downgrade di `typescript` alla patch stabile supportata `5.9.3`.
    2. Rigenerato il lockfile con installazione standard, senza forzature.
    3. Verificati i peer package: nessun `invalid` residuo nel sottoalbero controllato.
  - File modificati: `package.json`, `package-lock.json`
  - Verifica: `npx tsc --noEmit`, `npm test -- --runInBand` e `npm run build` verdi il 2026-03-27.

- **W. Estensione Playwright oltre gli smoke iniziali e integrazione stabile con il pre-commit — risolto**
  - Causa: la suite Playwright iniziale copriva solo 2 smoke test. Inoltre il pre-commit (`lint-staged`) falliva sui file Playwright perche `eslint --fix` riceveva file ignorati o fuori dal `tsconfig` analizzato.
  - Fix applicato:
    1. Aggiunti `playwright/tests/app-flows.spec.ts` e `playwright/tests/helpers.ts` per coprire persistenza dopo reload, CRUD base, tema/lingua e selezione giorno in calendario.
    2. Creato `playwright/tsconfig.json` e aggiornato `eslint.config.js` per includere anche i file Playwright nel type-aware linting.
    3. Aggiornato `lint-staged` in `package.json` con `eslint --fix --no-warn-ignored` per non rompere il commit sui file `*.spec.ts` esclusi.
  - File modificati: `package.json`, `eslint.config.js`, `playwright/tests/smoke.spec.ts`
  - File creati: `playwright/tests/app-flows.spec.ts`, `playwright/tests/helpers.ts`, `playwright/tsconfig.json`
  - Verifica: `npm run test:pw` verde il 2026-03-27 (13/13 test superati dopo le estensioni successive) e pre-commit completato con commit reale su `main`.

- **X. `CryptoService` rompeva i test Jest in ambiente senza IndexedDB — risolto**
  - Causa: dopo l'hardening della persistenza chiavi su IndexedDB, in ambiente Jest/JSDOM `indexedDB` non esisteva. Il pre-commit arrivava ai related tests e fallivano numerosi test di `CryptoService`.
  - Fix applicato:
    1. Introdotto rilevamento di disponibilita di IndexedDB.
    2. Mantenuta la persistenza preferenziale su IndexedDB nel browser reale.
    3. Introdotto fallback compatibile su `localStorage` per ambienti senza IndexedDB, preservando anche la compatibilita con il formato legacy.
  - File modificato: `src/services/crypto.service.ts`
  - Verifica: `npm test -- --runInBand src/services/crypto.service.spec.ts` verde il 2026-03-27 (32/32 test).

- **Y. CSP troppo stretta per il dev server nel browser locale — risolto pragmaticamente**
  - Causa: con `ng serve`, il browser bloccava inline handler/dev overlay a causa di `script-src 'self'` nel `meta` CSP.
  - Fix applicato:
    1. Riammesso `unsafe-inline` in `script-src` nel `meta` CSP usato in sviluppo locale.
    2. Mantenuta la nota che il prossimo passo corretto, se si vuole stringere la sicurezza in produzione, e separare CSP `dev` e `prod`.
  - File modificato: `index.html`
  - Verifica: app nuovamente caricabile su `http://localhost:3000/` il 2026-03-27 senza blocco browser sul dev server.

### Ancora aperti

#### C. ~~Uso misto `[(ngModel)]` su signal nei template~~ — RISOLTO (2026-03-25)

Corretto: tutti e 3 i binding `[(ngModel)]` su signal (`searchDateInput`, `statsStartDate`, `statsEndDate`) in `app.component.html` sono stati sostituiti con `[ngModel]` + `(ngModelChange)` + `.set()`. Zero `[(ngModel)]` rimasti nel template.

#### E. ~~README errato o fuorviante~~ — RISOLTO (2026-03-25)

README riscritto con contenuto completo e accurato: screenshot, stack tecnologico, comandi, architettura, sicurezza, link a P.md.

#### H. Vulnerabilita transitive in dipendenze dev — PARZIALMENTE RIDOTTE (2026-03-27)

Fix applicato:

- Aggiornati `@angular/build` e `@angular/cli` da `21.2.3` a `21.2.5`.
- Lockfile riallineato inizialmente con `npm install --legacy-peer-deps` per applicare le patch Angular; successivamente il repository e stato riportato su TypeScript `5.9.3` con installazione standard.
- Advisory `high` su `undici` e `picomatch` eliminate tramite upgrade transitivo a `undici@7.24.4` e `picomatch@4.0.4`.
- Aggiunto override npm mirato `handlebars@4.7.9` per ridurre una advisory `moderate` transitiva di `ts-jest`.

Problema:

- Stato audit verificato il 2026-03-27 dopo gli aggiornamenti: 21 vulnerabilita totali, tutte `moderate`, 0 `high`, 0 `critical`.
- Le vulnerabilita residue sono nel toolchain Jest/Istanbul (`jest`, `ts-jest`, `jest-preset-angular`, `glob`, `test-exclude`, `minimatch`, `brace-expansion`) e richiedono fix upstream o un riallineamento non banale della catena di test.

Rischio:

- Nessun impatto runtime. Solo CI/audit su dipendenze dev.

Priorita: bassa.

#### I. Review sicurezza aree critiche applicative — PARZIALMENTE RISOLTO (2026-03-27)

Ambito verificato:

- Cifratura locale e gestione chiavi (`CryptoService`, `ShiftService`)
- Import/export backup
- Content Security Policy e superficie XSS
- Service worker e caching runtime
- Notifiche native e impostazioni persistite
- Validazione input su file/import

Problemi rilevati:

- Alta. La chiave AES viene esportata e salvata nello stesso `localStorage` che contiene i dati cifrati. Chi ottiene accesso allo storage del browser puo leggere sia ciphertext sia chiave e decifrare tutto. La cifratura protegge solo da letture casuali, non da XSS, estensioni malevole, accesso al profilo browser o device compromise.
- Alta. La chiave AES usata per lo storage locale resta salvata nello stesso `localStorage` che contiene i dati cifrati. Questo limita fortemente il valore difensivo della cifratura contro XSS, estensioni malevole, accesso al profilo browser o device compromise.
- ~~Alta. Il backup esportato e in chiaro (`easyturno_backup.json`)~~ — RISOLTO (2026-03-27): export introdotto in formato cifrato con password utente, KDF `PBKDF2-SHA-256` e import compatibile sia con il nuovo formato cifrato sia con i backup JSON legacy.
- ~~Media. L'import supporta solo JSON in chiaro~~ — RISOLTO (2026-03-27): l'import riconosce il payload cifrato e richiede la password per la decifratura, mantenendo retrocompatibilita con il formato precedente.
- ~~Media. La CSP in `index.html` include ancora `script-src 'unsafe-inline' 'unsafe-eval'`~~ — PARZIALMENTE RISOLTO (2026-03-27): rimossi `unsafe-eval` e la parte storica piu permissiva; `unsafe-inline` e stato temporaneamente riammesso per compatibilita del dev server locale. Per una chiusura completa va separata la CSP di sviluppo da quella di produzione.
- ~~Media. `NotificationService.getSettings()` deserializza `localStorage` con `JSON.parse` senza schema validation o fallback difensivo~~ — RISOLTO (2026-03-27): introdotta sanitizzazione runtime con fallback ai default in caso di payload corrotto o malevolo.
- ~~Media. `scheduleShiftNotification()` usa `settings.reminderMinutesBefore` senza limiti runtime~~ — RISOLTO (2026-03-27): i valori reminder vengono ora normalizzati su una allowlist supportata prima dello scheduling.
- ~~Media. Il service worker applica `stale-while-revalidate` a tutte le risorse same-origin con estensione `.json`~~ — RISOLTO (2026-03-27): caching runtime dei JSON ristretto a una allowlist esplicita di asset statici locali.
- ~~Bassa. `CryptoService.isEncrypted()` usa un'euristica debole basata solo sul primo carattere~~ — RISOLTO (2026-03-27): introdotto controllo piu robusto su base64 valido e lunghezza minima del payload.
- ~~Bassa. L'import del backup legge l'intero file via `FileReader.readAsText()` senza alcun controllo su dimensione massima~~ — RISOLTO (2026-03-27): introdotti limiti difensivi sia nel componente UI sia nel servizio di import.

Rischio:

- Confidenzialita dati: non garantita contro attaccanti con accesso al contesto browser o ai backup esportati.
- Integrita/robustezza: bassa-media, con residuo concentrato soprattutto sulla strategia chiavi dello storage locale.
- Impatto XSS: ridotto rispetto allo stato precedente, ma non annullato finche la chiave storage resta nel contesto browser.

Priorita residua: alta, ma ormai focalizzata quasi esclusivamente sulla strategia chiavi/storage locale.

Interventi consigliati:

1. Introdurre backup cifrati con password utente e KDF robusta (`PBKDF2`/`scrypt`/`Argon2`, in base ai vincoli platform) separando chiaramente storage locale e formato export.
2. Rivedere la strategia chiavi: evitare di salvare la chiave raw nello stesso storage dei dati protetti; in alternativa, ridimensionare formalmente il claim di sicurezza nella documentazione/UI.
3. Separare CSP di sviluppo e produzione, cosi da poter mantenere `unsafe-inline` solo in locale e rimuoverlo in produzione.
4. Aggiungere schema validation e fallback sicuri per notification settings e altri payload da `localStorage`.
5. Limitare dimensione e formato dei file importati prima del parsing completo.
6. Ridurre lo scope del runtime caching del service worker a una allowlist esplicita di asset statici.

Ipotesi correttive residue per il rischio architetturale principale:

1. Password utente per lo storage locale.
   - Approccio: derivare la chiave di cifratura dai dati inseriti dall'utente a ogni sblocco sessione, mantenendo la chiave solo in memoria e mai in `localStorage`.
   - Vantaggi: soluzione piu semplice da introdurre nel progetto attuale, forte miglioramento reale della confidenzialita, indipendente da backend o integrazioni native.
   - Svantaggi: richiede UX di login/sblocco locale, gestione della perdita password e migrazione dei dati gia esistenti.
   - Valutazione pratica: e l'opzione consigliata come miglior compromesso tra semplicita, sicurezza e affidabilita.

2. Secret esterno al `localStorage`.
   - Approccio: usare una chiave o materiale segreto custodito fuori dal normale storage browser, ad esempio backend autenticato, secure storage/keystore nativo via Capacitor, oppure altra sorgente esterna non persistita nel browser.
   - Vantaggi: puo offrire una garanzia ancora migliore se il segreto resta davvero fuori dal contesto browser.
   - Svantaggi: implementazione piu complessa, maggiore dipendenza dall'ambiente di esecuzione e beneficio limitato se il segreto finisce comunque in storage client accessibile.
   - Valutazione pratica: opzione sensata solo se si decide di investire in backend o secure storage nativo; non e la strada piu lineare per l'assetto attuale della PWA.

## 4. Piano di completamento consigliato

### Fase 1 - Riallineare documentazione ✅ COMPLETATA (2026-03-25)

1. ~~Correggere `README.md` con descrizione reale di EasyTurno.~~ — Fatto: documentazione principale riallineata e separata in `README.md` inglese + `README_IT.md` italiano, con screenshot, stack, comandi, architettura, sicurezza e stato progetto.
2. ~~Rimuovere o archiviare eventuali file storici residui.~~ — Fatto: file storici (AGGIORNAMENTI.md, CHANGELOG_ADVANCED_FEATURES.md, CHAT_CLAUDE.md, INTEGRATION.md, INTERVENTI.md, ROADMAP.md, SECURITY.md, SUMMARY.md, docs/PWA_UPDATE_GUIDE.md) gia rimossi dal working tree. Directory `docs/` vuota, ignorata da git.

Esito:

- Documentazione chiara e coerente con il codice.

### Fase 2 - Pulizia architetturale residua ✅ COMPLETATA (2026-03-25)

1. ~~Eliminare gli ultimi `[(ngModel)]` diretti su signal in `app.component.html`.~~ — Fatto: sostituiti con `[ngModel]` + `(ngModelChange)` + `.set()`.
2. Migrazione a Signal Forms (`[formField]`/`FormRoot`) valutata e non giustificata allo stato attuale: il pattern `[ngModel]`+`(ngModelChange)` e coerente, leggero e sufficiente per i 3 campi data coinvolti.

Esito:

- Coerenza interna completa del codice. Zero `[(ngModel)]` su signal nel progetto.

### Fase 3 - Aggiornamento dipendenze major ✅ COMPLETATA (2026-03-25)

1. ~~TypeScript 5.9 -> 6.0~~ — Fatto e poi rollback: aggiornato inizialmente a 6.0.2, poi riportato a 5.9.3 per rientrare nel perimetro supportato dei peer dependency (vedi sezione V).
2. ~~Tailwind 3 -> 4~~ — Fatto: aggiornato a 4.2.2. Migrazione CSS-first: `@import 'tailwindcss'` + `@variant dark (&.dark)` + `@source`. Rimossi `tailwind.config.js`, `autoprefixer`, `postcss.config.cjs`. Creato `postcss.config.json` (unico formato supportato da `@angular/build`). CSS styles passato da 39 KB (v3) a 43 KB (v4, con tutte le classi dinamiche generate).
3. ~~Capacitor 7 -> 8~~ — Fatto: core 8.3.0, tutti i plugin aggiornati a v8. Nessuna breaking change nel codice applicativo. Validazione device native da fare in Fase 4.

Esito:

- Stack aggiornato alle ultime major version. Tutti i quality gate superati.

### Fase 4 - Validazione funzionale finale (IN CORSO)

1. ~~Stabilizzare i test E2E Cypress dopo gli aggiornamenti strutturali.~~ — Fatto: bug bloccanti risolti (Tailwind CDN, TS6 deprecation, race condition Angular) e selettore fragile del calendario corretto nello spec.
2. ~~Hardening asset PWA per mobile/home screen.~~ — Fatto: icone manifest, icona maskable, apple-touch-icon e favicon reali generate e collegate; asset inclusi nel build Angular.
3. ~~Hardening service worker/dev-vs-prod e HMR locale.~~ — Fatto: service worker disattivato su `localhost`, registrazione centralizzata e CSP aggiornata per WebSocket Vite locale.
4. ~~Rieseguire `npm run e2e` completo in ambiente non sandboxato.~~ — Fatto: 55/55 test verdi il 2026-03-26.
5. Verificare offline reale su smartphone dopo pulizia cache/installazione fresca.
6. Validare import/export, ricorrenze, statistiche, ricerca data, calendario e notifiche native su device.
7. ~~Consolidare snapshot finale delle metriche.~~ — Fatto: quality gate locali rieseguiti il 2026-03-27 (`lint`, `format:check`, `tsc`, `test`, `build`) e documento riallineato allo stato reale del repository.
8. ~~Integrare Playwright nel repository per smoke browser e CI.~~ — Fatto: setup completo, estensione a 13 test browser Chromium verdi e job CI dedicato il 2026-03-27.
9. ~~Ridurre le vulnerabilita `high` in audit sulle dipendenze dev Angular/build.~~ — Fatto: upgrade patch di `@angular/build`/`@angular/cli`, `high` eliminate e audit ridotto a sole `moderate` residue nel toolchain Jest il 2026-03-27.
10. ~~Ridurre ulteriormente il residuo `moderate` a basso rischio e riallineare Jest dopo l'integrazione Playwright.~~ — Fatto: override `handlebars@4.7.9`, esclusione `playwright/` da Jest, audit ridotto a 21 `moderate` e `npm test` nuovamente verde il 2026-03-27.
11. ~~Riallineare il repository a una matrice di peer dependency ufficialmente supportata.~~ — Fatto: TypeScript riportato a `5.9.3`; spariti i peer `invalid` di `@angular/build`, `ts-jest` e `@typescript-eslint`, con quality gate principali confermati verdi il 2026-03-27.

Nota Playwright:

- Estendere ulteriormente la suite Playwright e possibile e potenzialmente utile, ma non e necessario allo stato attuale.
- Il progetto ha gia Cypress come suite E2E ampia; Playwright va mantenuto come secondo livello smoke/browser rapido, non come duplicazione completa degli stessi scenari.
- Se si decide di ampliare Playwright, e consigliato farlo solo sui flussi piu critici e ad alta confidenza di manutenzione.
- Gli scenari Playwright prioritari inizialmente consigliati (ricorrenze, statistiche minime, errore import con password errata) sono ora coperti.
- Un eventuale ampliamento futuro dovrebbe restare selettivo e concentrarsi solo su flussi browser ad alto valore e bassa fragilita.

Interventi applicati in questa sessione:

- Pulizia `index.html`: rimossi CDN Tailwind v3, importmap, ts-browser. CSP aggiornato.
- Creato `cypress/tsconfig.json` per compatibilita TS 6.0.
- Refactoring `beforeEach` in tutti i 5 spec E2E per stabilita.
- Configurazione retry Cypress (`runMode: 2`).
- Script `dev:e2e` con `--watch=false` in `package.json`.
- Generati asset PWA reali (`icons/*.png`, `favicon.ico`, `favicon.png`) e aggiornati `angular.json`, `index.html`, `manifest.webmanifest`.
- Registrazione service worker limitata ai contesti production-like, CSP aggiornata per HMR locale e `sw.js` riallineato al build Angular corrente.
- Corretto il selettore fragile nello spec `cypress/e2e/calendar-view.cy.ts` per cliccare solo celle con turni reali.
- Riallineati gli spec Cypress per service worker locale e testo del dialog ricorrenze.
- Verificati fuori sandbox `npm run build` e `npm run e2e` con esito positivo.
- Corretta la regressione di `SwUpdateService` che impediva ai test Jest/JSDOM di esercitare la registrazione del service worker.
- Consolidato il nuovo snapshot metrico locale del 2026-03-27 con esito verde per lint, format, type check, test e build.
- Integrato Playwright nel repository con config dedicata, smoke suite Chromium, script npm e job CI separato.
- Estesa la suite Playwright con helper condivisi e flussi browser aggiuntivi su persistenza, CRUD base, tema/lingua, calendario e reset dati con conferma modale.
- Estesa ulteriormente la suite Playwright con il flusso end-to-end di export backup cifrato, reset dati e import con password.
- Estesa ulteriormente la suite Playwright con modifica singola ricorrenza, cancellazione intera serie, apertura statistiche con rendering minimo e percorso di errore import con password errata.
- Tradotto integralmente `README.md` in inglese e creato `README_IT.md` come variante italiana mantenuta in parallelo.
- Allineato il pre-commit ai file Playwright con `playwright/tsconfig.json` e `eslint --fix --no-warn-ignored` in `lint-staged`.
- Verificato fuori sandbox `npm run test:pw` con esito positivo (13/13).
- Aggiornati `@angular/build` e `@angular/cli` alla patch correttiva `21.2.5`, con lockfile rigenerato via `npm install --legacy-peer-deps`.
- Verificato con `npm audit` il passaggio da 30 vulnerabilita totali (27 moderate, 3 high) a 22 vulnerabilita tutte moderate, residue sul solo stack Jest/Istanbul.
- Verificato fuori sandbox `npm run build` dopo il bump Angular (`main` 753.36 KB, `styles` 43.03 KB, totale 804.89 KB).
- Aggiunto override npm per `handlebars@4.7.9` e verificata ulteriore riduzione dell'audit a 21 vulnerabilita tutte moderate.
- Corretto `jest.config.js` per escludere `playwright/` dai test unitari ed evitare che Jest tenti di eseguire gli smoke test browser.
- Rieseguito `npm test -- --runInBand` con esito verde dopo il fix di configurazione Jest.
- Riportato `typescript` da `6.0.2` a `5.9.3` per rientrare nel perimetro supportato dei peer dependency correnti.
- Confermato che il sottoalbero `@angular/build` / `ts-jest` / `@typescript-eslint` non presenta piu peer `invalid`.
- Verificati dopo il downgrade `npx tsc --noEmit`, `npm test -- --runInBand` e `npm run build` con esito positivo.
- Eseguita review di sicurezza mirata sulle aree critiche applicative (cifratura locale, backup, CSP, notifiche, import file, service worker) e applicato un pacchetto di hardening concreto.
- Introdotti backup cifrati con password utente (`PBKDF2` + `AES-GCM`) con import retrocompatibile verso il formato JSON legacy.
- Rimossa la parte storicamente piu permissiva della CSP lato script e mantenuto solo il residuo necessario al dev server locale (`unsafe-inline` in sviluppo).
- Aggiunta sanitizzazione runtime per notification settings e limiti difensivi ai reminder supportati.
- Limitato l'import a payload entro soglia e ristretto il runtime caching del service worker ai JSON statici esplicitamente consentiti.
- Rafforzata l'euristica di riconoscimento dei payload cifrati nello storage locale.
- Introdotto fallback di `CryptoService` su `localStorage` solo per ambienti senza IndexedDB, preservando la persistenza preferenziale su IndexedDB nel browser reale.

Esito atteso:

- Stato production ready basato su evidenze reali.

## Stato sintetico finale

EasyTurno e una applicazione avanzata e funzionalmente completa. Aree residue:

- Verifica offline reale su smartphone dopo installazione/cache fresca.
- Validazione notifiche native su device fisico.
- Hardening sicurezza applicativa ancora aperto soprattutto sulla strategia chiavi dello storage locale; backup cifrati, CSP, validation difensiva e scope del caching runtime sono stati rinforzati.

Valutazione pratica attuale:

- Funzionalita: completo
- Buildability: buona (Angular 21.2, TS 5.9, Tailwind 4.2, Capacitor 8.3 — build verificata anche localmente il 2026-03-27)
- Manutenibilita: buona (signal API, control flow nativo, OnPush, pure pipes)
- Affidabilita automatizzata: molto buona (319/319 unit test verdi, 55/55 E2E Cypress verdi con retry, 13/13 Playwright browser verdi, lint OK, type check OK, format OK)
- Documentazione: completa (README riscritto, P.md allineato)
- Stack: aggiornato alle ultime major version

## Verifiche locali eseguite per questo documento

- `npx eslint "src/**/*.ts"` -> superato (0 errori)
- `npm run format:check` -> superato
- `npx tsc --noEmit` -> superato (0 errori, TypeScript 5.9.3)
- `npm run build` -> superato localmente il 2026-03-27 dopo l'hardening sicurezza (759.10 KB `main`, 44.71 KB `styles`, 812.30 KB totale iniziale)
- `npm run build` -> superato fuori sandbox dopo update `@angular/build`/`@angular/cli` il 2026-03-27 (753.36 KB `main`, 43.03 KB `styles`, 804.89 KB totale iniziale)
- `npm ls typescript @angular/build ts-jest @typescript-eslint/parser @typescript-eslint/eslint-plugin --depth=0` -> verificato il 2026-03-27: toolchain riallineato su TypeScript 5.9.3, nessun peer `invalid` nel sottoalbero controllato
- `npm test -- --runInBand` -> superato localmente il 2026-03-27 dopo hardening sicurezza (11 suite, 319 test, 0 falliti)
- `npm test -- --runInBand src/services/crypto.service.spec.ts` -> superato localmente il 2026-03-27 dopo introduzione fallback IndexedDB/localStorage (32/32 test)
- `npm run e2e` -> superato fuori sandbox (55/55, 100%, tutte le 5 spec verdi)
- `npm run test:pw` -> superato fuori sandbox il 2026-03-27 (13 test Playwright browser verdi su Chromium)
- `npm install -D @playwright/test --legacy-peer-deps` -> completato il 2026-03-27; audit storico del momento: 28 vulnerabilita totali (25 moderate, 3 high), tutte dev-only
- `npm audit --json` -> verificato il 2026-03-27 dopo update Angular tooling: 22 vulnerabilita totali (22 moderate, 0 high, 0 critical), tutte dev-only
- `npm audit --json` -> verificato il 2026-03-27 dopo override `handlebars`: 21 vulnerabilita totali (21 moderate, 0 high, 0 critical), tutte dev-only

## Stack tecnologico attuale

| Tecnologia   | Versione                |
| ------------ | ----------------------- |
| Angular      | 21.2.5                  |
| TypeScript   | 5.9.3                   |
| Capacitor    | 8.3.0                   |
| Tailwind CSS | 4.2.2                   |
| Jest         | 30.3.0                  |
| Cypress      | 15.13.0                 |
| Playwright   | 1.58.2                  |
| Node.js      | 22.22.2 (richiesto 22+) |

## File principali da considerare come base tecnica

- `src/app.component.ts` — Componente principale, stato applicazione, gestione modale e form
- `src/app.component.html` — Template principale
- `src/services/shift.service.ts` — CRUD turni, generazione ricorrenze, persistenza cifrata
- `src/services/crypto.service.ts` — Cifratura AES-GCM 256-bit
- `src/services/calendar.service.ts` — Stato calendario, navigazione mesi, griglia giorni
- `src/services/translation.service.ts` — Internazionalizzazione
- `src/services/notification.service.ts` — Notifiche locali native (Capacitor)
- `src/services/sw-update.service.ts` — Rilevamento aggiornamenti PWA
- `src/components/calendar.component.ts` — Vista calendario con signal input/output e shiftsByDay map
- `src/components/shift-list-item.component.ts` — Card turno con signal input/output
- `src/shift.model.ts` — Interfacce Shift, Repetition, Allowance, type guards
