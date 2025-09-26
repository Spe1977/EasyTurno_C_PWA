
import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideZonelessChangeDetection } from '@angular/core';
import { AppComponent } from './src/app.component';
import { DatePipe, registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';

registerLocaleData(localeIt);

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    DatePipe
  ],
});

// AI Studio always uses an `index.tsx` file for all project types.