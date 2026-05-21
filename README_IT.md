# EasyTurno

PWA per la gestione dei turni di lavoro, offline-first, ottimizzata per mobile.

English documentation is available in [README.md](README.md).

<p align="center">
  <img src="screenshot/Screen1.jpg" width="200" alt="Lista turni" />
  <img src="screenshot/Screen2.jpg" width="200" alt="Creazione turno" />
  <img src="screenshot/Screen3.jpg" width="200" alt="Vista calendario" />
  <img src="screenshot/Screen4.jpg" width="200" alt="Statistiche" />
</p>

## Funzionalita principali

- Creazione, modifica e cancellazione turni singoli e ricorrenti (giornalieri, settimanali, mensili, annuali)
- Vista lista con ricerca per data e paginazione, vista calendario mensile con gesture swipe
- Tracciamento straordinari e indennita multiple per turno
- Dashboard statistiche con riepilogo ore, straordinari e indennita per periodo
- Backup/ripristino dati in formato JSON con validazione, con supporto a backup cifrati protetti da password
- Tema chiaro/scuro con rilevamento automatico preferenza di sistema
- Multilingua italiano/inglese
- Dati cifrati localmente con AES-GCM 256-bit
- Service worker con caching offline-first e rilevamento aggiornamenti PWA
- Notifiche locali su piattaforme native (Android via Capacitor)

## Stack tecnologico

| Tecnologia   | Versione |
| ------------ | -------- |
| Angular      | 21.2.13  |
| TypeScript   | 5.9.3    |
| Tailwind CSS | 4.2.2    |
| Capacitor    | 8.3.4    |
| Firebase     | 11.4.0   |
| Jest         | 30.3.0   |
| Playwright   | 1.58.2   |

## Avvio rapido

```bash
# Richiede Node.js 22+

# Installazione dipendenze
npm install

# Server di sviluppo (porta 3000)
npm run dev

# Build di produzione
npm run build

# Preview build di produzione
npm run preview
```

L'app di sviluppo e disponibile di default su `http://localhost:3000/`.

## Comandi utili

```bash
# Lint e formattazione
npm run lint            # Controlla errori ESLint
npm run lint:fix        # Correggi errori auto-fixabili
npm run format          # Formatta con Prettier
npm run format:check    # Verifica formattazione

# Test
npm test                # Unit test Jest (singola esecuzione)
npm run test:watch      # Unit test in watch mode
npm run test:coverage   # Report copertura (output in coverage/)
npm run e2e             # Avvia dev server + test E2E Cypress
npm run test:pw:install # Installa Chromium per Playwright
npm run test:pw         # Smoke test browser con Playwright
npm run test:pw:ui      # Playwright UI mode
npm run test:pw:headed  # Playwright headed mode
npx tsc --noEmit        # Type check standalone

# Mobile (Capacitor)
npm run build:mobile    # Build + sync Capacitor
npm run android:dev     # Apri Android Studio
```

## Architettura

L'applicazione usa standalone components Angular con signal-based state management e `OnPush` change detection.

```text
src/
  app.component.ts/html         # Componente principale, stato e modali
  shift.model.ts                # Interfacce Shift, Repetition, Allowance
  components/
    calendar.component.ts       # Vista calendario con touch gesture
    shift-list-item.component.ts  # Card turno
    toast-container.component.ts  # Notifiche toast
  services/
    shift.service.ts            # CRUD turni, ricorrenze, persistenza cifrata
    crypto.service.ts           # Cifratura AES-GCM 256-bit
    calendar.service.ts         # Navigazione calendario e griglia giorni
    translation.service.ts      # Internazionalizzazione
    notification.service.ts     # Notifiche locali native
    toast.service.ts            # Toast UI
    sw-update.service.ts        # Aggiornamenti PWA
  pipes/
    translate.pipe.ts           # Pipe traduzione
    date-format.pipe.ts         # Pipe date localizzate
  assets/i18n/                  # Traduzioni JSON (it.json, en.json)
```

## Sicurezza

- Dati cifrati con AES-GCM 256-bit in `localStorage`
- Chiave dispositivo persistita preferibilmente in IndexedDB; fallback legacy su `localStorage` solo dove IndexedDB non e disponibile
- Backup esportabili in formato cifrato con password utente (`PBKDF2` + `AES-GCM`)
- Content Security Policy (CSP) irrigidita, con eccezione `unsafe-inline` mantenuta in sviluppo locale per compatibilita con `ng serve`
- Migrazione automatica dati legacy non cifrati

### Modello di sicurezza

