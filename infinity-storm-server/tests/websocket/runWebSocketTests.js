/**
 * runWebSocketTests.js - WebSocket Test Runner
 *
 * Custom Task 4.5: Test WebSocket cascade events
 *
 * This script provides a comprehensive test runner for all WebSocket cascade
 * event tests, including setup, execution, and reporting.
 */

const { spawn } = require('child_process');
const path = require('path');

// Test configuration
const TEST_CONFIG = {
  testTimeout: 30000,
  verbose: true,
  coverage: true,
  detectOpenHandles: true,
  forceExit: true
};

// Test files to run
const TEST_FILES = [
  'WebSocketCascadeEvents.test.js',
  'WebSocketIntegration.test.js'
];

/**
 * Run WebSocket cascade event tests
 */
async function runWebSocketTests() {
  console.log('🔄 Starting WebSocket Cascade Event Tests');
  console.log('=========================================\n');

  const testResults = {
    total: 0,
    passed: 0,
    failed: 0,
    errors: []
  };

  for (const testFile of TEST_FILES) {
    console.log(`\n📋 Running ${testFile}...`);
    console.log('─'.repeat(50));

    try {
      const result = await runSingleTest(testFile);
      testResults.total++;

      if (result.success) {
        testResults.passed++;
        console.log(`✅ ${testFile} - PASSED`);
      } else {
        testResults.failed++;
        testResults.errors.push({
          file: testFile,
          error: result.error
        });
        console.log(`❌ ${testFile} - FAILED`);
        console.log(`   Error: ${result.error}`);
      }
    } catch (error) {
      testResults.total++;
      testResults.failed++;
      testResults.errors.push({
        file: testFile,
        error: error.message
      });
      console.log(`❌ ${testFile} - ERROR`);
      console.log(`   Error: ${error.message}`);
    }
  }

  // Print final results
  console.log('\n🏁 WebSocket Test Results');
  console.log('========================');
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`Passed: ${testResults.passed}`);
  console.log(`Failed: ${testResults.failed}`);
  console.log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log('\n📋 Test Errors:');
    testResults.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.file}: ${error.error}`);
    });
  }

  if (testResults.failed === 0) {
    console.log('\n🎉 All WebSocket tests completed successfully!');
    console.log('\n✅ Task 4.5: Test WebSocket cascade events - COMPLETED');
    console.log('  - 4.5.1: Test real-time cascade broadcasting ✅');
    console.log('  - 4.5.2: Test step acknowledgment events ✅');
    console.log('  - 4.5.3: Test desync detection events ✅');
    console.log('  - 4.5.4: Test recovery coordination events ✅');
  } else {
    console.log('\n⚠️  Some WebSocket tests failed. Please review the errors above.');
  }

  return testResults;
}

/**
 * Run a single test file
 */
function runSingleTest(testFile) {
  return new Promise((resolve) => {
    const testPath = path.join(__dirname, testFile);

    const jestArgs = [
      testPath,
      '--verbose',
      '--detectOpenHandles',
      '--forceExit',
      '--testTimeout=30000'
    ];

    if (TEST_CONFIG.coverage) {
      jestArgs.push('--coverage');
    }

    const jest = spawn('npx', ['jest', ...jestArgs], {
      cwd: path.join(__dirname, '../..'),
      stdio: 'pipe'
    });

    let output = '';
    let errorOutput = '';

    jest.stdout.on('data', (data) => {
      const text = data.toString();
      output += text;
      if (TEST_CONFIG.verbose) {
        process.stdout.write(text);
      }
    });

    jest.stderr.on('data', (data) => {
      const text = data.toString();
      errorOutput += text;
      if (TEST_CONFIG.verbose) {
        process.stderr.write(text);
      }
    });

    jest.on('close', (code) => {
      const success = code === 0;
      const error = success ? null : (errorOutput || 'Test execution failed');

      resolve({
        success,
        error,
        output,
        errorOutput
      });
    });

    jest.on('error', (error) => {
      resolve({
        success: false,
        error: error.message,
        output,
        errorOutput
      });
    });
  });
}

/**
 * Verify test environment setup
 */
async function verifyTestEnvironment() {
  console.log('🔍 Verifying test environment...');

  const requiredDependencies = [
    'jest',
    'socket.io',
    'socket.io-client',
    'supertest'
  ];

  const missingDependencies = [];

  for (const dep of requiredDependencies) {
    try {
      require.resolve(dep);
      console.log(`✅ ${dep} - Available`);
    } catch (error) {
      missingDependencies.push(dep);
      console.log(`❌ ${dep} - Missing`);
    }
  }

  if (missingDependencies.length > 0) {
    console.log('\n⚠️  Missing dependencies detected:');
    console.log('Please install the following packages:');
    console.log(`npm install ${missingDependencies.join(' ')}`);
    return false;
  }

  console.log('\n✅ Test environment ready!');
  return true;
}

/**
 * Main execution
 */
async function main() {
  try {
    const envReady = await verifyTestEnvironment();

    if (!envReady) {
      console.log('\n❌ Test environment not ready. Please install missing dependencies.');
      process.exit(1);
    }

    const results = await runWebSocketTests();

    // Exit with error code if tests failed
    process.exit(results.failed > 0 ? 1 : 0);

  } catch (error) {
    console.error('\n❌ Test runner error:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = {
  runWebSocketTests,
  runSingleTest,
  verifyTestEnvironment
};