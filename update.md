# update.md — Piano di manutenzione e aggiornamenti EasyTurno

Schema operativo per verificare gli aggiornamenti dell'app a cadenza regolare.
Obiettivo: tenere sicure e aggiornate dipendenze, framework e toolchain senza
introdurre regressioni.

- **Cadenza standard:** ogni **30 giorni** (sicurezza) e ogni **60 giorni** (versioni maggiori/native).
- **Regola d'oro:** aggiornare **un gruppo alla volta**, poi eseguire la verifica completa
  (`lint` + `test` + `build` + Playwright) prima di passare al gruppo successivo.
- **Mai aggiornare alla cieca:** leggere sempre il changelog/release notes dei major prima di salire di versione.

---

## 0. Routine rapida (da eseguire ad ogni check)

```bash
# 1. Fotografia dello stato attuale
npm outdated                 # cosa è arretrato (current vs wanted vs latest)
npm audit                    # vulnerabilità note

# 2. Aggiornamenti SICURI (entro i range semver del package.json: ^ e ~)
npm update                   # applica patch/minor compatibili
npm audit fix                # fix non-breaking delle vulnerabilità

# 3. Verifica completa OBBLIGATORIA dopo ogni aggiornamento
npm run lint
npm test
npm run build
npm run test:pw              # Playwright smoke (Chromium)

# 4. (Facoltativo) E2E completi
npm run e2e                  # Cypress + dev server
```

> I major (es. Angular 21 → 22) **non** vengono presi da `npm update`: vanno gestiti
> manualmente nella sezione dedicata sotto.

---

## 1. Cadenza per categoria

| Categoria | Cosa controllare | Cadenza | Rischio aggiornamento |
|---|---|---|---|
| **Sicurezza** | `npm audit`, advisory GitHub | **30 gg** | Basso (patch) |
| **Framework core** | Angular, TypeScript, Zone.js, RxJS | 60 gg | Alto (major) |
| **Build/Tooling** | Vite, @angular/build, ESLint, Prettier | 60 gg | Medio |
| **Testing** | Jest, jest-preset-angular, Cypress, Playwright | 60 gg | Medio |
| **Styling** | Tailwind CSS 4, PostCSS | 60 gg | Medio |
| **Backend/Cloud** | `firebase` SDK, `firebase-tools` | 30 gg | Medio |
| **Mobile/Native** | Capacitor, Android Gradle/AGP/SDK | 60 gg | Alto |
| **Runtime** | Node.js, npm | 60 gg | Medio |
| **PWA** | service worker, manifest, CSP | 60 gg | Basso |

---

## 2. Dettaglio aggiornamenti

### 2.1 Framework core — ⚠️ Major = lavoro manuale
Versioni attuali (vedi `package.json`):

- **Angular** `^21.2.5` — usare lo strumento ufficiale, **non** modificare a mano:
  ```bash
  ng update @angular/core @angular/cli   # mostra il piano di migrazione
  ```
  Salire **una major alla volta** (21 → 22 → 23). Controllare https://update.angular.dev
- **TypeScript** `~5.9.3` — vincolato alla versione supportata da Angular. Salire **solo** dopo Angular.
- **Zone.js** `^0.15.1` — allineato ad Angular; aggiornare insieme ad Angular.
- **RxJS** `^7.8.2` — verificare compatibilità con la versione Angular target.

> ⚠️ Angular, TypeScript, Zone.js e RxJS sono **interdipendenti**: aggiornarli come
> blocco unico seguendo la matrice di compatibilità Angular.

### 2.2 Build & Tooling
- **@angular/build** `^21.2.11` — segue la versione di Angular (`ng update`).
- **Vite** `^7.1.9` — gestito tramite `@angular/build`; verificare dopo gli update Angular.
- **ESLint** `^10.1.0` + **@typescript-eslint** `^8.45.0` — aggiornare in coppia (plugin + parser allineati).
- **Prettier** `^3.6.2` + **prettier-plugin-tailwindcss** `^0.8.0`.
- Dopo ogni aggiornamento tooling: `npm run lint` + `npm run format:check`.

