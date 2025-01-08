import CryptoJS from 'crypto-js';
import { ApiError } from '../types/common';

// Constants
const STORAGE_PREFIX = 'provocative_cloud_';
const STORAGE_VERSION = 'v1';
const ENCRYPTION_KEY = process.env.REACT_APP_STORAGE_ENCRYPTION_KEY || '';
const MAX_STORAGE_SIZE = 5 * 1024 * 1024; // 5MB
const COMPRESSION_THRESHOLD = 1024 * 100; // 100KB

// Storage error types
class StorageError extends Error {
  constructor(public code: number, message: string) {
    super(message);
    this.name = 'StorageError';
  }
}

// Helper functions
const getFullKey = (key: string): string => {
  return `${STORAGE_PREFIX}${STORAGE_VERSION}_${key}`;
};

const encrypt = (value: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new StorageError(500, 'Encryption key not configured');
  }
  return CryptoJS.AES.encrypt(value, ENCRYPTION_KEY).toString();
};

const decrypt = (value: string): string => {
  if (!ENCRYPTION_KEY) {
    throw new StorageError(500, 'Encryption key not configured');
  }
  const bytes = CryptoJS.AES.decrypt(value, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
};

const compress = (value: string): string => {
  return CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(value));
};

const decompress = (value: string): string => {
  const bytes = CryptoJS.enc.Base64.parse(value);
  return CryptoJS.enc.Utf8.stringify(bytes);
};

const calculateStorageUsage = (): number => {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(STORAGE_PREFIX)) {
      total += (localStorage.getItem(key)?.length || 0) * 2; // UTF-16 encoding
    }
  }
  return total;
};

/**
 * Stores data in localStorage with optional encryption and compression
 * @param key Storage key
 * @param value Value to store
 * @param encrypt Whether to encrypt the data
 * @throws {StorageError} If storage quota is exceeded or operation fails
 */
export function setLocalStorage<T>(key: string, value: T, shouldEncrypt = false): void {
  try {
    if (!key || typeof key !== 'string') {
      throw new StorageError(400, 'Invalid storage key');
    }

    const fullKey = getFullKey(key);
    let serializedValue = JSON.stringify(value);
    
    // Check size before compression
    if (serializedValue.length > COMPRESSION_THRESHOLD) {
      serializedValue = compress(serializedValue);
    }

    if (shouldEncrypt) {
      serializedValue = encrypt(serializedValue);
    }

    // Check storage quota
    const currentUsage = calculateStorageUsage();
    const newSize = serializedValue.length * 2; // UTF-16 encoding
    if (currentUsage + newSize > MAX_STORAGE_SIZE) {
      throw new StorageError(507, 'Storage quota exceeded');
    }

    localStorage.setItem(fullKey, serializedValue);
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(500, `Storage operation failed: ${(error as Error).message}`);
  }
}

/**
 * Retrieves data from localStorage with optional decryption
 * @param key Storage key
 * @param decrypt Whether to decrypt the data
 * @returns Retrieved value or null if not found
 * @throws {StorageError} If decryption fails or data is invalid
 */
export function getLocalStorage<T>(key: string, shouldDecrypt = false): T | null {
  try {
    const fullKey = getFullKey(key);
    const value = localStorage.getItem(fullKey);

    if (!value) {
      return null;
    }

    let parsedValue = value;
    
    if (shouldDecrypt) {
      parsedValue = decrypt(parsedValue);
    }

    // Try decompression if value appears to be compressed
    try {
      parsedValue = decompress(parsedValue);
    } catch {
      // Value wasn't compressed, continue with parsing
    }

    return JSON.parse(parsedValue) as T;
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(500, `Failed to retrieve storage value: ${(error as Error).message}`);
  }
}

/**
 * Stores sensitive data in sessionStorage with encryption
 * @param key Storage key
 * @param value Value to store
 * @param encrypt Whether to encrypt the data
 * @throws {StorageError} If storage operation fails
 */
export function setSessionStorage<T>(key: string, value: T, shouldEncrypt = true): void {
  try {
    if (!key || typeof key !== 'string') {
      throw new StorageError(400, 'Invalid storage key');
    }

    const fullKey = getFullKey(key);
    let serializedValue = JSON.stringify(value);

    if (shouldEncrypt) {
      serializedValue = encrypt(serializedValue);
    }

    sessionStorage.setItem(fullKey, serializedValue);
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(500, `Session storage operation failed: ${(error as Error).message}`);
  }
}

/**
 * Securely clears all application storage data
 * @throws {StorageError} If cleanup operation fails
 */
export function clearStorage(): void {
  try {
    // Clear localStorage
    const localStorageKeys = Object.keys(localStorage);
    localStorageKeys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.removeItem(key);
      }
    });

    // Clear sessionStorage
    const sessionStorageKeys = Object.keys(sessionStorage);
    sessionStorageKeys.forEach(key => {
      if (key.startsWith(STORAGE_PREFIX)) {
        sessionStorage.removeItem(key);
      }
    });

    // Verify cleanup
    const remainingLocalKeys = Object.keys(localStorage).filter(key => 
      key.startsWith(STORAGE_PREFIX)
    );
    const remainingSessionKeys = Object.keys(sessionStorage).filter(key => 
      key.startsWith(STORAGE_PREFIX)
    );

    if (remainingLocalKeys.length > 0 || remainingSessionKeys.length > 0) {
      throw new StorageError(500, 'Storage cleanup verification failed');
    }
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError(500, `Storage cleanup failed: ${(error as Error).message}`);
  }
}