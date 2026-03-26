import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'langDate',
  standalone: true,
  // pure: false is intentional — the formatted output depends on
  // TranslationService.language() (a runtime signal) to choose locale and
  // date-format pattern (e.g. dd/MM/yyyy vs MM/dd/yyyy).  A pure pipe would
  // cache the result keyed on (value, format) and ignore locale changes, so
  // dates would not reformat when the user switches language.
  pure: false,
})
export class LangDatePipe implements PipeTransform {
  private translationService = inject(TranslationService);
  private datePipe = inject(DatePipe);

  transform(
    value: Date | string | number | null | undefined,
    format: string = 'mediumDate'
  ): string | null {
    const lang = this.translationService.language();
    const locale = lang === 'it' ? 'it-IT' : 'en-US';
    let dateFormat: string;

    switch (format) {
      case 'shortDate':
        dateFormat = lang === 'it' ? 'dd/MM/yyyy' : 'MM/dd/yyyy';
        break;
      case 'dayNumber':
        dateFormat = 'd';
        break;
      case 'shortMonthName':
        dateFormat = 'MMM';
        break;
      case 'shortMonthAndYear':
        dateFormat = 'MMM yy';
        break;
      case 'shortDayName':
        dateFormat = 'EEE';
        break;
      case 'time':
        dateFormat = 'HH:mm';
        break;
      default: // 'mediumDate'
        dateFormat = lang === 'it' ? 'dd/MM/yyyy' : 'yyyy-MM-dd';
        break;
    }

    return this.datePipe.transform(value, dateFormat, undefined, locale);
  }
}
