import { Pipe, PipeTransform } from '@angular/core';
import { TranslationService } from '../services/translation.service';
import { inject } from '@angular/core';

@Pipe({
  name: 'translate',
  standalone: true,
  // pure: false is intentional — the pipe reads TranslationService.language()
  // which is a signal that changes at runtime when the user switches language.
  // A pure pipe would be memoised on its inputs (the translation key string),
  // so it would never re-run when the language changes even though the output
  // should be different.  Marking it impure ensures Angular re-evaluates it
  // on every change-detection cycle, keeping the UI in sync with the language.
  pure: false,
})
export class TranslatePipe implements PipeTransform {
  private translationService = inject(TranslationService);

  transform(key: string): string {
    return this.translationService.translate(key);
  }
}
