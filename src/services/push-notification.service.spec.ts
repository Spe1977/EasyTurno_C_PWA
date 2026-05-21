import { TestBed } from '@angular/core/testing';
import { PushNotificationService } from './push-notification.service';
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(),
  },
}));

jest.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: jest.fn(),
    requestPermissions: jest.fn(),
    register: jest.fn(),
    addListener: jest.fn(),
  },
}));

describe('PushNotificationService', () => {
  let service: PushNotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
    (PushNotifications.checkPermissions as jest.Mock).mockResolvedValue({ receive: 'granted' });
    (PushNotifications.addListener as jest.Mock).mockResolvedValue({ remove: jest.fn() });

    TestBed.configureTestingModule({});
    service = TestBed.inject(PushNotificationService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should not initialize on web', async () => {
    (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);
    await service.initialize();
    expect(PushNotifications.register).not.toHaveBeenCalled();
  });

  it('should register for push notifications if permission is granted', async () => {
    await service.initialize();
    expect(PushNotifications.register).toHaveBeenCalled();
    expect(PushNotifications.addListener).toHaveBeenCalledWith(
      'registration',
      expect.any(Function)
    );
  });

  it('should request permission if status is prompt', async () => {
    (PushNotifications.checkPermissions as jest.Mock).mockResolvedValue({ receive: 'prompt' });
    (PushNotifications.requestPermissions as jest.Mock).mockResolvedValue({ receive: 'granted' });

    await service.initialize();

    expect(PushNotifications.requestPermissions).toHaveBeenCalled();
    expect(PushNotifications.register).toHaveBeenCalled();
  });

  it('should not register if permission is denied', async () => {
    (PushNotifications.checkPermissions as jest.Mock).mockResolvedValue({ receive: 'denied' });

    await service.initialize();

    expect(PushNotifications.register).not.toHaveBeenCalled();
  });

  it('should update token signal when registration succeeds', async () => {
    let registrationCallback: Function = () => {};
    (PushNotifications.addListener as jest.Mock).mockImplementation((event, cb) => {
      if (event === 'registration') registrationCallback = cb;
      return Promise.resolve({ remove: jest.fn() });
    });

    await service.initialize();
    registrationCallback({ value: 'test-token' });

    expect(service.token()).toBe('test-token');
  });

  it('should not log the raw registration token when registration succeeds', async () => {
    let registrationCallback: Function = () => {};
    (PushNotifications.addListener as jest.Mock).mockImplementation((event, cb) => {
      if (event === 'registration') registrationCallback = cb;
      return Promise.resolve({ remove: jest.fn() });
    });
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    await service.initialize();
    registrationCallback({ value: 'sensitive-fcm-token' });

    expect(consoleInfoSpy).not.toHaveBeenCalledWith(expect.any(String), 'sensitive-fcm-token');
    expect(consoleInfoSpy.mock.calls.flat()).not.toContain('sensitive-fcm-token');

    consoleInfoSpy.mockRestore();
  });

  it('should handle registrationError, pushNotificationReceived, and pushNotificationActionPerformed', async () => {
    let registrationErrorCallback: Function = () => {};
    let pushNotificationReceivedCallback: Function = () => {};
    let pushNotificationActionCallback: Function = () => {};

    (PushNotifications.addListener as jest.Mock).mockImplementation((event, cb) => {
      if (event === 'registrationError') registrationErrorCallback = cb;
      if (event === 'pushNotificationReceived') pushNotificationReceivedCallback = cb;
      if (event === 'pushNotificationActionPerformed') pushNotificationActionCallback = cb;
      return Promise.resolve({ remove: jest.fn() });
    });

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const consoleInfoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

    await service.initialize();

    registrationErrorCallback({ message: 'failed' });
    pushNotificationReceivedCallback({ title: 'test-title' });
    pushNotificationActionCallback({ actionId: 'test-action' });

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error on push registration:', expect.any(String));
    expect(consoleInfoSpy).toHaveBeenCalledWith('Push notification received:', expect.any(Object));
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      'Push notification action performed:',
      expect.any(Object)
    );

    consoleErrorSpy.mockRestore();
    consoleInfoSpy.mockRestore();
  });
});
