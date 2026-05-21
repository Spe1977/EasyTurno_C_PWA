import { Injectable, computed, inject, signal } from '@angular/core';
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  deleteUser,
  onAuthStateChanged,
  reload,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
  sendEmailVerification,
  sendPasswordResetEmail,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from 'firebase/auth';

import { FirebaseAppService } from './firebase-app.service';
import { FirestoreUserDataService } from './firestore-user-data.service';

export type AuthMode =
  | 'loading'
  | 'unauthenticated'
  | 'guest'
  | 'authenticated'
  | 'email-not-verified';

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
    const auth = this.firebaseApp.auth;
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName && displayName.trim().length > 0) {
      await updateProfile(credential.user, { displayName: displayName.trim() });
    }
    await sendEmailVerification(credential.user);
    this.lastVerificationSentAt = Date.now();
    this.handleUserChange(credential.user);
  }

  async loginEmail(email: string, password: string): Promise<void> {
    this.clearGuestPreference();
    const auth = this.firebaseApp.auth;
    const credential = await signInWithEmailAndPassword(auth, email, password);
    this.handleUserChange(credential.user);
  }

  async loginGoogle(): Promise<void> {
    this.clearGuestPreference();
    const auth = this.firebaseApp.auth;
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    this.handleUserChange(credential.user);
  }

  /** Resend verification email. Returns false if rate-limited (60s cooldown). */
  async resendVerificationEmail(): Promise<boolean> {
    const auth = this.firebaseApp.auth;
    const user = auth.currentUser;
    if (!user) return false;
    const elapsed = Date.now() - this.lastVerificationSentAt;
    if (elapsed < VERIFICATION_RESEND_COOLDOWN_MS) return false;
    await sendEmailVerification(user);
    this.lastVerificationSentAt = Date.now();
    return true;
  }

  /** Force-refresh the user record to pick up email verification done in another tab. */
  async refreshUser(): Promise<void> {
    const auth = this.firebaseApp.auth;
    const user = auth.currentUser;
    if (!user) return;
    await reload(user);
    this.handleUserChange(auth.currentUser);
  }

  async sendPasswordReset(email: string): Promise<void> {
    const auth = this.firebaseApp.auth;
    await sendPasswordResetEmail(auth, email);
  }

  async signOut(): Promise<void> {
    this.clearGuestPreference();
    const auth = this.firebaseApp.auth;
    await fbSignOut(auth);
    this._state.set({ mode: 'unauthenticated' });
  }

  async deleteAccount(options: DeleteAccountOptions = {}): Promise<void> {
    const auth = this.firebaseApp.auth;
    const user = auth.currentUser;
    if (!user) {
      this._state.set({ mode: 'unauthenticated' });
      return;
    }

    const providerIds = user.providerData?.map(provider => provider.providerId) ?? [];
    if (providerIds.includes('password')) {
      if (!user.email || !options.password) {
        throw new Error('Password re-authentication requires email and password.');
      }
      const credential = EmailAuthProvider.credential(user.email, options.password);
      await reauthenticateWithCredential(user, credential);
    } else if (providerIds.includes('google.com')) {
      await reauthenticateWithPopup(user, new GoogleAuthProvider());
    }

    await this.firestoreUserData.deleteUserDataTree(user.uid);
    await deleteUser(user);
    this.clearGuestPreference();
    this._state.set({ mode: 'unauthenticated' });
  }

  private async bootstrapAuth(): Promise<void> {
    if (this.authInitialized) return;
    this.authInitialized = true;
    const auth = this.firebaseApp.auth;
    try {
      await setPersistence(auth, browserLocalPersistence);
    } catch {
      // persistence may not be supported in some environments; ignore.
    }
    onAuthStateChanged(auth, user => this.handleUserChange(user));
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
