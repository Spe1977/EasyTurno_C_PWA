# Design System - EasyTurno

## Visual Theme
L'applicazione implementa una dualità Light/Dark basata su tinte neutre fredde.
- **Light Mode**: Sfondo principale in Slate 100 (`#f1f5f9`), superfici di lavoro in Bianco puro (`#ffffff`), testi primari in Slate 900 (`#0f172a`).
- **Dark Mode**: Sfondo principale in Slate 900 (`#0f172a`), superfici di lavoro in Slate 800 (`#1e293b`), testi primari in Slate 100 (`#f1f5f9`).

## Color Palette
La palette cromatica è studiata per ridurre la saturazione estrema e favorire sfumature cromatiche in OKLCH o HSL bilanciate:
- **Primary / Accent**: Indigo (`#4f46e5` - `indigo-600`) per le azioni principali e lo stato attivo.
- **Shift Colors**: Sky, Green, Amber, Rose, Indigo, Teal, Fuchsia, Slate.
- **Success / Indicators**: Emerald per indicare il corretto allineamento dei dati e il completamento dei turni.

## Typography
- **Font Stack**: `system-ui`, `-apple-system`, `Segoe UI`, `Roboto`, `Helvetica Neue`, `Arial`, `sans-serif`.
- **Text Sizing**:
  - Headings: `text-2xl font-bold` (24px) o `text-lg font-bold` (18px) per sezioni.
  - Body: `text-base` (16px) per testi correnti, `text-sm` (14px) per etichette e metadati.
- **Line Length**: Limitata a `65-75ch` per ottimizzare la leggibilità.

## Layout & Motion
- **Rhythm**: Spaziature scalari (es. `p-4`, `p-6`, `space-y-6`) per stabilire una gerarchia visiva armoniosa.
- **Transitions**: Transizioni morbide (`transition-all duration-300 ease-out-quint`) per l'apertura delle modali e il filtraggio delle statistiche.
- **Shadows**: Ombre soffuse (`shadow-xl` / `shadow-2xl`) per separare le superfici fluttuanti dallo sfondo.
