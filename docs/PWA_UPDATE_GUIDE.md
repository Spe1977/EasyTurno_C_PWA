# PWA Update Guide - EasyTurno

## 📱 Come Funziona l'Aggiornamento della PWA

### Panoramica

La PWA EasyTurno si aggiorna automaticamente utilizzando il Service Worker, ma richiede alcuni passaggi per essere completato.

---

## 🔄 Processo di Aggiornamento

### 1. Deploy su Cloudflare
Quando fai push su GitHub:
1. Cloudflare rileva i cambiamenti
2. Esegue il build della nuova versione
3. Deploy automatico su produzione

### 2. Rilevamento Aggiornamenti (Smartphone)
Quando l'utente apre l'app:
1. Il browser controlla automaticamente `sw.js`
2. Se rileva una versione diversa, scarica il nuovo Service Worker
3. Il nuovo Service Worker entra in stato "waiting"
4. L'app mostra il **banner di aggiornamento**

### 3. Installazione Aggiornamento
L'utente clicca su "Aggiorna Ora":
1. Il Service Worker attivo viene sostituito
2. La vecchia cache viene eliminata
3. La nuova cache viene popolata
4. L'app si ricarica automaticamente
5. ✅ Aggiornamento completato!

---

## 🛠️ Come Fare il Deploy di un Aggiornamento

### Passaggi Obbligatori

#### 1. **Incrementa la versione della cache**

```javascript
// sw.js - CAMBIA QUESTO AD OGNI DEPLOY
const CACHE_NAME = 'easyturno-cache-v5'; // Era v4, ora v5
```

⚠️ **IMPORTANTE**: Se non cambi questo, l'app NON si aggiorna!

#### 2. **Commit e Push**

```bash
# Incrementa versione cache
git add sw.js

# Commit con messaggio chiaro
git commit -m "chore: Bump cache version to v5 for update"

# Push su GitHub
git push origin main
```

#### 3. **Cloudflare Deploy Automatico**

Cloudflare rileva il push e fa il deploy automaticamente (circa 1-2 minuti)

#### 4. **Verifica Deploy**

Visita il sito web e controlla:
```javascript
// DevTools > Application > Service Workers
// Verifica che la versione sia aggiornata
```

---

## 📋 Checklist Deploy

### Prima del Deploy
- [ ] Tutti i test passano (`npm test`)
- [ ] Build production funziona (`npm run build`)
- [ ] Incrementata versione cache in `sw.js`
- [ ] Commit creato con messaggio descrittivo

### Dopo il Deploy
- [ ] Cloudflare ha completato il deploy
- [ ] Sito web mostra la nuova versione
- [ ] Service Worker versione aggiornata (DevTools)

### Verifica su Smartphone
- [ ] Aprire l'app PWA installata
- [ ] Aspettare il banner "Nuova versione disponibile"
- [ ] Cliccare "Aggiorna Ora"
- [ ] App si ricarica con nuova versione
- [ ] Verificare che le modifiche siano visibili

---

## 🐛 Troubleshooting

### L'app non mostra il banner di aggiornamento

**Problema**: Hai fatto il deploy ma l'app non mostra il banner

**Soluzioni**:

1. **Verifica versione cache**
   ```bash
   # Controlla sw.js
   grep "CACHE_NAME" sw.js
   # Output: const CACHE_NAME = 'easyturno-cache-vX';
   ```
   Se la versione non è cambiata, incrementala e ri-deploya

2. **Forza aggiornamento Service Worker**
   - Apri DevTools > Application > Service Workers
   - Clicca "Update" accanto al Service Worker
   - Clicca "Skip waiting" se appare

3. **Cancella cache manualmente** (ultimo resort)
   - DevTools > Application > Clear storage
   - Seleziona "Service workers" e "Cache storage"
   - Clicca "Clear site data"
   - Ricarica pagina

### L'app non si aggiorna dopo aver cliccato "Aggiorna Ora"

**Problema**: Cliccato sul banner ma l'app non si aggiorna

**Soluzioni**:

1. **Chiudi e riapri l'app completamente**
   - Chiudi tutte le tab/finestre dell'app
   - Riapri l'app

2. **Cancella e reinstalla PWA**
   - Disinstalla PWA dallo smartphone
   - Visita sito web via browser
   - Reinstalla PWA

### Il banner appare continuamente

**Problema**: Il banner di aggiornamento si ripresenta sempre

