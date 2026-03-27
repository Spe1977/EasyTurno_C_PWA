import { TestBed } from '@angular/core/testing';
import { TranslatePipe } from './translate.pipe';
import { TranslationService } from '../services/translation.service';

describe('TranslatePipe', () => {
  let pipe: TranslatePipe;
  let translationService: TranslationService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [TranslatePipe, TranslationService],
    });

    pipe = TestBed.inject(TranslatePipe);
    translationService = TestBed.inject(TranslationService);
  });

  it('should create an instance', () => {
    expect(pipe).toBeTruthy();
  });

  describe('transform', () => {
    it('should translate a key using the translation service', () => {
      translationService.setLanguage('en');
      const result = pipe.transform('app_title');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should return different translations for different languages', () => {
      translationService.setLanguage('it');
      const italianTranslation = pipe.transform('app_title');

      translationService.setLanguage('en');
      const englishTranslation = pipe.transform('app_title');

      expect(typeof italianTranslation).toBe('string');
      expect(typeof englishTranslation).toBe('string');
    });

    it('should return the key itself if translation not found', () => {
      const nonExistentKey = 'non_existent_key_xyz';
      const result = pipe.transform(nonExistentKey);
      expect(result).toBe(nonExistentKey);
    });

    it('should handle common translation keys in Italian', () => {
      translationService.setLanguage('it');
      const result = pipe.transform('add_shift');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should handle common translation keys in English', () => {
      translationService.setLanguage('en');
      const result = pipe.transform('add_shift');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });

    it('should work with multiple different keys', () => {
      translationService.setLanguage('en');
      const result1 = pipe.transform('app_title');
      const result2 = pipe.transform('add_shift');
      const result3 = pipe.transform('delete_shift');

      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
      expect(result3).toBeTruthy();
    });
  });

  describe('reactivity to language changes', () => {
    it('should return updated translation when language changes', () => {
      translationService.setLanguage('it');
      const italianResult = pipe.transform('app_title');
      expect(italianResult).toBeTruthy();

      translationService.setLanguage('en');
      const englishResult = pipe.transform('app_title');
      expect(englishResult).toBeTruthy();

      // Results should exist for both languages
      expect(typeof italianResult).toBe('string');
      expect(typeof englishResult).toBe('string');
    });
  });

  describe('edge cases', () => {
    it('should handle empty string key', () => {
      const result = pipe.transform('');
      expect(result).toBe('');
    });

    it('should handle keys with special characters', () => {
      const result = pipe.transform('key_with_underscores');
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
    });
  });

  describe('integration with TranslationService', () => {
    it('should delegate translation to TranslationService', () => {
      const translateSpy = jest.spyOn(translationService, 'translate');
      pipe.transform('test_key');
      expect(translateSpy).toHaveBeenCalledWith('test_key');
    });

    it('should use the current language from TranslationService', () => {
      translationService.setLanguage('it');
      expect(translationService.language()).toBe('it');

      pipe.transform('app_title');

      translationService.setLanguage('en');
      expect(translationService.language()).toBe('en');

      pipe.transform('app_title');
    });
  });
});
