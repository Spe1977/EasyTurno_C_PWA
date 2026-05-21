import { TestBed } from '@angular/core/testing';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache } from 'firebase/firestore';

import { FirebaseAppService } from './firebase-app.service';
import { firebaseConfig } from '../environments/firebase.config';

describe('FirebaseAppService', () => {
  let service: FirebaseAppService;

  beforeEach(() => {
    jest.clearAllMocks();
    (getApps as jest.Mock).mockReturnValue([]);
    TestBed.configureTestingModule({});
    service = TestBed.inject(FirebaseAppService);
  });

  it('should initialize the named Firebase app once', () => {
    const app = { name: 'easyturno' };
    (initializeApp as jest.Mock).mockReturnValue(app);

    expect(service.initialize()).toBe(app);
    expect(service.initialize()).toBe(app);
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig, 'easyturno');
  });

  it('should reuse an existing named app instead of creating a new one', () => {
    const existingApp = { name: 'easyturno' };
    (getApps as jest.Mock).mockReturnValue([{ name: 'other' }, existingApp]);

    expect(service.initialize()).toBe(existingApp);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('should cache auth and firestore instances lazily', () => {
    const app = { name: 'easyturno' };
    const auth = { currentUser: null };
    const firestore = { app };
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getAuth as jest.Mock).mockReturnValue(auth);
    (persistentLocalCache as jest.Mock).mockReturnValue({ kind: 'persistentLocalCache' });
    (initializeFirestore as jest.Mock).mockReturnValue(firestore);

    expect(service.auth).toBe(auth);
    expect(service.auth).toBe(auth);
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(getAuth).toHaveBeenCalledWith(app);

    expect(service.firestore).toBe(firestore);
    expect(service.firestore).toBe(firestore);
    expect(persistentLocalCache).toHaveBeenCalledTimes(1);
    expect(initializeFirestore).toHaveBeenCalledTimes(1);
    expect(initializeFirestore).toHaveBeenCalledWith(app, {
      localCache: { kind: 'persistentLocalCache' },
    });
  });

  it('should report whether a global default Firebase app exists', () => {
    (getApp as jest.Mock).mockReturnValueOnce({ name: '[DEFAULT]' });
    expect(service.hasGlobalDefaultApp()).toBe(true);

    (getApp as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no default app');
    });
    expect(service.hasGlobalDefaultApp()).toBe(false);
  });

  it('should report correct initialization status', () => {
    expect(service.isInitialized).toBe(false);
    service.initialize();
    expect(service.isInitialized).toBe(true);
  });

  it('should return the app instance or initialize it on getApp', () => {
    const app = { name: 'easyturno' };
    (initializeApp as jest.Mock).mockReturnValue(app);
    expect(service.getApp()).toBe(app);
    expect(service.getApp()).toBe(app);
  });
});
