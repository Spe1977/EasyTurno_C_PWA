import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'translate',
  standalone: true,
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);
  private lastKey: string | undefined;
  private lastLang: 'it' | 'en' | undefined;
  private lastValue = '';

  transform(key: string): string {
    if (typeof this.translationService.language !== 'function') {
      return this.translationService.translate(key);
    }

    const lang = this.translationService.language();
    if (key === this.lastKey && lang === this.lastLang) {
      return this.lastValue;
    }
    this.lastKey = key;
    this.lastLang = lang;
    this.lastValue = this.translationService.translate(key);
    return this.lastValue;
  }
}
