import { Injectable } from '@angular/core';

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
  private readonly PBKDF2_ITERATIONS = 250000;
  private readonly PASSWORD_BACKUP_TYPE = 'easyturno-password-backup';

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
      tx.oncomplete = () => { db.close(); resolve(); };
    });
  }

  // ── Key management ───────────────────────────────────────────────────────

  /**
   * Gets or generates a device-specific encryption key.
   * The key is stored as a non-extractable CryptoKey in IndexedDB so that
   * raw key bytes are never exposed to JavaScript or serialised to disk as
   * plain text.  On first run after the upgrade, a legacy key found in
   * localStorage is migrated and then removed.
   */
  private async getDeviceKey(): Promise<CryptoKey> {
    // 1. Try IndexedDB (secure, non-extractable storage)
    try {
      const idbKey = await this.getKeyFromIDB();
      if (idbKey) return idbKey;
    } catch (error) {
      console.warn('Failed to load key from IndexedDB, will try migration', error);
    }

    // 2. Migrate legacy key from localStorage (one-time)
    const legacyRaw = localStorage.getItem(this.LEGACY_KEY_NAME);
    if (legacyRaw) {
      try {
        const keyData = this.base64ToArrayBuffer(legacyRaw);
        const migratedKey = await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: this.ALGORITHM, length: this.KEY_LENGTH },
          false, // non-extractable after migration
          ['encrypt', 'decrypt']
        );
        await this.saveKeyToIDB(migratedKey);
        localStorage.removeItem(this.LEGACY_KEY_NAME);
        return migratedKey;
      } catch (error) {
        console.warn('Failed to migrate legacy key, generating new one', error);
      }
    }

    // 3. Generate a new non-extractable key and persist it in IndexedDB
    const newKey = await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false, // non-extractable: raw bytes never leave the crypto engine
      ['encrypt', 'decrypt']
    );
    await this.saveKeyToIDB(newKey);
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

      // Return as base64 string
      return this.arrayBufferToBase64(combined.buffer);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
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

      // Decode from base64
      const combined = this.base64ToArrayBuffer(encryptedBase64);
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
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Checks if data is encrypted (basic heuristic check)
   */
  isEncrypted(data: string): boolean {
    if (!data || data.length === 0) return false;

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
      const key = await this.derivePasswordKey(password, salt, ['encrypt']);
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
      console.error('Backup encryption failed:', error);
      throw new Error('Failed to encrypt backup');
    }
  }

  async decryptBackupWithPassword(payload: string, password: string): Promise<string> {
    try {
      const backupPayload = JSON.parse(payload);
      if (!this.isPasswordProtectedBackupPayload(payload)) {
        throw new Error('Invalid encrypted backup format');
      }

      const salt = this.base64ToArrayBuffer(backupPayload.salt);
      const iv = this.base64ToArrayBuffer(backupPayload.iv);
      const encrypted = this.base64ToArrayBuffer(backupPayload.data);
      const key = await this.derivePasswordKey(password, salt, ['decrypt']);
      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: new Uint8Array(iv) },
        key,
        encrypted
      );

      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Backup decryption failed:', error);
      throw new Error('Failed to decrypt backup');
    }
  }

  isPasswordProtectedBackupPayload(payload: string): boolean {
    if (!payload) {
      return false;
    }

    try {
      const parsed = JSON.parse(payload) as Record<string, unknown>;
      return (
        parsed.type === this.PASSWORD_BACKUP_TYPE &&
        parsed.version === 1 &&
        parsed.kdf === 'PBKDF2' &&
        parsed.hash === 'SHA-256' &&
        typeof parsed.iterations === 'number' &&
        parsed.iterations >= 100000 &&
        typeof parsed.salt === 'string' &&
        typeof parsed.iv === 'string' &&
        typeof parsed.data === 'string'
      );
    } catch {
      return false;
    }
  }

  /**
   * Converts ArrayBuffer to base64 string
   */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]!);
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
        iterations: this.PBKDF2_ITERATIONS,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      usages
    );
  }
}
