import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslationService } from '../services/translation.service';

const MAX_SHARED_DATE_CACHE_ENTRIES = 1000;
const sharedDateCache = new WeakMap<DatePipe, Map<string, string | null>>();

@Pipe({
  name: 'langDate',
  standalone: true,
  pure: false,
})
export class LangDatePipe implements PipeTransform {
  private translationService = inject(TranslationService);
  private datePipe = inject(DatePipe);
  private hasCached = false;
  private lastValueKey: string | number | null | undefined;
  private lastFormat = '';
  private lastLang: 'it' | 'en' | undefined;
  private lastResult: string | null = null;

  transform(
    value: Date | string | number | null | undefined,
    format: string = 'mediumDate'
  ): string | null {
    if (value === null || value === undefined) {
      return null;
    }

    const lang =
      typeof this.translationService.language === 'function'
        ? this.translationService.language()
        : 'en';
    const valueKey = value instanceof Date ? value.getTime() : value;

    if (
      this.hasCached &&
      this.lastLang === lang &&
      this.lastFormat === format &&
      Object.is(this.lastValueKey, valueKey)
    ) {
      return this.lastResult;
    }

    let sharedMap = sharedDateCache.get(this.datePipe);
    if (!sharedMap) {
      sharedMap = new Map<string, string | null>();
      sharedDateCache.set(this.datePipe, sharedMap);
    }

    const cacheable = !(typeof valueKey === 'number' && Number.isNaN(valueKey));
    const sharedKey = cacheable ? `${lang}|${format}|${typeof valueKey}:${valueKey}` : '';

    let formatted: string | null;
    if (cacheable && sharedMap.has(sharedKey)) {
      formatted = sharedMap.get(sharedKey)!;
    } else {
      const locale = lang === 'it' ? 'it-IT' : 'en-US';
      const dateFormat = this.resolveDateFormat(lang, format);
      formatted = this.datePipe.transform(value, dateFormat, undefined, locale);

      if (cacheable) {
        if (sharedMap.size >= MAX_SHARED_DATE_CACHE_ENTRIES) {
          const oldestKey = sharedMap.keys().next().value;
          sharedMap.delete(oldestKey!);
        }
        sharedMap.set(sharedKey, formatted);
      }
    }

    this.hasCached = true;
    this.lastValueKey = valueKey;
    this.lastFormat = format;
    this.lastLang = lang;
    this.lastResult = formatted;

    return formatted;
  }

  private resolveDateFormat(lang: 'it' | 'en', format: string): string {
    switch (format) {
      case 'shortDate':
        return lang === 'it' ? 'dd/MM/yyyy' : 'MM/dd/yyyy';
      case 'dayNumber':
        return 'd';
      case 'shortMonthName':
        return 'MMM';
      case 'shortMonthAndYear':
        return 'MMM yy';
      case 'shortDayName':
        return 'EEE';
      case 'time':
        return 'HH:mm';
      default: // 'mediumDate'
        return lang === 'it' ? 'dd/MM/yyyy' : 'yyyy-MM-dd';
    }
  }
}
