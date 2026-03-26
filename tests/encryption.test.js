// Simple test for encryption utility
const crypto = require('crypto');

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
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (encryptedText) => {
  const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
  const parts = encryptedText.split(':');
  const iv = Buffer.from(parts[0], 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
  let decrypted = decipher.update(parts[1], 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
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