- **Dati a riposo** cifrati con una chiave AES-GCM 256-bit specifica del dispositivo. Quando IndexedDB e disponibile la chiave e salvata come **`CryptoKey` non estraibile** (`extractable: false`): i byte grezzi della chiave non escono mai dal contesto crittografico del browser. Un piccolo header sul ciphertext (`ETBLOB1:`) marca ogni record cifrato per consentire la migrazione trasparente dei formati legacy.
- **La chiave dispositivo e unica per questo profilo browser su questo dispositivo.** Non e derivata da una password e non e sincronizzata su alcun backend. Cancellare i dati del browser, cambiare device o perdere lo storage distrugge la chiave — e con essa la possibilita di leggere i turni cifrati. **Non esiste percorso di recovery** al di fuori del ripristino di un backup esportato in precedenza.
- **I backup cifrati** sono prodotti con `PBKDF2-SHA256` (600 000 iterazioni) + AES-GCM derivati dalla password utente. I backup creati prima dell'aumento a 600 000 iter (es. 250 000 iter) restano decifrabili grazie al campo `iterations` per-payload, ma i nuovi export usano sempre i parametri correnti. L'app **richiede sempre una password >= 12 caratteri** in export: **non esiste un percorso di export in chiaro**.
- **Gli import** accettano sia il formato protetto da password (caso normale) sia, solo per retrocompatibilita, file JSON legacy in chiaro. Subito dopo l'import i turni vengono ri-salvati nel formato cifrato locale.
- **Hardening server-side**: la build pubblica spedisce `_headers` (Cloudflare Pages / Netlify) con CSP strict, HSTS (`preload` + `includeSubDomains`), `X-Content-Type-Options`, COOP / CORP `same-origin`, `Permissions-Policy` restrittivo e `frame-ancestors 'none'`. La PWA non puo essere embeddata in iframe.
- **Raccomandazione**: esporta un backup cifrato non appena hai accumulato dati non banali. La prima volta che raggiungi **5 turni** l'app mostra un promemoria una tantum; puoi rilanciare l'export da Impostazioni in qualsiasi momento. Senza backup, un device perso o un profilo cancellato equivalgono a dati persi.

Nota importante:

- La cifratura dello storage locale protegge bene da letture casuali dei dati, ma non equivale a una protezione forte contro attaccanti che ottengono accesso al contesto browser dell'utente.
- Al momento la chiave usata per la cifratura locale e ancora gestita nello stesso contesto client dei dati; per questo il livello di protezione reale dello storage locale e inferiore a quello dei nuovi backup cifrati con password.
- Le due evoluzioni architetturali consigliate per chiudere questo limite sono:
  1. password utente per lo storage locale, con chiave derivata a ogni sblocco e mantenuta solo in memoria;
  2. secret esterno al `localStorage`, ad esempio backend autenticato o secure storage nativo via Capacitor.
- Tra le due, la prima e la soluzione consigliata per questo progetto per rapporto tra semplicita, sicurezza e affidabilita.

## Stato attuale

- Build verificata con Angular 21.2.13, TypeScript 5.9.3 e Tailwind CSS 4.2.2
- Sincronizzazione cloud con Firebase Firestore implementata e testata
- Autenticazione (Email/Password + Google Login) completa
- Unit test: **495+ verdi** (inclusi nuovi test per Sync, Auth, Firestore e Push Notifications)
- Playwright browser flows: 14/14 verdi (incluso smoke test di sincronizzazione)
- Emulator Suite Firebase integrata per test di integrazione
- Notifiche Push (FCM) configurate e testate su Android nativo
- Generazione icone adaptive, splash screen e Keystore di firma pronti per il Play Store
- Build e lint verificati puliti al 100%

## Sincronizzazione Firebase

Gli utenti ospite salvano i dati cifrati localmente. Gli utenti autenticati salvano serie, turni manuali e override in Firestore sotto `users/{uid}`. La cache offline Firestore consente l'uso senza rete e la sincronizzazione riprende quando la connessione torna disponibile.

### Limitazioni note
- Il limite di dispositivi per account è impostato a 4 (limite soft).
- La sincronizzazione richiede un account verificato via email o tramite provider Google.

## Firebase Emulator Suite

Per lo sviluppo e il testing locale della sincronizzazione e dell'autenticazione, il progetto integra la suite di emulatori Firebase:

```bash
# Avvia gli emulatori in locale (Auth e Firestore)
npm run emulators

# Esegue i test di integrazione Firebase agganciati all'emulatore locale
npm run test:firebase
```

## Sviluppo Mobile (Capacitor & Android)

EasyTurno supporta l'esportazione nativa per Android tramite **Capacitor 8**.

### Requisiti di sistema
- **JDK 21** (necessario per Capacitor 8 / Gradle)
- **Android SDK** configurato o Android Studio installato

### Comandi per lo sviluppo mobile

```bash
# Build dell'applicazione web e sincronizzazione degli asset con Android
npm run build:mobile

# Apri il progetto nativo in Android Studio per lo sviluppo/debug
npm run android:dev

# Genera la build di produzione firmata (Release APK)
npm run android:build
```

I file di firma (`release.keystore`), le configurazioni delle credenziali (`android/keystore.properties`) e il file di integrazione Google (`google-services.json`) sono esclusi dal tracciamento Git per motivi di sicurezza, ma sono pre-configurati nei file Gradle dell'applicazione.

## E2E Browser

Il progetto usa due livelli di test browser:

- Cypress per la suite E2E ampia gia esistente
- Playwright per smoke test rapidi su Chromium con server gestito automaticamente

File principali:

- `playwright.config.ts` - configurazione runner, browser e web server
- `playwright/tests/smoke.spec.ts` - smoke test su bootstrap app, toggle calendario e creazione turno
- `playwright/tests/app-flows.spec.ts` - flussi browser aggiuntivi: persistenza, CRUD base, tema/lingua, calendario, reset dati, modifica/cancellazione ricorrenze, rendering statistiche, backup/import cifrato con password e gestione errore import con password errata
- `playwright/tests/helpers.ts` - helper condivisi per bootstrap e creazione turno

## Licenza

[MIT](LICENSE) - Copyright (c) 2025 Leonardo
