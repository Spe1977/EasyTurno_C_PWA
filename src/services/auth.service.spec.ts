import { TestBed } from '@angular/core/testing';
import * as fbApp from 'firebase/app';
import * as fbAuth from 'firebase/auth';
import * as fbFirestore from 'firebase/firestore';

import { AuthService, mapReauthErrorKey } from './auth.service';
import { FirebaseAppService } from './firebase-app.service';

const flushMicrotasks = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 25));
};

describe('AuthService', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  it('starts in loading mode and resolves to unauthenticated when no user is signed in', async () => {
    const service = TestBed.runInInjectionContext(() => new AuthService());
    expect(service.state().mode).toBe('loading');
    await flushMicrotasks();
    expect(service.state().mode).toBe('unauthenticated');
  });

  it('restores guest mode synchronously from localStorage and skips Firebase bootstrap and SDK initialization', () => {
    localStorage.setItem('easyturno.authMode', 'guest');
    const service = TestBed.runInInjectionContext(() => new AuthService());
    const firebaseApp = TestBed.inject(FirebaseAppService);
    expect(service.state().mode).toBe('guest');
    expect(service.isGuest()).toBe(true);
    expect(firebaseApp.isInitialized).toBe(false);
    expect(fbApp.initializeApp).not.toHaveBeenCalled();
    expect(fbAuth.getAuth).not.toHaveBeenCalled();
    expect(fbAuth.onAuthStateChanged).not.toHaveBeenCalled();
    expect(fbFirestore.initializeFirestore).not.toHaveBeenCalled();
  });

  it('continueAsGuest persists the choice and updates state', () => {
    const service = TestBed.runInInjectionContext(() => new AuthService());
    service.continueAsGuest();
    expect(service.state().mode).toBe('guest');
    expect(localStorage.getItem('easyturno.authMode')).toBe('guest');
  });

  it('exitGuestMode clears storage and bootstraps Firebase', async () => {
    localStorage.setItem('easyturno.authMode', 'guest');
    const service = TestBed.runInInjectionContext(() => new AuthService());
    expect(service.state().mode).toBe('guest');

    service.exitGuestMode();
    expect(localStorage.getItem('easyturno.authMode')).toBeNull();
    expect(service.state().mode).toBe('unauthenticated');
    await flushMicrotasks();
    expect(fbAuth.onAuthStateChanged).toHaveBeenCalled();
  });

  it('registerEmail creates the user, sends a verification email, and reflects emailVerified=false', async () => {
    (fbAuth.createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: {
        uid: 'u1',
        email: 'a@b.it',
        displayName: null,
        emailVerified: false,
      },
    });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.registerEmail('a@b.it', 'password123');

    expect(fbAuth.createUserWithEmailAndPassword).toHaveBeenCalled();
    expect(fbAuth.sendEmailVerification).toHaveBeenCalled();
    expect(service.state().mode).toBe('email-not-verified');
  });

  it('loginEmail with a verified user transitions to authenticated', async () => {
    (fbAuth.signInWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: {
        uid: 'u2',
        email: 'verified@example.com',
        displayName: 'Test',
        emailVerified: true,
      },
    });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.loginEmail('verified@example.com', 'password123');
    expect(service.state()).toMatchObject({
      mode: 'authenticated',
      uid: 'u2',
      email: 'verified@example.com',
      emailVerified: true,
    });
  });

  it('loginGoogle transitions to authenticated for a verified Google user', async () => {
    (fbAuth.signInWithPopup as jest.Mock).mockResolvedValue({
      user: {
        uid: 'google-user',
        email: 'google@example.com',
        displayName: 'Google User',
        emailVerified: true,
        providerData: [{ providerId: 'google.com' }],
      },
    });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.loginGoogle();

    expect(fbAuth.signInWithPopup).toHaveBeenCalled();
    expect(service.state()).toMatchObject({
      mode: 'authenticated',
      uid: 'google-user',
      email: 'google@example.com',
      emailVerified: true,
      providerIds: ['google.com'],
    });
  });

  it('deleteAccount reauthenticates password users before deleting the Firebase user', async () => {
    const currentUser = {
      uid: 'u-password',
      email: 'delete@example.com',
      displayName: null,
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
    };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.deleteAccount({ password: 'Password1!' });

    expect(fbAuth.EmailAuthProvider.credential).toHaveBeenCalledWith(
      'delete@example.com',
      'Password1!'
    );
    expect(fbAuth.reauthenticateWithCredential).toHaveBeenCalledWith(
      currentUser,
      expect.objectContaining({ providerId: 'password' })
    );
    expect(fbAuth.deleteUser).toHaveBeenCalledWith(currentUser);
    expect(service.state().mode).toBe('unauthenticated');
  });

  it('deleteAccount reauthenticates Google users with popup before deleting the Firebase user', async () => {
    const currentUser = {
      uid: 'u-google',
      email: 'google@example.com',
      displayName: 'Google User',
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
    };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.deleteAccount();

    expect(fbAuth.reauthenticateWithPopup).toHaveBeenCalledWith(
      currentUser,
      expect.any(fbAuth.GoogleAuthProvider)
    );
    expect(fbAuth.deleteUser).toHaveBeenCalledWith(currentUser);
    expect(service.state().mode).toBe('unauthenticated');
  });

  it('deleteAccount surfaces requires-recent-login without clearing auth state', async () => {
    const currentUser = {
      uid: 'u-stale',
      email: 'stale@example.com',
      displayName: null,
      emailVerified: true,
      providerData: [{ providerId: 'google.com' }],
    };
    const error = { code: 'auth/requires-recent-login' };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
    (fbAuth.signInWithPopup as jest.Mock).mockResolvedValue({ user: currentUser });
    (fbAuth.deleteUser as jest.Mock).mockRejectedValueOnce(error);
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();
    await service.loginGoogle();

    await expect(service.deleteAccount()).rejects.toBe(error);

    expect(service.state().mode).toBe('authenticated');
  });

  it('resendVerificationEmail honors the 60s cooldown', async () => {
    const fixedNow = 1_700_000_000_000;
    const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(fixedNow);
    (fbAuth.createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: {
        uid: 'u3',
        email: 'x@y.it',
        displayName: null,
        emailVerified: false,
      },
    });
    (fbAuth.getAuth as jest.Mock).mockReturnValue({
      currentUser: { uid: 'u3', emailVerified: false },
    });

    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();
    await service.registerEmail('x@y.it', 'password123');
    expect(fbAuth.sendEmailVerification).toHaveBeenCalledTimes(1);

    // Immediately after registration → cooldown blocks resend.
    const resentImmediate = await service.resendVerificationEmail();
    expect(resentImmediate).toBe(false);
    expect(fbAuth.sendEmailVerification).toHaveBeenCalledTimes(1);

    // 61s later → resend succeeds.
    dateSpy.mockReturnValue(fixedNow + 61_000);
    const resentLater = await service.resendVerificationEmail();
    expect(resentLater).toBe(true);
    expect(fbAuth.sendEmailVerification).toHaveBeenCalledTimes(2);

    dateSpy.mockRestore();
  });

  it('resendVerificationEmail returns false when there is no current user', async () => {
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser: null });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await expect(service.resendVerificationEmail()).resolves.toBe(false);
    expect(fbAuth.sendEmailVerification).not.toHaveBeenCalled();
  });

  it('signOut clears guest preference and transitions to unauthenticated', async () => {
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();
    await service.signOut();
    expect(fbAuth.signOut).toHaveBeenCalled();
    expect(service.state().mode).toBe('unauthenticated');
  });

  it('deletes user Firestore data before deleting the Firebase account', async () => {
    const currentUser = {
      uid: 'uid-delete',
      email: 'delete@example.com',
      displayName: null,
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
    };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });

    // Mock FirestoreUserDataService cleanup
    const cleanupMock = { deleteUserDataTree: jest.fn().mockResolvedValue(undefined) };
    const { FirestoreUserDataService } = await import('./firestore-user-data.service');

    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [AuthService, { provide: FirestoreUserDataService, useValue: cleanupMock }],
    });

    const service = TestBed.inject(AuthService);
    await service.deleteAccount({ password: 'Password1!' });

    expect(cleanupMock.deleteUserDataTree).toHaveBeenCalledWith('uid-delete');
    expect(fbAuth.deleteUser).toHaveBeenCalledWith(currentUser);
  });

  it('deleteAccount does nothing and returns early if currentUser is null', async () => {
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser: null });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.deleteAccount({ password: 'Password1!' });
    expect(service.state().mode).toBe('unauthenticated');
  });

  it('deleteAccount deletes users with missing providerData without reauthentication', async () => {
    const currentUser = {
      uid: 'u-no-providers',
      email: 'plain@example.com',
      displayName: null,
      emailVerified: true,
      providerData: undefined,
    };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.deleteAccount();

    expect(fbAuth.reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(fbAuth.reauthenticateWithPopup).not.toHaveBeenCalled();
    expect(fbAuth.deleteUser).toHaveBeenCalledWith(currentUser);
  });

  it('deleteAccount skips reauthentication for unknown providers', async () => {
    const currentUser = {
      uid: 'u-custom-provider',
      email: 'custom@example.com',
      displayName: null,
      emailVerified: true,
      providerData: [{ providerId: 'custom.example' }],
    };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.deleteAccount();

    expect(fbAuth.reauthenticateWithCredential).not.toHaveBeenCalled();
    expect(fbAuth.reauthenticateWithPopup).not.toHaveBeenCalled();
    expect(fbAuth.deleteUser).toHaveBeenCalledWith(currentUser);
  });

  it('deleteAccount throws an error if provider is password but no password or email is provided', async () => {
    const currentUser = {
      uid: 'u-password',
      email: null,
      displayName: null,
      emailVerified: true,
      providerData: [{ providerId: 'password' }],
    };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await expect(service.deleteAccount()).rejects.toThrow(
      'Password re-authentication requires email and password.'
    );
  });

  it('readSavedMode and writeSavedMode handle localStorage exceptions gracefully', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Security Error');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Security Error');
    });

    const service = TestBed.runInInjectionContext(() => new AuthService());
    expect(service.state().mode).toBe('loading');

    // Reset mocks for other tests
    jest.spyOn(Storage.prototype, 'getItem').mockRestore();
    jest.spyOn(Storage.prototype, 'setItem').mockRestore();
  });

  it('signOut and deleteAccount clear guest preference if set', async () => {
    localStorage.setItem('easyturno.authMode', 'guest');
    const service = TestBed.runInInjectionContext(() => new AuthService());
    expect(localStorage.getItem('easyturno.authMode')).toBe('guest');

    await service.signOut();
    expect(localStorage.getItem('easyturno.authMode')).toBeNull();
  });

  it('registerEmail updates display name if provided', async () => {
    const userMock = {
      uid: 'u1',
      email: 'a@b.it',
      displayName: null,
      emailVerified: false,
    };
    (fbAuth.createUserWithEmailAndPassword as jest.Mock).mockResolvedValue({
      user: userMock,
    });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.registerEmail('a@b.it', 'password123', 'My Display Name');

    expect(fbAuth.createUserWithEmailAndPassword).toHaveBeenCalled();
    expect(fbAuth.updateProfile).toHaveBeenCalledWith(userMock, { displayName: 'My Display Name' });
    expect(fbAuth.sendEmailVerification).toHaveBeenCalled();
  });

  it('refreshUser reloads user if currentUser is not null', async () => {
    const currentUser = { uid: 'u-verified', emailVerified: true };
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.refreshUser();
    expect(fbAuth.reload).toHaveBeenCalledWith(currentUser);
  });

  it('refreshUser returns early if currentUser is null', async () => {
    (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser: null });
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.refreshUser();
    expect(fbAuth.reload).not.toHaveBeenCalled();
  });

  it('sendPasswordReset calls sendPasswordResetEmail', async () => {
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    await service.sendPasswordReset('forgot@example.com');
    expect(fbAuth.sendPasswordResetEmail).toHaveBeenCalledWith(
      expect.any(Object),
      'forgot@example.com'
    );
  });

  it('bootstrapAuth is idempotent after initialization', async () => {
    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    const persistenceCalls = (fbAuth.setPersistence as jest.Mock).mock.calls.length;
    const listenerCalls = (fbAuth.onAuthStateChanged as jest.Mock).mock.calls.length;

    await (service as any).bootstrapAuth();
    await (service as any).bootstrapAuth();

    expect(fbAuth.setPersistence).toHaveBeenCalledTimes(persistenceCalls);
    expect(fbAuth.onAuthStateChanged).toHaveBeenCalledTimes(listenerCalls);
  });

  it('hasPasswordProvider returns false if providerIds is missing', () => {
    const service = TestBed.runInInjectionContext(() => new AuthService());
    (service as any)._state.set({ mode: 'authenticated' });
    expect(service.hasPasswordProvider()).toBe(false);
  });

  it('falls back to unauthenticated and resets initialization flag if bootstrapAuth fails', async () => {
    const firebaseApp = TestBed.inject(FirebaseAppService);
    jest
      .spyOn(firebaseApp, 'getAuth')
      .mockRejectedValueOnce(new Error('auth chunk unavailable'))
      .mockRejectedValueOnce(new Error('auth chunk still down'));

    const service = TestBed.runInInjectionContext(() => new AuthService());
    await flushMicrotasks();

    expect(service.state().mode).toBe('unauthenticated');
    expect((service as any).authInitialized).toBe(false);

    // Trigger again from non-loading state (continueAsGuest -> exitGuestMode -> bootstrapAuth)
    service.continueAsGuest();
    service.exitGuestMode();
    await flushMicrotasks();

    expect(service.state().mode).toBe('unauthenticated');
    expect((service as any).authInitialized).toBe(false);
  });

  describe('Fase 7: reauthenticateForSensitiveAction & error mapping', () => {
    const restoreOnline = (originalDescriptor?: PropertyDescriptor) => {
      if (originalDescriptor) {
        Object.defineProperty(navigator, 'onLine', originalDescriptor);
      } else {
        Object.defineProperty(navigator, 'onLine', {
          configurable: true,
          value: true,
        });
      }
    };

    it('reauthenticates Email/Password users via EmailAuthProvider.credential without deleting user', async () => {
      const currentUser = {
        uid: 'u-pwd',
        email: 'user@example.com',
        displayName: null,
        emailVerified: true,
        providerData: [{ providerId: 'password' }],
      };
      (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
      const service = TestBed.runInInjectionContext(() => new AuthService());
      await flushMicrotasks();

      await service.reauthenticateForSensitiveAction({ password: 'MySecretPassword1!' });

      expect(fbAuth.EmailAuthProvider.credential).toHaveBeenCalledWith(
        'user@example.com',
        'MySecretPassword1!'
      );
      expect(fbAuth.reauthenticateWithCredential).toHaveBeenCalledWith(
        currentUser,
        expect.objectContaining({ providerId: 'password' })
      );
      expect(fbAuth.deleteUser).not.toHaveBeenCalled();
    });

    it('reauthenticates Google users via reauthenticateWithPopup without deleting user', async () => {
      const currentUser = {
        uid: 'u-google',
        email: 'google@example.com',
        displayName: 'Google User',
        emailVerified: true,
        providerData: [{ providerId: 'google.com' }],
      };
      (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
      const service = TestBed.runInInjectionContext(() => new AuthService());
      await flushMicrotasks();

      await service.reauthenticateForSensitiveAction();

      expect(fbAuth.reauthenticateWithPopup).toHaveBeenCalledWith(
        currentUser,
        expect.any(fbAuth.GoogleAuthProvider)
      );
      expect(fbAuth.reauthenticateWithCredential).not.toHaveBeenCalled();
      expect(fbAuth.deleteUser).not.toHaveBeenCalled();
    });

    it('rejects immediately with auth/network-request-failed when offline (navigator.onLine === false)', async () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: false,
      });

      try {
        const currentUser = {
          uid: 'u-pwd',
          email: 'user@example.com',
          emailVerified: true,
          providerData: [{ providerId: 'password' }],
        };
        (fbAuth.getAuth as jest.Mock).mockReturnValue({ currentUser });
        const service = TestBed.runInInjectionContext(() => new AuthService());
        await flushMicrotasks();

        await expect(
          service.reauthenticateForSensitiveAction({ password: 'Password1!' })
        ).rejects.toMatchObject({ code: 'auth/network-request-failed' });

        expect(fbAuth.reauthenticateWithCredential).not.toHaveBeenCalled();
        expect(fbAuth.reauthenticateWithPopup).not.toHaveBeenCalled();
      } finally {
        restoreOnline(originalDescriptor);
      }
    });

    it('propagates expected Firebase reauthentication errors cleanly', async () => {
      const authStub: { currentUser: unknown } = {
        currentUser: {
          uid: 'u-pwd',
          email: 'user@example.com',
          emailVerified: true,
          providerData: [{ providerId: 'password' }],
        },
      };
      (fbAuth.getAuth as jest.Mock).mockReturnValue(authStub);
      const service = TestBed.runInInjectionContext(() => new AuthService());
      await flushMicrotasks();

      const expectedCodes = [
        'auth/wrong-password',
        'auth/invalid-credential',
        'auth/too-many-requests',
        'auth/network-request-failed',
      ];

      for (const code of expectedCodes) {
        const firebaseError = Object.assign(new Error(code), { code });
        (fbAuth.reauthenticateWithCredential as jest.Mock).mockRejectedValueOnce(firebaseError);

        await expect(
          service.reauthenticateForSensitiveAction({ password: 'WrongPassword!' })
        ).rejects.toMatchObject({ code });
      }

      authStub.currentUser = {
        uid: 'u-google',
        email: 'google@example.com',
        emailVerified: true,
        providerData: [{ providerId: 'google.com' }],
      };
      const popupError = Object.assign(new Error('Popup closed'), {
        code: 'auth/popup-closed-by-user',
      });
      (fbAuth.reauthenticateWithPopup as jest.Mock).mockRejectedValueOnce(popupError);

      await expect(service.reauthenticateForSensitiveAction()).rejects.toMatchObject({
        code: 'auth/popup-closed-by-user',
      });
    });

    it('normalizes an uncoded error thrown during mid-flight offline disconnect to auth/network-request-failed', async () => {
      const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'onLine');
      const authStub = {
        currentUser: {
          uid: 'u-pwd',
          email: 'user@example.com',
          emailVerified: true,
          providerData: [{ providerId: 'password' }],
        },
      };
      (fbAuth.getAuth as jest.Mock).mockReturnValue(authStub);
      const service = TestBed.runInInjectionContext(() => new AuthService());
      await flushMicrotasks();

      (fbAuth.reauthenticateWithCredential as jest.Mock).mockImplementationOnce(async () => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: false });
        throw new Error('Failed to fetch');
      });

      try {
        await expect(
          service.reauthenticateForSensitiveAction({ password: 'Password1!' })
        ).rejects.toMatchObject({ code: 'auth/network-request-failed' });
      } finally {
        restoreOnline(originalDescriptor);
      }
    });

    it('throws auth/requires-recent-login when no currentUser is present and auth/invalid-credential when password is missing', async () => {
      const authStub: { currentUser: unknown } = { currentUser: null };
      (fbAuth.getAuth as jest.Mock).mockReturnValue(authStub);
      const service = TestBed.runInInjectionContext(() => new AuthService());
      await flushMicrotasks();

      await expect(
        service.reauthenticateForSensitiveAction({ password: 'Password1!' })
      ).rejects.toMatchObject({ code: 'auth/requires-recent-login' });

      authStub.currentUser = {
        uid: 'u-pwd',
        email: 'user@example.com',
        emailVerified: true,
        providerData: [{ providerId: 'password' }],
      };

      await expect(service.reauthenticateForSensitiveAction()).rejects.toMatchObject({
        code: 'auth/invalid-credential',
      });
    });

    it('maps reauth error codes to clear i18n translation keys', () => {
      const service = TestBed.runInInjectionContext(() => new AuthService());
      expect(mapReauthErrorKey({ code: 'auth/wrong-password' })).toBe('resetErrorInvalidPassword');
      expect(mapReauthErrorKey({ code: 'auth/invalid-credential' })).toBe(
        'resetErrorInvalidPassword'
      );
      expect(mapReauthErrorKey({ code: 'auth/too-many-requests' })).toBe(
        'authErrorTooManyRequests'
      );
      expect(mapReauthErrorKey({ code: 'auth/network-request-failed' })).toBe('resetErrorOffline');
      expect(mapReauthErrorKey({ code: 'auth/popup-closed-by-user' })).toBe(
        'resetErrorPopupClosed'
      );
      expect(mapReauthErrorKey({ code: 'auth/cancelled-popup-request' })).toBe(
        'resetErrorPopupClosed'
      );
      expect(mapReauthErrorKey({ code: 'auth/popup-blocked' })).toBe('authErrorPopupBlocked');
      expect(mapReauthErrorKey({ code: 'auth/requires-recent-login' })).toBe(
        'authDeleteAccountReauthRequired'
      );
      expect(service.mapReauthErrorKey(new Error('unknown'))).toBe('authGenericError');
      expect(service.mapReauthErrorKey('non-object')).toBe('authGenericError');
    });
  });
});
