import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SyncService } from './sync.service';
import { AuthService } from './auth.service';
import { FirestoreUserDataService } from './firestore-user-data.service';
import { DeviceService } from './device.service';
import { PushNotificationService } from './push-notification.service';

describe('SyncService', () => {
  let firestoreStoreMock: any;

  beforeEach(() => {
    firestoreStoreMock = {
      start: jest.fn(),
      stop: jest.fn(),
    };
  });

  it('reports local mode for guest users', () => {
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { state: signal({ mode: 'guest' }) } },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
      ],
    });

    const service = TestBed.inject(SyncService);
    expect(service.status()).toMatchObject({ mode: 'local', labelKey: 'syncLocal' });
  });

  it('reports cloud connecting for authenticated users before first snapshot', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { state: signal({ mode: 'authenticated', uid: 'uid-1', emailVerified: true }) },
        },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
      ],
    });

    const service = TestBed.inject(SyncService);
    expect(service.status().mode).toBe('connecting');
  });

  it('registers device and fcm token when user authenticates', () => {
    const authState = signal<any>({ mode: 'guest' });
    const deviceServiceMock = { deviceId: jest.fn().mockReturnValue('dev-123') };
    const pushNotificationServiceMock = { token: signal('token-456') };
    firestoreStoreMock.registerDevice = jest.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { state: authState } },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
        { provide: DeviceService, useValue: deviceServiceMock },
        { provide: PushNotificationService, useValue: pushNotificationServiceMock },
      ],
    });

    TestBed.inject(SyncService);
    expect(firestoreStoreMock.registerDevice).not.toHaveBeenCalled();

    authState.set({ mode: 'authenticated', uid: 'uid-1' });
    TestBed.flushEffects();

    expect(deviceServiceMock.deviceId).toHaveBeenCalled();
    expect(firestoreStoreMock.registerDevice).toHaveBeenCalledWith('uid-1', 'dev-123', 'token-456');
  });

  it('reports offline mode when navigator.onLine is false', () => {
    const onlineSpy = jest.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { state: signal({ mode: 'authenticated', uid: 'uid-1', emailVerified: true }) },
        },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
      ],
    });

    const service = TestBed.inject(SyncService);
    expect(service.status()).toMatchObject({ mode: 'offline', labelKey: 'syncOffline' });
    onlineSpy.mockRestore();
  });

  it('reports error mode when syncError is set', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { state: signal({ mode: 'authenticated', uid: 'uid-1', emailVerified: true }) },
        },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
      ],
    });

    const service = TestBed.inject(SyncService);
    (service as any).syncError.set('Test Sync Error');
    expect(service.status()).toMatchObject({
      mode: 'error',
      labelKey: 'syncError',
      error: 'Test Sync Error',
    });
  });

  it('reports synced when remoteReady is true', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { state: signal({ mode: 'authenticated', uid: 'uid-1', emailVerified: true }) },
        },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
      ],
    });

    const service = TestBed.inject(SyncService);
    (service as any).remoteReady.set(true);
    expect(service.status()).toMatchObject({ mode: 'synced', labelKey: 'syncSynced' });
  });

  it('reports local mode when authenticated but uid is missing', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { state: signal({ mode: 'authenticated', uid: '' }) },
        },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
      ],
    });

    const service = TestBed.inject(SyncService);
    expect(service.status()).toMatchObject({ mode: 'local', labelKey: 'syncLocal' });
  });

  it('reports local mode when auth state is loading', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: { state: signal({ mode: 'loading' }) },
        },
        { provide: FirestoreUserDataService, useValue: firestoreStoreMock },
      ],
    });

    const service = TestBed.inject(SyncService);
    expect(service.status()).toMatchObject({ mode: 'local', labelKey: 'syncLocal' });
  });
});
