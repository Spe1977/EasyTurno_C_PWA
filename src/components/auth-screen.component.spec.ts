import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FirebaseError } from 'firebase/app';

import { AuthScreenComponent } from './auth-screen.component';
import { AuthService } from '../services/auth.service';
import { ToastService } from '../services/toast.service';
import { TranslationService } from '../services/translation.service';

describe('AuthScreenComponent', () => {
  let fixture: ComponentFixture<AuthScreenComponent>;
  let component: AuthScreenComponent;
  let auth: {
    loginGoogle: jest.Mock;
    continueAsGuest: jest.Mock;
    loginEmail: jest.Mock;
    registerEmail: jest.Mock;
    sendPasswordReset: jest.Mock;
  };
  let toast: { error: jest.Mock; success: jest.Mock };

  beforeEach(async () => {
    auth = {
      loginGoogle: jest.fn().mockResolvedValue(undefined),
      continueAsGuest: jest.fn(),
      loginEmail: jest.fn().mockResolvedValue(undefined),
      registerEmail: jest.fn().mockResolvedValue(undefined),
      sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    };
    toast = {
      error: jest.fn(),
      success: jest.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [AuthScreenComponent],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: ToastService, useValue: toast },
        { provide: TranslationService, useValue: { translate: (key: string) => key } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AuthScreenComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  describe('View Switching', () => {
    it('switches between login, register, and forgot password views', () => {
      expect(component.view()).toBe('login');

      component.switchView('register');
      expect(component.view()).toBe('register');

      component.switchView('forgot');
      expect(component.view()).toBe('forgot');

      component.switchView('login');
      expect(component.view()).toBe('login');
    });

    it('clears form fields and errors when switching views', () => {
      component.email.set('test@example.com');
      component.password.set('Password123!');
      component.fieldError.set('email');

      component.switchView('register');

      expect(component.email()).toBe('test@example.com'); // Email is usually preserved for convenience
      expect(component.password()).toBe('');
      expect(component.fieldError()).toBeNull();
    });
  });

  describe('Form Validation', () => {
    it('ignores handleSubmit when already loading', async () => {
      component.loading.set(true);
      component.email.set('invalid-email');
      await component.handleSubmit(new Event('submit'));
      expect(component.fieldError()).toBeNull();
    });

    it('sets fieldError to "email" for invalid email format', async () => {
      component.email.set('invalid-email');
      await component.handleSubmit(new Event('submit'));
      expect(component.fieldError()).toBe('email');
      expect(auth.loginEmail).not.toHaveBeenCalled();
    });

    it('sets fieldError to "password" if password is empty in login view', async () => {
      component.email.set('test@example.com');
      component.password.set('');
      await component.handleSubmit(new Event('submit'));
      expect(component.fieldError()).toBe('password');
      expect(auth.loginEmail).not.toHaveBeenCalled();
    });

    it('sets fieldError to "password" if password is weak in register view', async () => {
      component.switchView('register');
      component.email.set('test@example.com');
      component.password.set('weak');
      await component.handleSubmit(new Event('submit'));
      expect(component.fieldError()).toBe('password');
      expect(component.showPasswordHelp()).toBe(true);
      expect(auth.registerEmail).not.toHaveBeenCalled();
    });

    it('sets fieldError to "passwordConfirm" if passwords mismatch in register view', async () => {
      component.switchView('register');
      component.email.set('test@example.com');
      component.password.set('ValidPass123!');
      component.passwordConfirm.set('DifferentPass123!');
      await component.handleSubmit(new Event('submit'));
      expect(component.fieldError()).toBe('passwordConfirm');
      expect(auth.registerEmail).not.toHaveBeenCalled();
    });
  });

  describe('Login Flow', () => {
    it('calls loginEmail with correct credentials and handles success', async () => {
      component.email.set('test@example.com');
      component.password.set('Password123!');
      await component.handleSubmit(new Event('submit'));

      expect(auth.loginEmail).toHaveBeenCalledWith('test@example.com', 'Password123!');
      expect(component.loading()).toBe(false);
    });

    it('handles login errors by showing a toast with mapped error message', async () => {
      auth.loginEmail.mockRejectedValueOnce(
        new FirebaseError('auth/invalid-credential', 'Invalid credentials')
      );
      component.email.set('test@example.com');
      component.password.set('WrongPass');

      await component.handleSubmit(new Event('submit'));

      expect(toast.error).toHaveBeenCalledWith('authErrorInvalidCredentials');
      expect(component.loading()).toBe(false);
    });
  });

  describe('Registration Flow', () => {
    beforeEach(() => component.switchView('register'));

    it('calls registerEmail and shows success toast on success', async () => {
      component.email.set('new@example.com');
      component.password.set('ValidPass123!');
      component.passwordConfirm.set('ValidPass123!');
      component.displayName.set('New User');

      await component.handleSubmit(new Event('submit'));

      expect(auth.registerEmail).toHaveBeenCalledWith(
        'new@example.com',
        'ValidPass123!',
        'New User'
      );
      expect(toast.success).toHaveBeenCalledWith('authRegistrationSuccess');
    });

    it('handles registration errors like "email-already-in-use"', async () => {
      auth.registerEmail.mockRejectedValueOnce(
        new FirebaseError('auth/email-already-in-use', 'Email exists')
      );
      component.email.set('existing@example.com');
      component.password.set('ValidPass123!');
      component.passwordConfirm.set('ValidPass123!');

      await component.handleSubmit(new Event('submit'));

      expect(toast.error).toHaveBeenCalledWith('authErrorEmailInUse');
    });
  });

  describe('Password Reset Flow', () => {
    beforeEach(() => component.switchView('forgot'));

    it('calls sendPasswordReset and switches back to login on success', async () => {
      component.email.set('lost@example.com');
      await component.handleSubmit(new Event('submit'));

      expect(auth.sendPasswordReset).toHaveBeenCalledWith('lost@example.com');
      expect(toast.success).toHaveBeenCalledWith('authResetEmailSent');
      expect(component.view()).toBe('login');
    });
  });

  describe('Google Login', () => {
    it('ignores handleGoogleLogin when already loading', async () => {
      component.loading.set(true);
      await component.handleGoogleLogin();
      expect(auth.loginGoogle).not.toHaveBeenCalled();
    });

    it('starts Google sign-in and clears loading after success', async () => {
      await component.handleGoogleLogin();
      expect(auth.loginGoogle).toHaveBeenCalledTimes(1);
      expect(component.loading()).toBe(false);
    });

    it('ignores a user-cancelled Google popup', async () => {
      auth.loginGoogle.mockRejectedValueOnce(
        new FirebaseError('auth/popup-closed-by-user', 'Popup closed')
      );
      await component.handleGoogleLogin();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('ignores a user-cancelled popup request', async () => {
      auth.loginGoogle.mockRejectedValueOnce(
        new FirebaseError('auth/cancelled-popup-request', 'Popup request cancelled')
      );
      await component.handleGoogleLogin();
      expect(toast.error).not.toHaveBeenCalled();
    });

    it('maps a blocked Google popup to "authErrorPopupBlocked"', async () => {
      auth.loginGoogle.mockRejectedValueOnce(
        new FirebaseError('auth/popup-blocked', 'Popup blocked')
      );
      await component.handleGoogleLogin();
      expect(toast.error).toHaveBeenCalledWith('authErrorPopupBlocked');
    });
  });

  describe('Firebase Error Code Mapping', () => {
    it('maps auth/user-not-found to authErrorUserNotFound', async () => {
      auth.loginEmail.mockRejectedValueOnce(
        new FirebaseError('auth/user-not-found', 'User not found')
      );
      component.email.set('test@example.com');
      component.password.set('password');
      await component.handleSubmit(new Event('submit'));
      expect(toast.error).toHaveBeenCalledWith('authErrorUserNotFound');
    });

    it('maps auth/weak-password to authErrorWeakPassword', async () => {
      auth.loginEmail.mockRejectedValueOnce(
        new FirebaseError('auth/weak-password', 'Weak password')
      );
      component.email.set('test@example.com');
      component.password.set('password');
      await component.handleSubmit(new Event('submit'));
      expect(toast.error).toHaveBeenCalledWith('authErrorWeakPassword');
    });

    it('maps auth/too-many-requests to authErrorTooManyRequests', async () => {
      auth.loginEmail.mockRejectedValueOnce(
        new FirebaseError('auth/too-many-requests', 'Too many requests')
      );
      component.email.set('test@example.com');
      component.password.set('password');
      await component.handleSubmit(new Event('submit'));
      expect(toast.error).toHaveBeenCalledWith('authErrorTooManyRequests');
    });

    it('maps auth/network-request-failed to authErrorNetwork', async () => {
      auth.loginEmail.mockRejectedValueOnce(
        new FirebaseError('auth/network-request-failed', 'Network error')
      );
      component.email.set('test@example.com');
      component.password.set('password');
      await component.handleSubmit(new Event('submit'));
      expect(toast.error).toHaveBeenCalledWith('authErrorNetwork');
    });

    it('maps unknown Firebase errors to authGenericError', async () => {
      auth.loginEmail.mockRejectedValueOnce(
        new FirebaseError('auth/some-weird-error', 'Something else')
      );
      component.email.set('test@example.com');
      component.password.set('password');
      await component.handleSubmit(new Event('submit'));
      expect(toast.error).toHaveBeenCalledWith('authGenericError');
    });

    it('maps non-FirebaseError to authGenericError', async () => {
      auth.loginEmail.mockRejectedValueOnce(new Error('Some generic JS error'));
      component.email.set('test@example.com');
      component.password.set('password');
      await component.handleSubmit(new Event('submit'));
      expect(toast.error).toHaveBeenCalledWith('authGenericError');
    });
  });

  describe('Guest Mode', () => {
    it('opens guest confirmation and handles confirmation', () => {
      component.openGuestConfirm();
      expect(component.showGuestConfirm()).toBe(true);

      component.confirmGuest();
      expect(auth.continueAsGuest).toHaveBeenCalled();
      expect(component.showGuestConfirm()).toBe(false);
    });

    it('can close guest confirmation without continuing', () => {
      component.openGuestConfirm();
      component.closeGuestConfirm();
      expect(component.showGuestConfirm()).toBe(false);
      expect(auth.continueAsGuest).not.toHaveBeenCalled();
    });
  });

  describe('Input Toggles', () => {
    it('toggles password visibility state', () => {
      expect(component.showPassword()).toBe(false);
      component.toggleShowPassword();
      expect(component.showPassword()).toBe(true);
      component.toggleShowPassword();
      expect(component.showPassword()).toBe(false);
    });

    it('toggles password confirmation visibility state', () => {
      expect(component.showPasswordConfirm()).toBe(false);
      component.toggleShowPasswordConfirm();
      expect(component.showPasswordConfirm()).toBe(true);
      component.toggleShowPasswordConfirm();
      expect(component.showPasswordConfirm()).toBe(false);
    });

    it('toggles password help display state', () => {
      expect(component.showPasswordHelp()).toBe(false);
      component.togglePasswordHelp();
      expect(component.showPasswordHelp()).toBe(true);
      component.togglePasswordHelp();
      expect(component.showPasswordHelp()).toBe(false);
    });
  });
});
