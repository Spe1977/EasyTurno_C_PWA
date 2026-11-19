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

  it('does not initialize Firebase eagerly on service construction', () => {
    expect(service.isInitialized).toBe(false);
    expect(initializeApp).not.toHaveBeenCalled();
    expect(getAuth).not.toHaveBeenCalled();
    expect(initializeFirestore).not.toHaveBeenCalled();
  });

  it('should initialize the named Firebase app once (including concurrent callers)', async () => {
    const app = { name: 'easyturno' };
    (initializeApp as jest.Mock).mockReturnValue(app);

    const [a, b] = await Promise.all([service.initialize(), service.initialize()]);
    const c = await service.initialize();

    expect(a).toBe(app);
    expect(b).toBe(app);
    expect(c).toBe(app);
    expect(initializeApp).toHaveBeenCalledTimes(1);
    expect(initializeApp).toHaveBeenCalledWith(firebaseConfig, 'easyturno');
  });

  it('should reuse an existing named app instead of creating a new one', async () => {
    const existingApp = { name: 'easyturno' };
    (getApps as jest.Mock).mockReturnValue([{ name: 'other' }, existingApp]);

    await expect(service.initialize()).resolves.toBe(existingApp);
    expect(initializeApp).not.toHaveBeenCalled();
  });

  it('should cache auth and firestore instances lazily', async () => {
    const app = { name: 'easyturno' };
    const auth = { currentUser: null };
    const firestore = { app };
    (initializeApp as jest.Mock).mockReturnValue(app);
    (getAuth as jest.Mock).mockReturnValue(auth);
    (persistentLocalCache as jest.Mock).mockReturnValue({ kind: 'persistentLocalCache' });
    (initializeFirestore as jest.Mock).mockReturnValue(firestore);

    await expect(service.getAuth()).resolves.toBe(auth);
    await expect(service.getAuth()).resolves.toBe(auth);
    expect(getAuth).toHaveBeenCalledTimes(1);
    expect(getAuth).toHaveBeenCalledWith(app);

    await expect(service.getFirestore()).resolves.toBe(firestore);
    await expect(service.getFirestore()).resolves.toBe(firestore);
    expect(persistentLocalCache).toHaveBeenCalledTimes(1);
    expect(initializeFirestore).toHaveBeenCalledTimes(1);
    expect(initializeFirestore).toHaveBeenCalledWith(app, {
      localCache: { kind: 'persistentLocalCache' },
    });
  });

  it('resets cached initialize promise on failure so a subsequent attempt can succeed', async () => {
    const app = { name: 'easyturno' };
    (initializeApp as jest.Mock)
      .mockImplementationOnce(() => {
        throw new Error('init failed');
      })
      .mockReturnValueOnce(app);

    await expect(service.initialize()).rejects.toThrow('init failed');
    expect(service.isInitialized).toBe(false);

    await expect(service.initialize()).resolves.toBe(app);
    expect(service.isInitialized).toBe(true);
  });

  it('should report whether a global default Firebase app exists', async () => {
    (getApp as jest.Mock).mockReturnValueOnce({ name: '[DEFAULT]' });
    await expect(service.hasGlobalDefaultApp()).resolves.toBe(true);

    (getApp as jest.Mock).mockImplementationOnce(() => {
      throw new Error('no default app');
    });
    await expect(service.hasGlobalDefaultApp()).resolves.toBe(false);
  });

  it('should report correct initialization status', async () => {
    expect(service.isInitialized).toBe(false);
    await service.initialize();
    expect(service.isInitialized).toBe(true);
  });

  it('should return the app instance or initialize it on getApp', async () => {
    const app = { name: 'easyturno' };
    (initializeApp as jest.Mock).mockReturnValue(app);
    await expect(service.getApp()).resolves.toBe(app);
    await expect(service.getApp()).resolves.toBe(app);
  });
});
