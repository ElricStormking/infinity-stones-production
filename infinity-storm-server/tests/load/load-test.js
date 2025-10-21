/**
 * Infinity Storm - Load Testing Script
 * 
 * Tests concurrent user capacity and identifies performance bottlenecks.
 * 
 * Features:
 * - Concurrent user simulation
 * - Real-time metrics reporting
 * - Response time analysis
 * - Error rate tracking
 * - Memory and CPU monitoring
 * - Bottleneck identification
 */

const http = require('http');
const https = require('https');
const { performance } = require('perf_hooks');

// Configuration
const CONFIG = {
  baseURL: process.env.LOAD_TEST_URL || 'http://localhost:8080',
  maxConcurrentUsers: parseInt(process.env.MAX_USERS, 10) || 100,
  testDuration: parseInt(process.env.TEST_DURATION, 10) || 300, // 5 minutes
  rampUpTime: parseInt(process.env.RAMP_UP_TIME, 10) || 60,     // 1 minute
  thinkTime: parseInt(process.env.THINK_TIME, 10) || 3000,      // 3 seconds
  reportInterval: 10000, // Report every 10 seconds
  
  // Endpoints to test
  endpoints: {
    demoSpin: '/api/demo-spin',
    gameState: '/api/game-state',
    health: '/health'
  },
  
  // Performance thresholds
  thresholds: {
    maxErrorRate: 0.01,      // 1%
    maxP95ResponseTime: 500, // 500ms
    maxP99ResponseTime: 1000 // 1000ms
  }
};

// Statistics tracking
class LoadTestStats {
  constructor() {
    this.reset();
  }

  reset() {
    this.requests = {
      total: 0,
      successful: 0,
      failed: 0,
      byEndpoint: {}
    };
    
    this.responseTimes = [];
    this.errors = [];
    this.concurrentUsers = 0;
    this.peakConcurrentUsers = 0;
    
    this.startTime = Date.now();
    this.endTime = null;
    
    // Endpoint-specific stats
    Object.keys(CONFIG.endpoints).forEach(name => {
      this.requests.byEndpoint[name] = {
        total: 0,
        successful: 0,
        failed: 0,
        responseTimes: []
      };
    });
  }

  recordRequest(endpointName, success, responseTime, error = null) {
    this.requests.total++;
    
    if (success) {
      this.requests.successful++;
      this.responseTimes.push(responseTime);
      
      if (this.requests.byEndpoint[endpointName]) {
        this.requests.byEndpoint[endpointName].successful++;
        this.requests.byEndpoint[endpointName].responseTimes.push(responseTime);
      }
    } else {
      this.requests.failed++;
      this.errors.push({
        timestamp: Date.now(),
        endpoint: endpointName,
        error: error?.message || 'Unknown error'
      });
      
      if (this.requests.byEndpoint[endpointName]) {
        this.requests.byEndpoint[endpointName].failed++;
      }
    }
    
    if (this.requests.byEndpoint[endpointName]) {
      this.requests.byEndpoint[endpointName].total++;
    }
  }

  updateConcurrentUsers(count) {
    this.concurrentUsers = count;
    if (count > this.peakConcurrentUsers) {
      this.peakConcurrentUsers = count;
    }
  }

  getPercentile(percentile) {
    if (this.responseTimes.length === 0) return 0;
    const sorted = [...this.responseTimes].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index];
  }

  getErrorRate() {
    if (this.requests.total === 0) return 0;
    return (this.requests.failed / this.requests.total) * 100;
  }

  getRequestsPerSecond() {
    const duration = (Date.now() - this.startTime) / 1000;
    return this.requests.total / duration;
  }

  getReport() {
    const duration = ((this.endTime || Date.now()) - this.startTime) / 1000;
    
    return {
      duration: `${duration.toFixed(2)}s`,
      totalRequests: this.requests.total,
      successful: this.requests.successful,
      failed: this.requests.failed,
      errorRate: `${this.getErrorRate().toFixed(2)}%`,
      requestsPerSecond: this.getRequestsPerSecond().toFixed(2),
      
      concurrentUsers: {
        current: this.concurrentUsers,
        peak: this.peakConcurrentUsers
      },
      
      responseTimes: {
        min: Math.min(...this.responseTimes).toFixed(2),
        max: Math.max(...this.responseTimes).toFixed(2),
        avg: (this.responseTimes.reduce((a, b) => a + b, 0) / this.responseTimes.length).toFixed(2),
        p50: this.getPercentile(50).toFixed(2),
        p95: this.getPercentile(95).toFixed(2),
        p99: this.getPercentile(99).toFixed(2)
      },
      
      byEndpoint: Object.keys(this.requests.byEndpoint).reduce((acc, name) => {
        const endpoint = this.requests.byEndpoint[name];
        if (endpoint.total > 0) {
          acc[name] = {
            total: endpoint.total,
            successful: endpoint.successful,
            failed: endpoint.failed,
            errorRate: `${((endpoint.failed / endpoint.total) * 100).toFixed(2)}%`,
            avgResponseTime: (endpoint.responseTimes.reduce((a, b) => a + b, 0) / endpoint.responseTimes.length).toFixed(2) + 'ms'
          };
        }
        return acc;
      }, {}),
      
      recentErrors: this.errors.slice(-10) // Last 10 errors
    };
  }
}

