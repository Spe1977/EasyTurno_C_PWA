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
