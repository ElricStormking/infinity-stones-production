# End-to-End Integration Testing Suite

**Task 8.1: End-to-end integration testing**

This comprehensive integration testing suite validates the complete Phase 5 casino system, ensuring all components work together correctly from authentication through gameplay to payout.

## Overview

The integration test suite covers:

1. **Complete Game Flow Testing** - Full user journey from login to payout
2. **Game State Synchronization Validation** - Client-server state consistency 
3. **Error Handling and Recovery Scenarios** - Network failures, timeouts, disconnections
4. **Animation and UI Preservation Verification** - UI consistency with server data
5. **Performance Validation** - Response times and system performance under load
6. **Data Integrity Testing** - Credits, transactions, and game state accuracy

## Test Structure

```
tests/integration/
├── EndToEndIntegration.test.js          # Client-server integration tests
├── runIntegrationTests.js               # Test runner with comprehensive reporting
├── jest.config.js                       # Jest configuration for integration tests
├── setup.js                             # Custom matchers and test utilities
├── globalSetup.js                       # Global test environment setup
├── globalTeardown.js                    # Global cleanup and reporting
├── package.json                         # Test dependencies and scripts
└── README.md                            # This documentation

infinity-storm-server/tests/integration/
└── ServerIntegration.test.js            # Server-side integration tests
```

## Test Categories

### 1. Complete Game Flow Testing
- **User Authentication** - Login, session management, token refresh
- **Wallet Operations** - Balance checks, debit/credit operations, transaction integrity
- **Game Sessions** - Session creation, management, and closure
- **Spin Processing** - Bet placement, result generation, win processing
- **Free Spins** - Purchase workflow and free spin mechanics
- **Progressive Jackpots** - Contribution and potential wins

### 2. Game State Synchronization Validation
- **Client-Server Sync** - Perfect state synchronization during cascades
- **Hash Validation** - Cryptographic verification of game states
- **Step Acknowledgments** - Real-time step-by-step validation
- **Desync Detection** - Automatic detection and correction of state mismatches
- **Recovery Mechanisms** - Progressive recovery strategies

### 3. Error Handling and Recovery Scenarios
- **Network Failures** - Timeout handling and recovery
- **Server Errors** - Graceful degradation and retry mechanisms  
- **Session Expiry** - Token expiration and re-authentication
- **WebSocket Disconnections** - Connection loss and reconnection
- **Transaction Rollbacks** - Database consistency on failures

### 4. Animation and UI Preservation
- **Animation Timing** - Server-synchronized animation data
- **UI State Preservation** - Maintaining UI settings across operations
- **Fallback Mechanisms** - Graceful handling when server data unavailable
- **Performance Consistency** - Smooth animations with server integration

### 5. Performance Validation
- **Response Time Requirements** - All operations <500ms for spins, <200ms for wallet
- **Concurrent Operations** - Multiple simultaneous users and operations
- **Sustained Load** - Performance under continuous high load
- **Resource Management** - Memory usage and cleanup verification

### 6. Data Integrity Testing
- **Transaction Accuracy** - Complete audit trail of all transactions
- **Balance Consistency** - Perfect balance calculations across operations
- **Duplicate Prevention** - Protection against duplicate transactions
- **Referential Integrity** - Database relationships maintained correctly

## Running Tests

### Prerequisites

```bash
# Install test dependencies
cd tests/integration
npm install

# Or install from root
npm install
```

### Run All Integration Tests

```bash
# Comprehensive test runner with reporting
node tests/integration/runIntegrationTests.js

# Or using Jest directly
npm run test --prefix tests/integration
```

### Run Specific Test Categories

```bash
# Client-server integration
npm run test:client --prefix tests/integration

# Server-side integration  
npm run test:server --prefix tests/integration

# Cascade synchronization
npm run test:cascade --prefix tests/integration

# WebSocket communication
npm run test:websocket --prefix tests/integration

# Performance testing
npm run test:performance --prefix tests/integration
```

### Watch Mode for Development

```bash
npm run test:watch --prefix tests/integration
```

### Coverage Reports

```bash
npm run test:coverage --prefix tests/integration

# Open HTML coverage report
npm run report --prefix tests/integration
```

## Test Configuration

### Environment Variables

```bash
NODE_ENV=test                    # Test environment
TEST_MODE=integration           # Integration test mode  
LOG_LEVEL=error                 # Reduce log noise
DATABASE_URL=memory://test      # In-memory database
REDIS_URL=memory://test         # In-memory Redis
JWT_SECRET=test-secret-key      # JWT secret for testing
DISABLE_RATE_LIMITING=true      # Disable rate limiting
```

