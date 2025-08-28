/**
 * Jest Configuration for End-to-End Integration Testing
 * 
 * Task 8.1: Integration test configuration
 * 
 * Comprehensive Jest configuration for running all integration tests
 * with proper environment setup and reporting.
 */

module.exports = {
    // Test Environment
    testEnvironment: 'node',
    
    // Root directories for tests
    roots: [
        '<rootDir>/tests/integration',
        '<rootDir>/infinity-storm-server/tests'
    ],

    // Test file patterns
    testMatch: [
        '**/tests/integration/**/*.test.js',
        '**/tests/**/integration/*.test.js',
        '**/tests/**/EndToEnd*.test.js',
        '**/tests/**/Integration*.test.js'
    ],

    // Setup files
    setupFilesAfterEnv: [
        '<rootDir>/tests/integration/setup.js'
    ],

    // Test timeout (30 seconds for integration tests)
    testTimeout: 30000,

    // Coverage configuration
    collectCoverage: true,
    coverageDirectory: '<rootDir>/coverage/integration',
    coverageReporters: [
        'text',
        'lcov',
        'html',
        'json-summary'
    ],

    // Files to collect coverage from
    collectCoverageFrom: [
        'infinity-storm-server/src/**/*.js',
        'infinity-storm-server/game-logic/**/*.js',
        'src/services/**/*.js',
        'src/systems/**/*.js',
        'src/managers/**/*.js',
        '!**/*.test.js',
        '!**/node_modules/**',
        '!**/coverage/**'
    ],

    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 70,
            functions: 70,
            lines: 70,
            statements: 70
        }
    },

    // Module paths
    moduleDirectories: [
        'node_modules',
        'infinity-storm-server/node_modules',
        '<rootDir>'
    ],

    // Transform configuration
    transform: {
        '^.+\\.js$': 'babel-jest'
    },

    // Module file extensions
    moduleFileExtensions: [
        'js',
        'json'
    ],

    // Test result processor
    reporters: [
        'default',
        [
            'jest-html-reporters',
            {
                publicPath: './coverage/integration',
                filename: 'integration-test-report.html',
                expand: true,
                hideIcon: true,
                pageTitle: 'Integration Test Report'
            }
        ],
        [
            'jest-junit',
            {
                outputDirectory: './coverage/integration',
                outputName: 'integration-results.xml',
                suiteName: 'Integration Tests'
            }
        ]
    ],

    // Global setup and teardown
    globalSetup: '<rootDir>/tests/integration/globalSetup.js',
    globalTeardown: '<rootDir>/tests/integration/globalTeardown.js',

    // Verbose output
    verbose: true,

    // Detect open handles for proper cleanup
    detectOpenHandles: true,

    // Force exit after tests complete
    forceExit: true,

    // Maximum number of concurrent workers
    maxWorkers: 1, // Sequential execution for integration tests

    // Clear mocks between tests
    clearMocks: true,

    // Restore mocks after each test
    restoreMocks: true,

    // Test name pattern (if specified via CLI)
    testNamePattern: process.env.TEST_NAME_PATTERN,

    // Test path ignore patterns
    testPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/build/',
        '/dist/'
    ],

    // Watch mode ignore patterns
    watchPathIgnorePatterns: [
        '/node_modules/',
        '/coverage/',
        '/build/',
        '/dist/'
    ],

    // Module path ignore patterns
    modulePathIgnorePatterns: [
        '/coverage/',
        '/build/',
        '/dist/'
    ],

    // Custom matchers
    setupFilesAfterEnv: [
        '<rootDir>/tests/integration/setup.js'
    ],

    // Environment variables
    testEnvironmentOptions: {
        // Node.js options if needed
    },

    // Bail configuration (stop on first failure in CI)
    bail: process.env.CI ? 1 : 0,

    // Error on deprecated features
    errorOnDeprecated: true,

    // Notify mode (desktop notifications)
    notify: !process.env.CI,

    // Watch plugins
    watchPlugins: [
        'jest-watch-typeahead/filename',
        'jest-watch-typeahead/testname'
    ]
};