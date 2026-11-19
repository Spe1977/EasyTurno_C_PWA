import { Injectable, signal } from '@angular/core';

// Import JSON translation files
import translationsIt from '../assets/i18n/it.json';
import translationsEn from '../assets/i18n/en.json';

type TranslationValue = string | Record<string, string | Record<string, string>>;
type Translations = Record<string, TranslationValue>;

@Injectable({ providedIn: 'root' })
export class TranslationService {
  language = signal<'it' | 'en'>(this.getInitialLanguage());

  private translations: Record<'it' | 'en', Translations> = {
    it: translationsIt as Translations,
    en: translationsEn as Translations,
  };
  private readonly translationCache: Record<'it' | 'en', Map<string, string>> = {
    it: new Map(),
    en: new Map(),
  };

  private getInitialLanguage(): 'it' | 'en' {
    const storedLang = localStorage.getItem('easyturno_lang');
    if (storedLang === 'it' || storedLang === 'en') {
      return storedLang;
    }
    const browserLang = navigator.language.split('-')[0];
    return browserLang === 'it' ? 'it' : 'en';
  }

  setLanguage(lang: 'it' | 'en') {
    this.language.set(lang);
    localStorage.setItem('easyturno_lang', lang);
  }

  translate(key: string): string {
    const lang = this.language();
    const langCache = this.translationCache[lang];
    const cached = langCache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    const keys = key.split('.');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let result: any = this.translations[lang];

    for (const k of keys) {
      if (typeof result === 'object' && result !== null && k in result) {
        result = result[k];
      } else {
        langCache.set(key, key);
        return key; // Return original key if path not found
      }
    }

    const resolved = typeof result === 'string' ? result : key;
    langCache.set(key, resolved);
    return resolved;
  }
}
