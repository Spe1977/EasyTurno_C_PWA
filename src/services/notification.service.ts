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

  async initialize(): Promise<boolean> {
    if (!Capacitor.isNativePlatform()) {
      console.log('NotificationService: Running on web, native features disabled');
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
      console.log('Notification clicked:', notification);
      // TODO: Naviga al turno specifico
    });

    return true;
  }

  async scheduleShiftNotification(shift: Shift, settings: NotificationSettings): Promise<void> {
    if (!Capacitor.isNativePlatform() || !settings.enabled) {
      return;
    }

    const notifications: ScheduleOptions['notifications'] = [];
    const shiftStart = new Date(shift.start);
    const now = new Date();

    // Notifica X minuti prima del turno
    const reminderTime = new Date(
      shiftStart.getTime() - settings.reminderMinutesBefore * 60 * 1000
    );
    if (reminderTime > now) {
      notifications.push({
        title: `📅 ${shift.title}`,
        body: `Inizia tra ${settings.reminderMinutesBefore} minuti`,
        id: parseInt(shift.id.replace(/-/g, '').substring(0, 8), 16), // ID univoco da UUID
        schedule: { at: reminderTime },
        sound: 'default',
        smallIcon: 'ic_stat_icon_config_sample',
        actionTypeId: 'OPEN_SHIFT',
        extra: { shiftId: shift.id },
      });
    }

    // Notifica giorno prima (opzionale)
    if (settings.dayBeforeEnabled) {
      const dayBefore = new Date(shiftStart);
      dayBefore.setDate(dayBefore.getDate() - 1);
      dayBefore.setHours(20, 0, 0, 0); // Ore 20:00 del giorno prima

      if (dayBefore > now) {
        notifications.push({
          title: `🔔 Promemoria turno domani`,
          body: `${shift.title} - ${shiftStart.toLocaleDateString('it-IT')}`,
          id: parseInt(shift.id.replace(/-/g, '').substring(8, 16), 16),
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
      console.log(`Scheduled ${notifications.length} notifications for shift: ${shift.title}`);
    }
  }

  async cancelShiftNotifications(shiftId: string): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;

    // Cancella tutte le notifiche pending per questo turno
    const pending: PendingResult = await LocalNotifications.getPending();
    const toCancel = pending.notifications.filter(n => n.extra?.shiftId === shiftId);

    if (toCancel.length > 0) {
      await LocalNotifications.cancel({
        notifications: toCancel.map(n => ({ id: n.id })),
      });
    }
  }

  async cancelAllNotifications(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    const pending = await LocalNotifications.getPending();
    if (pending.notifications.length > 0) {
      await LocalNotifications.cancel({
        notifications: pending.notifications.map(n => ({ id: n.id })),
      });
    }
  }

  getSettings(): NotificationSettings {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    return stored
      ? JSON.parse(stored)
      : {
          enabled: true,
          reminderMinutesBefore: 60, // Default: 1h prima
          dayBeforeEnabled: true,
        };
  }

  saveSettings(settings: NotificationSettings): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(settings));
  }
}
