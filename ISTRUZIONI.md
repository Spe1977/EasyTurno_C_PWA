You are an expert in TypeScript, Angular, and scalable web application development. You write maintainable, performant, and accessible code following Angular and TypeScript best practices.
## TypeScript Best Practices
- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain
## Angular Best Practices
- Always use standalone components over NgModules
- Must NOT set `standalone: true` inside Angular decorators. It's the default.
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
  - `NgOptimizedImage` does not work for inline base64 images.
## Components
- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
## State Management
- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead
## Templates
- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
## Services
- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection


### REALIZZA LA SEGUENTE PWA:

## EasyTurno PWA completa e intuitiva per la gestione dei turni:

- Funzionalità Completamente Offline senza nessuna registrazione utente richiesta.
- Supporto Multilingue (Italiano e Inglese).
- Creazione turno singolo.
- Creazione di Turni Ripetitivi con Frequenze Personalizzabili con i seguenti parametri:
  Ogni 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20 giorni;
  Ogni 1, 2, 3, 4, 5, 6, 7,8, 9, 10 settimane;
  Ogni 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 mesi;
  Ogni 1, 2, 3, 4, 5 anni
- Modifica o Cancellazione del Turno Singolo.
- Modifica o Cancellazione di un Singolo Turno Appartenente a una Sequenza Ripetitiva.
- Modifica o Cancellazione di un'Intera Sequenza di Turni ripetitivi.
- Creazione di un Backup Esportabile e Importabile dei Turni Salvati.
- Funzione di Reset con Avviso per la Cancellazione di Tutti i Turni Salvati.
- UI e UX User-Friendly e Funzionali con Aspetto Grafico Moderno e Accattivante.
- Visualizzazione elegante in stile TO-DO List.
- Aggiunta di un pulsante “Cerca Data” per verificare quale turno di lavoro è previsto in una determinata data.
- Implementazione di un campo note nell'area di creazione dei turni singoli o ripetitivi.
- Switch automatico dalla modalità DD/MM/AAAA per la lingua italiana alla modalità YYYY/MM/DD per la lingua inglese, e viceversa.
- Personalizzazione dei turni tramite 8 colori diversi assegnabili ai turni singoli o alle sequenze di turni.

## Funzionalità Evolute: ✅ COMPLETATE
- ✅ Implementazione di un campo "Ore di Straordinario" nell'area di creazione dei turni singoli o ripetitivi.
- ✅ Implementazione di un campo "Indennità" nell'area di creazione dei turni singoli o ripetitivi, con la possibilità di scegliere di personalizzare il nome dell'indennità (supporta indennità multiple).
- ✅ Aggiunta del tasto "Statistiche" nel menù delle opzioni per calcolare i vari turni eseguiti, le ore lavorate, le ore di straordinario effettuate e le varie indennità maturate, in un determinato periodo scelto dall'utente.

## METODO DI LAVORO DA SEGUIRE ATTENTAMENTE!:
1 - Realizza EasyTurno gradualmente, suddividendo il lavoro in step logici consecutivi fra loro e alla fine di ogni step verifica se il codice che hai scritto non contenga errori e se può essere ottimizzato. Se trovi degli errori correggili.
2 - Nella scrittura del codice utilizza le migliori best practices per la realizzazione e lo sviluppo di PWA in TypeScript tramite il framework Angular 20 (o successivi).
3 - Aggiorna le tue conoscenze effettuando ricerche online per realizzare il progetto in modo altamente ottimizzato, stabile e sicuro, e per trovare le soluzioni più efficaci per la risoluzione di problemi, errori di codice e bug.
4 - L’applicazione deve essere perfettamente ottimizzata per un utilizzo che avverrà principalmente su dispositivi mobili come smartphone e tablet.

