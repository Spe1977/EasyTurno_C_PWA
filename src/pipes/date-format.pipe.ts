
import { Pipe, PipeTransform, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { TranslationService } from '../services/translation.service';

@Pipe({
  name: 'langDate',
  standalone: true,
  pure: false
})
export class LangDatePipe implements PipeTransform {
  private translationService = inject(TranslationService);
  private datePipe = inject(DatePipe);

  transform(value: any, format: string = 'mediumDate'): any {
    const lang = this.translationService.language();
    const locale = lang === 'it' ? 'it-IT' : 'en-US';
    let dateFormat: string;

    switch(format){
        case 'shortDate':
            dateFormat = lang === 'it' ? 'dd/MM/yyyy' : 'MM/dd/yyyy';
            break;
        case 'dayMonth':
             dateFormat = lang === 'it' ? 'd MMM' : 'MMM d';
             break;
        case 'monthYear':
             dateFormat = 'MMMM yyyy';
             break;
        case 'dayNumber':
             dateFormat = 'd';
             break;
        case 'shortDayName':
             dateFormat = 'EEE';
             break;
        case 'shortMonthName':
             dateFormat = 'MMM';
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