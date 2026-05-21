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

// Mock Web Crypto API for Jest (used by CryptoService)
// This polyfill is needed because crypto.subtle is not available in jsdom
const { webcrypto } = require('node:crypto');
Object.defineProperty(globalThis, 'crypto', {
  value: webcrypto,
  writable: false,
  configurable: true,
});

// Mock TextEncoder/TextDecoder for Jest (used by CryptoService)
const { TextEncoder, TextDecoder } = require('node:util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// jsdom does not implement scrollIntoView; the app uses it for the
// "scroll to today" behavior on first load and via the "Oggi" button.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}

// Mock the Firebase JS SDK in unit tests. We never want tests to actually
// initialize Firebase, talk to the network, or read the user's session.
// AuthService and FirebaseAppService are wired but never instantiated in
// the current spec suite (kept for the Fase 3 wiring); these mocks make
// the import graph resolve cleanly under Node + jest-preset-angular.
jest.mock('firebase/app', () => ({
  initializeApp: jest.fn(() => ({ name: 'easyturno' })),
  getApps: jest.fn(() => []),
  getApp: jest.fn(() => {
    throw new Error('no default app');
  }),
  FirebaseError: class FirebaseError extends Error {
    constructor(code, message) {
      super(message);
      this.code = code;
    }
  },
}));

jest.mock('firebase/auth', () => ({
  getAuth: jest.fn(() => ({ currentUser: null })),
  setPersistence: jest.fn().mockResolvedValue(undefined),
  browserLocalPersistence: 'browserLocalPersistence',
  onAuthStateChanged: jest.fn((_auth, cb) => {
    // Fire once with null so AuthService transitions loading → unauthenticated.
    setTimeout(() => cb(null), 0);
    return () => {};
  }),
  createUserWithEmailAndPassword: jest.fn(),
  deleteUser: jest.fn().mockResolvedValue(undefined),
  EmailAuthProvider: {
    credential: jest.fn((email, password) => ({ email, password, providerId: 'password' })),
  },
  signInWithEmailAndPassword: jest.fn(),
  signInWithPopup: jest.fn(),
  reauthenticateWithCredential: jest.fn().mockResolvedValue(undefined),
  reauthenticateWithPopup: jest.fn().mockResolvedValue(undefined),
  GoogleAuthProvider: class GoogleAuthProvider {},
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  signOut: jest.fn().mockResolvedValue(undefined),
  reload: jest.fn().mockResolvedValue(undefined),
  updateProfile: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('firebase/firestore', () => ({
  getFirestore: jest.fn(() => ({})),
  initializeFirestore: jest.fn(() => ({})),
  persistentLocalCache: jest.fn(() => ({ kind: 'persistentLocalCache' })),
  collection: jest.fn((_db, path) => ({ path })),
  doc: jest.fn((_db, path) => ({ path })),
  onSnapshot: jest.fn(() => jest.fn()),
  getDocs: jest.fn().mockResolvedValue({ docs: [] }),
  writeBatch: jest.fn(() => ({
    set: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    commit: jest.fn().mockResolvedValue(undefined),
  })),
  serverTimestamp: jest.fn(() => 'serverTimestamp'),
}));

getTestBed().initTestEnvironment(BrowserDynamicTestingModule, platformBrowserDynamicTesting());
