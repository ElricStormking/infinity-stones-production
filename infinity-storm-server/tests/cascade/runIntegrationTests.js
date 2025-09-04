#!/usr/bin/env node

/**
 * Integration Test Runner for Enhanced Cascade Synchronization
 *
 * This script runs the complete end-to-end and performance test suites
 * for Task 15.1 (End-to-End Testing) and Task 15.2 (Performance Testing)
 *
 * Usage:
 *   node runIntegrationTests.js [options]
 *
 * Options:
 *   --e2e-only      Run only end-to-end tests (Task 15.1)
 *   --perf-only     Run only performance tests (Task 15.2)
 *   --fast          Run abbreviated test suite for faster feedback
 *   --verbose       Enable verbose output
 *   --help          Show this help message
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

class IntegrationTestRunner {
  constructor() {
    this.options = this.parseArguments();
    this.testResults = {
      endToEnd: null,
      performance: null,
      startTime: Date.now(),
      endTime: null
    };
  }

  parseArguments() {
    const args = process.argv.slice(2);
    const options = {
      e2eOnly: false,
      perfOnly: false,
      fast: false,
      verbose: false,
      help: false
    };

    args.forEach(arg => {
      switch (arg) {
      case '--e2e-only':
        options.e2eOnly = true;
        break;
      case '--perf-only':
        options.perfOnly = true;
        break;
      case '--fast':
        options.fast = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--help':
        options.help = true;
        break;
      default:
        console.warn(`Unknown option: ${arg}`);
      }
    });

    return options;
  }

  showHelp() {
    console.log(`
Enhanced Cascade Synchronization Integration Test Runner

This script runs comprehensive end-to-end and performance tests for the
Enhanced Cascade Synchronization system (Tasks 15.1 and 15.2).

Usage:
  node runIntegrationTests.js [options]

Options:
  --e2e-only      Run only end-to-end tests (Task 15.1)
                  - Complete spin-to-result flow
                  - Multi-step cascade validation  
                  - Network interruption recovery
                  - Payout accuracy verification

  --perf-only     Run only performance tests (Task 15.2)
                  - High-frequency cascade handling
                  - Memory usage patterns
                  - Concurrent player handling
                  - Server resource utilization

  --fast          Run abbreviated test suite for faster feedback
                  - Reduces test iterations and timeouts
                  - Suitable for development and CI

  --verbose       Enable verbose output
                  - Shows detailed test progress
                  - Includes performance metrics
                  - Useful for debugging

  --help          Show this help message

Examples:
  node runIntegrationTests.js                    # Run all tests
  node runIntegrationTests.js --e2e-only         # End-to-end only
  node runIntegrationTests.js --perf-only --fast # Quick performance test
  node runIntegrationTests.js --verbose          # All tests with details

Test Coverage:
  ✓ Complete cascade synchronization workflows
  ✓ Client-server integration validation
  ✓ Network failure recovery scenarios  
  ✓ Performance under various load conditions
  ✓ Memory usage and resource utilization
  ✓ Concurrent player session handling
`);
  }

  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    const prefix = level.toUpperCase().padEnd(5);

    if (level === 'verbose' && !this.options.verbose) {
      return;
    }

    console.log(`[${timestamp}] ${prefix} ${message}`);
  }

  async runJestTest(testFile, testName) {
    return new Promise((resolve) => {
      const jestPath = path.join(__dirname, '../../node_modules/.bin/jest');
      const testPath = path.join(__dirname, testFile);

      const jestArgs = [
        testPath,
        '--verbose',
        '--colors',
        '--detectOpenHandles',
        '--forceExit'
      ];

      if (this.options.fast) {
        jestArgs.push('--maxWorkers=1');
      }

      this.log(`Starting ${testName}...`);
      this.log(`Running: ${jestPath} ${jestArgs.join(' ')}`, 'verbose');

      const jestProcess = spawn(jestPath, jestArgs, {
        stdio: this.options.verbose ? 'inherit' : 'pipe',
        shell: true,
        cwd: path.join(__dirname, '../..')
      });

      let output = '';
      let errorOutput = '';

      if (!this.options.verbose) {
        jestProcess.stdout?.on('data', (data) => {
          output += data.toString();
        });

        jestProcess.stderr?.on('data', (data) => {
          errorOutput += data.toString();
        });
      }

      jestProcess.on('close', (code) => {
        const result = {
          testName,
          exitCode: code,
          success: code === 0,
          output,
          errorOutput,
          duration: Date.now() - this.testResults.startTime
        };

        if (result.success) {
          this.log(`✓ ${testName} completed successfully`);
        } else {
          this.log(`✗ ${testName} failed with exit code ${code}`, 'error');
          if (!this.options.verbose && errorOutput) {
            console.log('\nError output:');
            console.log(errorOutput);
          }
        }

        resolve(result);
      });

      jestProcess.on('error', (error) => {
        this.log(`Error running ${testName}: ${error.message}`, 'error');
        resolve({
          testName,
          exitCode: 1,
          success: false,
          error: error.message,
          duration: Date.now() - this.testResults.startTime
        });
      });
    });
  }

  async runEndToEndTests() {
    this.log('🚀 Starting End-to-End Integration Tests (Task 15.1)');
    this.log('   Testing complete cascade synchronization workflows', 'verbose');

    const result = await this.runJestTest('EndToEndCascade.test.js', 'End-to-End Cascade Tests');
    this.testResults.endToEnd = result;

    if (result.success) {
      this.log('✅ End-to-End tests passed - cascade synchronization verified');
    } else {
      this.log('❌ End-to-End tests failed - check cascade synchronization', 'error');
    }

    return result;
  }

  async runPerformanceTests() {
    this.log('⚡ Starting Performance and Load Tests (Task 15.2)');
    this.log('   Testing system performance under various load conditions', 'verbose');

    const result = await this.runJestTest('PerformanceLoad.test.js', 'Performance and Load Tests');
    this.testResults.performance = result;

    if (result.success) {
      this.log('✅ Performance tests passed - system handles load efficiently');
    } else {
      this.log('❌ Performance tests failed - check system scalability', 'error');
    }

    return result;
  }

  generateReport() {
    this.testResults.endTime = Date.now();
    const totalDuration = this.testResults.endTime - this.testResults.startTime;

    console.log('\n' + '='.repeat(80));
    console.log('🏁 ENHANCED CASCADE SYNCHRONIZATION INTEGRATION TEST REPORT');
    console.log('='.repeat(80));

    console.log('\n📊 Test Summary:');
    console.log(`   Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);
    console.log(`   Started: ${new Date(this.testResults.startTime).toISOString()}`);
    console.log(`   Completed: ${new Date(this.testResults.endTime).toISOString()}`);

    if (this.testResults.endToEnd) {
      console.log('\n🎯 End-to-End Tests (Task 15.1):');
      console.log(`   Status: ${this.testResults.endToEnd.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   Duration: ${(this.testResults.endToEnd.duration / 1000).toFixed(2)}s`);
      console.log('   Coverage: Complete spin-to-result flow, multi-step cascades,');
      console.log('            network recovery, payout accuracy');
    }

    if (this.testResults.performance) {
      console.log('\n⚡ Performance Tests (Task 15.2):');
      console.log(`   Status: ${this.testResults.performance.success ? '✅ PASSED' : '❌ FAILED'}`);
      console.log(`   Duration: ${(this.testResults.performance.duration / 1000).toFixed(2)}s`);
      console.log('   Coverage: High-frequency handling, memory patterns,');
      console.log('            concurrent players, resource utilization');
    }

    const overallSuccess = (!this.testResults.endToEnd || this.testResults.endToEnd.success) &&
                              (!this.testResults.performance || this.testResults.performance.success);

    console.log('\n🏆 Overall Result:');
    if (overallSuccess) {
      console.log('   ✅ ALL TESTS PASSED - Enhanced Cascade Synchronization is production ready!');
      console.log('   🎉 The system successfully handles:');
      console.log('      • Complete end-to-end cascade workflows');
      console.log('      • Network interruption recovery');
      console.log('      • High-frequency cascade processing');
      console.log('      • Concurrent player sessions');
      console.log('      • Memory and performance optimization');
    } else {
      console.log('   ❌ SOME TESTS FAILED - Review system implementation');
      console.log('   🔍 Check the detailed output above for specific issues');
    }

    console.log('\n' + '='.repeat(80));

    return overallSuccess;
  }

  async run() {
    if (this.options.help) {
      this.showHelp();
      return true;
    }

    console.log('🧪 Enhanced Cascade Synchronization Integration Test Runner');
    console.log('📋 Tasks 15.1 (End-to-End) and 15.2 (Performance Testing)');
    console.log('');

    try {
      // Validate test environment
      const testDir = __dirname;
      const e2eTestFile = path.join(testDir, 'EndToEndCascade.test.js');
      const perfTestFile = path.join(testDir, 'PerformanceLoad.test.js');

      if (!fs.existsSync(e2eTestFile) && !this.options.perfOnly) {
        throw new Error('End-to-End test file not found: ' + e2eTestFile);
      }

      if (!fs.existsSync(perfTestFile) && !this.options.e2eOnly) {
        throw new Error('Performance test file not found: ' + perfTestFile);
      }

      // Run selected test suites
      if (!this.options.perfOnly) {
        await this.runEndToEndTests();
      }

      if (!this.options.e2eOnly) {
        await this.runPerformanceTests();
      }

      // Generate final report
      const success = this.generateReport();

      process.exit(success ? 0 : 1);

    } catch (error) {
      this.log(`Fatal error: ${error.message}`, 'error');
      console.error(error);
      process.exit(1);
    }
  }
}

// Run the integration tests if this script is called directly
if (require.main === module) {
  const runner = new IntegrationTestRunner();
  runner.run().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

module.exports = IntegrationTestRunner;