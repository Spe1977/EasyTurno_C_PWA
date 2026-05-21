# EasyTurnoPWA — Report tecnico per implementazione Capacitor Android, Firebase Auth/Sync e nuovo scroll turni

## Stato di avanzamento

- [ ] **Security remediation roadmap — vulnerabilità codex-security** (pianificata 2026-05-21)
  - Report scan: `/tmp/codex-security-scans/EasyTurno_C_PWA/b733367_20260521T100746+0200/report.md`.
  - Piano operativo: [`docs/superpowers/plans/2026-05-21-security-findings-remediation.md`](docs/superpowers/plans/2026-05-21-security-findings-remediation.md).
  - Fix da applicare prima di produzione / Play Store:
    1. rimuovere il log del token FCM raw da `src/services/push-notification.service.ts`;
    2. disabilitare o restringere Android backup in `android/app/src/main/AndroidManifest.xml`;
    3. aggiornare/rimuovere dipendenze tooling vulnerabili (`firebase-tools`, `@capacitor/assets` e transitive);
    4. restringere `android/app/src/main/res/xml/file_paths.xml` se possibile, evitando `external-path path="."`.
  - Verifica finale prevista: `npm run lint`, `npm test -- --runInBand`, `npm run build`, `npm audit --audit-level=low`, `npm run test:firebase` se cambia Firebase tooling, build Gradle Android se JDK 21 è disponibile.
- [x] **Fase 5a — Finestra di visibilità lista** (completata 2026-05-17)
  - Costanti `PAST_MONTHS_VISIBLE = 12` e `FUTURE_MONTHS_VISIBLE = 24` in `app.component.ts`.
  - `generateList()` filtra per intersezione con `[today-12m, today+24m]`.
  - `MAX_RECURRING_INSTANCES` alzato da 200 a 800 in `shift.service.ts` per coprire ricorrenze daily su 24 mesi.
  - Ricerca data fuori range non bloccata, con toast informativo (`searchOutsideRange` it/en).
  - **Bottone "Vai a oggi"** nella sticky bar (vista lista, senza ricerca attiva): scrolla al primo turno con `end >= today` e auto-carica le pagine successive se il target è oltre la pagination corrente. Chiavi i18n `goToToday`/`goToTodayAria`.
  - Unit test: 418/418 verdi; aggiornato `app.component.spec.ts` per testare la nuova finestra; aggiornato `shift.service.spec.ts` per il nuovo cap.
- [~] **Fase 4 + 5b — Firestore sync + refactor serie/override** (in corso, 2026-05-18)
  - Cambia il modello dati da `Shift[]` materializzato a `ShiftSeries[] + ManualShift[] + ShiftOverride[]` + `generateOccurrencesForRange()` puro. È esattamente il modello dati richiesto da Firestore (sezione §4): le due fasi vanno insieme per non refactorare due volte.
  - Piano operativo: [`docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md`](docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md).
  - **Task 1 ✅** (2026-05-18, Codex) — modello `ShiftSeries`/`ManualShift`/`ShiftOverride`/`ShiftDataState` in `shift.model.ts`; `generateOccurrencesForRange()` puro in `src/services/occurrence-generator.ts` con relativi unit test (8/8 verdi).
  - **Task 2 ✅** (2026-05-18, Claude Code) — `ShiftService` riscritto sopra `ShiftDataState`; persistenza cifrata sulla nuova chiave `easyturno_user_data_v2`; lettura legacy `easyturno_shifts` con migrazione automatica (la chiave legacy è preservata come safety-net, viene rimossa solo da `resetAfterDecryptionError`). `shifts` è ora un `computed<Shift[]>` che applica overrides. CRUD pubblica invariata; semantica `updateShiftSeries` "split al punto di edit" preservata tramite overrides `modified` retroattivi sulle occorrenze passate. Suite totale: 16/16 verdi, 449/449 test, lint pulito, `ng build` ok. Limitazione nota: se l'utente edita l'orario (time-of-day) di una occorrenza intermedia in `updateShiftSeries`, il nuovo orario non si propaga alle occorrenze successive — non coperto dai test esistenti, da rivedere in Task 5b proper o con un `seriesEnd`/`validFrom` sul modello.
  - **Task 3 ✅** (2026-05-18, Claude Code) — `UserDataService` estratto come confine locale dello store (`src/services/user-data.service.ts` + spec). `@Injectable({providedIn:'root'})` possiede il `signal<ShiftDataState>` privato; espone `readonly state` (readonly signal), `setState(next)`, `update(mutator)` come unico boundary di mutazione. `ShiftService` ora `inject(UserDataService)` e instrada tutti i 17 write site attraverso il service; i read paths usano un alias `private readonly state = this.userDataService.state`. Zero cambio comportamentale: persistenza cifrata, migrazione legacy, CRUD pubblica, scheduling notifiche e materializzazione invariati. Suite totale: 17/17 verdi, 453/453 test (+4 nuovi su `UserDataService`), lint pulito, `ng build` ok (1.04 MB raw / 245.80 kB transfer, invariato).
  - **Task 4 ✅** (2026-05-18, Claude Code) — `FirestoreUserDataService` aggiunto (`src/services/firestore-user-data.service.ts` + spec). `@Injectable({providedIn:'root'})` con `signal<ShiftDataState>` privato (readonly via `state`). `start(uid)` apre tre `onSnapshot` su `users/{uid}/{shiftSeries,manualShifts,shiftOverrides}` e patcha lo stato; `stop()` invoca tutti gli unsubscriber e resetta a `EMPTY_SHIFT_DATA_STATE`. Idempotente: `start()` chiamato due volte chiude i listener precedenti prima di aprirne di nuovi. `FirebaseAppService.firestore` ora usa `initializeFirestore(app, { localCache: persistentLocalCache() })` invece di `getFirestore(app)`. Mock `firebase/firestore` esteso in `setup-jest.js` con `initializeFirestore`, `persistentLocalCache`, `collection`, `doc`, `onSnapshot`, `writeBatch`, `serverTimestamp`. **Non ancora wirato** in `UserDataService`/`ShiftService` (per piano va a Task 6). Suite totale: 18/18 verdi, 457/457 test (+4 nuovi), lint pulito, `ng build` ok (1.24 MB raw / 289.81 kB transfer; delta +0.20 MB raw / +44 kB transfer = costo del path IndexedDB di `persistentLocalCache`).
  - **Task 5 ✅** (2026-05-20, Gemini) — `SyncService` con stato `SyncStatus` (`local|connecting|synced|offline|error`) e badge UI nell'header con i18n. Suite totale: 19/19 verdi, 461/461 test.
  - **Task 6 ✅** (2026-05-20, Antigravity) — CRUD Firestore via Sync. Implemenati metodi di scrittura in `FirestoreUserDataService` e wirati in `UserDataService` e `ShiftService`.
  - **Task 7 ✅** (2026-05-20, Antigravity) — Device registration + soft-limit 4. Creato `DeviceService` e integrato in `SyncService` per registrare il dispositivo su Firestore all'autenticazione.
  - **Task 8-10 ✅** — rules + emulator harness, backup import/export v2-compat, account-delete cloud cleanup.
  - **Task 11 ✅** — verifica finale e documentazione completata. 470/470 test passati, build ok.
  - **Task 12 (Prossimamente)** — Rafforzamento della suite di test: copertura UI Auth, batch Firestore e casi limite DST/Leap years.