### Performance Thresholds

- **Spin Operations**: <500ms response time
- **Wallet Operations**: <200ms response time  
- **Authentication**: <300ms response time
- **Concurrent Users**: 100+ simultaneous operations
- **Success Rate**: >95% under load
- **Memory Usage**: <100MB growth during testing

## Custom Test Matchers

The test suite includes custom Jest matchers for casino-specific validations:

```javascript
// Balance validation
expect(response.balance).toBeValidBalance();

// Spin result validation
expect(spinResult).toBeValidSpinResult();

// Response time validation
expect(responseTime).toHaveValidResponseTime(500);

// Tolerance checking for financial calculations
expect(calculatedAmount).toBeWithinTolerance(expectedAmount, 0.01);

// Session and transaction ID validation
expect(sessionId).toBeValidSessionId();
expect(transactionId).toBeValidTransactionId();

// Cascade step validation
expect(spinResult).toHaveValidCascadeSteps();
```

## Test Utilities

### Performance Measurement

```javascript
const { result, performance } = await testUtils.measurePerformance(async () => {
    return await gameOperation();
}, 'spin_operation');

console.log(`Operation took ${performance.duration}ms`);
```

### Concurrent Execution

```javascript
const operations = Array.from({length: 100}, () => () => spinOperation());
const results = await testUtils.executeConcurrently(operations, 10);
```

### Mock Data Generation

```javascript
const playerId = testUtils.generateRandomPlayerId();
const sessionId = testUtils.generateRandomSessionId();  
const betAmount = testUtils.generateRandomAmount(1, 100);
const mockGrid = testUtils.generateMockGrid();
```

## Reporting

### Test Runner Report

The test runner generates comprehensive reports including:

- **Overall Results** - Total tests, pass/fail rates, duration
- **Category Breakdown** - Results by test category  
- **Performance Metrics** - Response times, throughput, resource usage
- **Error Analysis** - Detailed error information and recommendations
- **Coverage Statistics** - Code coverage across components

### Output Files

- `coverage/integration/integration-test-report.html` - Visual HTML report
- `coverage/integration/integration-test-report.json` - Detailed JSON results
- `coverage/integration/lcov.info` - Coverage data for CI/CD
- `coverage/integration/teardown-summary.json` - Cleanup and environment data

## Integration with CI/CD

### GitHub Actions Example

```yaml
name: Integration Tests

on: [push, pull_request]

jobs:
  integration:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        
    - name: Install dependencies
      run: |
        npm install
        cd tests/integration && npm install
        
    - name: Run integration tests
      run: node tests/integration/runIntegrationTests.js
      
    - name: Upload coverage reports
      uses: actions/upload-artifact@v3
      with:
        name: integration-coverage
        path: coverage/integration/
```

## Troubleshooting

### Common Issues

1. **Port Conflicts** - Tests start servers on random ports to avoid conflicts
2. **Timeout Issues** - Increase `testTimeout` in jest.config.js if needed
3. **Memory Leaks** - Tests include cleanup and garbage collection
4. **Async Cleanup** - Tests wait for proper resource cleanup

### Debug Mode

```bash
# Enable verbose output
DEBUG=* npm run test --prefix tests/integration

# Run single test with debugging
npm run test -- --testNamePattern="specific test name" --verbose
```

### Performance Debugging

```bash
# Run with memory profiling
node --expose-gc tests/integration/runIntegrationTests.js

# Monitor resource usage
htop # or equivalent system monitor
```

## Success Criteria

The integration test suite validates:

✅ **Complete User Journeys** - All user workflows from login to payout  
✅ **State Synchronization** - Perfect client-server consistency  
✅ **Error Recovery** - Graceful handling of all failure scenarios  
✅ **Performance Standards** - All operations meet response time requirements  
✅ **Data Integrity** - Complete accuracy of all financial transactions  
✅ **Scalability** - System handles concurrent operations efficiently  
✅ **Security Validation** - All security measures function correctly  
✅ **Animation Consistency** - UI remains smooth with server integration

## Contributing

When adding new integration tests:

1. Follow the established test structure and naming conventions
2. Use the provided custom matchers and test utilities
3. Include both positive and negative test cases
4. Add performance validations for new operations
5. Update this README with new test categories or utilities
6. Ensure tests clean up all resources properly

The integration test suite ensures the Phase 5 casino system is production-ready with enterprise-grade reliability, security, and performance.