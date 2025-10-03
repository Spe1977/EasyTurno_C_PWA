// NOTE: This app uses zoneless change detection in production (provideZonelessChangeDetection)
// but jest-preset-angular still requires zone.js for TestBed compatibility
// See: https://angular.dev/guide/experimental/zoneless

import 'zone.js';
import 'zone.js/testing';
import { getTestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { registerLocaleData } from '@angular/common';
import localeIt from '@angular/common/locales/it';

// Register Italian locale for DatePipe tests
registerLocaleData(localeIt);

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());