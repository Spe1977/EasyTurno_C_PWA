import { Injectable } from '@angular/core';

/**
 * CryptoService - Provides encryption/decryption for localStorage data
 *
 * Uses Web Crypto API with AES-GCM for authenticated encryption.
 * Key derivation is based on device fingerprint to avoid requiring user passwords.
 */
@Injectable({
  providedIn: 'root',
})
export class CryptoService {
  private readonly DEVICE_KEY_NAME = 'easyturno_device_key';
  private readonly KEY_LENGTH = 256;
  private readonly ALGORITHM = 'AES-GCM';
  private readonly IV_LENGTH = 12; // 96 bits for AES-GCM
  private readonly SALT_LENGTH = 16;

  /**
   * Gets or generates a device-specific encryption key
   * The key is stored in localStorage but is cryptographically secure
   */
  private async getDeviceKey(): Promise<CryptoKey> {
    // Try to load existing key
    const storedKey = localStorage.getItem(this.DEVICE_KEY_NAME);

    if (storedKey) {
      try {
        // Import the stored key
        const keyData = this.base64ToArrayBuffer(storedKey);
        return await crypto.subtle.importKey(
          'raw',
          keyData,
          { name: this.ALGORITHM, length: this.KEY_LENGTH },
          false,
          ['encrypt', 'decrypt']
        );
      } catch (error) {
        console.warn('Failed to import stored key, generating new one', error);
      }
    }

    // Generate new key
    const key = await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true, // extractable
      ['encrypt', 'decrypt']
    );

    // Store the key for future use
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    localStorage.setItem(this.DEVICE_KEY_NAME, this.arrayBufferToBase64(exportedKey));

    return key;
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
    // Encrypted data should be base64 and reasonably long
    // Non-encrypted JSON starts with { or [
    if (!data || data.length === 0) return false;

    const firstChar = data.charAt(0);
    return firstChar !== '{' && firstChar !== '[';
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
}
