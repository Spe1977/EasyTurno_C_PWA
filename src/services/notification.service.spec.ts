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

    it('should fall back to defaults when stored settings are invalid JSON', () => {
      localStorageMock['easyturno_notification_settings'] = '{invalid';

      const settings = service.getSettings();

      expect(settings).toEqual({
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: true,
      });
    });

    it('should sanitize unsupported reminder values from storage', () => {
      localStorageMock['easyturno_notification_settings'] = JSON.stringify({
        enabled: true,
        reminderMinutesBefore: -999,
        dayBeforeEnabled: false,
      });

      const settings = service.getSettings();

      expect(settings).toEqual({
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: false,
      });
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

    it('should sanitize invalid settings before saving', () => {
      service.saveSettings({
        enabled: true,
        reminderMinutesBefore: -5,
        dayBeforeEnabled: true,
      });

      expect(localStorageMock['easyturno_notification_settings']).toBe(
        JSON.stringify({
          enabled: true,
          reminderMinutesBefore: 60,
          dayBeforeEnabled: true,
        })
      );
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

    it('should log notification action callbacks from native listener', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.requestPermissions as jest.Mock).mockResolvedValue({
        display: 'granted',
      });
      (LocalNotifications.getPending as jest.Mock).mockResolvedValue({ notifications: [] });
      let actionCallback: ((notification: unknown) => void) | undefined;
      (LocalNotifications.addListener as jest.Mock).mockImplementation((_event, callback) => {
        actionCallback = callback;
        return Promise.resolve({ remove: jest.fn() });
      });
      const infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});

      await service.initialize();
      actionCallback?.({ notification: { id: 1 } });

      expect(infoSpy).toHaveBeenCalledWith('Notification clicked:', {
        notification: { id: 1 },
      });
      infoSpy.mockRestore();
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

    it('should not schedule when all notification times are already past', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      const pastShift: Shift = {
        id: 'past-shift',
        seriesId: 'past-series',
        title: 'Past Shift',
        start: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        color: 'sky',
        isRecurring: false,
      };

      await service.scheduleShiftNotification(pastShift, {
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: true,
      });

      expect(LocalNotifications.schedule).not.toHaveBeenCalled();
    });

    it('should log and swallow schedule failures', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.schedule as jest.Mock).mockRejectedValue(new Error('schedule failed'));
      const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.scheduleShiftNotification(mockShift, {
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: false,
      });

      expect(errorSpy).toHaveBeenCalledWith(
        'Failed to schedule shift notifications:',
        expect.any(Error)
      );
      errorSpy.mockRestore();
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

    it('should not cancel when no pending notifications match the shift', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.getPending as jest.Mock).mockResolvedValue({
        notifications: [{ id: 1, extra: { shiftId: 'other-id' } }],
      });

      await service.cancelShiftNotifications('missing-id');

      expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    });
  });

  describe('Native branch coverage (T8)', () => {
    describe('loadNotificationIdCounter', () => {
      it('should skip counter loading when called on web platform', async () => {
        (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(false);

        await (service as any).loadNotificationIdCounter();

        expect(LocalNotifications.getPending).not.toHaveBeenCalled();
      });

      it('should initialize counter from highest pending notification ID', async () => {
        (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
        (LocalNotifications.requestPermissions as jest.Mock).mockResolvedValue({
          display: 'granted',
        });
        (LocalNotifications.addListener as jest.Mock).mockResolvedValue({ remove: jest.fn() });
        (LocalNotifications.getPending as jest.Mock).mockResolvedValue({
          notifications: [{ id: 5 }, { id: 42 }, { id: 17 }],
        });
        (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);

        await service.initialize();

        // Next scheduled notification ID must be greater than the existing maxId (42)
        const futureShift: Shift = {
          id: 'shift-after-load',
          seriesId: 'series-after-load',
          title: 'After load',
          start: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          color: 'sky',
          isRecurring: false,
        };
        await service.scheduleShiftNotification(futureShift, {
          enabled: true,
          reminderMinutesBefore: 60,
          dayBeforeEnabled: false,
        });

        expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
        const scheduledArg = (LocalNotifications.schedule as jest.Mock).mock.calls[0][0];
        expect(scheduledArg.notifications[0].id).toBeGreaterThan(42);
        expect(scheduledArg.notifications[0].id).toBe(43);
      });

      it('should reset counter to 0 when getPending throws', async () => {
        (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
        (LocalNotifications.requestPermissions as jest.Mock).mockResolvedValue({
          display: 'granted',
        });
        (LocalNotifications.addListener as jest.Mock).mockResolvedValue({ remove: jest.fn() });
        (LocalNotifications.getPending as jest.Mock).mockRejectedValue(new Error('IDB error'));
        (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {
          /* noop */
        });

        await service.initialize();

        const futureShift: Shift = {
          id: 'shift-after-error',
          seriesId: 'series-after-error',
          title: 'After error',
          start: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          color: 'sky',
          isRecurring: false,
        };
        await service.scheduleShiftNotification(futureShift, {
          enabled: true,
          reminderMinutesBefore: 60,
          dayBeforeEnabled: false,
        });

        expect(errorSpy).toHaveBeenCalledWith(
          'Failed to load notification counter:',
          expect.any(Error)
        );
        // Counter was reset to 0 → first generated ID is 1
        const scheduledArg = (LocalNotifications.schedule as jest.Mock).mock.calls[0][0];
        expect(scheduledArg.notifications[0].id).toBe(1);
      });
    });

    describe('scheduleShiftNotification — day-before branch', () => {
      it('should schedule the day-before reminder at 20:00 local time of the previous day', async () => {
        (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
        (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);

        // Shift starting 2 days from now at 09:00 local time, to be well after "yesterday 20:00"
        const shiftStart = new Date();
        shiftStart.setDate(shiftStart.getDate() + 2);
        shiftStart.setHours(9, 0, 0, 0);
        const shiftEnd = new Date(shiftStart);
        shiftEnd.setHours(17, 0, 0, 0);

        const shift: Shift = {
          id: 'shift-day-before',
          seriesId: 'series-day-before',
          title: 'Day before test',
          start: shiftStart.toISOString(),
          end: shiftEnd.toISOString(),
          color: 'sky',
          isRecurring: false,
        };

        await service.scheduleShiftNotification(shift, {
          enabled: true,
          reminderMinutesBefore: 60,
          dayBeforeEnabled: true,
        });

        expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
        const notifications = (LocalNotifications.schedule as jest.Mock).mock.calls[0][0]
          .notifications;
        expect(notifications).toHaveLength(2);

        const dayBeforeNotification = notifications.find((n: { title: string }) =>
          n.title.includes('🔔')
        );
        expect(dayBeforeNotification).toBeDefined();
        const scheduledAt: Date = dayBeforeNotification.schedule.at;
        const expectedDay = new Date(shiftStart);
        expectedDay.setDate(expectedDay.getDate() - 1);
        expectedDay.setHours(20, 0, 0, 0);
        expect(scheduledAt.getTime()).toBe(expectedDay.getTime());
        expect(scheduledAt.getHours()).toBe(20);
        expect(scheduledAt.getMinutes()).toBe(0);
      });

      it('should format day-before notification dates with Italian locale when selected', async () => {
        (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
        (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);
        (service as any).translationService.setLanguage('it');
        const shiftStart = new Date();
        shiftStart.setDate(shiftStart.getDate() + 2);
        shiftStart.setHours(9, 0, 0, 0);

        await service.scheduleShiftNotification(
          {
            id: 'shift-it',
            seriesId: 'series-it',
            title: 'Turno IT',
            start: shiftStart.toISOString(),
            end: new Date(shiftStart.getTime() + 8 * 60 * 60 * 1000).toISOString(),
            color: 'sky',
            isRecurring: false,
          },
          {
            enabled: true,
            reminderMinutesBefore: 60,
            dayBeforeEnabled: true,
          }
        );

        const notifications = (LocalNotifications.schedule as jest.Mock).mock.calls[0][0]
          .notifications;
        expect(
          notifications.some((notification: { body: string }) =>
            notification.body.includes('Turno IT')
          )
        ).toBe(true);
      });

      it('should skip the day-before reminder when 20:00 of the previous day is already in the past', async () => {
        (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
        (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);

        // Shift starting in 2 hours: "yesterday at 20:00" is far in the past
        const shift: Shift = {
          id: 'shift-soon',
          seriesId: 'series-soon',
          title: 'Soon shift',
          start: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          color: 'sky',
          isRecurring: false,
        };

        await service.scheduleShiftNotification(shift, {
          enabled: true,
          reminderMinutesBefore: 60,
          dayBeforeEnabled: true,
        });

        expect(LocalNotifications.schedule).toHaveBeenCalledTimes(1);
        const notifications = (LocalNotifications.schedule as jest.Mock).mock.calls[0][0]
          .notifications;
        // Only the X-minutes-before reminder is scheduled, not the day-before one
        expect(notifications).toHaveLength(1);
        expect(notifications[0].title).toContain('📅');
      });
    });

    describe('scheduleShiftNotification — invalid start date', () => {
      it('should skip scheduling when shift.start is not a valid date', async () => {
        (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
        (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);
        const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {
          /* noop */
        });

        const invalidShift: Shift = {
          id: 'invalid-shift',
          seriesId: 'invalid-series',
          title: 'Invalid date',
          start: 'not-a-date',
          end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
          color: 'sky',
          isRecurring: false,
        };

        await service.scheduleShiftNotification(invalidShift, {
          enabled: true,
          reminderMinutesBefore: 60,
          dayBeforeEnabled: true,
        });

        expect(LocalNotifications.schedule).not.toHaveBeenCalled();
        expect(warnSpy).toHaveBeenCalledWith(
          'NotificationService: invalid shift start date, skipping notifications'
        );
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

    it('should not cancel all when there are no pending notifications', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.getPending as jest.Mock).mockResolvedValue({
        notifications: [],
      });

      await service.cancelAllNotifications();

      expect(LocalNotifications.cancel).not.toHaveBeenCalled();
    });

    it('should reset the notification ID counter after cancelling all (#9)', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.requestPermissions as jest.Mock).mockResolvedValue({
        display: 'granted',
      });
      (LocalNotifications.addListener as jest.Mock).mockResolvedValue({ remove: jest.fn() });
      // Pre-existing high IDs cause loadNotificationIdCounter to set counter = 42
      (LocalNotifications.getPending as jest.Mock).mockResolvedValueOnce({
        notifications: [{ id: 5 }, { id: 42 }, { id: 17 }],
      });
      (LocalNotifications.schedule as jest.Mock).mockResolvedValue(undefined);
      (LocalNotifications.cancel as jest.Mock).mockResolvedValue(undefined);

      await service.initialize();

      // cancelAllNotifications reads pending again and clears them
      (LocalNotifications.getPending as jest.Mock).mockResolvedValueOnce({
        notifications: [{ id: 5 }, { id: 42 }, { id: 17 }],
      });
      await service.cancelAllNotifications();

      // After cancellation, the next scheduled notification must restart at ID 1
      const futureShift: Shift = {
        id: 'shift-after-reset',
        seriesId: 'series-after-reset',
        title: 'After reset',
        start: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
        end: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString(),
        color: 'sky',
        isRecurring: false,
      };
      await service.scheduleShiftNotification(futureShift, {
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: false,
      });

      const scheduledArg = (LocalNotifications.schedule as jest.Mock).mock.calls[0][0];
      expect(scheduledArg.notifications[0].id).toBe(1);
    });
  });

  describe('Edge cases and error handling', () => {
    it('handles loadNotificationIdCounter on native platform when getPending fails', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.getPending as jest.Mock).mockRejectedValue(
        new Error('getPending failed')
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const newService = TestBed.inject(NotificationService);
      await newService.initialize();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to load notification counter:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('handles cancelShiftNotifications when LocalNotifications.cancel fails', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.getPending as jest.Mock).mockResolvedValue({
        notifications: [{ id: 1, extra: { shiftId: 'error-shift' } }],
      });
      (LocalNotifications.cancel as jest.Mock).mockRejectedValue(new Error('cancel failed'));

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.cancelShiftNotifications('error-shift');

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to cancel shift notifications:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('handles cancelAllNotifications when getPending fails', async () => {
      (Capacitor.isNativePlatform as jest.Mock).mockReturnValue(true);
      (LocalNotifications.getPending as jest.Mock).mockRejectedValue(
        new Error('getPending failed')
      );

      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      await service.cancelAllNotifications();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Failed to cancel all notifications:',
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it('handles sanitizeSettings when stored settings are null or not an object', () => {
      localStorageMock['easyturno_notification_settings'] = 'null';
      let settings = service.getSettings();
      expect(settings).toEqual({
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: true,
      });

      localStorageMock['easyturno_notification_settings'] = '"just-a-string"';
      settings = service.getSettings();
      expect(settings).toEqual({
        enabled: true,
        reminderMinutesBefore: 60,
        dayBeforeEnabled: true,
      });
    });

    it('should reuse the same notification ID for the same shift and suffix', () => {
      const first = (service as any).getNotificationId('same-shift');
      const second = (service as any).getNotificationId('same-shift');
      const third = (service as any).getNotificationId('same-shift', '-daybefore');

      expect(second).toBe(first);
      expect(third).toBeGreaterThan(first);
    });

    it('should sanitize missing boolean settings when saving', () => {
      service.saveSettings({
        enabled: 'yes',
        reminderMinutesBefore: 15,
        dayBeforeEnabled: undefined,
      } as any);

      expect(JSON.parse(localStorageMock['easyturno_notification_settings'])).toEqual({
        enabled: true,
        reminderMinutesBefore: 15,
        dayBeforeEnabled: true,
      });
    });
  });
});
