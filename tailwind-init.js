/* Tailwind Play CDN runtime configuration.
   Loaded as an external script BEFORE the Tailwind CDN so that the
   dark-mode strategy is set before Tailwind starts processing the DOM.
   Keeping this in a separate file (rather than an inline <script>) lets
   the Content Security Policy omit 'unsafe-inline' from script-src. */
tailwind.config = {
  darkMode: 'class',
};