**Causa**: Il Service Worker ha un problema di attivazione

**Soluzione**:
```javascript
// Verifica in sw.js che ci sia:
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting(); // ← Questo è essenziale
    }
});
```

---

## 🔧 Configurazione Avanzata

### Cambio Strategia di Update

#### Opzione 1: Update Silenzioso (Attuale)
L'utente vede un banner e decide quando aggiornare

**Pro**: Utente ha controllo
**Contro**: Può rimandare indefinitamente

#### Opzione 2: Update Forzato
L'app si aggiorna automaticamente senza chiedere

```typescript
// src/services/sw-update.service.ts
newWorker?.addEventListener('statechange', () => {
  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
    // Attiva immediatamente senza chiedere
    this.activateUpdate();
  }
});
```

**Pro**: Sempre aggiornato
**Contro**: Interruzione UX

#### Opzione 3: Update su Idle
Aggiorna quando l'utente è inattivo

```typescript
let idleTimer: number;

window.addEventListener('mousemove', () => {
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (this.updateAvailable()) {
      this.activateUpdate();
    }
  }, 30000); // 30 secondi di inattività
});
```

---

## 📊 Monitoraggio Aggiornamenti

### Verifica Versione Corrente

```javascript
// Console browser
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('Service Worker version:', reg?.active?.scriptURL);
});
```

### Log Aggiornamenti

Il Service Worker logga automaticamente:
```javascript
// Console
"Opened cache and caching assets" // ← Cache popolata
"Clearing old cache: easyturno-cache-v3" // ← Vecchia cache rimossa
"New Service Worker activated, reloading..." // ← Aggiornamento attivato
```

---

## 📝 Best Practices

### 1. **Versioning Semantico**

```javascript
// Usa semantic versioning per la cache
const CACHE_NAME = 'easyturno-cache-v1.2.3';
//                                    ^ ^ ^
//                                    | | |
//                        Major -----+ | |
//                        Minor -------+ |
//                        Patch ---------+
```

- **Major** (v2.0.0): Breaking changes
- **Minor** (v1.2.0): Nuove features
- **Patch** (v1.1.1): Bug fixes

### 2. **Comunicare gli Aggiornamenti**

Nel messaggio del banner, specifica cosa è nuovo:
```typescript
// Personalizza il messaggio
updateAvailableDesc = "Nuova feature: Statistiche avanzate";
```

### 3. **Testare Prima del Deploy**

```bash
# Test locale
npm run dev
# Apri http://localhost:3000
# Verifica funzionalità

# Build production
npm run build
npm run preview
# Verifica build ottimizzata
```

### 4. **Changelog Dettagliato**

Mantieni un CHANGELOG.md:
```markdown
# Changelog

## [v1.2.0] - 2025-10-03
### Added
- Service Worker update banner
- Automatic update detection
- User-controlled update activation

### Changed
- Cache version bumped to v4
```

---

## 🚀 Automazione (Opzionale)

### Script di Deploy Automatico

```bash
#!/bin/bash
# deploy.sh

# Incrementa automaticamente versione
OLD_VERSION=$(grep -oP 'easyturno-cache-v\K[0-9]+' sw.js)
NEW_VERSION=$((OLD_VERSION + 1))
sed -i "s/easyturno-cache-v$OLD_VERSION/easyturno-cache-v$NEW_VERSION/" sw.js

echo "Cache version bumped: v$OLD_VERSION → v$NEW_VERSION"

# Commit e push
git add sw.js
git commit -m "chore: Bump cache version to v$NEW_VERSION"
git push origin main

echo "✅ Deploy initiated!"
```

Uso:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## 📞 Supporto

Per problemi con gli aggiornamenti:
1. Verifica questa guida
2. Controlla DevTools console per errori
3. Apri issue su GitHub con log completi

---

## 🎯 Riepilogo Rapido

### Per Aggiornare l'App:

1. **Modifica codice** ✏️
2. **Incrementa versione cache** in `sw.js` 🔢
3. **Commit e push** su GitHub 📤
4. **Cloudflare fa deploy** (automatico) ☁️
5. **Utenti vedono banner** quando aprono app 📱
6. **Cliccano "Aggiorna Ora"** 👆
7. **App si ricarica** con nuova versione ✅

**Tempo totale**: 2-5 minuti dal push all'aggiornamento utente

---

**Ultimo aggiornamento**: 2025-10-03
**Service Worker versione corrente**: v4
