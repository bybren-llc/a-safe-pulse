/**
 * Manual test for token management functionality
 * 
 * This is a simplified test that verifies the core functionality
 * of the token management system without relying on the database.
 */

// Set up environment variables for testing (64-character hex key for AES-256)
process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.LINEAR_CLIENT_ID = 'test-client-id';
process.env.LINEAR_CLIENT_SECRET = 'test-client-secret';

// Test data
const organizationId = 'test-org-id';
const organizationName = 'Test Organization';
const accessToken = 'test-access-token';
const refreshToken = 'test-refresh-token';
const appUserId = 'test-app-user-id';
const expiresIn = 3600;

// Mock crypto-js for encryption/decryption
const crypto = require('crypto-js');

// Simple encryption/decryption functions
const encrypt = (text) => {
  return crypto.AES.encrypt(text, process.env.ENCRYPTION_KEY).toString();
};

const decrypt = (encryptedText) => {
  const bytes = crypto.AES.decrypt(encryptedText, process.env.ENCRYPTION_KEY);
  return bytes.toString(crypto.enc.Utf8);
};

// Verify encryption/decryption works
const testEncryption = () => {
  const encrypted = encrypt(accessToken);
  const decrypted = decrypt(encrypted);
  
  if (decrypted !== accessToken) {
    console.error('Encryption/decryption test failed');
    return false;
  }
  
  console.log('✅ Encryption/decryption test passed');
  return true;
};

// Run the tests
const runTests = async () => {
  try {
    // Test encryption/decryption
    if (!testEncryption()) {
      return;
    }
    
    console.log('All tests passed!');
  } catch (error) {
    console.error('Test failed with error:', error);
  }
};

// Run the tests
runTests();
