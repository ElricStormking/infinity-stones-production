/**
 * Test setup file for client-side validation integration tests
 * Configures global mocks and environment for all tests
 */

// Mock global fetch for network requests
global.fetch = jest.fn();

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock sessionStorage
const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.sessionStorage = sessionStorageMock;

// Mock Web Crypto API
Object.defineProperty(global, 'crypto', {
  value: {
    subtle: {
      digest: jest.fn(async (algorithm, data) => {
        // Return mock hash buffer
        const mockHash = new Array(32).fill(0).map((_, i) => i);
        return new Uint8Array(mockHash).buffer;
      })
    },
    getRandomValues: jest.fn((array) => {
      for (let i = 0; i < array.length; i++) {
        array[i] = Math.floor(Math.random() * 256);
      }
      return array;
    })
  }
});

// Mock TextEncoder/TextDecoder
global.TextEncoder = class TextEncoder {
  encode(str) {
    return new Uint8Array(Buffer.from(str, 'utf8'));
  }
};

global.TextDecoder = class TextDecoder {
  decode(uint8Array) {
    return Buffer.from(uint8Array).toString('utf8');
  }
};

// Mock performance API
global.performance = {
  now: jest.fn(() => Date.now()),
  mark: jest.fn(),
  measure: jest.fn(),
  getEntriesByName: jest.fn(() => []),
  getEntriesByType: jest.fn(() => [])
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((callback) => {
  return setTimeout(callback, 16); // ~60fps
});

global.cancelAnimationFrame = jest.fn((id) => {
  clearTimeout(id);
});

// Mock console methods with silent versions for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn(),
  debug: jest.fn()
};

// Mock window.alert, confirm, prompt
global.alert = jest.fn();
global.confirm = jest.fn(() => true);
global.prompt = jest.fn(() => 'test');

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Setup Jest custom matchers for enhanced testing
expect.extend({
  toBeWithinTolerance(received, expected, tolerance = 0.01) {
    const pass = Math.abs(received - expected) <= tolerance;
    if (pass) {
      return {
        message: () => `expected ${received} not to be within ${tolerance} of ${expected}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be within ${tolerance} of ${expected}`,
        pass: false,
      };
    }
  },
  
  toHaveValidationHash(received) {
    const pass = typeof received === 'string' && received.length > 0;
    if (pass) {
      return {
        message: () => `expected ${received} not to be a valid hash`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be a valid hash string`,
        pass: false,
      };
    }
  },
  
  toHaveSyncState(received, expectedState) {
    const pass = received && received.isActive === expectedState;
    if (pass) {
      return {
        message: () => `expected sync state not to be ${expectedState}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected sync state to be ${expectedState}, got ${received?.isActive}`,
        pass: false,
      };
    }
  }
});

// Global test utilities
global.testUtils = {
  // Generate mock grid state
  generateMockGrid: (cols = 6, rows = 5) => {
    const symbols = ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem'];
    return Array(cols).fill().map(() => 
      Array(rows).fill().map(() => symbols[Math.floor(Math.random() * symbols.length)])
    );
  },
  
  // Generate mock cascade step
  generateMockCascadeStep: (stepIndex = 1) => ({
    stepIndex,
    gridState: global.testUtils.generateMockGrid(),
    validationHash: `mock_hash_${stepIndex}_${Date.now()}`,
    timing: {
      duration: 800,
      serverTimestamp: Date.now(),
      phaseTimings: {
        win_highlight: 200,
        symbol_removal: 150,
        symbol_drop: 300,
        symbol_settle: 150
      }
    },
    matches: [
      {
        symbol: 'time_gem',
        count: 8,
        positions: [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2],[2,0],[2,1]]
      }
    ],
    dropPatterns: [
      {
        column: 0,
        drops: [
          { from: -1, to: 0, symbolType: 'space_gem' }
        ]
      }
    ]
  }),
  
  // Wait for async operations
  waitFor: (ms = 100) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock server response
  generateMockServerResponse: (requestId = 'test_request') => ({
    requestId,
    success: true,
    initialGrid: global.testUtils.generateMockGrid(),
    finalGrid: global.testUtils.generateMockGrid(),
    cascadeSteps: [
      global.testUtils.generateMockCascadeStep(1),
      global.testUtils.generateMockCascadeStep(2)
    ],
    totalWin: 100,
    totalMultiplier: 2.0,
    netResult: 90,
    timing: {
      totalDuration: 1600,
      stepDuration: 800
    },
    betAmount: 10,
    timestamp: Date.now(),
    serverGenerated: true
  })
};

// Setup global error handling for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Cleanup after each test
afterEach(() => {
  // Clear all mocks
  jest.clearAllMocks();
  
  // Reset console methods
  if (global.console.log.mockClear) {
    global.console.log.mockClear();
    global.console.warn.mockClear();
    global.console.error.mockClear();
  }
  
  // Clear timers
  jest.clearAllTimers();
  
  // Clear window object additions
  if (global.window) {
    // Reset specific properties that tests might modify
    delete global.window.cascadeAPI;
    delete global.window.GridManager;
    delete global.window.WinCalculator;
    delete global.window.AnimationManager;
    delete global.window.GameScene;
  }
});