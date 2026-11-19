import { Injectable } from '@angular/core';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

import { firebaseConfig } from '../environments/firebase.config';
import { createLazyLoader } from '../utils/lazy-loader';

const APP_NAME = 'easyturno';

@Injectable({ providedIn: 'root' })
export class FirebaseAppService {
  private app: FirebaseApp | null = null;

  private readonly loadApp = createLazyLoader(async () => {
    const { initializeApp, getApps } = await import('firebase/app');
    const existing = getApps().find(a => a.name === APP_NAME);
    this.app = existing ?? initializeApp(firebaseConfig, APP_NAME);
    return this.app;
  });

  private readonly loadAuth = createLazyLoader(async () => {
    const [app, { getAuth }] = await Promise.all([this.initialize(), import('firebase/auth')]);
    return getAuth(app);
  });

  private readonly loadFirestore = createLazyLoader(async () => {
    const [app, { initializeFirestore, persistentLocalCache }] = await Promise.all([
      this.initialize(),
      import('firebase/firestore'),
    ]);
    return initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
  });

  initialize(): Promise<FirebaseApp> {
    return this.loadApp();
  }

  get isInitialized(): boolean {
    return this.app !== null;
  }

  getAuth(): Promise<Auth> {
    return this.loadAuth();
  }

  getFirestore(): Promise<Firestore> {
    return this.loadFirestore();
  }

  getApp(): Promise<FirebaseApp> {
    return this.initialize();
  }

  async hasGlobalDefaultApp(): Promise<boolean> {
    try {
      const { getApp } = await import('firebase/app');
      getApp();
      return true;
    } catch {
      return false;
    }
  }
}
