/**
 * Jest configuration for client-side validation integration tests
 * Task 3.6: Test client-side validation integration
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Test file patterns
  testMatch: [
    '<rootDir>/**/*.test.js'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/setup.js'
  ],
  
  // Module path mapping
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/../../$1'
  },
  
  // Coverage configuration
  collectCoverage: true,
  collectCoverageFrom: [
    '../../services/CascadeAPI.js',
    '../../systems/GridManager.js',
    '../../systems/WinCalculator.js',
    '../../managers/AnimationManager.js',
    '../../scenes/GameScene.js'
  ],
  coverageDirectory: './coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // Test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Transform configuration for ES6+ features
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  
  // Module file extensions
  moduleFileExtensions: [
    'js'
  ],
  
  // Global setup and teardown
  globalSetup: '<rootDir>/globalSetup.js',
  globalTeardown: '<rootDir>/globalTeardown.js'
};