- [x] **Fase 6 — Capacitor Android: setup piattaforma** (COMPLETATA, 2026-05-20)
  - **Step 6.3 ✅**: Push Notifications FCM implementate e testate.
  - **Punto 1 ✅**: Integrazione `google-services.json` con SHA-1 per Login Google.
  - **Punto 2 ✅**: Setup JDK 21 e build Android (Debug & Release) verificata.
  - **Punto 3 ✅**: UI Warning per superamento limite 4 dispositivi implementata.
  - **Punto 4 ✅**: Icone Adaptive, Splash Screen e Keystore generati e configurati.
  - **Decisione package name**: `com.spe1977.easyturno` (developer Spe1977; convenzione reverse-DNS). Modificato in `capacitor.config.ts`.
  - **Piattaforma Android aggiunta**: `npx cap add android` → creata cartella `android/` con Gradle project, MainActivity, AndroidManifest, plugin Capacitor (app/haptics/local-notifications/share/splash-screen/status-bar). `applicationId` e `namespace` corretti in `android/app/build.gradle`. `versionCode 1`, `versionName "1.0"`, `compileSdk/targetSdk 36`, `minSdk 24`.
  - **Asset web sincronizzati**: `dist/` copiato in `android/app/src/main/assets/public/`.
  - **`.gitignore` root**: aggiunte righe per `*.keystore`, `*.jks`, `keystore.properties`, `android/keystore.properties`, `google-services.json` (protezione preventiva, anche se l'`android/.gitignore` generato copre già build artifacts e local.properties).
  - **⚠ Build debug bloccata da JDK 17**: `./gradlew assembleDebug` fallisce con `invalid source release: 21`. Capacitor 8 richiede **JDK 21**, sul sistema c'è solo JDK 17. Niente di rotto nel progetto — è solo una toolchain mancante. Vedi §9.3.1 per la procedura di installazione.
  - **Non fatto in questa fase** (per scelta):
    - keystore release (servirà solo al momento della pubblicazione su Play Console, che l'utente non ha ancora attivato)
    - Push Notifications FCM (dipendono da Firebase, Fase 3-4)
    - icone adaptive Android personalizzate (le icone Capacitor di default sono funzionali per ora; rigenerazione consigliata prima della pubblicazione, vedi §9.5)
- [x] **Manutenzione dipendenze** (2026-05-17)
  - `@angular/*` 21.2.5 → 21.2.13, `@capacitor/core|android|cli` 8.3.0 → 8.3.4, `@capacitor/local-notifications` 8.1.0 → 8.2.0, `@capacitor/haptics` 8.0.1 → 8.0.2, `eslint` 10.3.0 → 10.4.0, `lint-staged` 17.0.4 → 17.0.5, npm globale 11.12.1 → 11.14.1.
  - Non aggiornati (volutamente): `typescript` 5.9.3 (pinned per Angular 21, commit `758d0d1`), `vite` 7.3.3 (major), `zone.js` 0.15.1 (peer Angular), Node 24 (engine OK).
  - Verifica: jest 418/418 verdi, ng build OK, `cap sync android` OK, `npm audit` 0 vulnerabilità.
- [x] **Fase 3 — Auth UI + Firebase Auth** (completata 2026-05-17)
  - **Setup Firebase Console**: progetto `easyturno`, region Firestore `eur3 (europe-west)` production mode (rules locked: `allow read, write: if false`), Auth provider Email/Password e Google abilitati.
  - **Step 3.1**: `npm install firebase` (69 packages, 0 vulns); `src/environments/firebase.config.ts` committato (chiavi client non sono segreti per design Firebase); CSP aggiornato in `index.html`/`index.production.html`/`_headers` con allowlist Firebase esplicita (`apis.google.com`, `gstatic.com`, `*.googleapis.com`, `*.firebaseio.com`, `wss://*.firebaseio.com`, `*.firebaseapp.com`, `accounts.google.com`). Test CSP aggiornati con allowlist documentata (`FIREBASE_SCRIPT_ORIGINS` / `FIREBASE_CONNECT_ORIGINS` / `FIREBASE_FRAME_ORIGINS`); reject di blanket `ws:`/`wss:` mantenuto via regex `(?:^|\s)wss?:(?!\/\/)`.
  - **Step 3.2 — `FirebaseAppService`**: singleton lazy con `initialize()` idempotente, getter `auth`/`firestore` con cache locale, app name `easyturno`.
  - **Step 3.3 — `AuthService`**: signal-based con `AuthMode = loading|unauthenticated|guest|authenticated|email-not-verified`. Computed: `mode`, `isGuest`, `isAuthenticated`, `needsEmailVerification`. Metodi: `registerEmail` (+`updateProfile`+`sendEmailVerification`), `loginEmail`, `loginGoogle` (popup), `resendVerificationEmail` (cooldown 60s), `refreshUser` (reload), `sendPasswordReset`, `signOut`, `continueAsGuest`, `exitGuestMode`. Persistenza guest in `localStorage['easyturno.authMode']`; bootstrap Firebase saltato in guest mode per non caricare network/SDK.
  - **Step 3.4 — `AuthScreenComponent`**: schermo unico con toggle (login/register/forgot), bottone Google con icona ufficiale, "Continua senza account" + modal di conferma con disclaimer GDPR-style. Validazione client (regex email + min 8 chars password + match conferma). Mappatura `FirebaseError.code` → chiavi i18n (`auth/invalid-credential`, `auth/email-already-in-use`, `auth/user-not-found`, `auth/weak-password`, `auth/too-many-requests`, `auth/network-request-failed`, `auth/popup-blocked`); `popup-closed-by-user` e `cancelled-popup-request` ignorati silenziosamente. ~50 chiavi i18n aggiunte (it/en).
  - **Step 3.5 — `EmailVerificationScreenComponent`**: messaggio con email utente, "Ho verificato" → `refreshUser()`, "Reinvia email" con cooldown 60s e contatore live, logout per cambiare account.
  - **Step 3.6 — Wiring `AppComponent`**: tutto il template wrappato in `@switch(authService.state().mode)`; case `loading` mostra splash con logo pulsante, `unauthenticated` → `<app-auth-screen/>`, `email-not-verified` → `<app-email-verification-screen/>`, `default` (guest/authenticated) → app esistente invariata. Aggiunta sezione "Account" in Settings con email utente o disclaimer guest, bottone dinamico "Esci" (signOut) / "Accedi" (exitGuestMode) via computed `authExitLabelKey`.
  - **Step 3.7 — Test**: mock di `firebase/app`/`firebase/auth`/`firebase/firestore` in `setup-jest.js` (zero network/SDK in test). 8 nuovi test per `AuthService` (loading→unauthenticated, restore guest, continueAsGuest, exitGuestMode, register flow, login verified, cooldown resend, signOut). **Suite totale: 427/427 verdi** (was 418).
  - **Bundle size**: 776 → 1024 kB raw / 179 → 251 kB transfer (delta Firebase SDK + Google Auth, atteso).
  - **Non sincronizza ancora niente**: l'utente autenticato vede l'app esattamente come l'ospite (localStorage cifrato). La sync è esplicitamente Fase 4. Le rules Firestore restano `if false` finché non implementiamo la sync.
- [x] **Fase 3.x — Eliminazione account** (completata 2026-05-17)
  - Aggiunto bottone "Elimina account" nella sezione Account delle Settings, visibile solo per utenti autenticati.
  - Flusso a 2 step: warning iniziale + conferma finale con digitazione email; per account email/password richiede anche password, per Google usa re-auth popup.
  - `AuthService.deleteAccount()` re-autentica con `reauthenticateWithCredential` o `reauthenticateWithPopup`, poi chiama `deleteUser`.
  - Al successo cancella turni locali e chiavi `localStorage` EasyTurno, chiude la sessione e mostra toast di conferma.
  - Gestione errori: email mismatch, `auth/requires-recent-login` con logout forzato, network error e fallback generico.
  - Test aggiunti: `AuthService` password/Google delete, provider Google nello stato, `AuthScreenComponent` Google sign-in/popup errors, `AppComponent` UI delete e reset dati locali. Suite totale: 438/438 verdi; `ng build` OK; lint OK.
  - Verifica browser locale: Auth screen renderizzata su `http://127.0.0.1:4200/`, bottone Google visibile, nessun errore console. Il completamento reale del popup OAuth richiede sessione/account Google interattivi.
  - **Nota Fase 4+**: resta da aggiungere il batch-delete Firestore `users/{uid}/**` quando la sync cloud sarà implementata.

<details>
<summary>Spec originale Fase 3.x</summary>

  - **Posizione UI**: bottone "Elimina account" nella sezione Account del modal Settings, ben separato dal logout (colore rosso/danger, sotto un divisore). Visibile solo se `authService.isAuthenticated()`, NON in guest mode (in guest non c'è account Firebase da eliminare).
  - **Flusso di conferma a 2 step**:
    1. Modal warning con disclaimer chiaro: "Stai per eliminare definitivamente il tuo account. Tutti i dati associati (turni sincronizzati, impostazioni cloud) verranno **cancellati e non recuperabili**. Vuoi continuare?" + bottoni "Annulla" / "Procedi".
    2. Modal conferma finale che richiede di **digitare l'email** dell'account (anti-misclick) + (per email/password) re-inserimento password per re-authenticate. Per utenti Google: re-auth via `reauthenticateWithPopup(GoogleAuthProvider)`.
  - **Logica `AuthService.deleteAccount()`**:
    - `reauthenticateWithCredential` o `reauthenticateWithPopup` (richiesto da Firebase per operazioni sensibili: se l'ultimo login è più vecchio di ~5 min, `deleteUser` fallisce con `auth/requires-recent-login`).
    - In **Fase 4+** (quando ci sarà sync): prima di `deleteUser`, batch-delete su Firestore di `users/{uid}/**` (shiftSeries, manualShifts, shiftOverrides, devices, settings, profile). In Fase 3.x basta solo `deleteUser`.
    - Cancellare anche i dati locali cifrati: `shiftService.clearAll()` + reset `localStorage` (chiave dispositivo IndexedDB, preferenze).
    - `await deleteUser(currentUser)` di firebase/auth.
    - `onAuthStateChanged` → mode `unauthenticated` → AuthScreen.
    - Toast di conferma "Account eliminato".
  - **Gestione errori**:
    - `auth/requires-recent-login` → mostra modal "Devi accedere di nuovo per confermare", forza logout+login senza completare l'eliminazione.
    - `auth/network-request-failed` → toast + ritenta.
    - Errore Firestore batch-delete → log + chiedi all'utente se procedere comunque con `deleteUser` (i dati cloud rimarrebbero orfani, ma non più accessibili a nessuno con le rules che richiedono `request.auth.uid == userId`).
  - **i18n keys da aggiungere** (it/en):
    - `authDeleteAccount`, `authDeleteAccountWarningTitle`, `authDeleteAccountWarningBody`, `authDeleteAccountConfirmTitle`, `authDeleteAccountConfirmEmailLabel`, `authDeleteAccountConfirmPasswordLabel`, `authDeleteAccountProceed`, `authDeleteAccountCancel`, `authDeleteAccountSuccess`, `authDeleteAccountReauthRequired`, `authDeleteAccountEmailMismatch`.
  - **Test unitari**: mock `deleteUser`, `reauthenticateWithCredential`, `reauthenticateWithPopup` in `setup-jest.js`. Coprire: happy path, requires-recent-login, network error, email-mismatch nel modal conferma.
  - **Sequenza consigliata**: implementare in Fase 3.x (subito dopo demo registrazione) solo la parte Firebase Auth `deleteUser` + reset localStorage. La parte Firestore batch-delete va aggiunta come step finale di Fase 4 quando il sync è completo.
  - **Riferimenti**: <https://firebase.google.com/docs/auth/web/manage-users#delete_a_user> e <https://firebase.google.com/docs/auth/web/manage-users#re-authenticate_a_user>.

</details>

---

## Roadmap operativa

L'ordine seguito da qui in poi. Le user-action richieste sono marcate **[USER]**; quelle di coding sono **[DEV]**.

### Fase 3 — Auth UI + Firebase Auth *(prossima da iniziare)*

Obiettivo: rendere l'app autenticabile, senza ancora sincronizzare dati. La modalità ospite resta attiva e identica all'attuale.

**Step 3.0 — Setup progetto Firebase [USER]** (~5 min)
1. Creare progetto su <https://console.firebase.google.com>.
2. Aggiungere "App Web" → copiare l'oggetto `firebaseConfig` (6 stringhe).
3. Authentication → abilitare provider **Email/Password** e **Google**.
4. Firestore Database → crearlo in modalità **production**, region `europe-west` (Belgio/Olanda — più vicina/conforme GDPR rispetto a `us-central1`).
5. Applicare le security rules di §5 (anche se in Fase 3 non scriveremo ancora su Firestore, le impostiamo subito).
6. Per Google Login su Android serviranno SHA-1/SHA-256 → si farà in Fase 6.x (post Firebase setup mobile).

**Step 3.1 — Dipendenze e config [DEV]**
- `npm install firebase` (Web SDK modulare).
- Creare `src/environments/firebase.config.ts` con i valori forniti dall'utente.
- Aggiungere il file a `.gitignore` se contiene chiavi che l'utente preferisce non committare (le chiavi client Firebase non sono segreti assoluti, ma è meglio tenerle fuori del repo pubblico).
- Aggiornare CSP in `index.html` / `_headers` per permettere `*.googleapis.com`, `*.firebaseio.com`, `*.firebaseapp.com`, `apis.google.com` (script/connect/frame-src dove serve).

**Step 3.2 — `FirebaseAppService` [DEV]**
- `src/services/firebase-app.service.ts`: singleton che chiama `initializeApp(firebaseConfig)` una volta sola, espone `auth`, `firestore` (preparato anche se non usato in Fase 3).
- Initialization lazy: solo quando l'utente sceglie qualcosa di diverso da "ospite", per non caricare Firebase a vuoto in modalità offline-only.

**Step 3.3 — `AuthService` [DEV]**
- `src/services/auth.service.ts` con stato signal-based:
  ```ts
  type AuthMode = 'loading' | 'guest' | 'authenticated' | 'email-not-verified';
  interface AuthState { mode: AuthMode; uid?: string; email?: string|null; displayName?: string|null; emailVerified?: boolean; }
  ```
- Metodi: `registerEmail`, `loginEmail`, `loginGoogle`, `sendVerificationEmail`, `reloadUser`, `sendPasswordReset`, `signOut`, `continueAsGuest`.
- `onAuthStateChanged` aggiorna lo state in un signal.
- Persistenza Auth: `browserLocalPersistence` (web) / default Capacitor (mobile, persistenza nativa di Firebase Auth JS è OK su Android via WebView).

**Step 3.4 — `AuthScreenComponent` [DEV]**
- `src/components/auth-screen.component.ts` (+ html) standalone, mobile-first, coerente con design system Tailwind esistente.
- Tab: **Accedi** / **Registrati** / **Recupera password**.
- Bottone Google (icona + testo).
- Bottone "Continua senza account" con disclaimer (chiave i18n `guestModeWarning`).
- Validazione client-side: email format, password ≥ 8 char.
- Stato error/loading per ogni azione; integrazione con `ToastService` per messaggi.
- i18n: aggiungere chiavi a `src/assets/i18n/{it,en}.json` (signIn, signUp, forgotPassword, continueWithoutAccount, guestModeWarning, emailNotVerifiedMessage, ecc.).

**Step 3.5 — `EmailVerificationScreenComponent` [DEV]**
- Componente dedicato per `mode === 'email-not-verified'`: messaggio chiaro, bottoni "Ho verificato" (chiama `reloadUser`) e "Reinvia email".
- Toast di conferma reinvio (rate limit lato client: 60s).

**Step 3.6 — Wiring in `AppComponent` [DEV]**
- `AuthService.state` consumato in template:
  ```html
  @switch (auth.state().mode) {
    @case ('loading') { <loading-screen/> }
    @case ('guest')           { <!-- app main attuale --> }
    @case ('authenticated')   { <!-- app main attuale, identica per ora --> }
    @case ('email-not-verified') { <email-verification-screen/> }
    @default { <auth-screen/> }
  }
  ```
- All'avvio: se non c'è user Firebase e non c'è preferenza salvata "guest", mostra auth-screen. Aggiungere chiave `localStorage` `easyturno.authMode` per ricordare la scelta "ospite" tra sessioni.
- Logout (in Settings) → riporta a auth-screen.

**Step 3.7 — Test [DEV]**
- Unit: mock di `firebase/auth` in `setup-jest.js`; test `AuthService` per ogni metodo (success + error path); test `AuthScreenComponent` per validazione e dispatch.
- E2E (Cypress / Playwright): rinviato — richiede Firebase Auth Emulator (preferibile in Fase 4 dove lo useremo anche per Firestore).

**Criteri di accettazione Fase 3**:
- App apre auth-screen al primo avvio.
- "Continua senza account" → app funziona come prima, dati locali invariati.
- Registrazione email/password → email di verifica ricevuta; finché non verificata l'utente vede `EmailVerificationScreenComponent`.
- Login dopo verifica → app principale (con dati ancora vuoti / locali separati per ora).
- Google login → entra direttamente in app (email considerata verificata).
- Reset password → email ricevuta.
- Logout funziona.
- Modalità ospite scelta una volta persiste tra reload.
- Nessuna scrittura su Firestore in questa fase.

---

### Fase 4 + 5b — Firestore sync + refactor serie/override *(da fare insieme)*

Le due fasi vanno insieme perché il refactor 5b adotta esattamente il modello dati Firestore (§4). Fare 4 senza 5b significherebbe duplicare la migrazione del modello.

Pianificazione di dettaglio pronta in [`docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md`](docs/superpowers/plans/2026-05-17-firestore-sync-series-overrides.md).

Punti chiave:
- Introduzione `ShiftSeries`, `ManualShift`, `ShiftOverride` in `shift.model.ts`.
- `UserDataService` come astrazione locale/cloud (signal-based).
- `SyncService` con stato `SyncStatus` visibile in UI (badge in header).
- Firestore SDK con `persistentLocalCache` (replica cache offline come fa AngularFire).
- Listener realtime per le 4 collezioni utente.
- Strategia conflitti: last-write-wins per documento + `updatedAt`.
- `DeviceService` con limite soft 4 dispositivi.
- `generateOccurrencesForRange(series, start, end)` puro, applica `ShiftOverride[]` per `modified` e `deleted`.
- E2E con Firebase Emulator Suite (Auth + Firestore).
- Migrazione: dati locali NON migrati automaticamente al primo login (come da §2.3); toast informativo.

---

### Fase 6.x — Chiusura Android *(parallelo, non blocca Fase 3/4)*

**Step 6.1 — JDK 21 [USER]** (~1 min)
- `sudo apt install openjdk-21-jdk && sudo update-alternatives --config java` (vedi §9.3.1).
- Verifica: `cd android && ./gradlew assembleDebug` → produce `app-debug.apk`.

**Step 6.2 — google-services.json [USER + DEV]** (richiede Fase 3 completata)
- Su Firebase Console: aggiungere app Android con package `com.spe1977.easyturno`.
- Scaricare `google-services.json` → posizionare in `android/app/`.
- Aggiungere SHA-1 (debug) and SHA-256 (release) per Google Login su Android.
- Aggiornare `android/build.gradle` e `android/app/build.gradle` con `com.google.gms.google-services` plugin.

**Step 6.3 — Push Notifications FCM ✅** (2026-05-20, Antigravity)
- `PushNotificationService` implementato con permessi e registrazione token.
- Token sincronizzato in Firestore su `users/{uid}/devices/{deviceId}`.
- Unit test: 509/509 verdi.
- Nota: richiede `google-services.json` per il funzionamento reale.

**Step 6.4 — Pre-pubblicazione Play Store [USER + DEV]** (quando l'utente attiverà l'account dev)
- Icone adaptive Android (foreground + background) sostitutive delle default Capacitor; possibile uso di `@capacitor/assets` per generare tutte le densità da una sorgente.
- Keystore release (Play App Signing): generazione, `keystore.properties` in `android/` (NON committato), `signingConfigs.release` in `build.gradle`.
- AAB: `./gradlew bundleRelease`.
- Screenshot, descrizioni, feature graphic per Play Console.

---

## 0. Obiettivo del lavoro

Realizzare tre evoluzioni dell'app **EasyTurnoPWA** senza riscrivere il progetto da zero:

1. Consolidare l'incapsulamento Android con **Capacitor** per pubblicazione su **Google Play Store**.
2. Aggiungere **registrazione, login, reset password, verifica email, Google Login e sincronizzazione online tramite Firebase**, mantenendo anche l'uso offline.
3. Modificare la visualizzazione dei turni per consultare:
   - turni passati fino a **12 mesi**;
   - turni futuri fino a **24 mesi dalla data odierna** per ricorrenze continuative;
   - ricerca data libera anche fuori da questi intervalli.

Il progetto deve rimanere compatibile con l'attuale funzionamento offline e con sviluppo locale su **Zorin OS**, usando le dipendenze/framework già presenti dove possibile.

---

## 1. Contesto tecnico rilevante della repository

Repository: `Spe1977/EasyTurnoPWA`  
Branch principale: `main`  
Stack attuale rilevato:

- Angular standalone app.
- Angular 21.
- TypeScript.
- Tailwind CSS.
- Capacitor già presente.
- Local notifications Capacitor già presenti.
- Persistenza attuale basata su `localStorage` cifrato.
- App attualmente principalmente offline.

File principali da analizzare prima di modificare:

```text
package.json
angular.json
capacitor.config.ts
index.tsx
src/app.component.ts
src/app.component.html
src/shift.model.ts
src/services/shift.service.ts
src/services/notification.service.ts
src/services/crypto.service.ts
src/services/toast.service.ts
src/services/translation.service.ts
src/components/*
src/pipes/*
```

Nota importante: non ricreare l'app. Modificare l'architettura esistente con interventi progressivi e testabili.

---

## 2. Vincoli funzionali

### 2.1 Modalità d'uso

L'app deve supportare due modalità:

```text
A. Utente autenticato
   - dati sincronizzati su Firebase;
   - dati disponibili su più dispositivi;
   - uso offline con sincronizzazione successiva.

B. Utente ospite / senza account
   - dati salvati solo sul dispositivo;
   - nessuna sincronizzazione cloud;
   - messaggio chiaro sui limiti della modalità offline locale.
```

All'avvio dell'app mostrare una schermata unica di autenticazione con:

- login email/password;
- registrazione email/password;
- reset password;
- login con Google;
- pulsante "Continua senza account";
- messaggio informativo sui dati locali se si continua senza account.

### 2.2 Flusso registrazione

Dopo la registrazione:

1. creare account Firebase Auth;
2. inviare email di verifica;
3. mostrare schermata/messaggio:

```text
Account creato. Controlla la tua email e conferma l'indirizzo prima di continuare.
```

4. dopo verifica email, portare l'utente alla creazione/configurazione dei turni.

Per Google Login, considerare l'email come verificata se Firebase la restituisce verificata.

### 2.3 Dati da sincronizzare

Sincronizzare tutti i dati inseriti dall'utente nell'app, inclusi almeno:

- turni;
- serie ricorrenti;
- modifiche manuali a singole date;
- straordinari;
- indennità;
- note;
- preferenze app utili alla continuità tra dispositivi;
- impostazioni notifiche, se compatibili;
- eventuali configurazioni future.

Non migrare automaticamente i dati offline già presenti prima della registrazione. Dopo registrazione/login l'utente ricrea i dati.

---

## 3. Firebase — Architettura richiesta

### 3.1 Piano Firebase

Usare inizialmente il piano gratuito Firebase/Spark.

Evitare implementazioni che richiedano obbligatoriamente il piano Blaze, come backend serverless complessi basati su Cloud Functions. Se una funzione richiede piano a pagamento, predisporla come fase futura, ma non renderla necessaria per la prima implementazione.

Servizi Firebase da usare nella prima fase:

```text
Firebase Authentication
Cloud Firestore
Firebase Cloud Messaging
Firebase Hosting, opzionale per versione web
```

### 3.2 Dipendenze suggerite

Aggiungere:

```bash
npm install firebase
npm install @capacitor/push-notifications
npx cap sync android
```

Valutare se usare AngularFire solo se pienamente compatibile con la versione Angular del progetto. In caso de dubbio, preferire Firebase Web SDK modulare diretto.

### 3.3 File ambiente Firebase

Creare una configurazione dedicata, senza committare segreti non necessari.

Esempio:

```text
src/environments/firebase.config.ts
```

Contenuto indicativo:

```ts
export const firebaseConfig = {
  apiKey: '...',
  authDomain: '...',
  projectId: '...',
  storageBucket: '...',
  messagingSenderId: '...',
  appId: '...',
};
```

Nota: le chiavi client Firebase non sono segreti assoluti, ma vanno comunque gestite ordinatamente.

### 3.4 Servizi Angular da creare

Creare almeno questi servizi:

```text
src/services/firebase-app.service.ts
src/services/auth.service.ts
src/services/sync.service.ts
src/services/device.service.ts
src/services/user-data.service.ts
```

Responsabilità:

#### `firebase-app.service.ts`

- inizializza Firebase;
- espone istanze `auth`, `firestore`, `messaging`;
- evita inizializzazioni multiple.

#### `auth.service.ts`

Gestisce:

- stato utente corrente;
- registrazione email/password;
- invio email verifica;
- login email/password;
- login Google;
- logout;
- reset password;
- reload utente per verificare `emailVerified`;
- modalità ospite.

Stato minimo:

```ts
type AuthMode = 'loading' | 'guest' | 'authenticated' | 'email-not-verified';

interface AuthState {
  mode: AuthMode;
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  emailVerified?: boolean;
}
```

#### `sync.service.ts`

Gestisce:

- caricamento dati utente da Firestore;
- salvataggio dati locali su Firestore;
- sincronizzazione offline/online;
- conflitti tra dispositivi;
- listener realtime Firestore;
- stato sync visibile all'utente.

Stati suggeriti:

```ts
type SyncStatus =
  | 'disabled'
  | 'loading'
  | 'synced'
  | 'pending'
  | 'offline'
  | 'error';
```

#### `device.service.ts`

Gestisce:

- identificativo dispositivo locale;
- registrazione dispositivo su Firestore;
- limite iniziale consigliato: **4 dispositivi per account**;
- aggiornamento `lastSeenAt`;
- token FCM per notifiche push.

Nota: il limite dispositivi in prima fase può essere un controllo applicativo "soft", non una garanzia di sicurezza assoluta, perché senza Cloud Functions è più difficile applicare limiti transazionali robusti.

#### `user-data.service.ts`

Astrazione tra:

```text
localStorage cifrato per ospite/offline
Firestore + cache locale per utente autenticato
```

Obiettivo: evitare che `AppComponent` dipenda direttamente da Firebase.

---

## 4. Firestore — Modello dati consigliato

Usare struttura per utente:

```text
users/{uid}
users/{uid}/profile/main
users/{uid}/devices/{deviceId}
users/{uid}/shiftSeries/{seriesId}
users/{uid}/shiftOverrides/{overrideId}
users/{uid}/manualShifts/{shiftId}
users/{uid}/settings/main
```

### 4.1 `users/{uid}/profile/main`

```ts
interface UserProfile {
  uid: string;
  email: string | null;
  displayName?: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  emailVerified: boolean;
}
```

### 4.2 `users/{uid}/devices/{deviceId}`

```ts
interface UserDevice {
  deviceId: string;
  platform: 'web' | 'android';
  name?: string;
  fcmToken?: string;
  enabled: boolean;
  createdAt: Timestamp;
  lastSeenAt: Timestamp;
}
```

### 4.3 `users/{uid}/shiftSeries/{seriesId}`

Salvare la definizione della serie, non tutte le istanze future.

```ts
interface ShiftSeries {
  id: string;
  title: string;
  start: string;
  end: string;
  color: ShiftColor;
  isRecurring: boolean;
  repetition?: Repetition;
  notes?: string;
  overtimeHours?: number;
  allowances?: Allowance[];
  timezone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deleted?: boolean;
}
```

### 4.4 `users/{uid}/manualShifts/{shiftId}`

Per turni singoli non ricorrenti o creati manualmente.

```ts
interface ManualShift {
  id: string;
  title: string;
  start: string;
  end: string;
  color: ShiftColor;
  notes?: string;
  overtimeHours?: number;
  allowances?: Allowance[];
  timezone?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  deleted?: boolean;
}
```

### 4.5 `users/{uid}/shiftOverrides/{overrideId}`

Per modifiche manuali su singole date di una serie.

```ts
interface ShiftOverride {
  id: string;
  seriesId: string;
  originalOccurrenceStart: string;
  action: 'modified' | 'deleted';
  replacementShift?: ManualShift;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

Questo evita di duplicare tutta la serie quando l'utente modifica o cancella un singolo turno.

### 4.6 `users/{uid}/settings/main`

```ts
interface UserSettings {
  theme?: 'light' | 'dark';
  language?: 'it' | 'en';
  notificationSettings?: unknown;
  updatedAt: Timestamp;
}
```

---

## 5. Firestore Security Rules

Implementare regole minime:

```js
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null
        && request.auth.uid == userId
        && request.auth.token.email_verified == true;
    }
  }
}
```

Note:

- gli utenti leggono/scrivono solo nel proprio namespace;
- richiedere email verificata per sincronizzare;
- la modalità ospite non accede a Firestore;
- eventuali regole più granulari vanno aggiunte dopo aver stabilizzato il modello dati.

---

## 6. Autenticazione — UI richiesta

Creare una schermata unica, chiara e mobile-first, prima dell'app principale.

Esempio componente:

```text
src/components/auth-screen.component.ts
src/components/auth-screen.component.html
```

Funzioni UI:

```text
Tab o sezioni:
- Accedi
- Registrati
- Password dimenticata
- Google Login
- Continua senza account
```

Messaggi obbligatori:

```text
Modalità senza account:
"I dati saranno salvati solo su questo dispositivo. Se disinstalli l'app, cancelli i dati del browser o cambi telefono, potresti perderli."

Email non verificata:
"Controlla la tua casella email e conferma l'indirizzo per attivare la sincronizzazione."
```

Nel template principale:

```html
@if (authState.mode === 'loading') {
  <loading-screen />
} @else if (authState.mode === 'guest') {
  <app-main />
} @else if (authState.mode === 'email-not-verified') {
  <email-verification-screen />
} @else if (authState.mode === 'authenticated') {
  <app-main />
} @else {
  <auth-screen />
}
```

Adattare la struttura reale del progetto, evitando routing se non necessario.

---

## 7. Offline-first e sincronizzazione

### 7.1 Principio

L'app deve funzionare anche senza connessione.

- In modalità ospite: usare il sistema attuale locale.
- In modalità autenticata: usare cache locale + Firestore.
- Quando torna online: sincronizzare modifiche pendenti.

### 7.2 Strategia consigliata

Implementare uno store applicativo unico:

```ts
interface AppDataSnapshot {
  shiftSeries: ShiftSeries[];
  manualShifts: ManualShift[];
  shiftOverrides: ShiftOverride[];
  settings: UserSettings;
  updatedAt: string;
}
```

Il vecchio `ShiftService` deve essere gradualmente trasformato:

Da:

```text
ShiftService = storage locale + generazione + CRUD
```

A:

```text
ShiftService = logica turni + generazione range visibile
UserDataService = persistenza locale/Firebase
SyncService = sincronizzazione Firestore
```

### 7.3 Conflitti

Prima fase:

- usare `updatedAt`;
- strategia "last write wins" per singoli record;
- non sovrascrivere tutto il dataset in blocco se possibile;
- preferire update per documento.

Fase futura:

- log modifiche;
- risoluzione conflitti più sofisticata;
- audit trail.

---

## 8. Scroll turni passati/futuri

> **Stato:** §8.1–§8.5 implementati come **Fase 5a** (vedi "Stato di avanzamento" in cima). §8.6–§8.7 (generazione on-demand + override system) rimandati a **Fase 5b**, da fare insieme alla Fase 4 (Firestore) per non duplicare il refactor del modello dati.

### 8.1 Requisiti

Modificare la vista lista turni:

```text
- apertura app: posizionata su oggi;
- mostra turni passati fino a 12 mesi;
- mostra turni futuri fino a 24 mesi da oggi;
- per ricorrenze perpetue generare solo il range visibile;
- mantenere ricerca per data specifica anche fuori dai limiti;
- mantenere attivo il pulsante di ricerca.
```

### 8.2 Problema attuale

Attualmente la lista standard mostra solo turni non conclusi. Serve una finestra temporale più ampia e bidirezionale.

### 8.3 Nuove costanti

Nel servizio dedicato alla generazione:

```ts
const PAST_MONTHS_VISIBLE = 12;
const FUTURE_MONTHS_VISIBLE = 24;
const INITIAL_LIST_SIZE = 50;
const LIST_LOAD_INCREMENT = 50;
```

### 8.4 Finestra standard

Calcolare:

```ts
function getDefaultVisibleRange(today = new Date()) {
  const start = startOfDay(addMonths(today, -12));
  const end = endOfDay(addMonths(today, 24));
  return { start, end };
}
```

La lista standard deve mostrare tutti i turni che intersecano questa finestra:

```ts
shift.start <= range.end && shift.end >= range.start
```

### 8.5 Ricerca data

La ricerca deve funzionare anche fuori dal range standard.

Comportamento:

- se l'utente cerca una data, mostrare i turni di quel giorno;
- se la data è fuori da -12/+24 mesi, non bloccare;
- eventualmente mostrare avviso informativo:

```text
"Data fuori dall'intervallo rapido. Risultati generati solo per il giorno selezionato."
```

### 8.6 Generazione ricorrenze

Non salvare tutte le ricorrenze future.

Implementare una funzione pura:

```ts
generateOccurrencesForRange(series, rangeStart, rangeEnd): Shift[]
```

Regole:

- prende una definizione di serie;
- genera solo le occorrenze che intersecano il range;
- applica override `modified` e `deleted`;
- non crea documenti Firestore per ogni ricorrenza futura;
- i turni passati già concretizzati/manuali restano salvati.

### 8.7 Modifiche manuali su singola data

Quando si modifica una singola occorrenza ricorrente:

- non duplicare tutta la serie;
- creare un documento `shiftOverrides`;
- azione `modified`;
- salvare il turno sostitutivo in `replacementShift`.

Quando si elimina una singola occorrenza:

- creare un documento `shiftOverrides`;
- azione `deleted`.

Quando si modifica l'intera serie:

- aggiornare `shiftSeries/{seriesId}`;
- mantenere gli override esistenti solo se ancora coerenti;
- se non coerenti, chiedere conferma o invalidarli con messaggio chiaro.

---

## 9. Capacitor Android e Play Store

### 9.1 Stato attuale

Il progetto ha già Capacitor installato e `capacitor.config.ts` presente. Consolidare la configurazione.

Valutare il package name:

```text
com.easyturno.app
```

È accettabile. Alternative più personali/proprietarie:

```text
it.easyturno.app
it.leospe.easyturno
com.spe1977.easyturno
```

Consiglio: usare `com.easyturno.app` solo se si intende mantenere un'identità prodotto generica. Se il nome EasyTurno non è controllato come dominio/marchio, `com.spe1977.easyturno` è più prudente.

### 9.2 Configurazione Capacitor

Verificare:

```ts
const config: CapacitorConfig = {
  appId: 'com.easyturno.app',
  appName: 'EasyTurno',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};
```

Controllare che `webDir` corrisponda all'output reale Angular.

### 9.3 Comandi

```bash
npm install
npm run build
npx cap sync android
npx cap open android
```

### 9.3.1 Prerequisito: JDK 21

Capacitor 8 e l'Android Gradle Plugin 8.x richiedono **JDK 21** per compilare. Con JDK 17 la build fallisce con:

```text
error: invalid source release: 21
```

**Su Ubuntu/Zorin OS** (consigliato, richiede sudo):

```bash
sudo apt update
sudo apt install openjdk-21-jdk
# imposta JDK 21 come default
sudo update-alternatives --config java
java -version   # deve mostrare 21.x
```

**Senza sudo (alternativa SDKMAN)**:

```bash
curl -s "https://get.sdkman.io" | bash
source "$HOME/.sdkman/bin/sdkman-init.sh"
sdk install java 21-tem
sdk default java 21-tem
java -version
```

Dopo l'installazione, dalla cartella `android/`:

```bash
./gradlew assembleDebug
# output: android/app/build/outputs/apk/debug/app-debug.apk
```

Installazione su dispositivo collegato via USB (debug ADB attivo):

```bash
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

Build debug:

```bash
cd android
./gradlew assembleDebug
```

Build release APK:

```bash
cd android
./gradlew assembleRelease
```

Build release AAB per Play Store:

```bash
cd android
./gradlew bundleRelease
```

Output tipico:

```text
android/app/build/outputs/bundle/release/app-release.aab
```

### 9.4 Firma release

Creare keystore:

```bash
keytool -genkeypair \
  -v \
  -keystore easyturno-release.keystore \
  -alias easyturno \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

Non committare:

```text
*.keystore
*.jks
keystore.properties
```

Configurare `android/keystore.properties`:

```properties
storeFile=../easyturno-release.keystore
storePassword=...
keyAlias=easyturno
keyPassword=...
```

Aggiornare `android/app/build.gradle` per usare `signingConfigs.release`.

### 9.5 Icone e splash screen

Includere:

- icona app adattiva Android;
- icona Play Store 512x512;
- feature graphic Play Store;
- splash screen coerente con colore brand;
- verifica modalità chiara/scura.

Usare asset dedicati, non icone provvisorie.

### 9.6 Notifiche

Il progetto ha già local notifications. Mantenere:

- notifiche locali per promemoria turni sul dispositivo;
- push notifications FCM per messaggi remoti/futuri.

Aggiungere Capacitor Push Notifications:

```bash
npm install @capacitor/push-notifications
npx cap sync android
```

Creare:

```text
src/services/push-notification.service.ts
```

Responsabilità:

- chiedere permessi;
- registrare token FCM;
- salvare token in `users/{uid}/devices/{deviceId}`;
- gestire refresh token;
- gestire notifiche ricevute;
- non rompere le notifiche locali esistenti.

Nota: l'invio automatico server-side di push personalizzate può richiedere backend. Nella prima fase predisporre registrazione token e ricezione, ma non rendere obbligatorio un backend a pagamento.

---

## 10. Firebase — Procedura creazione progetto da zero

### 10.1 Console Firebase

1. Creare progetto Firebase.
2. Aggiungere app Web.
3. Copiare configurazione Firebase.
4. Abilitare Authentication.
5. Abilitare provider:
   - Email/Password;
   - Google.
6. Abilitare Firestore Database.
7. Impostare Firestore in modalità production.
8. Applicare security rules.
9. Per Android:
   - aggiungere app Android con package scelto;
   - scaricare `google-services.json`;
   - posizionarlo in:

```text
android/app/google-services.json
```

10. Configurare SHA-1/SHA-256 se richiesti da Google Login Android.

### 10.2 Firebase Hosting opzionale

Se si vuole pubblicare anche versione web:

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
npm run build
firebase deploy
```

Configurare `dist` come directory build, se coerente con output Angular.

---

## 11. Test richiesti

### 11.1 Test auth

Verificare:

- registrazione email/password;
- invio email verifica;
- blocco sync se email non verificata;
- login dopo verifica;
- reset password;
- Google Login;
- logout;
- modalità ospite.

### 11.2 Test sync

Verificare:

- creazione turno su dispositivo A;
- visualizzazione su dispositivo B;
- modifica turno su dispositivo B;
- sincronizzazione su dispositivo A;
- uso offline e successiva riconnessione;
- conflitto semplice last-write-wins;
- limite soft dispositivi 4.

### 11.3 Test scroll

Verificare:

- apertura su oggi;
- visibilità turni passati fino a 12 mesi;
- visibilità turni futuri fino a 24 mesi;
- ricerca fuori range;
- ricorrenze generate dinamicamente;
- modifica singola occorrenza;
- eliminazione singola occorrenza;
- modifica intera serie.

### 11.4 Test Android

Verificare:

- `npm run build`;
- `npx cap sync android`;
- apertura Android Studio;
- build debug;
- build release;
- generazione `.aab`;
- installazione su dispositivo reale;
- notifiche locali;
- registrazione FCM token;
- login Google su Android;
- comportamento offline.

---

## 12. Piano operativo consigliato per l'LLM

### Fase 1 — Analisi

Prima di modificare:

1. leggere `package.json`;
2. leggere `capacitor.config.ts`;
3. leggere `src/app.component.ts`;
4. leggere `src/app.component.html`;
5. leggere `src/services/shift.service.ts`;
6. leggere `src/shift.model.ts`;
7. leggere servizi notifiche, crypto, toast, traduzioni;
8. identificare tutti i punti in cui i dati dei turni vengono creati, modificati, cancellati, esportati, importati e visualizzati.

### Fase 2 — Refactor minimo dati

1. Non rompere il salvataggio locale esistente.
2. Estrarre logica storage da `ShiftService` dove necessario.
3. Introdurre modelli per:
   - serie;
   - turni manuali;
   - override;
   - impostazioni;
   - dispositivi.
4. Mantenere compatibilità con `Shift` attuale nella UI.

### Fase 3 — Auth UI

1. Creare componente auth unico.
2. Integrare Firebase Auth.
3. Gestire modalità ospite.
4. Bloccare Firestore se email non verificata.
5. Mostrare messaggi chiari.

### Fase 4 — Firestore sync

1. Creare servizi Firebase.
2. Aggiungere persistenza offline.
3. Implementare CRUD Firestore per dati utente.
4. Collegare `ShiftService` a `UserDataService`.
5. Testare multi-dispositivo.

### Fase 5 — Scroll/generazione turni

1. ~~Sostituire generazione massiva ricorrenze future con generazione per range.~~ → **rimandato a Fase 5b** (vincolato al modello dati Firestore).
2. ✅ Implementare range standard -12/+24 mesi. *(Fase 5a, 2026-05-17)*
3. ✅ Mantenere ricerca libera. *(Fase 5a)*
4. ~~Applicare override.~~ → **rimandato a Fase 5b**.

### Fase 6 — Capacitor Android

1. Verificare configurazione Capacitor.
2. Integrare push notifications.
3. Configurare Firebase Android.
4. Preparare icone/splash.
5. Preparare firma release.
6. Generare `.aab`.

### Fase 7 — Test e pulizia

1. Eseguire lint/test/build.
2. Correggere TypeScript.
3. Aggiornare README con setup Firebase/Android.
4. Documentare variabili/configurazioni non committate.

---

## 13. Prompt operativo da fornire all'LLM sviluppatore

Usa il testo seguente come prompt principale:

```text
Devi modificare la repository EasyTurnoPWA senza riscriverla da zero.

Obiettivi:
1. Consolidare Capacitor Android per pubblicazione Play Store.
2. Implementare Firebase Auth con email/password, Google Login, reset password, verifica email e modalità ospite.
3. Implementare sincronizzazione Firebase/Firestore mantenendo funzionamento offline.
4. Modificare scroll e generazione turni: mostrare da 12 mesi nel passato a 24 mesi nel futuro dalla data odierna; mantenere ricerca data libera anche fuori range; generare ricorrenze future solo per il range visibile.
5. Preservare compatibilità con il comportamento offline attuale.

Prima di modificare, analizza:
- package.json
- angular.json
- capacitor.config.ts
- index.tsx
- src/app.component.ts
- src/app.component.html
- src/shift.model.ts
- src/services/shift.service.ts
- src/services/notification.service.ts
- src/services/crypto.service.ts
- servizi toast/traduzioni/componenti correlati

Vincoli:
- non eliminare funzionalità esistenti;
- non sostituire l'intera app;
- usare Angular standalone e stile esistente;
- mantenere UX semplice e mobile-first;
- modalità ospite obbligatoria;
- email verificata obbligatoria per sync cloud;
- usare Firebase Spark/free plan nella prima fase;
- evitare Cloud Functions obbligatorie;
- usare Firestore security rules per isolare i dati per uid;
- implementare limite iniziale soft di 4 dispositivi per account;
- mantenere notifiche locali e predisporre push notifications FCM;
- generare Android App Bundle .aab per Play Store.

Implementa in fasi piccole e testabili:
1. setup dipendenze Firebase/Push;
2. servizi Firebase/Auth;
3. auth screen;
4. modello dati Firestore;
5. sync offline;
6. refactor generazione turni;
7. Capacitor Android build/release;
8. test e documentazione.

Alla fine fornisci:
- elenco file modificati;
- comandi eseguiti;
- istruzioni Firebase console;
- istruzioni Android/Play Store;
- test manuali consigliati;
- eventuali limiti rimasti.
```

---

## 14. Criteri di accettazione

L'implementazione è accettabile solo se:

- l'app compila senza errori;
- l'utente può usare l'app senza account;
- l'utente può registrarsi con email/password;
- viene inviata email di verifica;
- l'utente non sincronizza finché l'email non è verificata;
- l'utente può fare login con Google;
- l'utente può resettare password;
- i dati autenticati sono salvati sotto `users/{uid}`;
- due dispositivi dello stesso account vedono gli stessi dati;
- l'app continua a funzionare offline;
- lo scroll mostra -12/+24 mesi;
- la ricerca data funziona anche fuori range;
- le ricorrenze perpetue non generano documenti infiniti;
- Android build debug funziona;
- Android release `.aab` viene generato;
- icone/splash/firma sono documentate;
- notifiche locali esistenti non vengono rotte;
- FCM token viene registrato per utente autenticato su Android.

---

## 15. Note finali

La priorità è trasformare EasyTurno da app solo locale a app offline-first con account opzionale.

La scelta più sicura è procedere per step:

1. mantenere intatto il salvataggio locale;
2. aggiungere auth;
3. aggiungere sync;
4. solo dopo modificare profondamente la generazione ricorrenze;
5. infine completare packaging Android/Play Store.

Evitare modifiche massive non necessarie.
