import { Injectable, computed, inject, signal } from '@angular/core';
import type { User } from 'firebase/auth';

import { FirebaseAppService } from './firebase-app.service';
import { FirestoreUserDataService } from './firestore-user-data.service';
import { createLazyLoader } from '../utils/lazy-loader';

export type AuthMode =
  'loading' | 'unauthenticated' | 'guest' | 'authenticated' | 'email-not-verified';

export interface AuthState {
  mode: AuthMode;
  uid?: string;
  email?: string | null;
  displayName?: string | null;
  emailVerified?: boolean;
  providerIds?: string[];
}

export interface DeleteAccountOptions {
  password?: string;
}

export type ReauthOptions = DeleteAccountOptions;

export function extractAuthErrorCode(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string'
  ) {
    return (error as { code: string }).code;
  }
  return '';
}

export function mapReauthErrorKey(error: unknown): string {
  switch (extractAuthErrorCode(error)) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
      return 'resetErrorInvalidPassword';
    case 'auth/too-many-requests':
      return 'authErrorTooManyRequests';
    case 'auth/network-request-failed':
      return 'resetErrorOffline';
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'resetErrorPopupClosed';
    case 'auth/popup-blocked':
      return 'authErrorPopupBlocked';
    case 'auth/requires-recent-login':
      return 'authDeleteAccountReauthRequired';
    default:
      return 'authGenericError';
  }
}

