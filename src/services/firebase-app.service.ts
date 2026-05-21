import { Injectable } from '@angular/core';
import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, type Firestore } from 'firebase/firestore';

import { firebaseConfig } from '../environments/firebase.config';

const APP_NAME = 'easyturno';

@Injectable({ providedIn: 'root' })
export class FirebaseAppService {
  private app: FirebaseApp | null = null;
  private authInstance: Auth | null = null;
  private firestoreInstance: Firestore | null = null;

  initialize(): FirebaseApp {
    if (this.app) return this.app;
    const existing = getApps().find(a => a.name === APP_NAME);
    this.app = existing ?? initializeApp(firebaseConfig, APP_NAME);
    return this.app;
  }

  get isInitialized(): boolean {
    return this.app !== null;
  }

  get auth(): Auth {
    const app = this.initialize();
    this.authInstance ??= getAuth(app);
    return this.authInstance;
  }

  get firestore(): Firestore {
    const app = this.initialize();
    this.firestoreInstance ??= initializeFirestore(app, {
      localCache: persistentLocalCache(),
    });
    return this.firestoreInstance;
  }

  getApp(): FirebaseApp {
    return this.app ?? this.initialize();
  }

  hasGlobalDefaultApp(): boolean {
    try {
      getApp();
      return true;
    } catch {
      return false;
    }
  }
}