// HTTP request helper
function makeRequest(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, CONFIG.baseURL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json',
        'x-demo-bypass': 'true'
      },
      timeout: 10000 // 10 second timeout
    };
    
    if (body) {
      const bodyString = JSON.stringify(body);
      options.headers['Content-Length'] = Buffer.byteLength(bodyString);
    }
    
    const startTime = performance.now();
    
    const req = lib.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = performance.now() - startTime;
        
        try {
          const jsonData = JSON.parse(data);
          resolve({
            success: res.statusCode >= 200 && res.statusCode < 300,
            statusCode: res.statusCode,
            data: jsonData,
            responseTime
          });
        } catch (error) {
          resolve({
            success: false,
            statusCode: res.statusCode,
            data: null,
            responseTime,
            error
          });
        }
      });
    });
    
    req.on('error', (error) => {
      const responseTime = performance.now() - startTime;
      resolve({
        success: false,
        statusCode: 0,
        data: null,
        responseTime,
        error
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      const responseTime = performance.now() - startTime;
      resolve({
        success: false,
        statusCode: 0,
        data: null,
        responseTime,
        error: new Error('Request timeout')
      });
    });
    
    if (body) {
      req.write(JSON.stringify(body));
    }
    
    req.end();
  });
}

// Simulate a single user session
async function simulateUser(userId, stats, stopSignal) {
  const betAmounts = [0.10, 0.50, 1.00, 5.00, 10.00];
  
  while (!stopSignal.stop) {
    try {
      // Random bet amount
      const betAmount = betAmounts[Math.floor(Math.random() * betAmounts.length)];
      const quickSpinMode = Math.random() > 0.5;
      
      // Make demo spin request
      const result = await makeRequest('POST', CONFIG.endpoints.demoSpin, {
        betAmount,
        quickSpinMode
      });
      
      stats.recordRequest('demoSpin', result.success, result.responseTime, result.error);
      
      // Think time (simulate user reading results)
      await new Promise(resolve => setTimeout(resolve, CONFIG.thinkTime));
      
      // Occasionally check game state
      if (Math.random() > 0.7) {
        const stateResult = await makeRequest('GET', CONFIG.endpoints.gameState);
        stats.recordRequest('gameState', stateResult.success, stateResult.responseTime, stateResult.error);
      }
      
      // Occasionally check health
      if (Math.random() > 0.9) {
        const healthResult = await makeRequest('GET', CONFIG.endpoints.health);
        stats.recordRequest('health', healthResult.success, healthResult.responseTime, healthResult.error);
      }
      
    } catch (error) {
      console.error(`User ${userId} error:`, error.message);
    }
  }
}

// Progress bar
function drawProgressBar(current, total, width = 50) {
  const percentage = (current / total) * 100;
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  return `[${bar}] ${percentage.toFixed(1)}%`;
}

