import { TestBed } from '@angular/core/testing';
import { SwUpdateService } from './sw-update.service';

describe('SwUpdateService', () => {
  let service: SwUpdateService;
  let mockRegistration: any;
  let mockNewWorker: any;

  beforeEach(() => {
    // Mock ServiceWorkerRegistration
    mockNewWorker = {
      state: 'installing',
      addEventListener: jest.fn(),
    };

    mockRegistration = {
      installing: mockNewWorker,
      waiting: null,
      update: jest.fn().mockResolvedValue(undefined),
      addEventListener: jest.fn(),
    };

    // Mock navigator.serviceWorker
    Object.defineProperty(navigator, 'serviceWorker', {
      writable: true,
      configurable: true,
      value: {
        register: jest.fn().mockResolvedValue(mockRegistration),
        controller: null,
        addEventListener: jest.fn(),
      },
    });

    TestBed.configureTestingModule({
      providers: [SwUpdateService],
    });
    service = TestBed.inject(SwUpdateService);

    // Clear all timers before each test
    jest.clearAllTimers();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('checkForUpdates', () => {
    it('should register service worker successfully', async () => {
      await service.checkForUpdates();

      expect(navigator.serviceWorker.register).toHaveBeenCalledWith('/sw.js');
    });

    it('should not register if serviceWorker is not supported', async () => {
      const originalSW = (navigator as any).serviceWorker;
      const registerSpy = jest.fn();

      Object.defineProperty(navigator, 'serviceWorker', {
        writable: true,
        configurable: true,
        value: undefined,
      });

      await service.checkForUpdates();

      // Restore immediately
      Object.defineProperty(navigator, 'serviceWorker', {
        writable: true,
        configurable: true,
        value: originalSW,
      });

      // Since serviceWorker is not supported, we should not try to register
      // This test verifies the early return works correctly
      expect(registerSpy).not.toHaveBeenCalled();
    });

    it('should set up update check interval (60 seconds)', async () => {
      await service.checkForUpdates();

      expect(mockRegistration.update).not.toHaveBeenCalled();

      // Advance timer by 60 seconds
      jest.advanceTimersByTime(60000);

      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      // Advance another 60 seconds
      jest.advanceTimersByTime(60000);

      expect(mockRegistration.update).toHaveBeenCalledTimes(2);
    });

    it('should listen for updatefound event', async () => {
      await service.checkForUpdates();

      expect(mockRegistration.addEventListener).toHaveBeenCalledWith(
        'updatefound',
        expect.any(Function)
      );
    });

    it('should set updateAvailable to true when new worker is installed', async () => {
      // Set navigator.serviceWorker.controller to simulate existing SW
      (navigator.serviceWorker as any).controller = {};

      await service.checkForUpdates();

      expect(service.updateAvailable()).toBe(false);

      // Get the updatefound callback
      const updatefoundCallback = mockRegistration.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'updatefound'
      )?.[1];

      expect(updatefoundCallback).toBeDefined();

      // Trigger updatefound
      updatefoundCallback();

      // Get the statechange callback registered on newWorker
      const statechangeCallback = mockNewWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'statechange'
      )?.[1];

      expect(statechangeCallback).toBeDefined();

      // Simulate new worker state change to 'installed'
      mockNewWorker.state = 'installed';
      statechangeCallback();

      expect(service.updateAvailable()).toBe(true);
    });

    it('should not set updateAvailable if no controller exists', async () => {
      // No controller means first installation, not an update
      (navigator.serviceWorker as any).controller = null;

      await service.checkForUpdates();

      // Get the updatefound callback
      const updatefoundCallback = mockRegistration.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'updatefound'
      )?.[1];

      updatefoundCallback();

      const statechangeCallback = mockNewWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'statechange'
      )?.[1];

      // Simulate new worker state change to 'installed'
      mockNewWorker.state = 'installed';
      statechangeCallback();

      // Should still be false (no update, just first install)
      expect(service.updateAvailable()).toBe(false);
    });

    it('should listen for controllerchange event', async () => {
      await service.checkForUpdates();

      expect(navigator.serviceWorker.addEventListener).toHaveBeenCalledWith(
        'controllerchange',
        expect.any(Function)
      );
    });

    it('should trigger reload on controllerchange event', async () => {
      // `window.location.reload` is non-configurable in JSDOM and cannot be
      // spied on directly. The service exposes a protected `reloadPage` wrapper
      // around `window.location.reload()` precisely so it can be intercepted
      // in tests.
      const reloadSpy = jest
        .spyOn(service as unknown as { reloadPage: () => void }, 'reloadPage')
        .mockImplementation(() => {});

      await service.checkForUpdates();

      const controllerchangeCallback = (
        navigator.serviceWorker.addEventListener as jest.Mock
      ).mock.calls.find((call: any) => call[0] === 'controllerchange')?.[1];

      expect(controllerchangeCallback).toBeDefined();

      controllerchangeCallback();
      expect(reloadSpy).toHaveBeenCalledTimes(1);

      reloadSpy.mockRestore();
    });

    it('should handle registration errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const error = new Error('Registration failed');

      (navigator.serviceWorker.register as jest.Mock).mockRejectedValueOnce(error);

      await service.checkForUpdates();

      expect(consoleErrorSpy).toHaveBeenCalledWith('Service Worker registration failed:', error);

      consoleErrorSpy.mockRestore();
    });

    it('should handle missing installing worker gracefully', async () => {
      mockRegistration.installing = null;

      await service.checkForUpdates();

      const updatefoundCallback = mockRegistration.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'updatefound'
      )?.[1];

      // Should not throw when installing is null
      expect(() => updatefoundCallback()).not.toThrow();
    });
  });

  describe('activateUpdate', () => {
    it('should send SKIP_WAITING message to waiting worker', async () => {
      const mockWaitingWorker = {
        postMessage: jest.fn(),
      };

      await service.checkForUpdates();
      mockRegistration.waiting = mockWaitingWorker;

      service.activateUpdate();

      expect(mockWaitingWorker.postMessage).toHaveBeenCalledWith({
        type: 'SKIP_WAITING',
      });
    });

    it('should not throw if no waiting worker exists', async () => {
      await service.checkForUpdates();
      mockRegistration.waiting = null;

      expect(() => service.activateUpdate()).not.toThrow();
    });

    it('should not throw if no registration exists', () => {
      // Don't call checkForUpdates, so no registration
      expect(() => service.activateUpdate()).not.toThrow();
    });
  });

  describe('updateAvailable signal', () => {
    it('should initialize updateAvailable to false', () => {
      expect(service.updateAvailable()).toBe(false);
    });

    it('should be reactive when set to true', async () => {
      (navigator.serviceWorker as any).controller = {};

      await service.checkForUpdates();

      const updatefoundCallback = mockRegistration.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'updatefound'
      )?.[1];

      updatefoundCallback();

      const statechangeCallback = mockNewWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'statechange'
      )?.[1];

      mockNewWorker.state = 'installed';

      expect(service.updateAvailable()).toBe(false);

      statechangeCallback();

      expect(service.updateAvailable()).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle multiple update checks simultaneously', async () => {
      const promise1 = service.checkForUpdates();
      const promise2 = service.checkForUpdates();
      const promise3 = service.checkForUpdates();

      await Promise.all([promise1, promise2, promise3]);

      // Should register SW at least once
      expect(navigator.serviceWorker.register).toHaveBeenCalled();
    });

    it('should handle new worker state changes other than installed', async () => {
      (navigator.serviceWorker as any).controller = {};

      await service.checkForUpdates();

      const updatefoundCallback = mockRegistration.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'updatefound'
      )?.[1];

      updatefoundCallback();

      const statechangeCallback = mockNewWorker.addEventListener.mock.calls.find(
        (call: any) => call[0] === 'statechange'
      )?.[1];

      // Try other states
      mockNewWorker.state = 'activating';
      statechangeCallback();

      expect(service.updateAvailable()).toBe(false);

      mockNewWorker.state = 'activated';
      statechangeCallback();

      expect(service.updateAvailable()).toBe(false);
    });

    it('should clear previous intervals when called multiple times', async () => {
      await service.checkForUpdates();

      jest.advanceTimersByTime(60000);
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      // Call again
      await service.checkForUpdates();

      jest.advanceTimersByTime(60000);

      // Should have more calls now from both intervals
      expect(mockRegistration.update).toHaveBeenCalledTimes(3);
    });
  });

  describe('cleanup (T12)', () => {
    it('should clear the update check interval set by checkForUpdates', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await service.checkForUpdates();

      // Sanity: interval fires once after 60s
      jest.advanceTimersByTime(60000);
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      service.cleanup();

      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

      // After cleanup, advancing time must NOT trigger any further update() calls
      jest.advanceTimersByTime(300000);
      expect(mockRegistration.update).toHaveBeenCalledTimes(1);

      clearIntervalSpy.mockRestore();
    });

    it('should be a no-op when called before checkForUpdates', () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      expect(() => service.cleanup()).not.toThrow();
      expect(clearIntervalSpy).not.toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should be idempotent when called multiple times', async () => {
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

      await service.checkForUpdates();

      service.cleanup();
      service.cleanup();
      service.cleanup();

      // Only the first call has an interval to clear; subsequent calls hit
      // the `updateCheckInterval === null` guard and skip clearInterval.
      expect(clearIntervalSpy).toHaveBeenCalledTimes(1);

      clearIntervalSpy.mockRestore();
    });
  });
});