### 2.3 Testing
- **Jest** `^30.2.0` + **jest-environment-jsdom** + **ts-jest** `^29.4.4` — aggiornare in blocco.
- **jest-preset-angular** `^16.1.1` — deve combaciare con la major di Angular.
- **Cypress** `^15.3.0` + **@cypress/angular** `^4.0.0`.
- **Playwright** `^1.58.2` — dopo l'update lanciare `npm run test:pw:install` (scarica i browser).
- Verifica: la suite Jest deve restare verde (riferimento storico ~686 test).

### 2.4 Styling
- **Tailwind CSS** `^4.2.2` + **@tailwindcss/postcss** `^4.2.2` + **PostCSS** `^8.5.6`.
- Tailwind 4 usa config CSS-first: dopo l'update controllare dark mode e la **safelist** dei colori dinamici dei turni.

### 2.5 Backend / Cloud (Firebase)
- **firebase** (SDK client) `^12.13.0` — usato a runtime: testare auth, Firestore `onSnapshot`/sync e `persistentLocalCache` dopo l'update.
- **firebase-tools** (CLI, dev-only) `^15.18.0` — usato solo per emulatori/deploy, **nessuna esposizione runtime**.
- Verifica sync: `npm run test:firebase` (emulatori auth+firestore).

### 2.6 Mobile / Native (Capacitor + Android) — ⚠️ verificare su device reale
Versioni attuali:

- **Capacitor** `^8.x` (core/cli/android + plugin app, haptics, local-notifications, push-notifications, share, splash-screen, status-bar).
  - Aggiornare tutti i pacchetti `@capacitor/*` **alla stessa major**, poi:
    ```bash
    npm run build:mobile     # build + cap sync
    ```
- **Android toolchain** (`android/`):
  - Gradle wrapper: **8.14.3**
  - Android Gradle Plugin (AGP): **8.13.0**
  - google-services: **4.4.4**
  - `compileSdk`/`targetSdk`: **36** · `minSdk`: **24**
  - ⚠️ **Google Play** impone periodicamente un `targetSdk` minimo: verificare la policy Play e alzare `targetSdkVersion` quando richiesto.
- Dopo qualsiasi update native: build APK release (`npm run android:build`) e test su dispositivo fisico (notifiche, haptics, splash, status bar).

### 2.7 Runtime
- **Node.js**: range richiesto `^20.19 || ^22.12 || >=24` (campo `engines`). In uso: Node 24 / npm 11.
- Tenere allineato il Node di **CI** (GitHub Actions in `.github/`) e di sviluppo locale.
- Aggiornare il vincolo `engines` quando si adotta una nuova LTS.

### 2.8 PWA
- Service worker (`sw.js`) e manifest: verificare che il flusso di update (`SwUpdateService`) funzioni dopo deploy.
- **CSP** in `_headers`/`index.html`: ricontrollare `connect-src` se cambiano endpoint Firebase o domini.

---

## 3. Rischi accettati / note correnti

- **firebase-tools → uuid <11.1.1** (GHSA-w5hq-g745-h8pq): 6 advisory `moderate` transitive.
  **Rischio accettato** — `firebase-tools` è dev/release-only, nessuna esposizione nella PWA/APK
  distribuita; l'unico fix è un downgrade breaking. Rivalutare solo quando esce una
  `firebase-tools` senza `uuid<11.1.1`. (Dettagli in `firebase.md`.)
- Override attivo in `package.json`: `handlebars: 4.7.9` (transitivo, motivi di sicurezza) — verificare se ancora necessario ai prossimi major.

---

## 4. Checklist di chiusura aggiornamento

Prima di considerare un ciclo di update completo:

- [ ] `npm outdated` rivisto e deciso cosa salire
- [ ] `npm audit` → 0 vulnerabilità nuove non accettate
- [ ] `npm run lint` pulito
- [ ] `npm test` verde
- [ ] `npm run build` ok (controllare anche la dimensione bundle)
- [ ] `npm run test:pw` verde
- [ ] (se native toccato) build APK + test su device reale
- [ ] `package-lock.json` committato
- [ ] Aggiornato il registro qui sotto

---

## 5. Registro dei check

| Data | Eseguito da | Categorie aggiornate | Esito | Note |
|---|---|---|---|---|
| 2026-05-25 | Claude Code | — (creazione documento) | baseline | Versioni iniziali registrate sopra |