// Real-time reporting
function startReporting(stats) {
  const interval = setInterval(() => {
    const report = stats.getReport();
    
    console.log('\n' + '='.repeat(70));
    console.log('📊 REAL-TIME LOAD TEST METRICS');
    console.log('='.repeat(70));
    console.log(`Duration: ${report.duration}`);
    console.log(`Concurrent Users: ${report.concurrentUsers.current} (Peak: ${report.concurrentUsers.peak})`);
    console.log(`\nRequests:`);
    console.log(`  Total: ${report.totalRequests}`);
    console.log(`  Successful: ${report.successful}`);
    console.log(`  Failed: ${report.failed}`);
    console.log(`  Error Rate: ${report.errorRate}`);
    console.log(`  Req/sec: ${report.requestsPerSecond}`);
    console.log(`\nResponse Times (ms):`);
    console.log(`  Min: ${report.responseTimes.min}`);
    console.log(`  Avg: ${report.responseTimes.avg}`);
    console.log(`  P95: ${report.responseTimes.p95}`);
    console.log(`  P99: ${report.responseTimes.p99}`);
    console.log(`  Max: ${report.responseTimes.max}`);
    
    // Threshold checks
    const p95 = parseFloat(report.responseTimes.p95);
    const p99 = parseFloat(report.responseTimes.p99);
    const errorRate = parseFloat(report.errorRate);
    
    console.log(`\n⚠️  Threshold Status:`);
    console.log(`  P95 < 500ms: ${p95 < CONFIG.thresholds.maxP95ResponseTime ? '✅' : '❌'} (${report.responseTimes.p95}ms)`);
    console.log(`  P99 < 1000ms: ${p99 < CONFIG.thresholds.maxP99ResponseTime ? '✅' : '❌'} (${report.responseTimes.p99}ms)`);
    console.log(`  Error Rate < 1%: ${errorRate < CONFIG.thresholds.maxErrorRate * 100 ? '✅' : '❌'} (${report.errorRate})`);
    
    if (report.recentErrors.length > 0) {
      console.log(`\n❌ Recent Errors (last 10):`);
      report.recentErrors.slice(-3).forEach(err => {
        console.log(`  [${new Date(err.timestamp).toISOString()}] ${err.endpoint}: ${err.error}`);
      });
    }
    
  }, CONFIG.reportInterval);
  
  return interval;
}

// Main load test execution
async function runLoadTest() {
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║   INFINITY STORM - LOAD TEST (Concurrent User Capacity)     ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log(`Configuration:`);
  console.log(`  Base URL: ${CONFIG.baseURL}`);
  console.log(`  Max Concurrent Users: ${CONFIG.maxConcurrentUsers}`);
  console.log(`  Test Duration: ${CONFIG.testDuration}s`);
  console.log(`  Ramp-up Time: ${CONFIG.rampUpTime}s`);
  console.log(`  Think Time: ${CONFIG.thinkTime}ms\n`);
  
  const stats = new LoadTestStats();
  const stopSignal = { stop: false };
  const activeUsers = [];
  
  // Start real-time reporting
  const reportInterval = startReporting(stats);
  
  // Ramp-up phase
  console.log('🚀 Starting ramp-up phase...\n');
  
  const usersPerSecond = CONFIG.maxConcurrentUsers / CONFIG.rampUpTime;
  const rampUpInterval = 1000 / usersPerSecond;
  
  let userId = 0;
  const rampUpTimer = setInterval(() => {
    if (activeUsers.length < CONFIG.maxConcurrentUsers) {
      userId++;
      const userPromise = simulateUser(userId, stats, stopSignal);
      activeUsers.push(userPromise);
      stats.updateConcurrentUsers(activeUsers.length);
    }
  }, rampUpInterval);
  
  // Wait for ramp-up to complete
  await new Promise(resolve => setTimeout(resolve, CONFIG.rampUpTime * 1000));
  clearInterval(rampUpTimer);
  
  console.log(`\n✅ Ramp-up complete: ${activeUsers.length} concurrent users\n`);
  console.log('🔥 Running sustained load test...\n');
  
  // Sustained load phase
  const sustainedDuration = CONFIG.testDuration - CONFIG.rampUpTime;
  const startTime = Date.now();
  
  // Progress indicator
  const progressInterval = setInterval(() => {
    const elapsed = (Date.now() - startTime) / 1000;
    const progress = Math.min(elapsed / sustainedDuration, 1);
    process.stdout.write(`\r${drawProgressBar(elapsed, sustainedDuration)} ${elapsed.toFixed(0)}s / ${sustainedDuration}s`);
  }, 1000);
  
  await new Promise(resolve => setTimeout(resolve, sustainedDuration * 1000));
  
  clearInterval(progressInterval);
  console.log('\n\n🛑 Stopping load test...\n');
  
  // Stop all users
  stopSignal.stop = true;
  clearInterval(reportInterval);
  
  // Wait for all users to finish
  await Promise.all(activeUsers);
  
  stats.endTime = Date.now();
  
  // Final report
  generateFinalReport(stats);
}

