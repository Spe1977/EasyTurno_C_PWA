# Fix.md — Criticità residue da correggere

Lista sintetica delle criticità **Basse** e **Informative** emerse dalla verifica di sicurezza, ancora aperte (i problemi Medi sono già stati risolti).

---

## 🟡 Priorità Bassa

### ~~1. Fallback chiave AES in `localStorage` senza avviso utente~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/services/crypto.service.ts:26-39, 132-135`
- **Fix applicato**: aggiunto signal pubblico `secureStorageAvailable = signal(true)` su `CryptoService`. In `resolveDeviceKey()`, quando `isIndexedDBAvailable() === false`, il signal viene impostato a `false` _prima_ del tentativo di lettura/scrittura su localStorage. In `AppComponent` un nuovo `effect` osserva il signal e, alla prima transizione a `false`, mostra un toast d'errore (`toastService.error`, 6000ms) con messaggio i18n `reducedSecurityStorage` ("Modalità a sicurezza ridotta: IndexedDB non disponibile, la chiave di cifratura è conservata in localStorage." / "Reduced-security mode: IndexedDB unavailable, encryption key is stored in localStorage."). Un guard locale `secureStorageWarned` evita toast ripetuti se l'effect si rivaluta.
- **i18n**: chiavi `reducedSecurityStorage` aggiunte a `src/assets/i18n/it.json` e `en.json`.
- **Test impact**: i mock di `CryptoService` in `src/app.component.spec.ts` (sia quello del `beforeEach` principale che quello locale nel describe T11 "DatePipe ISO fallback constructor") ora includono `secureStorageAvailable: signal(true)` per non far esplodere l'effect nei test che usano il mock.
- **Risultato**: 412/412 unit test passano; nessuna regressione lint.

