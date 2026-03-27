import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';
import { LocalNotifications, ScheduleOptions, PendingResult } from '@capacitor/local-notifications';
import { Shift } from '../shift.model';

export interface NotificationSettings {
  enabled: boolean;
  reminderMinutesBefore: number; // es. 60 = 1h prima
  dayBeforeEnabled: boolean;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly STORAGE_KEY = 'easyturno_notification_settings';
  private readonly DEFAULT_SETTINGS: NotificationSettings = {
    enabled: true,
    reminderMinutesBefore: 60,
    dayBeforeEnabled: true,
  };
  private readonly ALLOWED_REMINDER_MINUTES = new Set([15, 30, 60, 120, 180]);
  private notificationIdCounter = 0;
  private notificationIdMap = new Map<string, number>();

  async initialize(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.warn('NotificationService: Running on web, native features disabled');
      return false;
    }

    // Richiedi permessi
    const permission = await LocalNotifications.requestPermissions();
    if (permission.display !== 'granted') {
      console.warn('Notification permission not granted');
      return false;
    }

    // Listener per click su notifica
    await LocalNotifications.addListener('localNotificationActionPerformed', notification => {
      console.warn('Notification clicked:', notification);
      // TODO: Naviga al turno specifico
    });

    // Initialize counter from existing notifications
    await this.loadNotificationIdCounter();

    return true;
  }

  /**
   * Load the notification ID counter from existing notifications to prevent collisions
   */
  private async loadNotificationIdCounter(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const pending = await LocalNotifications.getPending();

      // Find the highest ID in use
      let maxId = 0;
      for (const notification of pending.notifications) {
        if (notification.id > maxId) {
          maxId = notification.id;
        }
      }

      // Start counter above the highest existing ID
      this.notificationIdCounter = maxId;
    } catch (error) {
      console.error('Failed to load notification counter:', error);
      this.notificationIdCounter = 0;
    }
  }

  /**
   * Generate a unique notification ID for a shift
   * @param shiftId The shift's UUID
   * @param suffix Optional suffix to differentiate multiple notifications for the same shift
   * @returns A unique integer ID
   */
  private getNotificationId(shiftId: string, suffix: string = ''): number {
    const key = `${shiftId}${suffix}`;

    if (!this.notificationIdMap.has(key)) {
      this.notificationIdCounter++;
      this.notificationIdMap.set(key, this.notificationIdCounter);
    }

    return this.notificationIdMap.get(key)!;
  }

  async scheduleShiftNotification(shift: Shift, settings: NotificationSettings): Promise<void> {
    const safeSettings = this.sanitizeSettings(settings);

    if (!Capacitor.isNativePlatform() || !safeSettings.enabled) {
      return;
    }

    try {
      const notifications: ScheduleOptions['notifications'] = [];
      const shiftStart = new Date(shift.start);
      const now = new Date();

      if (isNaN(shiftStart.getTime())) {
        console.warn('NotificationService: invalid shift start date, skipping notifications');
        return;
      }

      // Notifica X minuti prima del turno
      const reminderTime = new Date(
        shiftStart.getTime() - safeSettings.reminderMinutesBefore * 60 * 1000
      );
      if (reminderTime > now) {
        notifications.push({
          title: `📅 ${shift.title}`,
          body: `Inizia tra ${safeSettings.reminderMinutesBefore} minuti`,
          id: this.getNotificationId(shift.id, '-reminder'),
          schedule: { at: reminderTime },
          sound: 'default',
          smallIcon: 'ic_stat_icon_config_sample',
          actionTypeId: 'OPEN_SHIFT',
          extra: { shiftId: shift.id },
        });
      }

      // Notifica giorno prima (opzionale)
      if (safeSettings.dayBeforeEnabled) {
        const dayBefore = new Date(shiftStart);
        dayBefore.setDate(dayBefore.getDate() - 1);
        dayBefore.setHours(20, 0, 0, 0); // Ore 20:00 del giorno prima

        if (dayBefore > now) {
          notifications.push({
            title: `🔔 Promemoria turno domani`,
            body: `${shift.title} - ${shiftStart.toLocaleDateString('it-IT')}`,
            id: this.getNotificationId(shift.id, '-daybefore'),
            schedule: { at: dayBefore },
            sound: 'default',
            smallIcon: 'ic_stat_icon_config_sample',
            actionTypeId: 'OPEN_SHIFT',
            extra: { shiftId: shift.id },
          });
        }
      }

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });
        console.warn(`Scheduled ${notifications.length} notification(s) for shift: ${shift.id}`);
      }
    } catch (error) {
      console.error('Failed to schedule shift notifications:', error);
      // Notifiche non critiche - non propagare l'errore
    }
  }

  async cancelShiftNotifications(shiftId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      // Cancella tutte le notifiche pending per questo turno
      const pending: PendingResult = await LocalNotifications.getPending();
      const toCancel = pending.notifications.filter(n => n.extra?.shiftId === shiftId);

      if (toCancel.length > 0) {
        await LocalNotifications.cancel({
          notifications: toCancel.map(n => ({ id: n.id })),
        });
        console.warn(`Cancelled ${toCancel.length} notification(s) for shift: ${shiftId}`);
      }
    } catch (error) {
      console.error('Failed to cancel shift notifications:', error);
      // Notifiche non critiche - non propagare l'errore
    }
  }

  async cancelAllNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map(n => ({ id: n.id })),
        });
        console.warn(`Cancelled all ${pending.notifications.length} notifications`);
      }
    } catch (error) {
      console.error('Failed to cancel all notifications:', error);
      // Notifiche non critiche - non propagare l'errore
    }
  }

  getSettings(): NotificationSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);

    if (!stored) {
      return { ...this.DEFAULT_SETTINGS };
    }

    try {
      return this.sanitizeSettings(JSON.parse(stored));
    } catch (error) {
      console.error('Failed to parse notification settings, using defaults:', error);
      return { ...this.DEFAULT_SETTINGS };
    }
  }

  saveSettings(settings: NotificationSettings): void {
    const safeSettings = this.sanitizeSettings(settings);
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(safeSettings));
  }

  private sanitizeSettings(settings: unknown): NotificationSettings {
    if (typeof settings !== 'object' || settings === null) {
      return { ...this.DEFAULT_SETTINGS };
    }

    const parsed = settings as Partial<NotificationSettings>;
    const reminderMinutesBefore = this.ALLOWED_REMINDER_MINUTES.has(
      parsed.reminderMinutesBefore ?? -1
    )
      ? parsed.reminderMinutesBefore!
      : this.DEFAULT_SETTINGS.reminderMinutesBefore;

    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : this.DEFAULT_SETTINGS.enabled,
      reminderMinutesBefore,
      dayBeforeEnabled:
        typeof parsed.dayBeforeEnabled === 'boolean'
          ? parsed.dayBeforeEnabled
          : this.DEFAULT_SETTINGS.dayBeforeEnabled,
    };
  }
}
