import { Injectable } from '@angular/core';

const DEVICE_ID_KEY = 'easyturno_device_id';
const SOFT_DEVICE_LIMIT = 4;

@Injectable({ providedIn: 'root' })
export class DeviceService {
  deviceId(): string {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
    return id;
  }

  isSoftLimitExceeded(activeDeviceCount: number): boolean {
    return activeDeviceCount > SOFT_DEVICE_LIMIT;
  }
}
