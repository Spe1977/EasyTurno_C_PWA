import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { EmailVerificationScreenComponent } from './email-verification-screen.component';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { TranslationService } from '../services/translation.service';

describe('EmailVerificationScreenComponent', () => {
  let fixture: ComponentFixture<EmailVerificationScreenComponent>;
  let component: EmailVerificationScreenComponent;

  let authMock: {
    state: any;
    refreshUser: jest.Mock;
    resendVerificationEmail: jest.Mock;
    signOut: jest.Mock;
  };
  let toastMock: {
    success: jest.Mock;
    info: jest.Mock;
    error: jest.Mock;
  };
  let translationMock: {
    translate: jest.Mock;
  };

  beforeEach(async () => {
    authMock = {
      state: signal({ mode: 'email-not-verified', email: 'user@example.com', uid: 'uid-123' }),
      refreshUser: jest.fn().mockResolvedValue(undefined),
      resendVerificationEmail: jest.fn().mockResolvedValue(true),
      signOut: jest.fn().mockResolvedValue(undefined),
    };

    toastMock = {
      success: jest.fn(),
      info: jest.fn(),
      error: jest.fn(),
    };

    translationMock = {
      translate: jest.fn((key: string) => {
        if (key === 'authVerificationBody') {
          return 'Verifica inviata a {email}';
        }
        return key;
      }),
    };

    await TestBed.configureTestingModule({
      imports: [EmailVerificationScreenComponent],
      providers: [
        { provide: AuthService, useValue: authMock },
        { provide: ToastService, useValue: toastMock },
        { provide: TranslationService, useValue: translationMock },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(EmailVerificationScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  afterEach(() => {
    // Clean up any timers that might be running
    if (component['cooldownTimer']) {
      clearInterval(component['cooldownTimer']);
    }
  });

  it('should render and display the user email in the body message', () => {
    expect(component.bodyMessage()).toBe('Verifica inviata a user@example.com');
  });

  it('should fallback to empty string if user email is null/undefined', () => {
    authMock.state.set({ mode: 'email-not-verified', email: null, uid: 'uid-123' });
    expect(component.bodyMessage()).toBe('Verifica inviata a ');
  });

  describe('handleVerified', () => {
    it('should set checking to true during execution and refresh the user', async () => {
      const refreshPromise = component.handleVerified();
      expect(component.checking()).toBe(true);
      await refreshPromise;
      expect(component.checking()).toBe(false);
      expect(authMock.refreshUser).toHaveBeenCalled();
    });

    it('should toast an info message if the user email is still not verified', async () => {
      authMock.state.set({ mode: 'email-not-verified', email: 'user@example.com' });
      await component.handleVerified();
      expect(toastMock.info).toHaveBeenCalledWith('authVerificationStillPending');
    });

    it('should not toast if user mode is now verified', async () => {
      authMock.state.set({ mode: 'authenticated', email: 'user@example.com' });
      await component.handleVerified();
      expect(toastMock.info).not.toHaveBeenCalled();
    });

    it('should toast an error if refreshUser rejects', async () => {
      authMock.refreshUser.mockRejectedValueOnce(new Error('Firebase error'));
      await component.handleVerified();
      expect(toastMock.error).toHaveBeenCalledWith('authGenericError');
    });

    it('should ignore handleVerified if checking is already in progress', async () => {
      component.checking.set(true);
      await component.handleVerified();
      expect(authMock.refreshUser).not.toHaveBeenCalled();
    });
  });

  describe('handleResend', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should trigger verification email resend and start cooldown if successful', async () => {
      const resendPromise = component.handleResend();
      expect(component.resending()).toBe(true);

      await resendPromise;

      expect(component.resending()).toBe(false);
      expect(authMock.resendVerificationEmail).toHaveBeenCalled();
      expect(toastMock.success).toHaveBeenCalledWith('authVerificationResent');
      expect(component.cooldownRemaining()).toBe(60);

      // Fast forward cooldown timer by 10 seconds
      jest.advanceTimersByTime(10000);
      expect(component.cooldownRemaining()).toBe(50);

      // Fast forward the rest of the cooldown
      jest.advanceTimersByTime(50000);
      expect(component.cooldownRemaining()).toBe(0);
    });

    it('should toast info message if cooldown is still active from server perspective', async () => {
      authMock.resendVerificationEmail.mockResolvedValueOnce(false);
      await component.handleResend();

      expect(toastMock.info).toHaveBeenCalledWith('authVerificationCooldown');
      expect(component.cooldownRemaining()).toBe(0);
    });

    it('should toast error if resend rejects', async () => {
      authMock.resendVerificationEmail.mockRejectedValueOnce(new Error('Send error'));
      await component.handleResend();

      expect(toastMock.error).toHaveBeenCalledWith('authGenericError');
    });

    it('should ignore clicks if resending is already in progress or cooldown is active', async () => {
      component.resending.set(true);
      await component.handleResend();
      expect(authMock.resendVerificationEmail).not.toHaveBeenCalled();

      component.resending.set(false);
      component.cooldownRemaining.set(30);
      await component.handleResend();
      expect(authMock.resendVerificationEmail).not.toHaveBeenCalled();
    });

    it('should clear existing timer when starting cooldown again', async () => {
      const clearIntervalSpy = jest.spyOn(window, 'clearInterval');

      // Start first cooldown
      await component.handleResend();
      expect(component.cooldownRemaining()).toBe(60);

      // Reset mocks and run again to trigger branch
      authMock.resendVerificationEmail.mockClear();
      component.cooldownRemaining.set(0); // clear cooldown so handleResend doesn't guard

      await component.handleResend();
      expect(clearIntervalSpy).toHaveBeenCalled();

      clearIntervalSpy.mockRestore();
    });

    it('should finish cooldown even if the timer reference was already cleared', () => {
      (component as any).startCooldown(1);
      (component as any).cooldownTimer = null;

      jest.advanceTimersByTime(1000);

      expect(component.cooldownRemaining()).toBe(0);
    });
  });

  describe('handleSignOut', () => {
    it('should invoke auth signOut', async () => {
      await component.handleSignOut();
      expect(authMock.signOut).toHaveBeenCalled();
    });

    it('should toast error if signOut fails', async () => {
      authMock.signOut.mockRejectedValueOnce(new Error('Sign out failure'));
      await component.handleSignOut();
      expect(toastMock.error).toHaveBeenCalledWith('authGenericError');
    });
  });
});
