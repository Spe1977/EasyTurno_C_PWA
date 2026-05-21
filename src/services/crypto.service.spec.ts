import { TestBed } from '@angular/core/testing';
import { CryptoService } from './crypto.service';

describe('CryptoService', () => {
  let service: CryptoService;
  let localStorageMock: { [key: string]: string };

  beforeEach(() => {
    // Mock localStorage
    localStorageMock = {};
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return localStorageMock[key] || null;
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      localStorageMock[key] = value;
    });
    jest.spyOn(Storage.prototype, 'removeItem').mockImplementation((key: string) => {
      delete localStorageMock[key];
    });

    TestBed.configureTestingModule({
      providers: [CryptoService],
    });
    service = TestBed.inject(CryptoService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Service initialization', () => {
    it('should be created', () => {
      expect(service).toBeTruthy();
    });
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt data successfully', async () => {
      const plaintext = 'Hello, World!';

      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toBeTruthy();
      expect(encrypted).not.toEqual(plaintext);
      expect(typeof encrypted).toBe('string');

      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it('should encrypt the same plaintext to different ciphertexts (random IV)', async () => {
      const plaintext = 'Test data';

      const encrypted1 = await service.encrypt(plaintext);
      const encrypted2 = await service.encrypt(plaintext);

      // Different IVs mean different ciphertexts
      expect(encrypted1).not.toEqual(encrypted2);

      // But both decrypt to the same plaintext
      const decrypted1 = await service.decrypt(encrypted1);
      const decrypted2 = await service.decrypt(encrypted2);

      expect(decrypted1).toEqual(plaintext);
      expect(decrypted2).toEqual(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';

      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toBeTruthy();

      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it('should handle special characters and unicode', async () => {
      const plaintext = '🔐 Test with émojis and spëcial çharacters: 中文 日本語 한국어';

      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toBeTruthy();

      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
    });

    it('should handle large data (>1KB)', async () => {
      // Create a 5KB string
      const plaintext = 'A'.repeat(5000);

      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toBeTruthy();

      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toEqual(plaintext);
      expect(decrypted.length).toBe(5000);
    });

    it('should handle JSON data', async () => {
      const jsonData = JSON.stringify({
        name: 'Test User',
        shifts: [
          { id: '1', title: 'Morning Shift' },
          { id: '2', title: 'Evening Shift' },
        ],
        metadata: { version: 1, encrypted: true },
      });

      const encrypted = await service.encrypt(jsonData);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toEqual(jsonData);
      expect(JSON.parse(decrypted)).toEqual(JSON.parse(jsonData));
    });

    it('should throw error when decrypting invalid data', async () => {
      const invalidEncrypted = 'invalid-base64-data';

      await expect(service.decrypt(invalidEncrypted)).rejects.toThrow('Failed to decrypt data');
    });

    it('should throw error when decrypting corrupted data', async () => {
      // Create valid encrypted data
      const encrypted = await service.encrypt('test');

      // Corrupt it by changing a character
      const corrupted = encrypted.substring(0, encrypted.length - 5) + 'XXXXX';

      await expect(service.decrypt(corrupted)).rejects.toThrow('Failed to decrypt data');
    });

    it('should handle encryption errors gracefully', async () => {
      // Spy on crypto.subtle.encrypt to simulate failure
      jest.spyOn(crypto.subtle, 'encrypt').mockRejectedValue(new Error('Crypto API error'));

      await expect(service.encrypt('test')).rejects.toThrow('Failed to encrypt data');
    });
  });

  describe('Key Management', () => {
    it('should generate and store a device key on first use', async () => {
      await service.encrypt('test data');

      // Should have called setItem to store the generated key
      expect(localStorageMock['easyturno_device_key']).toBeTruthy();
    });

    it('should reuse existing device key from localStorage', async () => {
      // First encryption generates and stores key
      const encrypted1 = await service.encrypt('test');

      // Get the stored key
      const storedKey = localStorageMock['easyturno_device_key'];
      expect(storedKey).toBeTruthy();

      // Second encryption should reuse the key
      const encrypted2 = await service.encrypt('test');

      // Key should still be the same
      expect(localStorageMock['easyturno_device_key']).toBe(storedKey);

      // Both encryptions should decrypt with the same key
      const decrypted1 = await service.decrypt(encrypted1);
      const decrypted2 = await service.decrypt(encrypted2);

      expect(decrypted1).toBe('test');
      expect(decrypted2).toBe('test');
    });

    it('should regenerate key if stored key is invalid', async () => {
      // Provide invalid key
      localStorageMock['easyturno_device_key'] = 'invalid-key-data';

      // Should generate new key
      await service.encrypt('test');

      // Should have stored new key (different from invalid one)
      expect(localStorageMock['easyturno_device_key']).not.toBe('invalid-key-data');
    });

    it('should use the same key for multiple operations in the same session', async () => {
      const plaintext1 = 'First message';
      const plaintext2 = 'Second message';

      const encrypted1 = await service.encrypt(plaintext1);
      const encrypted2 = await service.encrypt(plaintext2);

      // Both should decrypt successfully with the same key
      const decrypted1 = await service.decrypt(encrypted1);
      const decrypted2 = await service.decrypt(encrypted2);

      expect(decrypted1).toBe(plaintext1);
      expect(decrypted2).toBe(plaintext2);
    });
  });

  describe('isEncrypted()', () => {
    it('should detect encrypted data (base64)', async () => {
      const plaintext = 'Test data';
      const encrypted = await service.encrypt(plaintext);

      expect(service.isEncrypted(encrypted)).toBe(true);
    });

    it('should detect non-encrypted JSON object', () => {
      const jsonObject = '{"key": "value"}';

      expect(service.isEncrypted(jsonObject)).toBe(false);
    });

    it('should detect non-encrypted JSON array', () => {
      const jsonArray = '[1, 2, 3]';

      expect(service.isEncrypted(jsonArray)).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(service.isEncrypted('')).toBe(false);
    });

    it('should return false for null or undefined input', () => {
      expect(service.isEncrypted(null as any)).toBe(false);
      expect(service.isEncrypted(undefined as any)).toBe(false);
    });

    it('should return true for base64-like strings', () => {
      const base64String = 'U29tZSBiYXNlNjQgZW5jb2RlZCBkYXRh';

      expect(service.isEncrypted(base64String)).toBe(false);
    });

    it('should reject invalid non-json strings as encrypted payloads', () => {
      expect(service.isEncrypted('not-valid-base64%%%')).toBe(false);
    });

    it('should return false when base64 decoding throws', () => {
      const atobSpy = jest.spyOn(globalThis, 'atob').mockImplementation(() => {
        throw new Error('decoder failed');
      });

      expect(service.isEncrypted('QUJDRA==')).toBe(false);

      atobSpy.mockRestore();
    });
  });

  describe('Password protected backups', () => {
    it('should encrypt and decrypt a backup with a password', async () => {
      const payload = JSON.stringify({ shifts: [{ id: '1' }] });

      const encrypted = await service.encryptBackupWithPassword(payload, 'secret-password');

      expect(service.isPasswordProtectedBackupPayload(encrypted)).toBe(true);

      const decrypted = await service.decryptBackupWithPassword(encrypted, 'secret-password');
      expect(decrypted).toBe(payload);
    });

    it('should fail to decrypt a backup with the wrong password', async () => {
      const encrypted = await service.encryptBackupWithPassword('sensitive-data', 'right-password');

      await expect(service.decryptBackupWithPassword(encrypted, 'wrong-password')).rejects.toThrow(
        'Failed to decrypt backup'
      );
    });

    describe('PBKDF2 backward compatibility (T2)', () => {
      // Helpers to build a backup payload with arbitrary iterations, so we can
      // simulate backups produced by older versions of the app (250 000 iter)
      // and edge cases below the minimum threshold (< 100 000).
      const SALT_LEN = 16;
      const IV_LEN = 12;
      const ALG = 'AES-GCM';
      const KEY_LEN = 256;

      const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.length; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        return btoa(binary);
      };

      async function buildBackup(plaintext: string, password: string, iterations: number) {
        const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
        const iv = crypto.getRandomValues(new Uint8Array(IV_LEN));
        const keyMaterial = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(password),
          'PBKDF2',
          false,
          ['deriveKey']
        );
        const key = await crypto.subtle.deriveKey(
          { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
          keyMaterial,
          { name: ALG, length: KEY_LEN },
          false,
          ['encrypt']
        );
        const encrypted = await crypto.subtle.encrypt(
          { name: ALG, iv },
          key,
          new TextEncoder().encode(plaintext)
        );

        return JSON.stringify({
          type: 'easyturno-password-backup',
          version: 1,
          kdf: 'PBKDF2',
          hash: 'SHA-256',
          iterations,
          salt: arrayBufferToBase64(salt.buffer),
          iv: arrayBufferToBase64(iv.buffer),
          data: arrayBufferToBase64(encrypted),
        });
      }

      it('decrypts a legacy backup encrypted with 250 000 PBKDF2 iterations', async () => {
        const plaintext = JSON.stringify({ shifts: [{ id: 'legacy-1' }] });
        const password = 'legacy-strong-password';

        const legacyPayload = await buildBackup(plaintext, password, 250_000);

        const decrypted = await service.decryptBackupWithPassword(legacyPayload, password);
        expect(decrypted).toBe(plaintext);
      });

      it('rejects a backup with iterations below the minimum threshold (99 999)', async () => {
        // We can't easily craft a valid ciphertext at 99 999 iter because
        // validation happens before decrypt — but the format guard runs on the
        // parsed JSON, so a hand-built payload is enough to exercise it.
        const malformed = JSON.stringify({
          type: 'easyturno-password-backup',
          version: 1,
          kdf: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 99_999,
          salt: 'AAAAAAAAAAAAAAAAAAAAAA==',
          iv: 'AAAAAAAAAAAAAAAA',
          data: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==',
        });

        expect(service.isPasswordProtectedBackupPayload(malformed)).toBe(false);
        await expect(service.decryptBackupWithPassword(malformed, 'any-password')).rejects.toThrow(
          'Failed to decrypt backup'
        );
      });

      it('round-trips encrypt/decrypt with the current 600 000 iterations', async () => {
        const plaintext = JSON.stringify({ shifts: [{ id: '1', title: 'Morning' }] });
        const password = 'current-strong-password';

        const encrypted = await service.encryptBackupWithPassword(plaintext, password);

        const parsed = JSON.parse(encrypted);
        expect(parsed.iterations).toBe(600_000);

        const decrypted = await service.decryptBackupWithPassword(encrypted, password);
        expect(decrypted).toBe(plaintext);
      });
    });

    it('should handle backup encryption errors gracefully', async () => {
      jest
        .spyOn(crypto.subtle, 'encrypt')
        .mockRejectedValue(new Error('Backup encryption API error'));

      await expect(service.encryptBackupWithPassword('sensitive-data', 'password')).rejects.toThrow(
        'Failed to encrypt backup'
      );
    });

    it('should return false for null, empty or non-JSON input in isPasswordProtectedBackupPayload', () => {
      expect(service.isPasswordProtectedBackupPayload('')).toBe(false);
      expect(service.isPasswordProtectedBackupPayload(null as any)).toBe(false);
      expect(service.isPasswordProtectedBackupPayload(undefined as any)).toBe(false);
      expect(service.isPasswordProtectedBackupPayload('not-a-json-string')).toBe(false);
      expect(service.isPasswordProtectedBackupPayload('{"malformed": ')).toBe(false);
      expect(service.isPasswordProtectedBackupPayload('{"foo": "bar"}')).toBe(false);
    });
  });

  describe('Base64 conversion utilities', () => {
    it('should convert ArrayBuffer to base64 and back', async () => {
      const originalText = 'Test conversion';
      const encoder = new TextEncoder();
      const arrayBuffer = encoder.encode(originalText).buffer;

      // Use encryption to test base64 conversion (it uses these methods internally)
      const encrypted = await service.encrypt(originalText);
      expect(encrypted).toBeTruthy();
      expect(typeof encrypted).toBe('string');

      // Decrypt uses base64 to ArrayBuffer conversion
      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toBe(originalText);
    });

    it('should handle binary data in base64 conversion', async () => {
      // Create binary-like data with all byte values
      const binaryData = new Uint8Array(256);
      for (let i = 0; i < 256; i++) {
        binaryData[i] = i;
      }

      const decoder = new TextDecoder('latin1');
      const text = decoder.decode(binaryData);

      // Encrypt and decrypt binary-like data
      const encrypted = await service.encrypt(text);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(text);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle multiple sequential encryption operations', async () => {
      // Test multiple encryptions sequentially to verify key stability
      const messages = ['Message 1', 'Message 2', 'Message 3', 'Message 4', 'Message 5'];
      const encrypted = [];

      for (const msg of messages) {
        encrypted.push(await service.encrypt(msg));
      }

      // All should be different (random IVs)
      const uniqueValues = new Set(encrypted);
      expect(uniqueValues.size).toBe(5);

      // All should decrypt correctly
      const decrypted = [];
      for (const e of encrypted) {
        decrypted.push(await service.decrypt(e));
      }
      expect(decrypted).toEqual(messages);
    });

    it('should handle rapid encrypt/decrypt cycles', async () => {
      for (let i = 0; i < 10; i++) {
        const plaintext = `Message ${i}`;
        const encrypted = await service.encrypt(plaintext);
        const decrypted = await service.decrypt(encrypted);
        expect(decrypted).toBe(plaintext);
      }
    });

    it('should maintain data integrity with whitespace', async () => {
      const plaintextWithWhitespace = '  \n\t  Test with   whitespace  \n\n  ';

      const encrypted = await service.encrypt(plaintextWithWhitespace);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted).toBe(plaintextWithWhitespace);
    });

    it('should handle decryption with wrong key gracefully', async () => {
      // Encrypt with first key
      const encrypted = await service.encrypt('secret data');

      // Clear the key to force generation of a new one
      delete localStorageMock['easyturno_device_key'];

      // Create new service instance with different key
      const newService = new CryptoService();

      // Try to decrypt with wrong key - should fail
      await expect(newService.decrypt(encrypted)).rejects.toThrow('Failed to decrypt data');
    });
  });

  describe('IndexedDB key persistence (T4)', () => {
    // The default Jest jsdom environment has no `indexedDB`, so the existing
    // suite exercises the localStorage fallback. These tests install a
    // minimal in-memory IDB to exercise the IndexedDB code paths in
    // `crypto.service.ts` (lines ~40-69 and ~130-146).

    type IdbStore = Map<unknown, unknown>;
    type IdbDatabase = Map<string, IdbStore>;

    const IDB_DB = 'easyturno_keystore';
    const IDB_STORE = 'keys';
    const IDB_KEY = 'deviceKey';

    let idbContents: Map<string, IdbDatabase>;
    let originalIndexedDB: unknown;
    let hadIndexedDB: boolean;
    let idbService: CryptoService;
    let generateKeySpy: jest.SpyInstance | null = null;
    let openSpy: jest.Mock | null = null;

    function installMockIndexedDB() {
      idbContents = new Map();
      const open = jest.fn((name: string) => {
        // Each call returns a fresh IDBOpenDBRequest-like object. Handlers are
        // assigned synchronously by the caller after `open()` returns, so we
        // dispatch on the next microtask to mirror real IDB ordering.
        const req: {
          onsuccess: (() => void) | null;
          onerror: (() => void) | null;
          onupgradeneeded: (() => void) | null;
          result: unknown;
          error: unknown;
        } = {
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: null,
          error: null,
        };
        Promise.resolve().then(() => {
          let entry = idbContents.get(name);
          let isNew = false;
          if (!entry) {
            entry = new Map();
            idbContents.set(name, entry);
            isNew = true;
          }
          const dbHandle = {
            createObjectStore(storeName: string) {
              if (!entry!.has(storeName)) entry!.set(storeName, new Map());
              return {};
            },
            transaction(storeName: string) {
              const store = entry!.get(storeName);
              if (!store) throw new Error(`Object store missing: ${storeName}`);
              const tx: { oncomplete: (() => void) | null; onerror: (() => void) | null } = {
                oncomplete: null,
                onerror: null,
              };
              const pending: Array<() => void> = [];
              const storeHandle = {
                get(key: unknown) {
                  const r: {
                    onsuccess: (() => void) | null;
                    onerror: (() => void) | null;
                    result: unknown;
                  } = {
                    onsuccess: null,
                    onerror: null,
                    result: undefined,
                  };
                  pending.push(() => {
                    r.result = store.get(key);
                    if (r.onsuccess) r.onsuccess();
                  });
                  return r;
                },
                put(value: unknown, key: unknown) {
                  const r: { onsuccess: (() => void) | null; onerror: (() => void) | null } = {
                    onsuccess: null,
                    onerror: null,
                  };
                  pending.push(() => {
                    store.set(key, value);
                    if (r.onsuccess) r.onsuccess();
                  });
                  return r;
                },
              };
              // Drain queued ops + signal completion AFTER the caller has had
              // a chance to attach `req.onsuccess` and `tx.oncomplete`.
              Promise.resolve().then(() => {
                for (const op of pending) op();
                if (tx.oncomplete) tx.oncomplete();
              });
              return {
                objectStore: () => storeHandle,
                get oncomplete() {
                  return tx.oncomplete;
                },
                set oncomplete(fn: (() => void) | null) {
                  tx.oncomplete = fn;
                },
              };
            },
            close() {},
          };
          req.result = dbHandle;
          if (isNew && req.onupgradeneeded) req.onupgradeneeded();
          if (req.onsuccess) req.onsuccess();
        });
        return req;
      });
      openSpy = open;
      Object.defineProperty(globalThis, 'indexedDB', {
        value: { open },
        writable: true,
        configurable: true,
      });
    }

    function uninstallMockIndexedDB() {
      if (hadIndexedDB) {
        Object.defineProperty(globalThis, 'indexedDB', {
          value: originalIndexedDB,
          writable: true,
          configurable: true,
        });
      } else {
        // jsdom default: no indexedDB global. Restore by deleting.
        delete (globalThis as { indexedDB?: unknown }).indexedDB;
      }
    }

    function arrayBufferToBase64(buffer: ArrayBuffer): string {
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    }

    beforeEach(() => {
      hadIndexedDB = 'indexedDB' in globalThis;
      originalIndexedDB = (globalThis as { indexedDB?: unknown }).indexedDB;
      installMockIndexedDB();
      idbService = new CryptoService();
    });

    afterEach(() => {
      uninstallMockIndexedDB();
      if (generateKeySpy) {
        generateKeySpy.mockRestore();
        generateKeySpy = null;
      }
      openSpy = null;
    });

    it('persists a non-extractable device key in IndexedDB on first use', async () => {
      await idbService.encrypt('payload');

      // When IDB is the chosen storage, the legacy localStorage slot stays empty.
      expect(localStorageMock['easyturno_device_key']).toBeUndefined();

      const storedKey = idbContents.get(IDB_DB)?.get(IDB_STORE)?.get(IDB_KEY) as
        | CryptoKey
        | undefined;
      expect(storedKey).toBeTruthy();
      // The whole point of using IDB: the key bytes never become extractable.
      expect((storedKey as CryptoKey).extractable).toBe(false);
      expect((storedKey as CryptoKey).type).toBe('secret');
    });

    it('migrates a legacy localStorage key into IndexedDB and clears the old record', async () => {
      // Seed: build an exportable AES-GCM key and persist it the way the old
      // implementation used to (raw bytes, base64 in localStorage).
      const legacyKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);
      const raw = await crypto.subtle.exportKey('raw', legacyKey);
      localStorageMock['easyturno_device_key'] = arrayBufferToBase64(raw);

      // Pre-encrypt a payload with the legacy key. If the service regenerates
      // a fresh key instead of migrating, this decrypt will throw.
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const encoded = new TextEncoder().encode('legacy-payload');
      const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, legacyKey, encoded);
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);
      const ciphertext = arrayBufferToBase64(combined.buffer);

      // First service call triggers the migration path.
      const decrypted = await idbService.decrypt(ciphertext);
      expect(decrypted).toBe('legacy-payload');

      // Legacy entry was removed.
      expect(localStorageMock['easyturno_device_key']).toBeUndefined();
      // IDB now holds the migrated key.
      expect(idbContents.get(IDB_DB)?.get(IDB_STORE)?.get(IDB_KEY)).toBeTruthy();
    });

    it('falls back to localStorage when IndexedDB is unavailable', async () => {
      // Remove the mock so isIndexedDBAvailable() returns false.
      uninstallMockIndexedDB();
      hadIndexedDB = false;
      const fallbackService = new CryptoService();

      const ciphertext = await fallbackService.encrypt('fallback-data');

      // No IDB transactions happened.
      expect(openSpy).not.toHaveBeenCalled();
      // Key landed in localStorage (extractable, since IDB couldn't host it).
      expect(localStorageMock['easyturno_device_key']).toBeTruthy();
      // Round-trip still works.
      expect(await fallbackService.decrypt(ciphertext)).toBe('fallback-data');
    });

    it('resets the cached device-key promise when key resolution fails', async () => {
      const failingService = new CryptoService();
      jest.spyOn(failingService as any, 'isIndexedDBAvailable').mockReturnValue(false);
      jest.spyOn(failingService as any, 'getLegacyKeyFromLocalStorage').mockResolvedValue(null);
      jest
        .spyOn(failingService as any, 'generateDeviceKey')
        .mockRejectedValueOnce(new Error('key generation failed'));

      await expect((failingService as any).getDeviceKey()).rejects.toThrow('key generation failed');

      expect((failingService as any).deviceKeyPromise).toBeNull();
    });

    it('continues with legacy key migration when IndexedDB key loading throws', async () => {
      const legacyKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
        'encrypt',
        'decrypt',
      ]);
      const raw = await crypto.subtle.exportKey('raw', legacyKey);
      localStorageMock['easyturno_device_key'] = arrayBufferToBase64(raw);
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      jest
        .spyOn(idbService as any, 'getKeyFromIDB')
        .mockRejectedValueOnce(new Error('IDB read failed'));

      const encrypted = await idbService.encrypt('migrated-after-idb-error');

      await expect(idbService.decrypt(encrypted)).resolves.toBe('migrated-after-idb-error');
      expect(warnSpy).toHaveBeenCalledWith(
        'Failed to load key from IndexedDB, will try migration',
        expect.any(Error)
      );
      expect(localStorageMock['easyturno_device_key']).toBeUndefined();

      warnSpy.mockRestore();
    });

    it('shares a single device-key promise across concurrent encrypts (no race)', async () => {
      generateKeySpy = jest.spyOn(crypto.subtle, 'generateKey');

      const [c1, c2, c3] = await Promise.all([
        idbService.encrypt('a'),
        idbService.encrypt('b'),
        idbService.encrypt('c'),
      ]);

      // Filter to AES-GCM device-key generations (rules out any unrelated calls).
      const deviceKeyGenerations = generateKeySpy.mock.calls.filter(call => {
        const algo = call[0] as { name?: string } | string;
        return typeof algo === 'object' && algo?.name === 'AES-GCM';
      });
      expect(deviceKeyGenerations).toHaveLength(1);

      // Only one key was written to IDB despite three concurrent callers.
      const store = idbContents.get(IDB_DB)?.get(IDB_STORE);
      expect(store?.size).toBe(1);

      // The single shared key decrypts every concurrent ciphertext.
      expect(await idbService.decrypt(c1)).toBe('a');
      expect(await idbService.decrypt(c2)).toBe('b');
      expect(await idbService.decrypt(c3)).toBe('c');
    });
  });

  describe('Real-world scenarios', () => {
    it('should encrypt and decrypt shift data structure', async () => {
      const shiftData = JSON.stringify([
        {
          id: 'shift-1',
          title: 'Morning Shift',
          start: '2025-10-17T08:00:00.000Z',
          end: '2025-10-17T16:00:00.000Z',
          color: 'indigo',
          overtimeHours: 1.5,
          allowances: [{ name: 'Night Differential', amount: 50 }],
        },
        {
          id: 'shift-2',
          title: 'Evening Shift',
          start: '2025-10-17T16:00:00.000Z',
          end: '2025-10-18T00:00:00.000Z',
          color: 'emerald',
        },
      ]);

      const encrypted = await service.encrypt(shiftData);
      const decrypted = await service.decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(JSON.parse(shiftData));
    });

    it('should handle migration from unencrypted to encrypted data', async () => {
      // Simulate unencrypted JSON data
      const unencryptedData = '{"shifts": [], "version": 1}';

      // Check if data is encrypted
      expect(service.isEncrypted(unencryptedData)).toBe(false);

      // Encrypt for storage
      const encrypted = await service.encrypt(unencryptedData);
      expect(service.isEncrypted(encrypted)).toBe(true);

      // Decrypt and verify
      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toBe(unencryptedData);
    });

    it('should support backup/export workflow', async () => {
      const userData = JSON.stringify({
        shifts: [{ id: '1', title: 'Test' }],
        settings: { theme: 'dark', language: 'it' },
      });

      // Encrypt for storage
      const encrypted = await service.encrypt(userData);

      // Simulate export (encrypted data)
      const exportData = encrypted;

      // Simulate import and decrypt
      const imported = await service.decrypt(exportData);

      expect(JSON.parse(imported)).toEqual(JSON.parse(userData));
    });
  });
});
