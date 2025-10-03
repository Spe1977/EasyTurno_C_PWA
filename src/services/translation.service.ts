import { Injectable, signal } from '@angular/core';

// Import JSON translation files
import translationsIt from '../assets/i18n/it.json';
import translationsEn from '../assets/i18n/en.json';

@Injectable({ providedIn: 'root' })
export class TranslationService {
  language = signal<'it' | 'en'>(this.getInitialLanguage());

  private translations: Record<'it' | 'en', Record<string, string>> = {
    it: translationsIt,
    en: translationsEn,
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
    return this.translations[this.language()][key] || key;
  }
}
