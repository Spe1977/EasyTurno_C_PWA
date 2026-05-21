import { TestBed } from '@angular/core/testing';
import { DeviceService } from './device.service';

describe('DeviceService', () => {
  beforeEach(() => localStorage.clear());

  it('creates and persists a stable device id', () => {
    const service = TestBed.inject(DeviceService);
    const first = service.deviceId();
    const second = service.deviceId();
    expect(first).toBe(second);
    expect(localStorage.getItem('easyturno_device_id')).toBe(first);
  });

  it('reports soft limit exceeded above four active devices', () => {
    const service = TestBed.inject(DeviceService);
    expect(service.isSoftLimitExceeded(5)).toBe(true);
    expect(service.isSoftLimitExceeded(4)).toBe(false);
  });
});
