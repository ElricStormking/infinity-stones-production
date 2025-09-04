#!/usr/bin/env node

/**
 * Performance and Stress Test Runner for Enhanced Cascade Synchronization
 *
 * Usage:
 *   node runPerformanceTests.js                    # Run all performance tests
 *   node runPerformanceTests.js --frequency        # Run only high-frequency tests
 *   node runPerformanceTests.js --memory           # Run only memory tests
 *   node runPerformanceTests.js --concurrent       # Run only concurrent player tests
 *   node runPerformanceTests.js --resource         # Run only resource utilization tests
 *   node runPerformanceTests.js --report           # Generate detailed performance report
 */

const { exec, spawn } = require('child_process');
const path = require('path');
const fs = require('fs').promises;

class PerformanceTestRunner {
  constructor() {
    this.testFile = path.join(__dirname, 'PerformanceStress.test.js');
    this.reportFile = path.join(__dirname, 'performance-report.json');
    this.logFile = path.join(__dirname, 'performance-test.log');
  }

  async runTests(options = {}) {
    const {
      frequency = false,
      memory = false,
      concurrent = false,
      resource = false,
      report = false,
      all = true
    } = options;

    console.log('🚀 Enhanced Cascade Synchronization - Performance Test Suite');
    console.log('='.repeat(60));

    try {
      // Prepare test environment
      await this.prepareEnvironment();

      const testPatterns = [];

      if (frequency || all) {
        testPatterns.push('Test High-Frequency Cascade Handling');
      }

      if (memory || all) {
        testPatterns.push('Validate Memory Usage Patterns');
      }

      if (concurrent || all) {
        testPatterns.push('Test Concurrent Player Handling');
      }

      if (resource || all) {
        testPatterns.push('Verify Server Resource Utilization');
      }

      if (report || all) {
        testPatterns.push('Performance Summary and Reporting');
      }

      // Run tests based on patterns
      const results = await this.executeTests(testPatterns);

      // Generate report
      if (report || all) {
        await this.generateReport(results);
      }

      console.log('\n✅ Performance test suite completed successfully');
      console.log(`📊 Test results available in: ${this.reportFile}`);
      console.log(`📝 Detailed logs available in: ${this.logFile}`);

      return results;

    } catch (error) {
      console.error('❌ Performance test suite failed:', error.message);
      process.exit(1);
    }
  }

  async prepareEnvironment() {
    console.log('🔧 Preparing test environment...');

    // Enable garbage collection for memory tests
    if (!global.gc) {
      console.log('⚠️  Garbage collection not exposed. Run with --expose-gc for better memory testing');
    }

    // Clear previous logs
    try {
      await fs.unlink(this.logFile);
    } catch (error) {
      // File doesn't exist, ignore
    }

    console.log('✅ Environment prepared');
  }