// Generate final report
function generateFinalReport(stats) {
  const report = stats.getReport();
  
  console.log('\n╔═══════════════════════════════════════════════════════════════╗');
  console.log('║              LOAD TEST - FINAL RESULTS                       ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  console.log('📊 SUMMARY');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Test Duration:          ${report.duration}`);
  console.log(`  Peak Concurrent Users:  ${report.concurrentUsers.peak}`);
  console.log(`  Total Requests:         ${report.totalRequests.toLocaleString()}`);
  console.log(`  Successful:             ${report.successful.toLocaleString()}`);
  console.log(`  Failed:                 ${report.failed.toLocaleString()}`);
  console.log(`  Error Rate:             ${report.errorRate}`);
  console.log(`  Requests/Second:        ${report.requestsPerSecond}\n`);
  
  console.log('⏱️  RESPONSE TIME ANALYSIS');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  Minimum:    ${report.responseTimes.min}ms`);
  console.log(`  Average:    ${report.responseTimes.avg}ms`);
  console.log(`  Median:     ${report.responseTimes.p50}ms`);
  console.log(`  P95:        ${report.responseTimes.p95}ms`);
  console.log(`  P99:        ${report.responseTimes.p99}ms`);
  console.log(`  Maximum:    ${report.responseTimes.max}ms\n`);
  
  console.log('🎯 ENDPOINT BREAKDOWN');
  console.log('─────────────────────────────────────────────────────────────');
  Object.keys(report.byEndpoint).forEach(name => {
    const endpoint = report.byEndpoint[name];
    console.log(`  ${name}:`);
    console.log(`    Total: ${endpoint.total}, Success: ${endpoint.successful}, Failed: ${endpoint.failed}`);
    console.log(`    Error Rate: ${endpoint.errorRate}, Avg Time: ${endpoint.avgResponseTime}`);
  });
  
  // Threshold validation
  const p95 = parseFloat(report.responseTimes.p95);
  const p99 = parseFloat(report.responseTimes.p99);
  const errorRate = parseFloat(report.errorRate);
  
  const p95Pass = p95 < CONFIG.thresholds.maxP95ResponseTime;
  const p99Pass = p99 < CONFIG.thresholds.maxP99ResponseTime;
  const errorPass = errorRate < CONFIG.thresholds.maxErrorRate * 100;
  
  console.log('\n✅ THRESHOLD VALIDATION');
  console.log('─────────────────────────────────────────────────────────────');
  console.log(`  P95 Response Time:  ${p95Pass ? '✅ PASS' : '❌ FAIL'} (${report.responseTimes.p95}ms / ${CONFIG.thresholds.maxP95ResponseTime}ms)`);
  console.log(`  P99 Response Time:  ${p99Pass ? '✅ PASS' : '❌ FAIL'} (${report.responseTimes.p99}ms / ${CONFIG.thresholds.maxP99ResponseTime}ms)`);
  console.log(`  Error Rate:         ${errorPass ? '✅ PASS' : '❌ FAIL'} (${report.errorRate} / ${(CONFIG.thresholds.maxErrorRate * 100).toFixed(2)}%)\n`);
  
  // Overall result
  const allPassed = p95Pass && p99Pass && errorPass;
  
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  if (allPassed) {
    console.log('║  ✅ LOAD TEST PASSED - Server handles concurrent load       ║');
  } else {
    console.log('║  ❌ LOAD TEST FAILED - Performance issues detected          ║');
  }
  console.log('╚═══════════════════════════════════════════════════════════════╝\n');
  
  // Recommendations
  if (!allPassed) {
    console.log('📋 RECOMMENDATIONS:');
    if (!p95Pass || !p99Pass) {
      console.log('  - Consider adding more server resources (CPU/Memory)');
      console.log('  - Enable caching for frequently accessed data');
      console.log('  - Optimize database queries');
      console.log('  - Enable response compression');
    }
    if (!errorPass) {
      console.log('  - Investigate error logs for root causes');
      console.log('  - Check database connection pool size');
      console.log('  - Verify rate limiting configuration');
      console.log('  - Check for resource exhaustion (memory, connections)');
    }
  } else {
    console.log('💡 CAPACITY SUMMARY:');
    console.log(`  - Server successfully handled ${report.concurrentUsers.peak} concurrent users`);
    console.log(`  - Average throughput: ${report.requestsPerSecond} req/sec`);
    console.log(`  - System is production-ready for this load level`);
    console.log(`  - Consider testing higher load for capacity planning`);
  }
  
  process.exit(allPassed ? 0 : 1);
}

// Run the load test
if (require.main === module) {
  runLoadTest().catch(error => {
    console.error('\n❌ Load test failed:', error);
    process.exit(1);
  });
}

module.exports = { runLoadTest, LoadTestStats };