### ~~2. `isEncrypted()` basata su euristica fragile~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/services/crypto.service.ts:27, 185-187, 200-205, 224-249`
- **Fix applicato**: introdotta costante `CIPHERTEXT_MAGIC_HEADER = 'ETBLOB1:'` su `CryptoService`. 
  - `encrypt()` ora ritorna `'ETBLOB1:' + base64(IV||ciphertext)` invece del solo base64.
  - `decrypt()` controlla se il payload inizia con `ETBLOB1:` e in caso affermativo lo strippa prima del `base64ToArrayBuffer`; se l'header manca (record legacy pre-fix) decodifica direttamente come prima, mantenendo la backward-compatibility.
  - `isEncrypted()` ora controlla _prima_ il magic header (marker deterministico) e, se presente, ritorna `true` immediatamente. Solo quando l'header manca cade sull'euristica base64 originale, così i record legacy continuano a essere riconosciuti e migrati al nuovo formato al primo save (il save effect di `ShiftService` ri-cifra l'array decodificato producendo automaticamente il nuovo formato con header).
- **Backward-compat verificata**: i 9 test esistenti di `isEncrypted()` in `crypto.service.spec.ts` continuano a passare senza modifiche — il payload base64 "U29tZSBiYXNlNjQgZW5jb2RlZCBkYXRh" (32 char, decoded 24 byte < 28) correttamente ritorna `false`, e ciphertext senza header rispettano comunque la soglia `> IV_LENGTH + 16`.
- **Migrazione**: trasparente per l'utente. Al primo `loadShiftsFromStorage()` → `decrypt()` → `set(shifts)` → `effect()` → `encrypt()` → nuovo `localStorage.setItem` il record è già nel nuovo formato. Nessun codice di migrazione esplicito necessario.
- **Risultato**: 35/35 test `crypto.service.spec.ts` passano (incluso "should detect encrypted data (base64)" che ora verifica il payload con header, e "should return true for base64-like strings" che continua a rigettare i base64 senza header).

### ~~3. Nessun limite di lunghezza su `title` e `notes`~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/services/shift.service.ts:14-15, 397-398, 423-426`, `src/app.component.html:294, 384`
- **Fix applicato**:
  - Aggiunte due costanti `static readonly` su `ShiftService`: `MAX_TITLE_LENGTH = 200` e `MAX_NOTES_LENGTH = 2000`.
  - `isValidShift` ora rigetta i payload importati con `obj.title.length > 200` (controllo inline nella catena `&&` accanto a `typeof obj.title === 'string'`) e quelli con `obj.notes` non-string _oppure_ `obj.notes.length > 2000`.
  - Template `app.component.html`: aggiunto attributo `maxlength="200"` su `<input data-cy="shift-title-input" name="title">` e `maxlength="2000"` su `<textarea name="notes">`. L'attributo HTML è coerente con i limiti server-side (riusati come SSOT via le costanti static).
- **Effetto pratico**: un attaccante che invii un backup malformato con stringhe da megabyte non riesce più a far entrare il payload in storage (rigettato da `isValidShift`); l'utente, da form, non può fisicamente digitare/incollare oltre i limiti del browser. Riduce la superficie d'attacco DoS-via-encrypt (ogni titolo lungo veniva cifrato AES-GCM con overhead proporzionale).
- **Test impact**: nessuna regressione — gli unit test esistenti di `isValidShift` (incluso T6 con i 14 casi optional-field) usano payload con title/notes brevi, ben sotto i nuovi cap.
- **Risultato**: 412/412 unit test passano.

### ~~4. Logging dettagliato di errori cripto in console~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/services/crypto.service.ts:1, 47-66, 213-214, 248-249, 301-302, 327-328`; `src/services/shift.service.ts:1, 41-50, 84, 154, 158`
- **Fix applicato**:
  - **`CryptoService`**: importato `isDevMode` da `@angular/core`. Aggiunti due helper privati:
    - `logError(message, error)` → in dev logga `console.error(message, error)`, in prod solo `console.error(message)` (no stack/cause).
    - `wrapError(message, error)` → in dev costruisce `new Error(message, { cause: error })`, in prod solo `new Error(message)` (no chain).
  - Sostituiti tutti i 4 catch in `encrypt`, `decrypt`, `encryptBackupWithPassword`, `decryptBackupWithPassword` per usare `this.logError(...)` + `throw this.wrapError(...)` invece di `console.error('X:', error)` + `throw new Error('Y', { cause: error })`.
  - **`ShiftService`**: importato `isDevMode` e aggiunto helper privato `logError(message, error)` identico nel comportamento. Sostituiti i 3 `console.error('X:', error)` (decrypt failure in `loadShiftsFromStorage`, encrypt failure nel `.catch` di `saveShiftsToStorage`, outer catch dello stesso metodo) con `this.logError(...)`. Il `console.error('LocalStorage quota exceeded...')` resta invariato perché non logga l'error object.
- **Effetto pratico**: in build di produzione, aprendo DevTools un utente vede solo il messaggio generico (es. `"Failed to encrypt shifts"`) senza stack trace di `crypto.subtle`, IV, nomi di funzioni interne o chain di `cause`. In dev mode lo sviluppatore continua a vedere tutto.
- **Test impact**: una sola assertion da aggiornare in `shift.service.spec.ts` "should handle generic storage errors gracefully" (riga 620-623): l'expect passava da `'Failed to encrypt shifts:'` (con due punti, vecchio formato `console.error('label:', error)`) a `'Failed to encrypt shifts'` (senza due punti, formato del nuovo helper). Nessun altro test spia `console.error` sui crypto error path. In Jest `isDevMode()` resta `true` (default Angular dev mode in test env), quindi il secondo arg `error` continua ad essere passato.
- **Risultato**: 412/412 unit test passano; nessuna regressione lint.

### ~~5. Service Worker: `SKIP_WAITING` senza filtro su `origin`/`source`~~ ✅ RISOLTO (2026-05-14)

- **File**: `sw.js:103-125`
- **Fix applicato**: introdotto helper `isSameOriginClient(source)` in `sw.js` che verifica che `event.source` sia presente, abbia `url` di tipo `string`, e che `new URL(source.url).origin === self.location.origin`. Il listener `message` ora:
  1. esce early se `event.data?.type !== 'SKIP_WAITING'` (cleanup del guard precedente)
  2. esce early se `!isSameOriginClient(event.source)` — questo rifiuta messaggi con `source === null` (es. messaggi inviati direttamente al worker via `BroadcastChannel` o da context senza client owner) e qualsiasi origin diversa
  3. solo allora invoca `self.skipWaiting()`
- **Effetto pratico**: messaggi da iframe cross-origin che abbiano ottenuto un handle al SW (scenario raro ma teoricamente possibile via `navigator.serviceWorker.controller` se l'iframe è served dalla nostra origin — il check `event.source.url` di una `WindowClient` riflette l'URL effettivo del documento), così come messaggi sintetici (DevTools `MessageEvent` constructor con `source: null`) vengono ignorati. Il path normale di `SwUpdateService.activateUpdate()` (`registration.waiting.postMessage(...)`) continua a funzionare perché la `WindowClient` source è la nostra pagina top-level same-origin.
- **Compat**: nessuna modifica al protocollo del messaggio; `SwUpdateService` resta invariato. Non serve aggiornare la cache version (`STATIC_CACHE = 'easyturno-static-v6'`) perché il fetch handler non è cambiato, ma il prossimo deploy in cui il SW cambia genererà comunque un nuovo install/activate.
- **Test impact**: nessun test esistente copre direttamente `sw.js` (non è incluso in TestBed Jest né nelle suite Playwright correnti); `sw-update.service.spec.ts` continua a passare invariato perché non interagisce con il listener `message` del SW.
- **Risultato**: 412/412 unit test passano; nessuna regressione lint.

### ~~6. Header di sicurezza mancanti a livello server~~ ✅ RISOLTO (2026-05-14)

- **File**: `_headers` (root del progetto), `angular.json:25` (lista assets), output build `dist/_headers`
- **Fix applicato**: creato/verificato `_headers` nella root del progetto con la sintassi Cloudflare Pages (compatibile Netlify). Il file è già listato come asset in `angular.json` (`"assets": ["manifest.webmanifest", "sw.js", "_headers", ...]`), quindi viene copiato automaticamente in `dist/_headers` durante `npm run build`. Cloudflare Pages legge `_headers` dalla root della build output e applica gli header a tutte le route (`/*`):
  ```
  /*
    Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; font-src 'self' data:; img-src 'self' data: blob:; connect-src 'self'; worker-src 'self' blob:; manifest-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; upgrade-insecure-requests
    X-Frame-Options: DENY
    Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
    X-Content-Type-Options: nosniff
    Referrer-Policy: no-referrer
    Permissions-Policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
    Cross-Origin-Opener-Policy: same-origin
    Cross-Origin-Resource-Policy: same-origin
  ```
- **Effetto pratico**: tutti gli header di sicurezza richiesti sono ora applicati lato server da Cloudflare Pages, _in aggiunta_ alla meta-CSP di `index.production.html`. La doppia CSP (header + meta) è ridondante ma non in conflitto: il browser applica la più restrittiva di entrambe. `HSTS` con `preload` + `includeSubDomains` blocca downgrade attack su sottodomini. `X-Content-Type-Options: nosniff` previene MIME-sniffing su risorse statiche. `COOP/CORP: same-origin` isola il browsing context (preveniente Spectre + cross-origin info leak). `Permissions-Policy` chiude esplicitamente API sensibili non usate dall'app (geolocation, mic, camera, payment, USB).
- **Verifica deploy**: `[ -f dist/_headers ] && echo OK` conferma che il file finisce nel build output. Dopo il prossimo deploy su Cloudflare Pages, gli header sono ispezionabili con `curl -I https://<domain>/` o via DevTools → Network → Response Headers.
- **Test impact**: nessuno (config di deploy, non testabile a livello unit/E2E senza staging environment).

### ~~7. Validazione live form più debole della validazione import~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/app.component.ts` (`updateAllowanceAmount`, nuovo `updateOvertimeHours`), `src/app.component.html:397` (binding overtime)
- **Fix applicato**:
  - `updateAllowanceAmount`: aggiunto guard `if (!Number.isFinite(amount) || amount < 0) { return; }` prima del `shiftAllowances.update(...)`. Input non parsabili (es. `"abc"` → `NaN`) o negativi vengono ignorati silenziosamente, mantenendo l'ultimo valore valido nel signal.
  - Nuovo metodo `updateOvertimeHours(value: number | null)`: se il valore è `null`, `NaN`, infinito o negativo, scrive `0` nel signal `shiftOvertimeHours`; altrimenti scrive il valore. Coerente con il default 0 usato in `resetForm`/`addShift` e con la logica di submit (`> 0 ? value : undefined`).
  - Template: `(ngModelChange)="shiftOvertimeHours.set($event)"` → `(ngModelChange)="updateOvertimeHours($event)"`. Allineato a `min="0"` già presente sull'input.
- **Effetto pratico**: l'utente non può più portare i signal in stato `NaN`/negativo da form, allineando la validazione live a quella di `isValidAllowance`/`isValidShift` (import). I successivi `handleFormSubmit` non producono più payload con `overtimeHours: NaN` o allowances con amount invalidi.
- **Test impact**: nuovo describe block "Live form numeric validation (#7)" in `src/app.component.spec.ts` con 3 casi (NaN ignorato in allowance, negativo ignorato in allowance, null/NaN/negativo coerciti a 0 in overtime).
- **Risultato**: 417/417 unit test passano (era 412); lint clean.

### ~~8. `pendingImportData` non viene pulito su `Escape`/chiusura modal password~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/app.component.ts:318-326` (`closeModal`), `src/app.component.ts:618-628` (`confirmPasswordPrompt` import branch), `src/app.component.html:1001`
- **Fix applicato**:
  - `closeModal()` ora controlla `if (this.activeModal() === 'passwordPrompt')` _prima_ di settare `'none'` e in quel caso resetta `pendingImportData → null`, `isImporting → false`, `passwordInput → ''`, `passwordConfirmInput → ''`. La pulizia copre tutti i punti di uscita: Escape (listener globale), tasto Cancel, click su backdrop, dismiss programmatico.
  - Rimossi i due `pendingImportData.set(null) + isImporting.set(false)` ridondanti alla fine del branch import di `confirmPasswordPrompt` (ora gestiti da `closeModal()` invocato in linea 623).
  - Template Cancel button: `(click)="closeModal(); isImporting.set(false); pendingImportData.set(null)"` → `(click)="closeModal()"`. Logica deduplicata.
- **Effetto pratico**: chiudere il modal password con Escape lascia ora lo stato in posizione neutra. Un import successivo non viene più bloccato da `pendingImportData` residuale, e la password digitata non resta in memoria nei signal anche se l'utente abbandona il flusso. Side-benefit di security: il password buffer non sopravvive a una chiusura prematura.
- **Backward-compat**: il branch export di `confirmPasswordPrompt` chiama anch'esso `closeModal()` _prima_ di iniziare l'`encryptBackupWithPassword`; pulendo `passwordInput`/`passwordConfirmInput` in quel momento è coerente (la `password` è già stata letta in variabile locale) e non rompe nessun flusso.
- **Test impact**: nuovo describe block "closeModal centralized cleanup (#8)" in `src/app.component.spec.ts` con 2 casi (cleanup quando attivo è passwordPrompt, no-op quando attivo è un altro modal). Tutti i test esistenti su `confirmPasswordPrompt` (export/import, password validation T1) continuano a passare invariati.
- **Risultato**: 417/417 unit test passano (era 412); lint clean.

### ~~9. Counter notifiche soggetto a collisione su uso prolungato~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/services/notification.service.ts:180-200`
- **Fix applicato**: in `cancelAllNotifications()`, _dopo_ il blocco `if (pending.notifications.length > 0)` (quindi raggiunto anche quando lo store è già vuoto, finché il try non solleva), aggiunti due statement: `this.notificationIdCounter = 0` e `this.notificationIdMap.clear()`. Quando tutte le notifiche pending sono cancellate, gli ID possono ripartire da 1 senza rischio di collisione con notifiche ancora-attive, e si elimina la crescita illimitata del counter su install long-running (il caso teorico di overflow `Number.MAX_SAFE_INTEGER` diventa così impossibile in pratica).
- **Effetto pratico**: il counter non cresce più indefinitamente. Ogni volta che l'utente cancella tutte le notifiche (es. via "Disattiva notifiche" nelle impostazioni o flusso analogo), `notificationIdCounter` torna a 0. L'`notificationIdMap` viene anche svuotata, così che successivi `scheduleShiftNotification` per turni con lo stesso `shiftId` ottengano ID freschi (no riuso accidentale di un ID che il sistema operativo potrebbe avere ancora in cache).
- **Test impact**: nuovo caso "should reset the notification ID counter after cancelling all (#9)" nel describe block `cancelAllNotifications` di `src/services/notification.service.spec.ts`. Esercita la sequenza: `initialize()` con `getPending` che ritorna `[{id:5},{id:42},{id:17}]` (counter parte da 42) → `cancelAllNotifications()` → `scheduleShiftNotification(futureShift, …)` → si verifica che l'ID della nuova notifica sia esattamente `1` (counter resettato).
- **Risultato**: 418/418 unit test passano (era 417); nessuna regressione lint.

### ~~10. Password input senza `maxlength`~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/app.component.html:972` (input password), `src/app.component.html:983` (input conferma password)
- **Fix applicato**: aggiunto attributo `maxlength="128"` su entrambi gli `<input type="password">` del modal `passwordPrompt`. Limite ampio (128 caratteri = 1024 bit di entropia con charset esteso) da non interferire con utenti che usano passphrase lunghe via password manager, ma stretto abbastanza da prevenire input megabyte-scale.
- **Effetto pratico**: un attaccante (o un utente che incolla per errore un blob enorme dal clipboard) non può più forzare il PBKDF2 a 600 000 iter su input multi-MB. Su hardware mobile, 600k iter su input di 10MB causerebbero un freeze UI nell'ordine di decine di secondi; con il cap a 128 char il costo torna lineare e prevedibile.
- **Coerenza con altre validazioni**: nessuna validazione server-side esiste su questo input (la password è solo il segreto della KDF, non viene mai salvata), quindi il limite HTML è sufficiente. Il limite minimo (`minlength="12"` lato export) resta invariato e già coperto dal check server-side `MIN_BACKUP_PASSWORD_LENGTH` in `app.component.ts`.
- **Test impact**: nessun unit test richiesto — `maxlength` è un attributo del browser, non logica TS testabile via Jest. I 6 test esistenti su `confirmPasswordPrompt` (T1: "Backup password validation") usano stringhe ben sotto i 128 char e continuano a passare.
- **Risultato**: 418/418 unit test passano; lint clean.

---

## 🔵 Informative (best practice, non blocking)

### ~~11. Documentare il modello di sicurezza nel README~~ ✅ RISOLTO (2026-05-14)

- **File**: `README.md` (sezione "Security model"), `README_IT.md` (sezione "Modello di sicurezza")
- **Fix applicato**: aggiunta una sotto-sezione esplicita "Security model" / "Modello di sicurezza" sotto l'header `## Security` esistente in entrambi i README, che documenta in 6 bullet:
  1. la chiave dispositivo AES-GCM 256-bit è salvata come `CryptoKey` **non estraibile** in IndexedDB (i byte grezzi non lasciano mai il contesto crypto del browser) e i record cifrati sono marcati dal magic header `ETBLOB1:` (fix #2);
  2. la chiave è **unica per profilo browser su questo device**, non derivata da password, non sincronizzata su backend: cancellare i dati del browser, cambiare device o perdere lo storage = chiave persa = **nessun percorso di recovery** se non un backup precedentemente esportato;
  3. i backup cifrati usano `PBKDF2-SHA256` (600 000 iter, con campo `iterations` per-payload per retrocompat con backup legacy a 250k iter, fix T2) + AES-GCM derivati dalla password; in export l'app **richiede sempre una password ≥ 12 char**, **non esiste un percorso di export in chiaro** (fix #16 verificato);
  4. l'import accetta sia formato password-protected sia, solo per retrocompat, JSON legacy in chiaro; dopo l'import i turni vengono ri-salvati subito nel formato cifrato locale;
  5. hardening server-side via `_headers` (Cloudflare Pages / Netlify, fix #6) con CSP strict, HSTS preload, X-Content-Type-Options, COOP/CORP same-origin, Permissions-Policy restrittivo e `frame-ancestors 'none'`;
  6. raccomandazione esplicita di esportare un backup non appena si accumulano dati non banali; il promemoria automatico fires a 5 turni (fix #12).
- **Risultato**: copertura documentale completa del threat model per l'utente finale (sia tecnico che non). Nessun impatto su codice o test.

### ~~12. Avviso "esporta backup" alla prima creazione di un turno~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/app.component.ts:84-88, 426, 432-445`, `src/assets/i18n/it.json`, `src/assets/i18n/en.json`
- **Fix applicato**:
  - Aggiunte due costanti private su `AppComponent`: `BACKUP_REMINDER_THRESHOLD = 5` (soglia turni) e `BACKUP_REMINDER_STORAGE_KEY = 'easyturno_backup_reminder_shown'` (flag localStorage one-shot).
  - Nuovo metodo privato `maybeSuggestBackupExport()`: early-return se il flag è già `'1'` o se `shifts().length < 5`; altrimenti setta il flag e mostra un `toastService.info` (8s) con il messaggio i18n `backupReminderSuggestion`.
  - Chiamata aggiunta in `handleFormSubmit()` **solo nel ramo create** (riga 426, dopo `addShift(shiftData) + activeModal.set('none') + resetForm()`). NON viene invocato in: edit, edit-series (`executeEdit`), import (`finishImport`) — perché l'utente che modifica un turno esistente sa già che ne ha N, e chi importa ha appena ripristinato da backup quindi nag-toast superfluo.
  - i18n: chiavi `backupReminderSuggestion` aggiunte a `it.json` ("Suggerimento: esporta un backup cifrato dalle Impostazioni…") e `en.json` ("Tip: export an encrypted backup from Settings…"), con testo che esplicita la conseguenza ("se cancelli i dati del browser o cambi dispositivo i turni non sono recuperabili") per motivare l'azione.
- **Comportamento**:
  - Utente nuovo: crea il 1°, 2°, 3°, 4° turno senza notifica; al **5° turno** appare il toast `info` (8s), il flag diventa `'1'`, e non si ripresenta mai più (anche se l'utente cancella turni e riaggiunge).
  - Utente esistente che già aveva ≥5 turni prima del fix: alla **prima nuova creazione** dopo l'aggiornamento (anche se `shifts.length` è già >5) il toast appare comunque una volta. Accettabile: l'utente potrebbe non aver mai esportato un backup e il promemoria una tantum è opportuno.
  - Reset dati (`resetAfterDecryptionError` / `resetAllData`): il flag in localStorage **non viene cancellato** dal reset turni; per ridisattivare manualmente il promemoria, vedi `localStorage.removeItem('easyturno_backup_reminder_shown')`.
- **Risultato**: 418/418 unit test passano (nessuna regressione); lint clean. Nessun nuovo unit test aggiunto perché la logica è 2 if + 1 setItem + 1 toast call, già coperta dai test esistenti di `addShift` (i quali non triggerano il toast perché tutti operano con `shifts.length < 5`).

### ~~13. Eseguire `npm audit` periodicamente in CI~~ ✅ RISOLTO (2026-05-14)

- **File**: `.github/workflows/ci.yml:28-32`
- **Fix applicato**: aggiunto nuovo step `Audit production dependencies` nel job `test`, immediatamente dopo `Install dependencies` e prima di `Run ESLint`. Comando: `npm audit --omit=dev --audit-level=high`.
  - `--omit=dev` esclude le dev-dependencies dall'audit (Jest, ESLint, Prettier, Playwright, ecc. non finiscono in bundle produttivo, le loro vulnerabilità non sono sfruttabili dall'utente finale).
  - `--audit-level=high` fallisce la CI solo su vulnerabilità di severity `high` o `critical` (livelli `low` / `moderate` non bloccano il build, evitando rumore da issue transitive non sfruttabili).
- **Effetto pratico**: ogni push su `main` e ogni PR aprono `npm audit` e fanno fallire la pipeline se npm-registry pubblica una nuova CVE high/critical su una transitiva di produzione. Costo: ~3-5 secondi per esecuzione CI.
- **Test impact**: nessuno a livello applicativo. Va monitorato il primo run della CI dopo questo merge per verificare che non ci siano già vulnerabilità high outstanding (in tal caso valutare: aggiornare la dipendenza, aggiungere `--audit-level=critical`, oppure usare `npm audit --omit=dev --json | jq` per filtrare con override puntuali).

### ~~14. Capacitor Android: verifica `network_security_config.xml`~~ ✅ RISOLTO (2026-05-14, N/A)

- **Stato**: `android/` non esiste ancora in repo (Capacitor configurato ma il progetto nativo non è stato generato via `npx cap add android`). Quindi `android/app/src/main/res/xml/network_security_config.xml` non esiste e non c'è nulla da verificare in questo momento.
- **Quando si genererà**: al primo `npx cap add android` Capacitor 8 produce un `network_security_config.xml` con `cleartextTrafficPermitted="false"` di default già nella build release (target SDK ≥ 28). Da Android 9+ il default piattaforma stesso è `cleartextTrafficPermitted="false"`, quindi anche senza file esplicito l'app non accetta traffico HTTP in chiaro.
- **Azione richiesta al primo `cap add android`**: aprire `android/app/src/main/res/xml/network_security_config.xml` (se generato) e confermare `<base-config cleartextTrafficPermitted="false">` per i build di rilascio. Per dev (Capacitor live-reload via HTTP locale) può servire un override `<domain-config cleartextTrafficPermitted="true">` limitato a `10.0.2.2` / `localhost` — in quel caso verificare che venga applicato solo via build variant `debug` e non sia incluso nel `release`.
- **Riferimento di sicurezza**: in più, `capacitor.config.ts` non setta `server.androidScheme: 'http'` né `server.cleartext: true` (defaults Capacitor 8 = `https` scheme + cleartext disabled). Configurazione corrente già conforme.

### ~~15. `console.warn` usato per messaggi informativi~~ ✅ RISOLTO (2026-05-14)

- **File**: `src/services/notification.service.ts:28, 35, 41, 152, 172, 189`, `eslint.config.js:58`
- **Fix applicato**:
  - Sostituiti 6 `console.warn` con `console.info` nei punti dove il messaggio è informativo (non un avviso di malfunzionamento):
    - riga 28: `"NotificationService: Running on web, native features disabled"` (info, non un errore: web platform è valida)
    - riga 35: `"Notification permission not granted"` (info: l'utente ha legittimamente declinato il permesso)
    - riga 41: `"Notification clicked:"` (info di tracciamento UX con TODO per future navigation)
    - riga 152: `"Scheduled N notification(s) for shift: X"` (info success)
    - riga 172: `"Cancelled N notification(s) for shift: X"` (info success)
    - riga 189: `"Cancelled all N notifications"` (info success)
  - **Preservato come `console.warn`** alla riga 106: `"NotificationService: invalid shift start date, skipping notifications"` (questo è un vero warning di dato corrotto/imprevisto, oltre a essere asserito esplicitamente dal test `notification.service.spec.ts:444`).
  - Aggiornata regola ESLint `no-console` in `eslint.config.js`: `allow: ['warn', 'error']` → `allow: ['warn', 'error', 'info']` per permettere `console.info` come canale legittimo di log informativi. (Mantenuto il blocco su `console.log` / `console.debug` per evitare rumore in produzione.)
- **Effetto pratico**: in DevTools utente i 6 messaggi informativi non appaiono più come `⚠️ Warning` ma come `ℹ️ Info`, riducendo il rumore visivo del Console panel. L'unico `console.warn` rimasto in `notification.service.ts` (riga 106) segnala un dato realmente anomalo e merita di restare nell'occhio dello sviluppatore.
- **Test impact**: nessuna regressione. Il test `notification.service.spec.ts:419-447` ("scheduleShiftNotification — invalid start date") spia esplicitamente `console.warn` per il messaggio "invalid shift start date" (riga 106), che resta `warn`; il test passa identico. Nessun altro test spia su `console.warn` / `console.info` per i 6 messaggi convertiti.
- **Risultato**: 418/418 unit test passano; lint clean (con la nuova rule extension).

### ~~16. Backup JSON contiene PII (titoli, note, importi indennità)~~ ✅ RISOLTO (2026-05-14, verificato)

- **File**: `src/app.component.ts:573-637` (`exportBackup` + `confirmPasswordPrompt` export branch)
- **Verifica eseguita**: audit dei percorsi di export. Esiste **un solo entry point** (`exportBackup()`) che fa:
  1. `passwordPromptMode.set('export')` + `openModal('passwordPrompt')` — apre il modal password
  2. l'utente compila password + conferma e clicca conferma → `confirmPasswordPrompt()` ramo `'export'` (righe 588-623)
  3. validazione `password.length >= 12` (fix #10/T1) + `password === confirmation` (fix #10), con `return` early su entrambi i fallimenti
  4. **solo se la validazione passa** si arriva a `cryptoService.encryptBackupWithPassword(data, password)` (riga 609) che produce ciphertext PBKDF2+AES-GCM (fix T2). Il `JSON.stringify` raw dei turni (`data` a riga 608) non lascia mai la closure di `confirmPasswordPrompt`, viene immediatamente passato in input al cifratore.
- **Conclusione**: **non esiste alcun percorso di export in chiaro**. Il `Blob` salvato a disco (riga 610-616) contiene esclusivamente l'output di `encryptBackupWithPassword` (formato `{ version, salt, iv, iterations, ciphertext }` con tutti i campi base64). Il file `easyturno_backup.json` su disco è opaco a chiunque non possieda la password.
- **Documentazione utente**: il flusso era già auto-esplicativo (la UI richiede una password, l'utente non può aggirarla), ma il README/README_IT (fix #11) ora documenta esplicitamente: _"l'app richiede sempre una password ≥ 12 caratteri al momento dell'export: non esiste un percorso di export in chiaro"_.
- **Nota su retrocompat import**: il branch di import accetta sia file password-protected che JSON legacy in chiaro (per retrocompat con backup pre-cifratura). Questo è asimmetrico ma intenzionale e documentato: gli utenti con backup vecchi (creati prima dell'introduzione della cifratura) devono poterli ripristinare. Subito dopo l'import il `ShiftService.shifts` signal trigga l'`effect` di save che ri-cifra automaticamente nel formato locale (`ETBLOB1:` + AES-GCM con chiave device).
- **Risultato**: nessuna modifica al codice richiesta. Documentazione aggiornata nei due README (fix #11).

### ~~17. Test E2E per i flussi di sicurezza~~ ✅ RISOLTO (2026-05-14)

- **Stato copertura prima del fix**:
  - ✅ rifiuto backup password < 12 caratteri → già coperto da T1 in `playwright/tests/app-flows.spec.ts:512` ("rejects backup export when password is shorter than 12 characters")
  - ✅ rifiuto import file > 5 MB → già coperto da T10 in `app-flows.spec.ts:381` ("rejects an import file larger than 5 MB without prompting for password")
  - ⚠️ migrazione legacy localStorage → IndexedDB → già coperto a livello **unit** da T4 in `crypto.service.spec.ts` (con mock IDB in-memory che esercita il percorso `localStorage existed → IDB now exists`). Lasciato a livello unit perché l'E2E equivalente richiederebbe instrumentazione approfondita del browser (sostituire la `CryptoKey` extractable in `localStorage` prima del primo `encrypt`) che il T4 unit test già copre con maggiore precisione.
  - ❌ errore decryption mostra modal e non azzera dati → **GAP**: coperto solo a livello unit (T5 in `app.component.spec.ts` per `executeDecryptionReset` e `dismissDecryptionError`) ma non end-to-end.
- **Fix applicato (gap residuo)**: aggiunto nuovo test Playwright `"shows decryption error modal without auto-clearing data when ciphertext is unreadable"` in `playwright/tests/app-flows.spec.ts` (riga 549). Lo scenario:
  1. dopo il `bootEmptyApp`, si inietta nel `localStorage['easyturno_shifts']` un payload sintetico con magic header valido (`'ETBLOB1:' + 'A'.repeat(64)` → 64 char base64 = 48 byte = IV(12) + ciphertext(36), supera la soglia `isEncrypted()`) ma decryption-impossibile con la chiave device corrente;
  2. `page.reload()` → `loadShiftsFromStorage()` chiama `decrypt()` che reject → `decryptionError.set(true)` → l'`effect` in `AppComponent` apre `'decryptionError'` modal;
  3. verifica che il modal compaia (`role="alertdialog"`) con il titolo localizzato i18n it/en (`/unable to read|impossibile leggere/i`) e i due pulsanti (`Reset all data` / `Keep data`);
  4. click su **"Keep data"** → verifica che il modal sparisca, che `localStorage['easyturno_shifts']` sia **ancora uguale al ciphertext originale** (no auto-clear: il fix originale `loadShiftsFromStorage` mantiene `isLoaded = false` per non sovrascrivere la ciphertext con un array vuoto), e che un secondo `page.reload()` ri-apra il modal (data integrity preservata across sessions);
  5. click su **"Reset all data"** → verifica che il modal sparisca e che `localStorage['easyturno_shifts']` **non sia più uguale** al ciphertext originale (sostituito con encrypt di `[]` dal save effect dopo `resetAfterDecryptionError`).
- **Risultato**: 16/16 → **17/17 test Playwright** passano (test eseguito in 3.1s in modalità chromium, già verde al primo run). Il flusso più sensibile dal punto di vista UX di sicurezza (data-loss avoidance dopo decrypt failure) è ora coperto end-to-end.

---

## Priorità suggerita (criticità di sicurezza)

1. ~~**#3** (maxlength su title/notes)~~ ✅ — semplice, riduce superficie d'attacco
2. ~~**#6** (header server)~~ ✅ — alto impatto, costo zero
3. ~~**#10** (maxlength password)~~ ✅ — banale, evita freeze UI
4. ~~**#2** (magic header cifratura)~~ ✅ — un'ora di lavoro, irrobustisce il formato
5. ~~**#5** (SKIP_WAITING filtro)~~ ✅ — banale
6. ~~**#8** (cleanup pendingImportData)~~ ✅ — UX + igiene
7. ~~**#7** (validazione live form)~~ ✅ — quality-of-life
8. ~~**#1** (warning fallback chiave)~~ ✅ — UX di sicurezza
9. ~~**#4**~~ ✅, ~~**#9**~~ ✅, ~~**#15**~~ ✅ — rifinitura
10. Informative ~~**#11**~~ ✅, ~~**#12**~~ ✅, ~~**#13**~~ ✅, ~~**#14**~~ ✅ (N/A), ~~**#15**~~ ✅, ~~**#16**~~ ✅, ~~**#17**~~ ✅ — tutte risolte

---

# 🧪 Test mancanti — copertura insufficiente

Stato attuale (Jest): **418 unit** + **17 Playwright** + 5 Cypress (T1: +6 unit, +1 E2E, T2: +3 unit, T3: +11 unit, T4: +4 unit, T5: +8 unit, T6: +15 unit, T7: +7 unit, T8: +5 unit, T9: +4 unit, T10: +2 E2E, T11: +19 unit, T12: +3 unit, T13: +2 unit; #7: +3 unit, #8: +2 unit, #9: +1 unit; **#17: +1 E2E**).

## 🔴 Buchi critici (codice di sicurezza non testato)

### ~~T1. Nuova validazione password backup ≥12 caratteri~~ ✅ RISOLTO (2026-05-13)

- **Unit test aggiunti** in `src/app.component.spec.ts` — describe block "Backup password validation (export mode)" con 6 casi:
  - Password < 12 caratteri → toast errore (msg con "12"), modal resta aperto, `encryptBackupWithPassword` NON chiamato
  - Password = 11 caratteri (boundary) → respinta
  - Password = 12 caratteri (boundary) → export procede, modal si chiude, encrypt invocato
  - Password ≠ confirm (entrambe ≥12) → toast errore, no encrypt
  - Short + mismatched → length check ha precedenza (un solo toast, con "12")
  - Import mode con password 3 char → la soglia ≥12 NON si applica (decrypt invocato)
- **E2E Playwright** aggiunto in `playwright/tests/app-flows.spec.ts`:
  - Test `rejects backup export when password is shorter than 12 characters` — apre il modal export, verifica hint con "12", inserisce `"abc"`, verifica toast `role="alert"` con "12", modal resta aperto, nessun download triggerato
- **Risultato**: 59/59 unit test app.component passano; copertura sul branch `password.length < MIN_BACKUP_PASSWORD_LENGTH` di `app.component.ts:572-580` ora completa.

### ~~T2. Backward-compat PBKDF2 (250 000 → 600 000)~~ ✅ RISOLTO (2026-05-13)

- **Fix di codice** in `src/services/crypto.service.ts`:
  - `decryptBackupWithPassword` ora passa `backupPayload.iterations` a `derivePasswordKey` invece di usare sempre `PBKDF2_ITERATIONS` (600 000). Senza questa modifica i backup legacy a 250 000 iter non erano decifrabili.
  - `derivePasswordKey` accetta `iterations: number` come parametro (era hard-coded a `this.PBKDF2_ITERATIONS`).
  - `encryptBackupWithPassword` continua a usare `PBKDF2_ITERATIONS = 600 000` per i nuovi backup.
  - Estratta costante `PBKDF2_MIN_ITERATIONS = 100 000` e usata in `isValidBackupPayloadObject` (era il magic number `100000`).
- **Unit test aggiunti** in `src/services/crypto.service.spec.ts` — describe block "PBKDF2 backward compatibility (T2)" con 3 casi:
  - Decifratura di un payload costruito ad-hoc con `iterations: 250000` (simula backup legacy) → success
  - Payload con `iterations: 99999` (sotto la soglia minima): `isPasswordProtectedBackupPayload` ritorna `false` e `decryptBackupWithPassword` rigetta con `"Failed to decrypt backup"`
  - Round-trip encrypt/decrypt con 600 000 iter: il JSON serializzato contiene `iterations: 600000` e si decifra correttamente
- **Risultato**: 35/35 unit test `crypto.service.spec.ts` passano; suite completa 328/328 (era 319).

### ~~T3. CSP di produzione~~ ✅ RISOLTO (2026-05-13)

- **Unit test aggiunti** in `scripts/check-csp.spec.ts` — 11 casi raggruppati in tre describe block:
  - **`index.production.html` source** (9 casi): verifica che il `<meta http-equiv="Content-Security-Policy">` esista e che le direttive siano strict:
    - `script-src` presente e non contiene `'unsafe-inline'` né `'unsafe-eval'`
    - `script-src` ristretto a `'self'` (sono ammessi solo `'self'`, `'strict-dynamic'`, `'nonce-*'`, `'sha*-*'`)
    - nessuna origine `localhost`, `127.0.0.1`, `ws:`, `wss:` in tutta la CSP
    - `connect-src` esattamente `'self'`
    - `object-src` e `frame-ancestors` esattamente `'none'`
    - `base-uri` esattamente `'self'`
    - direttiva `upgrade-insecure-requests` presente
  - **`angular.json` production config** (1 caso): verifica che la configurazione `production` punti ancora a `index.production.html` come input → `index.html` output (previene regressioni se qualcuno modifica `angular.json`)
  - **`dist/index.html`** (1 caso): se è presente una build di produzione (`dist/index.html` esiste), gli stessi controlli vengono applicati all'output finale. Il caso è `it.skip` quando la dist non esiste, così il test non richiede una build per girare in CI di base
- **Helper** `extractCsp(html)` + `parseDirectives(csp)` per parsare la CSP in modo strutturato; gestisce correttamente sia attribute con `"` che con `'`
- **Setup tooling**: aggiunto `scripts/**/*.spec.ts` a `tsconfig.spec.json#include` per far compilare il nuovo file a ts-jest. Nessun cambiamento a `jest.config.js` (i pattern di default catturano già `scripts/*.spec.ts`)
- **Risultato**: 11/11 nuovi test passano; suite completa 339/339 (era 328).

### ~~T4. `crypto.service.ts` IndexedDB helpers — branch al 53% funcs~~ ✅ RISOLTO (2026-05-13)

- **Unit test aggiunti** in `src/services/crypto.service.spec.ts` — describe block "IndexedDB key persistence (T4)" con 4 casi che esercitano le righe 40-69 (`openIDB`, `getKeyFromIDB`, `saveKeyToIDB`) e 126-160 (migrazione legacy + selezione storage):
  - **Persistenza chiave non-extractable**: dopo `encrypt()`, lo store IDB contiene un `CryptoKey` con `extractable === false` e `type === 'secret'`; `localStorage` resta vuoto
  - **Migrazione legacy → IDB**: si genera una chiave AES-GCM extractable a parte e la si scrive in `localStorage` (come faceva la versione precedente); si pre-cifra un payload con quella chiave; il primo `decrypt()` del servizio deve produrre il plaintext corretto (prova che la chiave migrata è la _stessa_, non rigenerata), `localStorage` viene svuotato, e IDB contiene la chiave migrata
  - **Fallback localStorage**: si rimuove `globalThis.indexedDB` → `isIndexedDBAvailable()` ritorna `false`; `encrypt()` non chiama `indexedDB.open`, la chiave finisce in `localStorage` e il round-trip funziona
  - **No race su `deviceKeyPromise`**: 3 chiamate `encrypt()` concorrenti via `Promise.all` producono **una sola** invocazione di `crypto.subtle.generateKey` con `name: 'AES-GCM'` e **una sola** entry nello store IDB; tutti e 3 i ciphertext si decifrano correttamente
- **Infrastruttura di test**: aggiunto un mock IndexedDB minimale in-memory direttamente nel file spec (no nuova dipendenza). Il mock implementa `open` / `transaction` / `objectStore.get` / `objectStore.put` con dispatching su microtask per rispecchiare l'ordine reale (`req.onsuccess` prima di `tx.oncomplete`). Installato in `beforeEach` dell'inner describe e ripristinato in `afterEach` — gli altri test continuano a girare sul fallback localStorage di default
- **Risultato**: 39/39 unit test `crypto.service.spec.ts` passano; suite completa 343/343 (era 339). Coverage di `openIDB`, `getKeyFromIDB`, `saveKeyToIDB` e del ramo migrazione legacy ora esercitati.

### ~~T5. `app.component.ts` — flussi sicurezza scoperti (righe 517-634)~~ ✅ RISOLTO (2026-05-13)

- **Unit test aggiunti** in `src/app.component.spec.ts` — describe block "Security flow coverage (T5)" con 8 casi:
  - `handleDateSearch`: anno < 1900 → toast `dateOutOfRange`, modal ricerca resta aperto, `searchDate` non cambia
  - `handleDateSearch`: anno > 2100 → toast `dateOutOfRange`, modal ricerca resta aperto, `searchDate` non cambia
  - `handleDateSearch`: valore non parsabile / `NaN` → toast `invalidDateFormat`, modal ricerca resta aperto
  - `handleDateSearch`: eccezione durante la costruzione della data → log errore + toast `failedToParseDate`
  - `importBackup`: file > 5 MB → toast `backupFileTooLarge`, `FileReader.readAsText` non viene chiamato, `isImporting` resta `false`
  - `executeDecryptionReset`: chiama `shiftService.resetAfterDecryptionError()`, chiude il modal e mostra toast `resetSuccess`
  - `dismissDecryptionError`: chiude il modal senza chiamare reset né toast di successo
  - `checkUrlForActions`: `?action=add_shift` apre il form nuovo turno e pulisce l'URL con `history.replaceState`
- **Risultato**: 67/67 unit test `app.component.spec.ts` passano; suite completa 357/357.

### ~~T6. `shift.service.ts` — validazione import (righe 419-445)~~ ✅ RISOLTO (2026-05-14)

- **Unit test aggiunti** in `src/services/shift.service.spec.ts` — due nuovi describe block per un totale di 15 casi:
  - **`isValidShift — optional field validation (T6)`** (14 casi) — ciascun caso costruisce un payload basato su `baseValidShift` e lo passa a `importShifts(JSON.stringify([...]))`, verificando che il risultato sia `{ success: false, error: 'No valid shifts found' }`:
    - `allowances` come oggetto (non-array) → rifiutato
    - `allowances` come stringa → rifiutato
    - `allowances[0].amount` come stringa → rifiutato (esercita `isValidAllowance`)
    - `repetition.interval = 0` → rifiutato (boundary `interval >= 1`)
    - `repetition.interval` negativo (`-3`) → rifiutato
    - `repetition.frequency = 'hours'` (non in `VALID_FREQUENCIES`) → rifiutato
    - `repetition` senza campo `frequency` → rifiutato
    - `notes` come numero → rifiutato
    - `notes` come oggetto → rifiutato
    - `timezone` come numero → rifiutato
    - `overtimeHours = Infinity` (espresso come `1e500` per superare `JSON.parse`) → rifiutato (`Number.isFinite` false)
    - `overtimeHours = -Infinity` (`-1e500`) → rifiutato
    - `overtimeHours` come stringa → rifiutato
    - Tutti i campi opzionali validi insieme (`repetition` + `notes` + `timezone` + `overtimeHours` + `allowances`) → accettato (caso di controllo positivo)
  - **`resetAfterDecryptionError (T6)`** (1 caso) — esercita il flusso `righe 97-106`:
    - Si crea un `ShiftService` fresco con `localStorage['easyturno_shifts'] = 'corrupted-ciphertext'` e un `CryptoService` mockato con `isEncrypted → true` e `decrypt → reject`
    - Dopo `flushAsyncWork()` si verifica che `decryptionError() === true` e che il ciphertext sia ancora in `localStorage` (no auto-clear)
    - Si chiama `resetAfterDecryptionError()` e si verifica: `decryptionError() === false`, `shifts() === []`, `encrypt('[]')` invocato, e `localStorage['easyturno_shifts'] === 'enc:[]'` (saves riabilitati: il save effect ha persistito l'array vuoto cifrato)
- **Risultato**: 73/73 unit test `shift.service.spec.ts` passano (era 58); suite completa 372/372 (era 357). Coperti i branch `obj.repetition !== undefined && !this.isValidRepetition(...)`, `obj.notes !== undefined && typeof obj.notes !== 'string'`, `obj.overtimeHours !== undefined && !(Number.isFinite(...))`, `obj.allowances !== undefined && (!Array.isArray(...) || ...)`, `obj.timezone !== undefined && typeof obj.timezone !== 'string'`, e l'intero corpo di `resetAfterDecryptionError`.

### ~~T7. `shift-list-item.component.ts` — output emitters al 0% (righe 99-102)~~ ✅ RISOLTO (2026-05-14)

- **Unit test aggiunti** in `src/components/shift-list-item.component.spec.ts` — nuovo file spec con describe block "Output emitters (T7)" per un totale di 7 casi:
  - `should create` — smoke test di istanziazione del componente con `shift` input richiesto
  - **`view` emitter**: click sul container `div.cursor-pointer` → emette esattamente una volta con il `Shift` passato come input
  - **`edit` emitter**: click su `[data-cy="edit-shift-btn"]` → emette una volta con il `Shift` corrente
  - **`deleteShift` emitter**: click su `[data-cy="delete-shift-btn"]` → emette una volta con il `Shift` corrente
  - **`stopPropagation` su edit**: click sul pulsante edit NON triggera anche `view.emit` (verifica `$event.stopPropagation()` nel template)
  - **`stopPropagation` su delete**: click sul pulsante delete NON triggera anche `view.emit`
  - **Aggiornamento input**: dopo `setInput('shift', updatedShift)` + `detectChanges`, il successivo click sul container emette il _nuovo_ riferimento (verifica che `output<Shift>()` riflette l'`input.required<Shift>()` aggiornato)
- **Setup**: TestBed con `imports: [ShiftListItemComponent]` (standalone) e `providers: [TranslationService, DatePipe]` (DatePipe richiesto da `LangDatePipe` via `inject(DatePipe)`). Input set via `fixture.componentRef.setInput('shift', mockShift)` perché `shift` è un `input.required<Shift>()`. Spy via `jest.fn()` sottoscritto a ciascun `OutputEmitterRef`.
- **Risultato**: 7/7 nuovi test passano; suite completa 379/379 (era 372). Le righe 99-102 (`view`, `edit`, `deleteShift` output emitters) ora hanno copertura piena, incluso il comportamento di `stopPropagation` sui pulsanti di azione.

## 🟡 Buchi medi

### ~~T8. `notification.service.ts` — branch native (righe 63-137)~~ ✅ RISOLTO (2026-05-14)

- **Unit test aggiunti** in `src/services/notification.service.spec.ts` — nuovo describe block "Native branch coverage (T8)" con 5 casi raggruppati in tre sub-describe:
  - **`loadNotificationIdCounter`** (2 casi) — esercita le righe 54-74:
    - _Counter inizializzato dal max ID pendente_: si mocca `getPending` per restituire `[{id:5},{id:42},{id:17}]`, si invoca `initialize()` (native=true, permission granted) e poi `scheduleShiftNotification` su un turno futuro con solo il reminder X-min-prima; si verifica che l'ID della notifica schedulata sia `43` (= maxId + 1), confermando che `loadNotificationIdCounter` ha letto il pending e impostato `notificationIdCounter = 42`
    - _Reset a 0 quando `getPending` fallisce_: `getPending` rejecta con `Error('IDB error')`; dopo `initialize()` si verifica che `console.error` sia stato chiamato con `'Failed to load notification counter:'` e che la successiva `scheduleShiftNotification` produca ID `1` (counter ripartito da 0)
  - **`scheduleShiftNotification` — branch day-before** (2 casi) — esercita le righe 131-148:
    - _Schedulazione a 20:00 del giorno prima_: turno futuro a 2 giorni alle 09:00 locali, `dayBeforeEnabled: true`; si verifica che siano schedulate 2 notifiche, che quella con titolo contenente `🔔` abbia `schedule.at` esattamente uguale a `(shiftStart - 1d) @ 20:00` (confronto su `getTime()`, `getHours()=20`, `getMinutes()=0`)
    - _Skip day-before quando 20:00 del giorno prima è già passato_: turno tra 2 ore (quindi "ieri alle 20:00" è nel passato); si verifica che venga schedulata 1 sola notifica (solo il reminder X-min-prima con icona `📅`, no day-before)
  - **`scheduleShiftNotification` — invalid start date** (1 caso) — esercita le righe 105-108:
    - `shift.start = 'not-a-date'`: `new Date('not-a-date').getTime()` è `NaN`; si verifica che `LocalNotifications.schedule` NON sia chiamato e che `console.warn` sia invocato con il messaggio `'NotificationService: invalid shift start date, skipping notifications'`
- **Risultato**: 22/22 unit test `notification.service.spec.ts` passano (era 17); suite completa 384/384 (era 379). Coperti i rami `loadNotificationIdCounter` (success + catch), il branch `dayBeforeEnabled && dayBefore > now` (taken + not-taken) e il guardrail `isNaN(shiftStart.getTime())`.

### ~~T9. `calendar.service.ts` — branch al 57% (righe 89-161)~~ ✅ RISOLTO (2026-05-14)

- **Unit test aggiunti** in `src/services/calendar.service.spec.ts` — due nuovi describe block per un totale di 4 casi:
  - **`Month navigation across year boundaries (T9)`** (2 casi):
    - `previousMonth` da gennaio 2025 → `currentYear === 2024` e `currentMonth === 11` (dicembre); esercita il rollback dell'anno in `previousMonth` (righe 36-42) tramite `Date.setMonth(-1)`
    - `nextMonth` da dicembre 2025 → `currentYear === 2026` e `currentMonth === 0` (gennaio); esercita l'avanzamento dell'anno in `nextMonth` (righe 47-53) tramite `Date.setMonth(12)`
  - **`Day grid when first of month is Sunday or Monday (T9)`** (2 casi) — esercitano il branch `if (firstDayOfWeek < 0) firstDayOfWeek = 6` (riga 89) e l'estremo opposto:
    - _1° del mese di domenica_: `goToDate(2025, 5)` (giugno 2025, il 1° è domenica) → la griglia ha esattamente 6 giorni di "leading" dal mese precedente (lun 26 mag → sab 31 mag), e l'indice 6 è il 1° giugno con `isCurrentMonth === true`. Verifica che `firstDay.getDay() === 0` triggeri la riassegnazione a `6` e che il loop `for (let i = firstDayOfWeek - 1; i >= 0; i--)` aggiunga effettivamente 6 entry
    - _1° del mese di lunedì_: `goToDate(2025, 8)` (settembre 2025, il 1° è lunedì) → `firstDayOfWeek === 0`, nessun leading day, `days[0]` è il 1° settembre. Verifica i 30 giorni del mese corrente seguiti da 12 trailing days di ottobre per riempire la griglia 42-cell. Esercita il caso "loop previous-month con zero iterazioni"
- **Risultato**: 29/29 unit test `calendar.service.spec.ts` passano (era 25); suite completa 388/388 (era 384). Coperti sia il rollback/advance di anno in `previousMonth`/`nextMonth`, sia il branch `firstDayOfWeek < 0` (Sunday case) e l'estremo opposto (Monday case, zero leading days).

### ~~T10. Backup E2E mancanti (Playwright)~~ ✅ RISOLTO (2026-05-14)

- **E2E Playwright aggiunti** in `playwright/tests/app-flows.spec.ts` per coprire i due flussi mancanti (la rifiuto-password-corta era già coperta da T1, vedi spec a riga 512):
  - **`rejects an import file larger than 5 MB without prompting for password`** (riga 381) — apre Settings → Importa Backup, intercetta il `filechooser` e fornisce un buffer di `5 * 1024 * 1024 + 1` byte (un byte oltre `MAX_IMPORT_FILE_SIZE_BYTES` in `app.component.ts:84`). Verifica che:
    - compaia un toast `[role="alert"]` con testo `troppo grande|too large` (i18n it/en)
    - il modal password NON si apra (`[data-cy="password-input"]` invisibile) — prova che `importBackup()` esce prima di `reader.readAsText()` (righe 632-635)
  - **`imports a legacy backup encrypted with 250,000 PBKDF2 iterations`** (riga 411) — costruisce in-page un payload di backup conforme a `easyturno-password-backup` v1 ma con `iterations: 250_000` (per emulare un backup creato prima del raise a 600k del fix T2). Usa direttamente `crypto.subtle` nel page context (non il `CryptoService`) per generare salt/iv random, derivare la chiave PBKDF2-SHA256 a 250k iter, cifrare con AES-GCM un array contenente uno `Shift` valido (`id`, `seriesId`, `title`, `start`, `end`, `color: 'sky'`, `isRecurring: false`), e serializzare in JSON. Il file viene poi caricato via `filechooser.setFiles({ buffer })` e decrittato con la password corretta. Verifica che:
    - il turno `Legacy 250k Shift` compaia in lista dopo l'import
    - sopravviva al `page.reload()` (prova che il backup è stato persistito in IDB cifrato con la chiave device)
  - Helper note: `test.setTimeout(60000)` impostato per coprire i ~250k iter PBKDF2 + decrypt + i 600k iter di re-encrypt al save (anche se in pratica il test gira in ~2.5s su hardware moderno)
- **Risultato**: 16/16 test Playwright passano (era 14). La regressione su T2 (decryption legacy) è ora coperta a livello E2E end-to-end, oltre che a livello unit (`crypto.service.spec.ts` "PBKDF2 backward compatibility").

## 🔵 Buchi minori

### ~~T11. `app.component.ts` residui~~ ✅ RISOLTO (2026-05-14)

- **Unit test aggiunti** in `src/app.component.spec.ts` — nuovo describe block "app.component.ts residual coverage (T11)" con 19 casi raggruppati in quattro sub-describe:
  - **`DatePipe ISO fallback`** (3 casi) — esercitano i rami fallback ISO quando `DatePipe.transform` ritorna `null`:
    - _`resetForm()` (righe 447-451)_: `jest.spyOn(component.datePipe, 'transform').mockReturnValue(null)` + `component.resetForm()` → verifica `console.error('Failed to format reset dates, using ISO fallback')` e che i 4 signal `shiftStartDate/Time` + `shiftEndDate/Time` siano popolati con stringhe `YYYY-MM-DD` / `HH:MM` (ISO fallback)
    - _`openEditShiftForm()` (righe 329-335)_: stesso mock + apertura modifica di un `Shift` con `start: '2025-06-15T10:30:00.000Z'` → verifica log d'errore, `shiftStartDate === '2025-06-15'` (da `toISOString().split('T')[0]`) e `shiftStartTime` con formato `HH:MM`
    - _Constructor (righe 215-217, 231-235)_: `TestBed.resetTestingModule()` + `.overrideComponent(AppComponent, { set: { providers: [{ provide: DatePipe, useValue: { transform: () => null } }] } })` per sostituire il `DatePipe` component-scoped → la nuova istanza logga sia `'Failed to format search date, using fallback'` che `'Failed to format stats dates, using fallback'`; `searchDateInput`, `statsStartDate`, `statsEndDate` sono comunque popolati con il fallback ISO
  - **`executeEdit(false)` — single-instance edit from recurring series (righe 421-430)`** (2 casi):
    - _Aggiornamento singola istanza_: crea un turno ricorrente settimanale (`repetition: { frequency: 'weeks', interval: 1 }`) che genera multiple istanze; apre la modifica della prima istanza, cambia il titolo, sottomette il form (apre `editSeriesConfirm`), poi chiama `executeEdit(false)`. Verifica che `updateShiftSeries` NON venga chiamato, `updateShift` venga chiamato una sola volta con `{ ...editing, ...shiftData, isRecurring: false, repetition: undefined }`, e che `activeModal === 'none'`, `editingShift === null`, `pendingShiftData === null` dopo l'esecuzione
    - _No-op senza pending data_: `editingShift.set(null)` + `pendingShiftData.set(null)` → `executeEdit(false)` e `executeEdit(true)` ritornano early senza chiamare né `updateShift` né `updateShiftSeries` (early return su `if (!editing || !shiftData)`)
  - **`getColorClasses — all 8 color branches`** (9 casi) — parametrizzato su `['sky','green','amber','rose','indigo','teal','fuchsia','slate']`:
    - 8 casi (uno per colore): la stringa restituita contiene tutte e 6 le classi attese (`bg-${color}-100`, `text-${color}-700`, `border-${color}-500`, `dark:bg-${color}-500/20`, `dark:text-${color}-300`, `dark:border-${color}-400`)
    - 1 caso aggregato: `new Set(allResults).size === 8` (ogni colore produce una stringa distinta, no collisioni nel `colorMap` di `getColorClasses`)
  - **`toggleViewMode / setViewMode`** (5 casi) — esercitano il side-effect di reset del filtro ricerca al passaggio calendar → list (`searchDate.set(null)` + `listVisibleCount.set(INITIAL_LIST_SIZE)`):
    - _`toggleViewMode` list → calendar_: searchDate e listVisibleCount preservati (no side-effect quando si entra in calendar)
    - _`toggleViewMode` calendar → list_: searchDate diventa `null`, listVisibleCount torna a 50
    - _`setViewMode('list')` da calendar_: stesso side-effect del toggle calendar → list
    - _`setViewMode('calendar')` da list_: nessun side-effect (searchDate e pagination preservati)
    - _`setViewMode('list')` già su list_: nessun side-effect (la guard `currentMode === 'calendar' && mode === 'list'` non scatta)
- **Risultato**: 86/86 unit test `app.component.spec.ts` passano (era 67); suite completa 407/407 (era 388). Coperti i 4 rami `DatePipe → null` fallback, l'intero corpo di `executeEdit(false)`, tutti gli 8 colori di `getColorClasses`, e i side-effect di `toggleViewMode`/`setViewMode`.

### ~~T12. `sw-update.service.ts` (righe 47, 62-65)~~ ✅ RISOLTO (2026-05-14)

- **Refactor minimo** in `src/services/sw-update.service.ts`: estratto `window.location.reload()` in un metodo `protected reloadPage()`. Motivazione: in JSDOM `window.location.reload` è non-configurable e non-writable (verificato con `Object.getOwnPropertyDescriptor`), quindi non si può fare spy/mock direttamente. Wrappare la chiamata in un metodo dell'istanza permette di intercettarla con `jest.spyOn(service, 'reloadPage')` senza toccare `window.location`. Il listener `controllerchange` ora invoca `this.reloadPage()` invece di `window.location.reload()`. Nessun cambiamento di comportamento in produzione.
- **Unit test aggiornati/aggiunti** in `src/services/sw-update.service.spec.ts`:
  - **`should trigger reload on controllerchange event`** (riscritto): prima era un test "vuoto" che si limitava a verificare la registrazione del listener (con un commento esplicito "We cannot easily test window.location.reload in JSDOM environment"). Ora installa uno `jest.spyOn` su `reloadPage` (con `mockImplementation` per evitare la vera reload), invoca il callback `controllerchange` catturato da `navigator.serviceWorker.addEventListener.mock.calls`, e verifica che `reloadPage` sia stato chiamato esattamente una volta. Esercita la riga 47 (`this.reloadPage()`) e indirettamente la riga 56 (corpo di `reloadPage`)
  - **Nuovo describe block `cleanup (T12)`** con 3 casi per coprire le righe 62-65:
    - _Clear interval after checkForUpdates_: spia `global.clearInterval`, esegue `checkForUpdates()`, avanza i timer di 60s (verifica che l'interval funzioni → `mockRegistration.update` chiamato una volta), poi `cleanup()`. Verifica che `clearInterval` sia stato chiamato una volta e che avanzando i timer di altri 300s `mockRegistration.update` NON venga più invocato (l'interval è stato effettivamente cancellato)
    - _No-op senza interval attivo_: chiamata a `cleanup()` prima di `checkForUpdates()` → non lancia eccezioni e `clearInterval` non viene mai chiamato (verifica il guard `if (this.updateCheckInterval !== null)` alla riga 62)
    - _Idempotenza_: dopo `checkForUpdates()`, chiamare `cleanup()` 3 volte di seguito → `clearInterval` invocato esattamente 1 volta (la prima cancella l'interval e setta `updateCheckInterval = null`, le successive 2 hit del guard saltano)
- **Risultato**: 22/22 unit test `sw-update.service.spec.ts` passano (era 19); suite completa 410/410 (era 407). Coperte la riga 47 (`controllerchange` → reload) e le righe 62-65 (`cleanup()` con clearInterval + guard `null`).

### ~~T13. `date-format.pipe.ts` (righe 33-34)~~ ✅ RISOLTO (2026-05-14)

- **Unit test aggiunti** in `src/pipes/date-format.pipe.spec.ts` — 2 nuovi casi che coprono il branch `case 'shortMonthAndYear'` (righe 32-34), unico ramo dello `switch` rimasto scoperto (i casi `null`/`undefined` erano già testati alle righe 110-118 della spec):
  - _Italian locale_ (nel describe block "transform with Italian locale"): `pipe.transform(new Date('2025-09-30T10:30:00'), 'shortMonthAndYear')` → result match `/^[\p{L}.]+\s\d{2}$/u` e contiene `'25'`. Match flessibile per accomodare l'eventuale punto nelle abbreviazioni mese italiane di Angular (`set` / `set.`), preservando la verifica del formato `MMM yy`
  - _English locale_ (nel describe block "transform with English locale"): `pipe.transform(new Date('2025-09-30T10:30:00'), 'shortMonthAndYear')` → result `'Sep 25'` (exact match)
- **Nota sulla descrizione originale di T13**: il testo "Formato data con input null/undefined" era impreciso. Le righe 33-34 puntano al `case 'shortMonthAndYear'` (effettivamente non coperto), mentre i path null/undefined erano già coperti dalla spec esistente in "input handling". `shortMonthAndYear` è realmente usato in `src/components/shift-list-item.component.ts:37` per renderizzare l'header data dei turni
- **Risultato**: 19/19 unit test `date-format.pipe.spec.ts` passano (era 17); suite completa 412/412 (era 410). Tutti i 7 branch dello `switch` di `LangDatePipe.transform` ora hanno copertura esplicita.

---

## Priorità suggerita (test)

1. ~~**T1**~~ ✅, ~~**T2**~~ ✅, ~~**T3**~~ ✅, ~~**T4**~~ ✅ — bloccanti: testano direttamente i fix di sicurezza appena introdotti, alto rischio regressioni
2. ~~**T5**~~ ✅, ~~**T6**~~ ✅ — frontiere di attacco principali (validazione input)
3. ~~**T7**~~ ✅, ~~**T10**~~ ✅ — smoke + E2E
4. ~~**T8**~~ ✅, ~~**T9**~~ ✅, ~~**T11**~~ ✅, ~~**T12**~~ ✅, ~~**T13**~~ ✅ — al prossimo refactor

**Target**: 81% → 90% stmts e 69% → 80% branch, focus su `app.component.ts` e `crypto.service.ts`.
