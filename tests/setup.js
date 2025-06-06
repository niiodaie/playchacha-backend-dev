/**
 * Jest setup file
 * 
 * This file runs before each test file and sets up the test environment.
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret';
process.env.STRIPE_SECRET_KEY = 'test-stripe-key';
process.env.STRIPE_WEBHOOK_SECRET = 'test-webhook-secret';
process.env.ODDS_API_KEY = 'test-odds-api-key';

// Increase timeout for tests
jest.setTimeout(30000);

// Global teardown after all tests
afterAll(async () => {
  // Add any global cleanup here if needed
});

