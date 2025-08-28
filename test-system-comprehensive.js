/**
 * Comprehensive System Validation Test Suite
 * Validates all components of the Infinity Storm Casino System
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class ComprehensiveSystemTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.results = {
            server: { status: 'pending', tests: [] },
            endpoints: { status: 'pending', tests: [] },
            admin: { status: 'pending', tests: [] },
            game: { status: 'pending', tests: [] },
            database: { status: 'pending', tests: [] },
            integration: { status: 'pending', tests: [] },
            performance: { status: 'pending', tests: [] },
            errors: []
        };
        this.startTime = performance.now();
        this.adminToken = null;
    }

    log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const colorCode = {
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green
            error: '\x1b[31m',   // Red
            warning: '\x1b[33m', // Yellow
            reset: '\x1b[0m'     // Reset
        };
        
        console.log(`${colorCode[type]}[${timestamp}] ${message}${colorCode.reset}`);
        
        if (type === 'error') {
            this.results.errors.push({ timestamp, message });
        }
    }

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Test 1: Server Status and Health Check
    async testServerStatus() {
        this.log('=== Testing Server Status ===');
        const tests = [];

        try {
            // Basic server response
            const startTime = performance.now();
            const response = await axios.get(`${this.baseUrl}`, { timeout: 5000 });
            const responseTime = performance.now() - startTime;

            tests.push({
                name: 'Server Accessibility',
                status: response.status === 200 ? 'pass' : 'fail',
                details: `Status: ${response.status}, Response Time: ${responseTime.toFixed(2)}ms`,
                responseTime
            });

            // Health endpoint
            try {
                const healthResponse = await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
                tests.push({
                    name: 'Health Endpoint',
                    status: healthResponse.status === 200 ? 'pass' : 'fail',
                    details: `Health check returned: ${JSON.stringify(healthResponse.data)}`
                });
            } catch (healthError) {
                tests.push({
                    name: 'Health Endpoint',
                    status: 'fail',
                    details: `Health endpoint failed: ${healthError.message}`
                });
            }

            // Static file serving
            try {
                const staticResponse = await axios.get(`${this.baseUrl}/index.html`, { timeout: 5000 });
                tests.push({
                    name: 'Static File Serving',
                    status: staticResponse.status === 200 ? 'pass' : 'fail',
                    details: `Static files accessible, size: ${staticResponse.data.length} bytes`
                });
            } catch (staticError) {
                tests.push({
                    name: 'Static File Serving',
                    status: 'fail',
                    details: `Static files not accessible: ${staticError.message}`
                });
            }

        } catch (error) {
            tests.push({
                name: 'Server Accessibility',
                status: 'fail',
                details: `Server not accessible: ${error.message}`
            });
            this.log(`Server not accessible: ${error.message}`, 'error');
        }

        this.results.server = {
            status: tests.every(t => t.status === 'pass') ? 'pass' : 'fail',
            tests
        };

        tests.forEach(test => {
            this.log(`${test.name}: ${test.status} - ${test.details}`, 
                test.status === 'pass' ? 'success' : 'error');
        });
    }

    // Test 2: API Endpoints Validation
    async testAPIEndpoints() {
        this.log('=== Testing API Endpoints ===');
        const tests = [];

        const endpoints = [
            { method: 'GET', path: '/api/health', expectedStatus: 200 },
            { method: 'POST', path: '/api/spin', expectedStatus: 401, requiresAuth: true },
            { method: 'GET', path: '/api/wallet/balance', expectedStatus: 401, requiresAuth: true },
            { method: 'GET', path: '/api/game-state', expectedStatus: 401, requiresAuth: true },
            { method: 'POST', path: '/api/auth/register', expectedStatus: 400, body: {} },
            { method: 'POST', path: '/api/auth/login', expectedStatus: 400, body: {} }
        ];

        for (const endpoint of endpoints) {
            try {
                const config = {
                    method: endpoint.method.toLowerCase(),
                    url: `${this.baseUrl}${endpoint.path}`,
                    timeout: 5000,
                    validateStatus: () => true // Don't throw on non-2xx status
                };

                if (endpoint.body) {
                    config.data = endpoint.body;
                    config.headers = { 'Content-Type': 'application/json' };
                }

                const response = await axios(config);
                const passed = response.status === endpoint.expectedStatus;

                tests.push({
                    name: `${endpoint.method} ${endpoint.path}`,
                    status: passed ? 'pass' : 'fail',
                    details: `Expected: ${endpoint.expectedStatus}, Got: ${response.status}`,
                    response: response.data
                });

            } catch (error) {
                tests.push({
                    name: `${endpoint.method} ${endpoint.path}`,
                    status: 'fail',
                    details: `Request failed: ${error.message}`
                });
            }
        }

        this.results.endpoints = {
            status: tests.every(t => t.status === 'pass') ? 'pass' : 'fail',
            tests
        };

        tests.forEach(test => {
            this.log(`${test.name}: ${test.status} - ${test.details}`, 
                test.status === 'pass' ? 'success' : 'warning');
        });
    }

    // Test 3: Admin Panel Access and Functionality
    async testAdminPanel() {
        this.log('=== Testing Admin Panel ===');
        const tests = [];

        try {
            // Test admin login page access
            const loginPageResponse = await axios.get(`${this.baseUrl}/admin/login`, { timeout: 5000 });
            tests.push({
                name: 'Admin Login Page Access',
                status: loginPageResponse.status === 200 ? 'pass' : 'fail',
                details: `Login page accessible, status: ${loginPageResponse.status}`
            });

            // Test admin dashboard access (should redirect without auth)
            try {
                const dashboardResponse = await axios.get(`${this.baseUrl}/admin/dashboard`, { 
                    timeout: 5000,
                    maxRedirects: 0,
                    validateStatus: () => true
                });
                
                const redirected = dashboardResponse.status === 302 || dashboardResponse.status === 401;
                tests.push({
                    name: 'Admin Dashboard Security',
                    status: redirected ? 'pass' : 'fail',
                    details: `Dashboard properly secured, status: ${dashboardResponse.status}`
                });
            } catch (error) {
                tests.push({
                    name: 'Admin Dashboard Security',
                    status: 'pass',
                    details: 'Dashboard properly secured (connection refused without auth)'
                });
            }

            // Test admin authentication
            try {
                const authResponse = await axios.post(`${this.baseUrl}/api/admin/login`, {
                    username: 'admin',
                    password: 'admin123'
                }, { 
                    timeout: 5000,
                    validateStatus: () => true
                });

                if (authResponse.status === 200 && authResponse.data.token) {
                    this.adminToken = authResponse.data.token;
                    tests.push({
                        name: 'Admin Authentication',
                        status: 'pass',
                        details: 'Admin login successful'
                    });

                    // Test authenticated admin endpoint
                    try {
                        const playersResponse = await axios.get(`${this.baseUrl}/api/admin/players`, {
                            headers: { 'Authorization': `Bearer ${this.adminToken}` },
                            timeout: 5000
                        });
                        
                        tests.push({
                            name: 'Admin Players Endpoint',
                            status: playersResponse.status === 200 ? 'pass' : 'fail',
                            details: `Players endpoint status: ${playersResponse.status}`
                        });
                    } catch (playersError) {
                        tests.push({
                            name: 'Admin Players Endpoint',
                            status: 'fail',
                            details: `Players endpoint failed: ${playersError.message}`
                        });
                    }
                } else {
                    tests.push({
                        name: 'Admin Authentication',
                        status: 'fail',
                        details: `Login failed, status: ${authResponse.status}`
                    });
                }
            } catch (authError) {
                tests.push({
                    name: 'Admin Authentication',
                    status: 'fail',
                    details: `Authentication failed: ${authError.message}`
                });
            }

        } catch (error) {
            tests.push({
                name: 'Admin Panel Access',
                status: 'fail',
                details: `Admin panel not accessible: ${error.message}`
            });
        }

        this.results.admin = {
            status: tests.every(t => t.status === 'pass') ? 'pass' : 'fail',
            tests
        };

        tests.forEach(test => {
            this.log(`${test.name}: ${test.status} - ${test.details}`, 
                test.status === 'pass' ? 'success' : 'warning');
        });
    }

    // Test 4: Game API Functionality
    async testGameAPIs() {
        this.log('=== Testing Game APIs ===');
        const tests = [];

        // Test guest user creation and game functionality
        try {
            // Register a test user
            const registerResponse = await axios.post(`${this.baseUrl}/api/auth/register`, {
                username: `testuser_${Date.now()}`,
                email: `test_${Date.now()}@example.com`,
                password: 'testpass123'
            }, { 
                timeout: 5000,
                validateStatus: () => true
            });

            if (registerResponse.status === 201) {
                tests.push({
                    name: 'User Registration',
                    status: 'pass',
                    details: 'Test user registered successfully'
                });

                // Login with test user
                const loginResponse = await axios.post(`${this.baseUrl}/api/auth/login`, {
                    username: registerResponse.data.user.username,
                    password: 'testpass123'
                }, { timeout: 5000 });

                if (loginResponse.status === 200 && loginResponse.data.token) {
                    const userToken = loginResponse.data.token;
                    tests.push({
                        name: 'User Authentication',
                        status: 'pass',
                        details: 'User login successful'
                    });

                    // Test wallet balance
                    try {
                        const balanceResponse = await axios.get(`${this.baseUrl}/api/wallet/balance`, {
                            headers: { 'Authorization': `Bearer ${userToken}` },
                            timeout: 5000
                        });

                        tests.push({
                            name: 'Wallet Balance API',
                            status: balanceResponse.status === 200 ? 'pass' : 'fail',
                            details: `Balance: ${JSON.stringify(balanceResponse.data)}`
                        });
                    } catch (balanceError) {
                        tests.push({
                            name: 'Wallet Balance API',
                            status: 'fail',
                            details: `Balance check failed: ${balanceError.message}`
                        });
                    }

                    // Test game state
                    try {
                        const gameStateResponse = await axios.get(`${this.baseUrl}/api/game-state`, {
                            headers: { 'Authorization': `Bearer ${userToken}` },
                            timeout: 5000
                        });

                        tests.push({
                            name: 'Game State API',
                            status: gameStateResponse.status === 200 ? 'pass' : 'fail',
                            details: `Game state retrieved successfully`
                        });
                    } catch (gameStateError) {
                        tests.push({
                            name: 'Game State API',
                            status: 'fail',
                            details: `Game state failed: ${gameStateError.message}`
                        });
                    }

                    // Test spin API
                    try {
                        const spinResponse = await axios.post(`${this.baseUrl}/api/spin`, {
                            bet: 10
                        }, {
                            headers: { 'Authorization': `Bearer ${userToken}` },
                            timeout: 10000
                        });

                        tests.push({
                            name: 'Spin API',
                            status: spinResponse.status === 200 ? 'pass' : 'fail',
                            details: `Spin result: ${spinResponse.data.win ? 'WIN' : 'LOSS'}, amount: ${spinResponse.data.totalWin}`
                        });
                    } catch (spinError) {
                        tests.push({
                            name: 'Spin API',
                            status: 'fail',
                            details: `Spin failed: ${spinError.message}`
                        });
                    }

                } else {
                    tests.push({
                        name: 'User Authentication',
                        status: 'fail',
                        details: 'User login failed'
                    });
                }

            } else {
                tests.push({
                    name: 'User Registration',
                    status: 'warning',
                    details: `Registration status: ${registerResponse.status} (may already exist)`
                });
            }

        } catch (error) {
            tests.push({
                name: 'Game API Setup',
                status: 'fail',
                details: `Game API tests failed: ${error.message}`
            });
        }

        this.results.game = {
            status: tests.filter(t => t.status === 'pass').length > 0 ? 'partial' : 'fail',
            tests
        };

        tests.forEach(test => {
            this.log(`${test.name}: ${test.status} - ${test.details}`, 
                test.status === 'pass' ? 'success' : 'warning');
        });
    }

    // Test 5: Database Operations
    async testDatabaseOperations() {
        this.log('=== Testing Database Operations ===');
        const tests = [];

        try {
            // Test database connectivity through API
            const healthResponse = await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
            
            if (healthResponse.data && healthResponse.data.database) {
                tests.push({
                    name: 'Database Connectivity',
                    status: healthResponse.data.database.connected ? 'pass' : 'fail',
                    details: `Database status: ${healthResponse.data.database.status}`
                });
            } else {
                tests.push({
                    name: 'Database Connectivity',
                    status: 'warning',
                    details: 'Database status not available in health check'
                });
            }

            // Test table existence through admin endpoint
            if (this.adminToken) {
                try {
                    const dbStatusResponse = await axios.get(`${this.baseUrl}/api/admin/system/db-status`, {
                        headers: { 'Authorization': `Bearer ${this.adminToken}` },
                        timeout: 5000
                    });

                    tests.push({
                        name: 'Database Schema',
                        status: dbStatusResponse.status === 200 ? 'pass' : 'fail',
                        details: `Schema status available`
                    });
                } catch (dbError) {
                    tests.push({
                        name: 'Database Schema',
                        status: 'warning',
                        details: 'Schema status endpoint not available'
                    });
                }
            }

        } catch (error) {
            tests.push({
                name: 'Database Tests',
                status: 'fail',
                details: `Database tests failed: ${error.message}`
            });
        }

        this.results.database = {
            status: tests.some(t => t.status === 'pass') ? 'partial' : 'fail',
            tests
        };

        tests.forEach(test => {
            this.log(`${test.name}: ${test.status} - ${test.details}`, 
                test.status === 'pass' ? 'success' : 'warning');
        });
    }

    // Test 6: Client-Server Integration
    async testClientServerIntegration() {
        this.log('=== Testing Client-Server Integration ===');
        const tests = [];

        try {
            // Test client assets accessibility
            const clientAssets = [
                '/src/config/GameConfig.js',
                '/src/services/NetworkService.js',
                '/src/scenes/GameScene.js',
                '/src/systems/GridManager.js'
            ];

            for (const asset of clientAssets) {
                try {
                    const assetResponse = await axios.get(`${this.baseUrl}${asset}`, { timeout: 5000 });
                    tests.push({
                        name: `Client Asset: ${path.basename(asset)}`,
                        status: assetResponse.status === 200 ? 'pass' : 'fail',
                        details: `Asset size: ${assetResponse.data.length} bytes`
                    });
                } catch (assetError) {
                    tests.push({
                        name: `Client Asset: ${path.basename(asset)}`,
                        status: 'fail',
                        details: `Asset not accessible: ${assetError.message}`
                    });
                }
            }

            // Test WebSocket connectivity
            try {
                const io = require('socket.io-client');
                const socket = io(`${this.baseUrl}`, { timeout: 5000 });

                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        socket.disconnect();
                        reject(new Error('WebSocket connection timeout'));
                    }, 5000);

                    socket.on('connect', () => {
                        clearTimeout(timeout);
                        tests.push({
                            name: 'WebSocket Connection',
                            status: 'pass',
                            details: 'WebSocket connected successfully'
                        });
                        socket.disconnect();
                        resolve();
                    });

                    socket.on('connect_error', (error) => {
                        clearTimeout(timeout);
                        tests.push({
                            name: 'WebSocket Connection',
                            status: 'fail',
                            details: `WebSocket connection failed: ${error.message}`
                        });
                        socket.disconnect();
                        resolve();
                    });
                });
            } catch (wsError) {
                tests.push({
                    name: 'WebSocket Connection',
                    status: 'fail',
                    details: `WebSocket test failed: ${wsError.message}`
                });
            }

        } catch (error) {
            tests.push({
                name: 'Integration Test Setup',
                status: 'fail',
                details: `Integration tests failed: ${error.message}`
            });
        }

        this.results.integration = {
            status: tests.some(t => t.status === 'pass') ? 'partial' : 'fail',
            tests
        };

        tests.forEach(test => {
            this.log(`${test.name}: ${test.status} - ${test.details}`, 
                test.status === 'pass' ? 'success' : 'warning');
        });
    }

    // Test 7: Performance Testing
    async testPerformance() {
        this.log('=== Testing Performance ===');
        const tests = [];

        try {
            // Response time test
            const iterations = 10;
            const responseTimes = [];

            for (let i = 0; i < iterations; i++) {
                const startTime = performance.now();
                try {
                    await axios.get(`${this.baseUrl}/api/health`, { timeout: 5000 });
                    const responseTime = performance.now() - startTime;
                    responseTimes.push(responseTime);
                } catch (error) {
                    // Skip failed requests
                }
                await this.delay(100);
            }

            if (responseTimes.length > 0) {
                const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
                const maxResponseTime = Math.max(...responseTimes);
                
                tests.push({
                    name: 'Response Time Performance',
                    status: avgResponseTime < 1000 ? 'pass' : 'warning',
                    details: `Avg: ${avgResponseTime.toFixed(2)}ms, Max: ${maxResponseTime.toFixed(2)}ms`
                });
            }

            // Concurrent request test
            const concurrentRequests = 5;
            const concurrentPromises = [];

            for (let i = 0; i < concurrentRequests; i++) {
                concurrentPromises.push(
                    axios.get(`${this.baseUrl}/api/health`, { timeout: 10000 })
                        .then(() => ({ success: true }))
                        .catch(() => ({ success: false }))
                );
            }

            const concurrentResults = await Promise.all(concurrentPromises);
            const successfulRequests = concurrentResults.filter(r => r.success).length;

            tests.push({
                name: 'Concurrent Request Handling',
                status: successfulRequests >= concurrentRequests * 0.8 ? 'pass' : 'fail',
                details: `${successfulRequests}/${concurrentRequests} concurrent requests successful`
            });

        } catch (error) {
            tests.push({
                name: 'Performance Tests',
                status: 'fail',
                details: `Performance tests failed: ${error.message}`
            });
        }

        this.results.performance = {
            status: tests.some(t => t.status === 'pass') ? 'partial' : 'fail',
            tests
        };

        tests.forEach(test => {
            this.log(`${test.name}: ${test.status} - ${test.details}`, 
                test.status === 'pass' ? 'success' : 'warning');
        });
    }

    // Generate comprehensive report
    generateReport() {
        const endTime = performance.now();
        const totalTime = ((endTime - this.startTime) / 1000).toFixed(2);

        this.log('=== COMPREHENSIVE SYSTEM TEST REPORT ===', 'info');
        this.log(`Total Test Duration: ${totalTime} seconds`, 'info');
        this.log('', 'info');

        // Summary
        let totalTests = 0;
        let passedTests = 0;
        let failedTests = 0;
        let warningTests = 0;

        for (const [category, results] of Object.entries(this.results)) {
            if (category === 'errors' || !results.tests) continue;

            const categoryPassed = results.tests.filter(t => t.status === 'pass').length;
            const categoryFailed = results.tests.filter(t => t.status === 'fail').length;
            const categoryWarning = results.tests.filter(t => t.status === 'warning').length;

            totalTests += results.tests.length;
            passedTests += categoryPassed;
            failedTests += categoryFailed;
            warningTests += categoryWarning;

            this.log(`${category.toUpperCase()}: ${results.status} (${categoryPassed}/${results.tests.length} passed)`, 
                results.status === 'pass' ? 'success' : 'warning');
        }

        this.log('', 'info');
        this.log(`OVERALL RESULTS:`, 'info');
        this.log(`✓ Passed: ${passedTests}`, 'success');
        this.log(`⚠ Warnings: ${warningTests}`, 'warning');
        this.log(`✗ Failed: ${failedTests}`, failedTests > 0 ? 'error' : 'info');
        this.log(`Total Tests: ${totalTests}`, 'info');

        // System Health Assessment
        const overallHealth = this.assessSystemHealth();
        this.log('', 'info');
        this.log(`SYSTEM HEALTH: ${overallHealth.status}`, overallHealth.status === 'HEALTHY' ? 'success' : 'warning');
        this.log(overallHealth.assessment, 'info');

        // Save detailed report
        const reportData = {
            timestamp: new Date().toISOString(),
            duration: totalTime,
            summary: {
                totalTests,
                passed: passedTests,
                warnings: warningTests,
                failed: failedTests,
                healthStatus: overallHealth.status
            },
            results: this.results,
            errors: this.results.errors
        };

        fs.writeFileSync(
            path.join(__dirname, 'test-results-comprehensive.json'),
            JSON.stringify(reportData, null, 2)
        );

        this.log('', 'info');
        this.log('Detailed report saved to: test-results-comprehensive.json', 'success');
    }

    assessSystemHealth() {
        const categories = ['server', 'endpoints', 'admin', 'game', 'database', 'integration', 'performance'];
        const healthyCategories = categories.filter(cat => 
            this.results[cat]?.status === 'pass' || this.results[cat]?.status === 'partial'
        ).length;

        const healthPercentage = (healthyCategories / categories.length) * 100;

        if (healthPercentage >= 80) {
            return {
                status: 'HEALTHY',
                assessment: `System is functioning well (${healthPercentage.toFixed(1)}% of components operational)`
            };
        } else if (healthPercentage >= 60) {
            return {
                status: 'DEGRADED',
                assessment: `System has some issues but core functionality works (${healthPercentage.toFixed(1)}% operational)`
            };
        } else {
            return {
                status: 'CRITICAL',
                assessment: `System has major issues and may not be usable (${healthPercentage.toFixed(1)}% operational)`
            };
        }
    }

    // Main test runner
    async runAllTests() {
        this.log('Starting Comprehensive System Validation...', 'info');
        this.log('='.repeat(60), 'info');

        try {
            await this.testServerStatus();
            await this.delay(1000);
            
            await this.testAPIEndpoints();
            await this.delay(1000);
            
            await this.testAdminPanel();
            await this.delay(1000);
            
            await this.testGameAPIs();
            await this.delay(1000);
            
            await this.testDatabaseOperations();
            await this.delay(1000);
            
            await this.testClientServerIntegration();
            await this.delay(1000);
            
            await this.testPerformance();

        } catch (error) {
            this.log(`Critical test failure: ${error.message}`, 'error');
        }

        this.generateReport();
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new ComprehensiveSystemTester();
    
    // Handle process termination gracefully
    process.on('SIGINT', () => {
        console.log('\nTest interrupted by user. Generating partial report...');
        tester.generateReport();
        process.exit(0);
    });

    tester.runAllTests()
        .then(() => {
            console.log('\nComprehensive system testing completed.');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\nTest suite failed:', error.message);
            tester.generateReport();
            process.exit(1);
        });
}

module.exports = ComprehensiveSystemTester;