import { TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ToastService, Toast } from './toast.service';

describe('ToastService', () => {
  let service: ToastService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ToastService],
    });
    service = TestBed.inject(ToastService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('show', () => {
    it('should add a toast with default type and duration', () => {
      service.show('Test message');

      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('info');
      expect(toasts[0].duration).toBe(3000);
      expect(toasts[0].id).toBeTruthy();
    });

    it('should add a toast with custom type', () => {
      service.show('Success message', 'success');

      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
    });

    it('should add a toast with custom duration', () => {
      service.show('Custom duration', 'info', 5000);

      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].duration).toBe(5000);
    });

    it('should auto-dismiss toast after duration', () => {
      service.show('Auto dismiss', 'info', 3000);

      expect(service.toasts()).toHaveLength(1);

      jest.advanceTimersByTime(3000);

      expect(service.toasts()).toHaveLength(0);
    });

    it('should not auto-dismiss toast with duration 0', () => {
      service.show('No auto dismiss', 'info', 0);

      expect(service.toasts()).toHaveLength(1);

      jest.advanceTimersByTime(10000);

      expect(service.toasts()).toHaveLength(1);
    });

    it('should handle multiple toasts', () => {
      service.show('Toast 1');
      service.show('Toast 2');
      service.show('Toast 3');

      expect(service.toasts()).toHaveLength(3);
    });

    it('should generate unique IDs for each toast', () => {
      service.show('Toast 1');
      service.show('Toast 2');

      const toasts = service.toasts();
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });
  });

  describe('success', () => {
    it('should create a success toast', () => {
      service.success('Success!');

      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('success');
      expect(toasts[0].message).toBe('Success!');
      expect(toasts[0].duration).toBe(3000);
    });

    it('should accept custom duration', () => {
      service.success('Success!', 5000);

      const toasts = service.toasts();
      expect(toasts[0].duration).toBe(5000);
    });
  });

  describe('error', () => {
    it('should create an error toast', () => {
      service.error('Error occurred');

      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('error');
      expect(toasts[0].message).toBe('Error occurred');
      expect(toasts[0].duration).toBe(4000);
    });

    it('should accept custom duration', () => {
      service.error('Error occurred', 6000);

      const toasts = service.toasts();
      expect(toasts[0].duration).toBe(6000);
    });
  });

  describe('warning', () => {
    it('should create a warning toast', () => {
      service.warning('Warning!');

      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('warning');
      expect(toasts[0].message).toBe('Warning!');
      expect(toasts[0].duration).toBe(3500);
    });

    it('should accept custom duration', () => {
      service.warning('Warning!', 4500);

      const toasts = service.toasts();
      expect(toasts[0].duration).toBe(4500);
    });
  });

  describe('info', () => {
    it('should create an info toast', () => {
      service.info('Information');

      const toasts = service.toasts();
      expect(toasts).toHaveLength(1);
      expect(toasts[0].type).toBe('info');
      expect(toasts[0].message).toBe('Information');
      expect(toasts[0].duration).toBe(3000);
    });

    it('should accept custom duration', () => {
      service.info('Information', 2000);

      const toasts = service.toasts();
      expect(toasts[0].duration).toBe(2000);
    });
  });

  describe('dismiss', () => {
    it('should dismiss a specific toast by id', () => {
      service.show('Toast 1');
      service.show('Toast 2');

      const toasts = service.toasts();
      const idToDismiss = toasts[0].id;

      service.dismiss(idToDismiss);

      const remainingToasts = service.toasts();
      expect(remainingToasts).toHaveLength(1);
      expect(remainingToasts[0].id).not.toBe(idToDismiss);
    });

    it('should do nothing if id does not exist', () => {
      service.show('Toast 1');

      service.dismiss('non-existent-id');

      expect(service.toasts()).toHaveLength(1);
    });
  });

  describe('dismissAll', () => {
    it('should dismiss all toasts', () => {
      service.show('Toast 1');
      service.show('Toast 2');
      service.show('Toast 3');

      expect(service.toasts()).toHaveLength(3);

      service.dismissAll();

      expect(service.toasts()).toHaveLength(0);
    });

    it('should work when there are no toasts', () => {
      service.dismissAll();
      expect(service.toasts()).toHaveLength(0);
    });
  });

  describe('signal reactivity', () => {
    it('should update signal when toast is added', () => {
      expect(service.toasts()).toHaveLength(0);

      service.show('New toast');

      expect(service.toasts()).toHaveLength(1);
    });

    it('should update signal when toast is dismissed', () => {
      service.show('Toast');
      const toastId = service.toasts()[0].id;

      service.dismiss(toastId);

      expect(service.toasts()).toHaveLength(0);
    });
  });

  describe('auto-dismiss timing', () => {
    it('should dismiss multiple toasts at correct times', () => {
      service.show('Quick toast', 'info', 1000);
      service.show('Slow toast', 'info', 3000);

      expect(service.toasts()).toHaveLength(2);

      jest.advanceTimersByTime(1000);
      expect(service.toasts()).toHaveLength(1);
      expect(service.toasts()[0].message).toBe('Slow toast');

      jest.advanceTimersByTime(2000);
      expect(service.toasts()).toHaveLength(0);
    });
  });
});
