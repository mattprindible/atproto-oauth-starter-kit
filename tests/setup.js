/**
 * Jest setup file - runs before all tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.PORT = '3001'; // Use different port for tests
process.env.PUBLIC_URL = 'https://test.example.com';
process.env.COOKIE_SECRET = 'test-cookie-secret-that-is-at-least-32-characters-long';

// Suppress console output during tests (optional - comment out to see logs)
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
};

// Set test timeout
jest.setTimeout(10000);
