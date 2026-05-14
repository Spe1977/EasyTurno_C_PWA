import { Injectable, isDevMode, signal } from '@angular/core';

/**
 * CryptoService - Provides encryption/decryption for localStorage data
 *
 * Uses Web Crypto API with AES-GCM for authenticated encryption.
 * Device storage encryption uses a non-extractable key persisted in IndexedDB.
 * Backup export/import can additionally use a password-derived key.
 */
@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  /** @deprecated Used only for migration from old localStorage key */
  private readonly LEGACY_KEY_NAME = 'easyturno_device_key';
  private readonly KEY_LENGTH = 256;
  private readonly ALGORITHM = 'AES-GCM';
  private readonly IV_LENGTH = 12; // 96 bits for AES-GCM
  private readonly SALT_LENGTH = 16;
  private readonly IDB_DB_NAME = 'easyturno_keystore';
  private readonly IDB_STORE_NAME = 'keys';
  private readonly IDB_KEY_ID = 'deviceKey';
  private readonly PBKDF2_ITERATIONS = 600000;
  private readonly PBKDF2_MIN_ITERATIONS = 100000;
  private readonly PASSWORD_BACKUP_TYPE = 'easyturno-password-backup';
  private readonly CIPHERTEXT_MAGIC_HEADER = 'ETBLOB1:';

  /**
   * In-flight key resolution. Sharing the same Promise across concurrent
   * callers prevents two requests from generating distinct keys and racing
   * to overwrite each other in IndexedDB.
   */
  private deviceKeyPromise: Promise<CryptoKey> | null = null;

  /**
   * Becomes false when the device key is persisted to localStorage instead
   * of IndexedDB (IDB unavailable). In that mode the raw AES key bytes are
   * readable from localStorage and exfiltrable by an XSS, so the UI should
   * surface a warning to the user.
   */
  secureStorageAvailable = signal(true);

  private isIndexedDBAvailable(): boolean {
    return typeof indexedDB !== 'undefined';
  }

  /**
   * In dev mode logs the full error (stack + cause); in production logs
   * only the message so that crypto internals are not exposed via DevTools.
   */
  private logError(message: string, error: unknown): void {
    if (isDevMode()) {
      console.error(message, error);
    } else {
      console.error(message);
    }
  }

  /**
   * In dev mode wraps the original error as `cause` for debuggability; in
   * production omits it so consumers logging the thrown error cannot leak
   * crypto internals.
   */
  private wrapError(message: string, error: unknown): Error {
    return isDevMode() ? new Error(message, { cause: error }) : new Error(message);
  }

  // ── IndexedDB helpers ────────────────────────────────────────────────────

  private openIDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.IDB_DB_NAME, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(this.IDB_STORE_NAME);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  private async getKeyFromIDB(): Promise<CryptoKey | null> {
    const db = await this.openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.IDB_STORE_NAME, 'readonly');
      const req = tx.objectStore(this.IDB_STORE_NAME).get(this.IDB_KEY_ID);
      req.onsuccess = () => resolve((req.result as CryptoKey | undefined) ?? null);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => db.close();
    });
  }

  private async saveKeyToIDB(key: CryptoKey): Promise<void> {
    const db = await this.openIDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this.IDB_STORE_NAME, 'readwrite');
      const req = tx.objectStore(this.IDB_STORE_NAME).put(key, this.IDB_KEY_ID);
      req.onerror = () => reject(req.error);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
    });
  }

  private async getLegacyKeyFromLocalStorage(extractable: boolean): Promise<CryptoKey | null> {
    const legacyRaw = localStorage.getItem(this.LEGACY_KEY_NAME);
    if (!legacyRaw) {
      return null;
    }

    const keyData = this.base64ToArrayBuffer(legacyRaw);
    return crypto.subtle.importKey(
      'raw',
      keyData,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      extractable,
      ['encrypt', 'decrypt']
    );
  }

  private async saveLegacyKeyToLocalStorage(key: CryptoKey): Promise<void> {
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(this.LEGACY_KEY_NAME, this.arrayBufferToBase64(exportedKey));
  }

  private generateDeviceKey(extractable: boolean): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      extractable,
      ['encrypt', 'decrypt']
    );
  }

  // ── Key management ───────────────────────────────────────────────────────

  /**
   * Gets or generates a device-specific encryption key.
   * The key is stored as a non-extractable CryptoKey in IndexedDB so that
   * raw key bytes are never exposed to JavaScript or serialised to disk as
   * plain text.  On first run after the upgrade, a legacy key found in
   * localStorage is migrated and then removed.
   */
  private getDeviceKey(): Promise<CryptoKey> {
    // Reuse the in-flight resolution so concurrent encrypt/decrypt calls
    // never race to generate competing keys.
    if (!this.deviceKeyPromise) {
      this.deviceKeyPromise = this.resolveDeviceKey().catch(error => {
        // Reset on failure so a later call can retry.
        this.deviceKeyPromise = null;
        throw error;
      });
    }
    return this.deviceKeyPromise;
  }

  private async resolveDeviceKey(): Promise<CryptoKey> {
    const canUseIndexedDB = this.isIndexedDBAvailable();
    if (!canUseIndexedDB) {
      this.secureStorageAvailable.set(false);
    }

    // 1. Try IndexedDB when available (secure, non-extractable storage)
    if (canUseIndexedDB) {
      try {
        const idbKey = await this.getKeyFromIDB();
        if (idbKey) return idbKey;
      } catch (error) {
        console.warn('Failed to load key from IndexedDB, will try migration', error);
      }
    }

    // 2. Migrate or reuse legacy key from localStorage
    try {
      const legacyKey = await this.getLegacyKeyFromLocalStorage(!canUseIndexedDB);
      if (legacyKey) {
        if (canUseIndexedDB) {
          await this.saveKeyToIDB(legacyKey);
          localStorage.removeItem(this.LEGACY_KEY_NAME);
        }
        return legacyKey;
      }
    } catch (error) {
      console.warn('Failed to migrate legacy key, generating new one', error);
    }

    // 3. Generate a new key and persist it in the best available storage.
    const newKey = await this.generateDeviceKey(!canUseIndexedDB);
    if (canUseIndexedDB) {
      await this.saveKeyToIDB(newKey);
    } else {
      await this.saveLegacyKeyToLocalStorage(newKey);
    }
    return newKey;
  }

  /**
   * Encrypts a string using AES-GCM
   * @param plaintext - The data to encrypt
   * @returns Base64-encoded encrypted data (includes IV)
   */
  async encrypt(plaintext: string): Promise<string> {
    try {
      const key = await this.getDeviceKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(plaintext);

      // Generate random IV (Initialization Vector)
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));

      // Encrypt the data
      const encrypted = await crypto.subtle.encrypt({ name: this.ALGORITHM, iv }, key, data);

      // Combine IV + encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Return as base64 string prefixed with the magic header so that
      // readers can deterministically identify the encrypted format.
      return this.CIPHERTEXT_MAGIC_HEADER + this.arrayBufferToBase64(combined.buffer);
    } catch (error) {
      this.logError('Encryption failed', error);
      throw this.wrapError('Failed to encrypt data', error);
    }
  }

  /**
   * Decrypts a base64-encoded encrypted string
   * @param encryptedBase64 - The encrypted data (includes IV)
   * @returns Decrypted plaintext string
   */
  async decrypt(encryptedBase64: string): Promise<string> {
    try {
      const key = await this.getDeviceKey();

      // Strip the magic header when present; legacy records (pre-header) are
      // accepted as-is and migrate to the new format on next save.
      const payload = encryptedBase64.startsWith(this.CIPHERTEXT_MAGIC_HEADER)
        ? encryptedBase64.slice(this.CIPHERTEXT_MAGIC_HEADER.length)
        : encryptedBase64;

      // Decode from base64
      const combined = this.base64ToArrayBuffer(payload);
      const combinedArray = new Uint8Array(combined);

      // Extract IV and encrypted data
      const iv = combinedArray.slice(0, this.IV_LENGTH);
      const data = combinedArray.slice(this.IV_LENGTH);

      // Decrypt
      const decrypted = await crypto.subtle.decrypt({ name: this.ALGORITHM, iv }, key, data);

      // Convert back to string
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      this.logError('Decryption failed', error);
      throw this.wrapError('Failed to decrypt data', error);
    }
  }

  /**
   * Checks if data is encrypted. New records carry a deterministic magic
   * header (`ETBLOB1:`); legacy records (pre-header) are matched via the
   * original base64 heuristic and migrate to the new format on next save.
   */
  isEncrypted(data: string): boolean {
    if (!data || data.length === 0) return false;

    if (data.startsWith(this.CIPHERTEXT_MAGIC_HEADER)) {
      return true;
    }

    const trimmedData = data.trim();
    if (trimmedData.startsWith('{') || trimmedData.startsWith('[')) {
      return false;
    }

    if (!/^[A-Za-z0-9+/]+=*$/.test(trimmedData) || trimmedData.length % 4 !== 0) {
      return false;
    }

    try {
      const decoded = this.base64ToArrayBuffer(trimmedData);
      return decoded.byteLength > this.IV_LENGTH + 16;
    } catch {
      return false;
    }
  }

  async encryptBackupWithPassword(plaintext: string, password: string): Promise<string> {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(this.SALT_LENGTH));
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
      const key = await this.derivePasswordKey(password, salt, this.PBKDF2_ITERATIONS, ['encrypt']);
      const encoded = new TextEncoder().encode(plaintext);
      const encrypted = await crypto.subtle.encrypt({ name: this.ALGORITHM, iv }, key, encoded);

      return JSON.stringify({
        type: this.PASSWORD_BACKUP_TYPE,
        version: 1,
        kdf: 'PBKDF2',
        hash: 'SHA-256',
        iterations: this.PBKDF2_ITERATIONS,
        salt: this.arrayBufferToBase64(salt.buffer),
        iv: this.arrayBufferToBase64(iv.buffer),
        data: this.arrayBufferToBase64(encrypted),
      });
    } catch (error) {
      this.logError('Backup encryption failed', error);
      throw this.wrapError('Failed to encrypt backup', error);
    }
  }

  async decryptBackupWithPassword(payload: string, password: string): Promise<string> {
    try {
      const backupPayload = JSON.parse(payload) as Record<string, unknown>;
      if (!this.isValidBackupPayloadObject(backupPayload)) {
        throw new Error('Invalid encrypted backup format');
      }

      const salt = this.base64ToArrayBuffer(backupPayload.salt);
      const iv = this.base64ToArrayBuffer(backupPayload.iv);
      const encrypted = this.base64ToArrayBuffer(backupPayload.data);
      const key = await this.derivePasswordKey(password, salt, backupPayload.iterations, [
        'decrypt',
      ]);
      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: new Uint8Array(iv) },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      this.logError('Backup decryption failed', error);
      throw this.wrapError('Failed to decrypt backup', error);
    }
  }

  isPasswordProtectedBackupPayload(payload: string): boolean {
    if (!payload) {
      return false;
    }

    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      return this.isValidBackupPayloadObject(parsed);
    } catch {
      return false;
    }
  }

  private isValidBackupPayloadObject(parsed: Record<string, unknown>): parsed is {
    type: string;
    version: number;
    kdf: string;
    hash: string;
    iterations: number;
    salt: string;
    iv: string;
    data: string;
  } {
    return (
      parsed.type === this.PASSWORD_BACKUP_TYPE &&
      parsed.version === 1 &&
      parsed.kdf === 'PBKDF2' &&
      parsed.hash === 'SHA-256' &&
      typeof parsed.iterations === 'number' &&
      parsed.iterations >= this.PBKDF2_MIN_ITERATIONS &&
      typeof parsed.salt === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.data === 'string'
    );
  }

  /**
   * Converts ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    // Process in chunks to avoid stack overflow on large buffers while
    // still being faster than single-character string concatenation.
    const CHUNK = 8192;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
    }
    // eslint-disable-next-line no-undef
    return btoa(binary);
  }

  /**
   * Converts base64 string to ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    // eslint-disable-next-line no-undef
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  private async derivePasswordKey(
    password: string,
    salt: BufferSource,
    iterations: number,
    usages: KeyUsage[]
  ): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      usages
    );
  }
}