const AUTH_MODE_STORAGE_KEY = 'easyturno.authMode';
const VERIFICATION_RESEND_COOLDOWN_MS = 60_000;

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseApp = inject(FirebaseAppService);
  private readonly firestoreUserData = inject(FirestoreUserDataService);

  private readonly _state = signal<AuthState>({ mode: 'loading' });
  readonly state = this._state.asReadonly();
  readonly mode = computed(() => this._state().mode);
  readonly isGuest = computed(() => this._state().mode === 'guest');
  readonly isAuthenticated = computed(() => this._state().mode === 'authenticated');
  readonly needsEmailVerification = computed(() => this._state().mode === 'email-not-verified');
  readonly hasPasswordProvider = computed(
    () => this._state().providerIds?.includes('password') ?? false
  );

  private authInitialized = false;
  private lastVerificationSentAt = 0;
  private readonly loadAuthSdk = createLazyLoader(() => import('firebase/auth'));

  constructor() {
    if (this.readSavedMode() === 'guest') {
      this._state.set({ mode: 'guest' });
      return;
    }
    void this.bootstrapAuth();
  }

  /** User explicitly chooses to skip account creation. */
  continueAsGuest(): void {
    this.writeSavedMode('guest');
    this._state.set({ mode: 'guest' });
  }

  /** Leave guest mode and go back to the auth screen (e.g. from Settings). */
  exitGuestMode(): void {
    this.writeSavedMode(null);
    this._state.set({ mode: 'unauthenticated' });
    void this.bootstrapAuth();
  }

  async registerEmail(email: string, password: string, displayName?: string): Promise<void> {
    this.clearGuestPreference();
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    const credential = await sdk.createUserWithEmailAndPassword(auth, email, password);
    if (displayName && displayName.trim().length > 0) {
      await sdk.updateProfile(credential.user, { displayName: displayName.trim() });
    }
    await sdk.sendEmailVerification(credential.user);
    this.lastVerificationSentAt = Date.now();
    this.handleUserChange(credential.user);
  }

  async loginEmail(email: string, password: string): Promise<void> {
    this.clearGuestPreference();
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    const credential = await sdk.signInWithEmailAndPassword(auth, email, password);
    this.handleUserChange(credential.user);
  }

  async loginGoogle(): Promise<void> {
    this.clearGuestPreference();
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    const provider = new sdk.GoogleAuthProvider();
    const credential = await sdk.signInWithPopup(auth, provider);
    this.handleUserChange(credential.user);
  }

  /** Resend verification email. Returns false if rate-limited (60s cooldown). */
  async resendVerificationEmail(): Promise<boolean> {
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    const user = auth.currentUser;
    if (!user) return false;
    const elapsed = Date.now() - this.lastVerificationSentAt;
    if (elapsed < VERIFICATION_RESEND_COOLDOWN_MS) return false;
    await sdk.sendEmailVerification(user);
    this.lastVerificationSentAt = Date.now();
    return true;
  }

  /** Force-refresh the user record to pick up email verification done in another tab. */
  async refreshUser(): Promise<void> {
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    const user = auth.currentUser;
    if (!user) return;
    await sdk.reload(user);
    this.handleUserChange(auth.currentUser);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    await sdk.sendPasswordResetEmail(auth, email);
  }

  async signOut(): Promise<void> {
    this.clearGuestPreference();
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    await sdk.signOut(auth);
    this._state.set({ mode: 'unauthenticated' });
  }

  async reauthenticateForSensitiveAction(options: ReauthOptions = {}): Promise<void> {
    if (this.isDeviceOffline()) {
      throw this.createAuthError(
        'auth/network-request-failed',
        'Network request failed while offline.'
      );
    }
    try {
      await this.reauthenticateCurrentUser(options);
    } catch (error) {
      if (!extractAuthErrorCode(error) && this.isDeviceOffline()) {
        throw this.createAuthError(
          'auth/network-request-failed',
          'Network request failed while offline.'
        );
      }
      throw error;
    }
  }

  mapReauthErrorKey(error: unknown): string {
    return mapReauthErrorKey(error);
  }

  async deleteAccount(options: DeleteAccountOptions = {}): Promise<void> {
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    const user = auth.currentUser;
    if (!user) {
      this._state.set({ mode: 'unauthenticated' });
      return;
    }

    await this.reauthenticateCurrentUser(options, user);

    await this.firestoreUserData.deleteUserDataTree(user.uid);
    await sdk.deleteUser(user);
    this.clearGuestPreference();
    this._state.set({ mode: 'unauthenticated' });
  }

  private async reauthenticateCurrentUser(
    options: ReauthOptions = {},
    userOverride?: User | null
  ): Promise<void> {
    const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
    const user = userOverride ?? auth.currentUser;
    if (!user) {
      throw this.createAuthError(
        'auth/requires-recent-login',
        'No authenticated user available for re-authentication.'
      );
    }

    const providerIds = user.providerData?.map(provider => provider.providerId) ?? [];
    if (providerIds.includes('password')) {
      if (!user.email || !options.password) {
        throw this.createAuthError(
          'auth/invalid-credential',
          'Password re-authentication requires email and password.'
        );
      }
      const credential = sdk.EmailAuthProvider.credential(user.email, options.password);
      await sdk.reauthenticateWithCredential(user, credential);
    } else if (providerIds.includes('google.com')) {
      await sdk.reauthenticateWithPopup(user, new sdk.GoogleAuthProvider());
    }
  }

  private createAuthError(code: string, message: string): Error & { code: string } {
    return Object.assign(new Error(message), { code });
  }

  private isDeviceOffline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  private async bootstrapAuth(): Promise<void> {
    if (this.authInitialized) return;
    this.authInitialized = true;
    try {
      const [auth, sdk] = await Promise.all([this.firebaseApp.getAuth(), this.loadAuthSdk()]);
      try {
        await sdk.setPersistence(auth, sdk.browserLocalPersistence);
      } catch {
        // persistence may not be supported in some environments; ignore.
      }
      sdk.onAuthStateChanged(auth, user => this.handleUserChange(user));
    } catch {
      this.authInitialized = false;
      if (this._state().mode === 'loading') {
        this._state.set({ mode: 'unauthenticated' });
      }
    }
  }

  private handleUserChange(user: User | null): void {
    if (this._state().mode === 'guest') return;
    if (!user) {
      this._state.set({ mode: 'unauthenticated' });
      return;
    }
    const mode: AuthMode = user.emailVerified ? 'authenticated' : 'email-not-verified';
    this._state.set({
      mode,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      emailVerified: user.emailVerified,
      providerIds: user.providerData?.map(provider => provider.providerId) ?? [],
    });
  }

  private readSavedMode(): 'guest' | null {
    try {
      return localStorage.getItem(AUTH_MODE_STORAGE_KEY) === 'guest' ? 'guest' : null;
    } catch {
      return null;
    }
  }

  private writeSavedMode(mode: 'guest' | null): void {
    try {
      if (mode === null) localStorage.removeItem(AUTH_MODE_STORAGE_KEY);
      else localStorage.setItem(AUTH_MODE_STORAGE_KEY, mode);
    } catch {
      // localStorage may throw in private mode; non-fatal.
    }
  }

  private clearGuestPreference(): void {
    if (this.readSavedMode() === 'guest') {
      this.writeSavedMode(null);
    }
  }
}