  async executeTests(testPatterns) {
    console.log(`🧪 Running tests for patterns: ${testPatterns.join(', ')}`);

    const jestConfig = {
      testMatch: [this.testFile],
      verbose: true,
      detectOpenHandles: true,
      forceExit: true,
      maxWorkers: 1, // Run sequentially for accurate performance measurement
      testTimeout: 120000 // 2 minutes per test
    };

    return new Promise((resolve, reject) => {
      const jestArgs = [
        '--config', JSON.stringify(jestConfig),
        '--testNamePattern', testPatterns.join('|'),
        '--verbose',
        '--no-cache',
        '--runInBand' // Force sequential execution
      ];

      const jestProcess = spawn('npx', ['jest', ...jestArgs], {
        stdio: 'pipe',
        cwd: path.join(__dirname, '..', '..')
      });

      let output = '';
      let errorOutput = '';

      jestProcess.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        console.log(chunk);
      });

      jestProcess.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        console.error(chunk);
      });

      jestProcess.on('close', async (code) => {
        // Save logs
        const logData = {
          timestamp: new Date().toISOString(),
          exitCode: code,
          stdout: output,
          stderr: errorOutput,
          testPatterns
        };

        try {
          await fs.writeFile(this.logFile, JSON.stringify(logData, null, 2));
        } catch (logError) {
          console.warn('Warning: Could not save logs:', logError.message);
        }

        if (code === 0) {
          resolve({
            success: true,
            exitCode: code,
            output,
            testPatterns
          });
        } else {
          reject(new Error(`Tests failed with exit code ${code}`));
        }
      });

      jestProcess.on('error', (error) => {
        reject(new Error(`Failed to start Jest: ${error.message}`));
      });
    });
  }

  async generateReport(results) {
    console.log('📊 Generating performance report...');

    const report = {
      testSuite: 'Enhanced Cascade Synchronization - Performance and Stress Tests',
      timestamp: new Date().toISOString(),
      testExecution: {
        success: results.success,
        exitCode: results.exitCode,
        patterns: results.testPatterns
      },
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpuCount: require('os').cpus().length,
        totalMemory: `${(require('os').totalmem() / 1024 / 1024 / 1024).toFixed(2)}GB`,
        freeMemory: `${(require('os').freemem() / 1024 / 1024 / 1024).toFixed(2)}GB`
      },
      performance: {
        processMemory: process.memoryUsage(),
        processUptime: `${process.uptime().toFixed(2)}s`,
        systemLoad: require('os').loadavg()
      },
      testCategories: {
        highFrequencyHandling: {
          description: 'Tests system ability to handle rapid cascade requests',
          target: '100+ requests with <1s average response time',
          status: results.testPatterns.includes('Test High-Frequency Cascade Handling') ? 'Executed' : 'Skipped'
        },
        memoryUsagePatterns: {
          description: 'Validates memory efficiency and leak prevention',
          target: 'Memory growth <50MB over 200 operations',
          status: results.testPatterns.includes('Validate Memory Usage Patterns') ? 'Executed' : 'Skipped'
        },
        concurrentPlayerHandling: {
          description: 'Tests multi-player session isolation and performance',
          target: '50+ concurrent sessions with >90% success rate',
          status: results.testPatterns.includes('Test Concurrent Player Handling') ? 'Executed' : 'Skipped'
        },
        serverResourceUtilization: {
          description: 'Validates system resource management under load',
          target: 'CPU <200%, Memory <200MB growth under extreme load',
          status: results.testPatterns.includes('Verify Server Resource Utilization') ? 'Executed' : 'Skipped'
        }
      },
      recommendations: this.generateRecommendations(results),
      summary: 'Performance testing validates Enhanced Cascade Synchronization system readiness for production deployment.'
    };

    try {
      await fs.writeFile(this.reportFile, JSON.stringify(report, null, 2));
      console.log('✅ Performance report generated');
    } catch (error) {
      console.warn('Warning: Could not save performance report:', error.message);
    }

    return report;
  }

  generateRecommendations(results) {
    const recommendations = [];

    if (!global.gc) {
      recommendations.push({
        category: 'Environment',
        priority: 'Medium',
        recommendation: 'Run Node.js with --expose-gc flag for more accurate memory testing'
      });
    }

    if (require('os').freemem() / require('os').totalmem() < 0.2) {
      recommendations.push({
        category: 'System Resources',
        priority: 'High',
        recommendation: 'System memory usage is high. Consider testing on a system with more available memory.'
      });
    }

    recommendations.push({
      category: 'Production Deployment',
      priority: 'High',
      recommendation: 'Monitor performance metrics in production environment and establish baseline benchmarks.'
    });

    recommendations.push({
      category: 'Continuous Testing',
      priority: 'Medium',
      recommendation: 'Integrate performance tests into CI/CD pipeline with automated threshold validation.'
    });

    return recommendations;
  }

  static async main() {
    const args = process.argv.slice(2);

    const options = {
      frequency: args.includes('--frequency'),
      memory: args.includes('--memory'),
      concurrent: args.includes('--concurrent'),
      resource: args.includes('--resource'),
      report: args.includes('--report'),
      all: args.length === 0 || args.includes('--all')
    };

    const runner = new PerformanceTestRunner();
    await runner.runTests(options);
  }
}

// Run if called directly
if (require.main === module) {
  PerformanceTestRunner.main().catch(console.error);
}

module.exports = PerformanceTestRunner;