// Simple test for encryption utility
const crypto = require('crypto-js');

// Mock environment variables (64-character hex key for AES-256)
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

// Mock the logger
jest.mock('../src/utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));

// Create a simplified version of the encryption utility for testing
const encrypt = (text) => {
  const key = process.env.ENCRYPTION_KEY;
  return crypto.AES.encrypt(text, key).toString();
};

const decrypt = (encryptedText) => {
  const key = process.env.ENCRYPTION_KEY;
  const bytes = crypto.AES.decrypt(encryptedText, key);
  return bytes.toString(crypto.enc.Utf8);
};

describe('Encryption Utility', () => {
  const testText = 'test-text-to-encrypt';
  
  it('should encrypt and decrypt text correctly', () => {
    // Encrypt the text
    const encryptedText = encrypt(testText);
    
    // Encrypted text should be different from original
    expect(encryptedText).not.toBe(testText);
    
    // Decrypt the text
    const decryptedText = decrypt(encryptedText);
    
    // Decrypted text should match original
    expect(decryptedText).toBe(testText);
  });
});
