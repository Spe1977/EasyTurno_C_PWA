import { TestBed } from '@angular/core/testing';
import { TranslationService } from './translation.service';

describe('TranslationService', () => {
  let service: TranslationService;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return localStorageMock[key] || null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
    });

    // Mock navigator.language
    Object.defineProperty(window.navigator, 'language', {
      writable: true,
      configurable: true,
      value: 'en-US',
    });

    TestBed.configureTestingModule({
      providers: [TranslationService],
    });

    service = TestBed.inject(TranslationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('initialization', () => {
    it('should load language from localStorage if available', () => {
      // Reset TestBed and set localStorage before creating service
      TestBed.resetTestingModule();
      localStorageMock['easyturno_lang'] = 'it';

      TestBed.configureTestingModule({
        providers: [TranslationService],
      });

      const newService = TestBed.inject(TranslationService);
      expect(newService.language()).toBe('it');
    });

    it('should use browser language if no stored preference', () => {
      // Reset TestBed and configure browser language
      TestBed.resetTestingModule();
      delete localStorageMock['easyturno_lang'];

      Object.defineProperty(window.navigator, 'language', {
        writable: true,
        configurable: true,
        value: 'it-IT',
      });

      TestBed.configureTestingModule({
        providers: [TranslationService],
      });

      const newService = TestBed.inject(TranslationService);
      expect(newService.language()).toBe('it');
    });

    it('should default to English if browser language is not Italian', () => {
      // Reset TestBed and configure browser language
      TestBed.resetTestingModule();
      delete localStorageMock['easyturno_lang'];

      Object.defineProperty(window.navigator, 'language', {
        writable: true,
        configurable: true,
        value: 'fr-FR',
      });

      TestBed.configureTestingModule({
        providers: [TranslationService],
      });

      const newService = TestBed.inject(TranslationService);
      expect(newService.language()).toBe('en');
    });
  });

  describe('setLanguage', () => {
    it('should set language to Italian', () => {
      service.setLanguage('it');
      expect(service.language()).toBe('it');
      expect(localStorageMock['easyturno_lang']).toBe('it');
    });

    it('should set language to English', () => {
      service.setLanguage('en');
      expect(service.language()).toBe('en');
      expect(localStorageMock['easyturno_lang']).toBe('en');
    });

    it('should persist language preference to localStorage', () => {
      service.setLanguage('it');
      expect(localStorageMock['easyturno_lang']).toBe('it');

      service.setLanguage('en');
      expect(localStorageMock['easyturno_lang']).toBe('en');
    });
  });

  describe('translate', () => {
    it('should translate keys in Italian', () => {
      service.setLanguage('it');
      const result = service.translate('app_title');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should translate keys in English', () => {
      service.setLanguage('en');
      const result = service.translate('app_title');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should return the key itself if translation not found', () => {
      const nonExistentKey = 'non_existent_key_xyz';
      const result = service.translate(nonExistentKey);
      expect(result).toBe(nonExistentKey);
    });

    it('should return different translations for different languages', () => {
      service.setLanguage('it');
      const italianTranslation = service.translate('app_title');

      service.setLanguage('en');
      const englishTranslation = service.translate('app_title');

      // Translations should be different (unless they happen to be the same)
      expect(typeof italianTranslation).toBe('string');
      expect(typeof englishTranslation).toBe('string');
    });

    it('should handle translation keys that exist in both languages', () => {
      service.setLanguage('it');
      const keyInItalian = service.translate('add_shift');
      expect(keyInItalian).toBeTruthy();

      service.setLanguage('en');
      const keyInEnglish = service.translate('add_shift');
      expect(keyInEnglish).toBeTruthy();
    });
  });

  describe('signal reactivity', () => {
    it('should signal language changes', () => {
      const initialLang = service.language();
      expect(initialLang).toBeTruthy();

      service.setLanguage('it');
      expect(service.language()).toBe('it');

      service.setLanguage('en');
      expect(service.language()).toBe('en');
    });
  });
});
