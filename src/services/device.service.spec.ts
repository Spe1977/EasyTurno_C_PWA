import { TestBed } from '@angular/core/testing';
import { Capacitor } from '@capacitor/core';
import { DeviceService } from './device.service';

describe('DeviceService', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => jest.restoreAllMocks());

  it('creates and persists a stable device id', () => {
    const service = TestBed.inject(DeviceService);
    const first = service.deviceId();
    const second = service.deviceId();
    expect(first).toBe(second);
    expect(localStorage.getItem('easyturno_device_id')).toBe(first);
  });

  it('reports soft limit exceeded above three installed devices', () => {
    const service = TestBed.inject(DeviceService);
    expect(service.isSoftLimitExceeded(4)).toBe(true);
    expect(service.isSoftLimitExceeded(3)).toBe(false);
    expect(service.isSoftLimitExceeded(2)).toBe(false);
  });

  describe('detectPlatform', () => {
    it('returns native when running under Capacitor', () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(true);
      const service = TestBed.inject(DeviceService);
      expect(service.detectPlatform()).toBe('native');
    });

    it('returns pwa-installed when the display mode is standalone', () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: jest.fn().mockReturnValue({ matches: true }),
      });
      const service = TestBed.inject(DeviceService);
      expect(service.detectPlatform()).toBe('pwa-installed');
    });

    it('returns web for a normal browser tab', () => {
      jest.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: jest.fn().mockReturnValue({ matches: false }),
      });
      const service = TestBed.inject(DeviceService);
      expect(service.detectPlatform()).toBe('web');
    });
  });
});
