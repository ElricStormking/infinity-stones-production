/**
 * Jest test setup file
 * Configures test environment for Enhanced Cascade Synchronization tests
 */

// Increase timeout for integration tests
jest.setTimeout(10000);

// Global test utilities
global.testUtils = {
  // Helper to create valid grid
  createValidGrid: () => [
    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
    ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
    ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove'],
    ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
    ['soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos', 'infinity_glove']
  ],
  
  // Helper to create match-guaranteed grid
  createMatchGrid: () => [
    ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'space_gem'],
    ['time_gem', 'time_gem', 'time_gem', 'time_gem', 'space_gem'],
    ['mind_gem', 'mind_gem', 'mind_gem', 'mind_gem', 'space_gem'],
    ['mind_gem', 'mind_gem', 'mind_gem', 'mind_gem', 'space_gem'],
    ['power_gem', 'power_gem', 'power_gem', 'power_gem', 'space_gem'],
    ['power_gem', 'power_gem', 'power_gem', 'power_gem', 'space_gem']
  ],
  
  // Helper to wait for async operations
  wait: (ms) => new Promise(resolve => setTimeout(resolve, ms))
};

// Mock console.warn and console.error in tests to reduce noise
const originalWarn = console.warn;
const originalError = console.error;

beforeEach(() => {
  console.warn = jest.fn();
  console.error = jest.fn();
});

afterEach(() => {
  console.warn = originalWarn;
  console.error = originalError;
});