/**
 * Global setup for client-side validation integration tests
 * Runs once before all test suites
 */

module.exports = async () => {
  // Set up global test environment
  process.env.NODE_ENV = 'test';
  process.env.TEST_TYPE = 'integration';
  
  // Configure global test timeouts
  jest.setTimeout(10000);
  
  console.log('🧪 Setting up Client-Side Validation Integration Tests');
  console.log('📁 Test Directory: src/tests/clientValidationIntegration/');
  console.log('🎯 Testing Enhanced Cascade Synchronization components');
  console.log('');
};