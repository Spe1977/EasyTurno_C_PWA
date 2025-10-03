import { TestBed } from '@angular/core/testing';
import { NotificationService, NotificationSettings } from './notification.service';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Shift } from '../shift.model';

// Mock Capacitor
jest.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: jest.fn(),
  },
}));

// Mock LocalNotifications
jest.mock('@capacitor/local-notifications', () => ({
  LocalNotifications: {
    requestPermissions: jest.fn(),
    addListener: jest.fn(),
    schedule: jest.fn(),
    cancel: jest.fn(),
    getPending: jest.fn(),
  },
}));

describe('NotificationService', () => {
  let service: NotificationService;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return localStorageMock[key] || null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
    });

    // Reset all mocks
    jest.clearAllMocks();

    TestBed.configureTestingModule({
      providers: [NotificationService],
    });

    service = TestBed.inject(NotificationService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getSettings', () => {
    it('should return default settings when no stored settings exist', () => {
      const settings = service.getSettings();
      expect(settings).toEqual({
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: true,
      });
    });

    it('should return stored settings when they exist', () => {
      const customSettings: NotificationSettings = {
        enabled: false,
        reminderMinutesBefore: 30,
        dayBeforeEnabled: false,
      };
      localStorageMock['easyturno_notification_settings'] = JSON.stringify(customSettings);

      const settings = service.getSettings();
      expect(settings).toEqual(customSettings);
    });
  });

  describe('saveSettings', () => {
    it('should save settings to localStorage', () => {
      const settings: NotificationSettings = {
        enabled: true,
        reminderMinutesBefore: 120,
        dayBeforeEnabled: true,
      };

      service.saveSettings(settings);

      expect(localStorageMock['easyturno_notification_settings']).toBe(JSON.stringify(settings));
    });
  });

  describe('initialize', () => {
    it('should return false on web platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);

      const result = await service.initialize();

      expect(result).toBe(false);
      expect(LocalNotifications.requestPermissions).not.toHaveBeenCalled();
    });

    it('should request permissions on native platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.requestPermissions as jest.Mock).mockResolvedValue({
        display: 'granted',
      });
      (LocalNotifications.addListener as jest.Mock).mockResolvedValue({ remove: jest.fn() });

      const result = await service.initialize();

      expect(result).toBe(true);
      expect(LocalNotifications.requestPermissions).toHaveBeenCalled();
      expect(LocalNotifications.addListener).toHaveBeenCalledWith(
        'localNotificationActionPerformed',
        expect.any(Function)
      );
    });

    it('should return false if permission is denied', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.requestPermissions as jest.Mock).mockResolvedValue({
        display: 'denied',
      });

      const result = await service.initialize();

      expect(result).toBe(false);
    });
  });

  describe('scheduleShiftNotification', () => {
    const mockShift: Shift = {
      id: 'test-shift-id',
      seriesId: 'test-series-id',
      title: 'Test Shift',
      start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(), // 2 hours from now
      end: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
      color: 'sky',
      isRecurring: false,
    };

    it('should not schedule on web platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);
      const settings: NotificationSettings = {
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: true,
      };

      await service.scheduleShiftNotification(mockShift, settings);

      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    });

    it('should not schedule if notifications are disabled', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      const settings: NotificationSettings = {
        enabled: false,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: true,
      };

      await service.scheduleShiftNotification(mockShift, settings);

      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    });

    it('should schedule notification on native platform when enabled', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);

      const settings: NotificationSettings = {
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: false,
      };

      await service.scheduleShiftNotification(mockShift, settings);

      expect(LocalNotifications.schedule).toHaveBeenCalledWith({
        notifications: expect.arrayContaining([
          expect.objectContaining({
            title: expect.stringContaining('Test Shift'),
            body: expect.any(String),
            schedule: expect.any(Object),
          }),
        ]),
      });
    });
  });

  describe('cancelShiftNotifications', () => {
    it('should not attempt to cancel on web platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);

      await service.cancelShiftNotifications('test-id');

      expect(LocalNotifications.getPending).not.toHaveBeenCalled();
    });

    it('should cancel notifications for a shift on native platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.getPending as jest.Mock).mockResolvedValue({
        notifications: [
          { id: 1, extra: { shiftId: 'test-id' } },
          { id: 2, extra: { shiftId: 'other-id' } },
          { id: 3, extra: { shiftId: 'test-id' } },
        ],
      });
      (LocalNotifications.cancel as jest.Mock).mockResolvedValue(undefined);

      await service.cancelShiftNotifications('test-id');

      expect(LocalNotifications.getPending).toHaveBeenCalled();
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: 1 }, { id: 3 }],
      });
    });
  });

  describe('cancelAllNotifications', () => {
    it('should not attempt to cancel on web platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);

      await service.cancelAllNotifications();

      expect(LocalNotifications.getPending).not.toHaveBeenCalled();
    });

    it('should cancel all notifications on native platform', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.getPending as jest.Mock).mockResolvedValue({
        notifications: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });
      (LocalNotifications.cancel as jest.Mock).mockResolvedValue(undefined);

      await service.cancelAllNotifications();

      expect(LocalNotifications.getPending).toHaveBeenCalled();
      expect(LocalNotifications.cancel).toHaveBeenCalledWith({
        notifications: [{ id: 1 }, { id: 2 }, { id: 3 }],
      });
    });
  });
});
