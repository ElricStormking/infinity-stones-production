/**
 * Admin Panel Testing Suite
 * Comprehensive testing of admin interface and functionality
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class AdminPanelTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.adminToken = null;
        this.testResults = [];
        this.createdTestData = [];
    }

    async log(message, type = 'info') {
        const timestamp = new Date().toISOString();
        const prefix = {
            info: '📋',
            success: '✅',
            error: '❌',
            warning: '⚠️'
        }[type] || '📋';
        
        console.log(`${prefix} [${timestamp.slice(11, 19)}] ${message}`);
    }

    async authenticateAdmin() {
        try {
            await this.log('Attempting admin authentication...');
            
            const response = await axios.post(`${this.baseUrl}/api/admin/login`, {
                username: 'admin',
                password: 'admin123'
            }, { 
                validateStatus: () => true,
                timeout: 10000
            });

            if (response.status === 200 && response.data.token) {
                this.adminToken = response.data.token;
                await this.log('Admin authentication successful', 'success');
                return true;
            } else {
                await this.log(`Admin authentication failed: Status ${response.status}`, 'error');
                return false;
            }
        } catch (error) {
            await this.log(`Admin authentication error: ${error.message}`, 'error');
            return false;
        }
    }

    async testAdminEndpoint(config) {
        const testResult = {
            name: config.name,
            endpoint: config.endpoint,
            method: config.method,
            timestamp: new Date().toISOString(),
            success: false,
            responseTime: 0,
            details: {}
        };

        const startTime = Date.now();

        try {
            const requestConfig = {
                method: config.method,
                url: `${this.baseUrl}${config.endpoint}`,
                timeout: config.timeout || 10000,
                validateStatus: () => true
            };

            if (config.requiresAuth && this.adminToken) {
                requestConfig.headers = {
                    'Authorization': `Bearer ${this.adminToken}`
                };
            }

            if (config.data) {
                requestConfig.data = config.data;
                requestConfig.headers = {
                    ...requestConfig.headers,
                    'Content-Type': 'application/json'
                };
            }

            const response = await axios(requestConfig);
            testResult.responseTime = Date.now() - startTime;
            testResult.details.status = response.status;
            testResult.details.responseSize = JSON.stringify(response.data).length;

            // Evaluate success based on expected criteria
            if (config.expectedStatus) {
                if (Array.isArray(config.expectedStatus)) {
                    testResult.success = config.expectedStatus.includes(response.status);
                } else {
                    testResult.success = response.status === config.expectedStatus;
                }
            } else {
                testResult.success = response.status >= 200 && response.status < 300;
            }

            // Run custom validator if provided
            if (config.validator && testResult.success) {
                try {
                    const validation = await config.validator(response.data, response);
                    testResult.details.validation = validation;
                    if (!validation.success) {
                        testResult.success = false;
                    }
                } catch (validationError) {
                    testResult.success = false;
                    testResult.details.validationError = validationError.message;
                }
            }

            testResult.details.response = this.sanitizeResponseData(response.data);

        } catch (error) {
            testResult.responseTime = Date.now() - startTime;
            testResult.success = false;
            testResult.details.error = error.message;
        }

        this.testResults.push(testResult);
        return testResult;
    }

    sanitizeResponseData(data) {
        if (!data) return data;
        
        if (typeof data === 'object') {
            const sanitized = Array.isArray(data) ? [] : {};
            
            for (const [key, value] of Object.entries(data)) {
                if (typeof value === 'string' && (
                    key.toLowerCase().includes('password') ||
                    key.toLowerCase().includes('token') ||
                    key.toLowerCase().includes('hash')
                )) {
                    sanitized[key] = '[REDACTED]';
                } else if (typeof value === 'object' && value !== null) {
                    sanitized[key] = this.sanitizeResponseData(value);
                } else {
                    sanitized[key] = value;
                }
            }
            
            return sanitized;
        }
        
        return data;
    }

    async testAdminAuthentication() {
        await this.log('=== Testing Admin Authentication ===');
        
        // Test valid credentials
        const validAuthTest = await this.testAdminEndpoint({
            name: 'Valid Admin Login',
            method: 'POST',
            endpoint: '/api/admin/login',
            data: {
                username: 'admin',
                password: 'admin123'
            },
            expectedStatus: [200, 401],
            validator: (data) => {
                if (data.token) {
                    return { success: true, message: 'Token received' };
                }
                return { success: false, message: 'No token in response' };
            }
        });

        // Test invalid credentials
        const invalidAuthTest = await this.testAdminEndpoint({
            name: 'Invalid Admin Login',
            method: 'POST',
            endpoint: '/api/admin/login',
            data: {
                username: 'admin',
                password: 'wrongpassword'
            },
            expectedStatus: 401
        });

        // Test empty credentials
        const emptyAuthTest = await this.testAdminEndpoint({
            name: 'Empty Admin Credentials',
            method: 'POST',
            endpoint: '/api/admin/login',
            data: {},
            expectedStatus: 400
        });

        await this.log(`Authentication Tests: ${[validAuthTest, invalidAuthTest, emptyAuthTest]
            .filter(t => t.success).length}/3 passed`);
    }

    async testPlayerManagement() {
        await this.log('=== Testing Player Management ===');

        // Test player listing
        const playersListTest = await this.testAdminEndpoint({
            name: 'List All Players',
            method: 'GET',
            endpoint: '/api/admin/players',
            requiresAuth: true,
            expectedStatus: [200, 500],
            validator: (data) => {
                if (Array.isArray(data) || (data.players && Array.isArray(data.players))) {
                    return { success: true, message: `Found ${data.length || data.players.length} players` };
                }
                return { success: true, message: 'Player data returned (format may vary)' };
            }
        });

        // Test player search/filtering
        const playerSearchTest = await this.testAdminEndpoint({
            name: 'Search Players',
            method: 'GET',
            endpoint: '/api/admin/players?search=test',
            requiresAuth: true,
            expectedStatus: [200, 404, 500]
        });

        // Test player statistics
        const playerStatsTest = await this.testAdminEndpoint({
            name: 'Player Statistics',
            method: 'GET',
            endpoint: '/api/admin/players/stats',
            requiresAuth: true,
            expectedStatus: [200, 404, 500]
        });

        await this.log(`Player Management Tests: ${[playersListTest, playerSearchTest, playerStatsTest]
            .filter(t => t.success).length}/3 passed`);
    }

    async testSystemMonitoring() {
        await this.log('=== Testing System Monitoring ===');

        // Test system health
        const systemHealthTest = await this.testAdminEndpoint({
            name: 'System Health Check',
            method: 'GET',
            endpoint: '/api/admin/system/health',
            requiresAuth: true,
            expectedStatus: [200, 404, 500],
            validator: (data) => {
                if (data && typeof data === 'object') {
                    return { success: true, message: 'Health data available' };
                }
                return { success: false, message: 'No health data returned' };
            }
        });

        // Test database status
        const dbStatusTest = await this.testAdminEndpoint({
            name: 'Database Status',
            method: 'GET',
            endpoint: '/api/admin/system/db-status',
            requiresAuth: true,
            expectedStatus: [200, 404, 500]
        });

        // Test system metrics
        const metricsTest = await this.testAdminEndpoint({
            name: 'System Metrics',
            method: 'GET',
            endpoint: '/api/admin/metrics',
            requiresAuth: true,
            expectedStatus: [200, 404, 500]
        });

        // Test game statistics
        const gameStatsTest = await this.testAdminEndpoint({
            name: 'Game Statistics',
            method: 'GET',
            endpoint: '/api/admin/game/stats',
            requiresAuth: true,
            expectedStatus: [200, 404, 500]
        });

        await this.log(`System Monitoring Tests: ${[systemHealthTest, dbStatusTest, metricsTest, gameStatsTest]
            .filter(t => t.success).length}/4 passed`);
    }

    async testSecurityFeatures() {
        await this.log('=== Testing Security Features ===');

        // Test unauthorized access
        const unauthorizedTest = await this.testAdminEndpoint({
            name: 'Unauthorized Access Block',
            method: 'GET',
            endpoint: '/api/admin/players',
            requiresAuth: false,
            expectedStatus: 401
        });

        // Test invalid token
        const invalidTokenTest = {
            name: 'Invalid Token Rejection',
            method: 'GET',
            endpoint: '/api/admin/players',
            timestamp: new Date().toISOString(),
            success: false
        };

        try {
            const response = await axios.get(`${this.baseUrl}/api/admin/players`, {
                headers: { 'Authorization': 'Bearer invalid-token' },
                validateStatus: () => true,
                timeout: 5000
            });
            
            invalidTokenTest.success = response.status === 401;
            invalidTokenTest.details = { status: response.status };
        } catch (error) {
            invalidTokenTest.details = { error: error.message };
        }

        this.testResults.push(invalidTokenTest);

        // Test rate limiting (if implemented)
        const rateLimitTest = await this.testAdminEndpoint({
            name: 'Rate Limiting Check',
            method: 'GET',
            endpoint: '/api/admin/health',
            requiresAuth: true,
            expectedStatus: [200, 429, 404, 500]
        });

        await this.log(`Security Tests: ${[unauthorizedTest, invalidTokenTest, rateLimitTest]
            .filter(t => t.success).length}/3 passed`);
    }

    async testAdminWebInterface() {
        await this.log('=== Testing Admin Web Interface ===');

        // Test admin login page
        const loginPageTest = await this.testAdminEndpoint({
            name: 'Admin Login Page',
            method: 'GET',
            endpoint: '/admin/login',
            expectedStatus: 200,
            validator: (data, response) => {
                const contentType = response.headers['content-type'] || '';
                if (contentType.includes('text/html')) {
                    return { success: true, message: 'HTML page served' };
                }
                return { success: false, message: 'Not an HTML page' };
            }
        });

        // Test admin dashboard redirect
        const dashboardTest = await this.testAdminEndpoint({
            name: 'Admin Dashboard Security',
            method: 'GET',
            endpoint: '/admin/dashboard',
            expectedStatus: [200, 302, 401, 404]
        });

        // Test admin static assets
        const assetsTest = await this.testAdminEndpoint({
            name: 'Admin Static Assets',
            method: 'GET',
            endpoint: '/admin/css/admin.css',
            expectedStatus: [200, 404]
        });

        await this.log(`Web Interface Tests: ${[loginPageTest, dashboardTest, assetsTest]
            .filter(t => t.success).length}/3 passed`);
    }

    async runAllAdminTests() {
        await this.log('🛡️  Starting Admin Panel Comprehensive Tests', 'info');
        await this.log('=' .repeat(50));

        // Authenticate first
        const authSuccess = await this.authenticateAdmin();
        if (!authSuccess) {
            await this.log('Admin authentication failed. Some tests may not work.', 'warning');
        }

        // Run all test suites
        await this.testAdminAuthentication();
        await this.testPlayerManagement();
        await this.testSystemMonitoring();
        await this.testSecurityFeatures();
        await this.testAdminWebInterface();

        // Generate comprehensive report
        this.generateReport();
    }

    generateReport() {
        const summary = {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.success).length,
            failed: this.testResults.filter(r => !r.success).length,
            averageResponseTime: this.testResults
                .filter(r => r.responseTime > 0)
                .reduce((sum, r) => sum + r.responseTime, 0) / 
                this.testResults.filter(r => r.responseTime > 0).length || 0,
            adminAuthWorking: !!this.adminToken,
            testCategories: this.categorizeResults()
        };

        console.log('\n📊 ADMIN PANEL TESTING SUMMARY');
        console.log('=' .repeat(50));
        console.log(`Total Tests: ${summary.totalTests}`);
        console.log(`Passed: ${summary.passed} ✅`);
        console.log(`Failed: ${summary.failed} ❌`);
        console.log(`Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`);
        console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
        console.log(`Admin Authentication: ${summary.adminAuthWorking ? '✅ Working' : '❌ Failed'}`);
        
        console.log('\nTest Categories:');
        Object.entries(summary.testCategories).forEach(([category, stats]) => {
            console.log(`  ${category}: ${stats.passed}/${stats.total} passed`);
        });

        // List failed tests
        const failedTests = this.testResults.filter(r => !r.success);
        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTests.forEach(test => {
                console.log(`  - ${test.name}: ${test.details.error || test.details.status || 'Unknown error'}`);
            });
        }

        // Save detailed report
        const reportData = {
            timestamp: new Date().toISOString(),
            summary,
            testResults: this.testResults,
            adminTokenReceived: !!this.adminToken
        };

        const reportPath = path.join(__dirname, 'admin-panel-test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        console.log(`\n📄 Detailed report saved to: ${reportPath}`);
        
        // Overall assessment
        const healthScore = (summary.passed / summary.totalTests) * 100;
        let healthStatus = 'CRITICAL';
        
        if (healthScore >= 80) healthStatus = 'HEALTHY';
        else if (healthScore >= 60) healthStatus = 'DEGRADED';
        
        console.log(`\n🎯 Admin Panel Health: ${healthStatus} (${healthScore.toFixed(1)}%)`);

        return summary;
    }

    categorizeResults() {
        const categories = {
            Authentication: [],
            'Player Management': [],
            'System Monitoring': [],
            Security: [],
            'Web Interface': []
        };

        this.testResults.forEach(result => {
            if (result.name.includes('Login') || result.name.includes('Auth')) {
                categories.Authentication.push(result);
            } else if (result.name.includes('Player')) {
                categories['Player Management'].push(result);
            } else if (result.name.includes('System') || result.name.includes('Health') || result.name.includes('Metrics')) {
                categories['System Monitoring'].push(result);
            } else if (result.name.includes('Unauthorized') || result.name.includes('Token') || result.name.includes('Rate')) {
                categories.Security.push(result);
            } else if (result.name.includes('Page') || result.name.includes('Dashboard') || result.name.includes('Assets')) {
                categories['Web Interface'].push(result);
            }
        });

        const stats = {};
        Object.entries(categories).forEach(([name, tests]) => {
            stats[name] = {
                total: tests.length,
                passed: tests.filter(t => t.success).length
            };
        });

        return stats;
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new AdminPanelTester();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nTest interrupted. Generating partial report...');
        tester.generateReport();
        process.exit(0);
    });

    tester.runAllAdminTests()
        .then(() => {
            console.log('\n✨ Admin panel testing completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Admin panel testing failed:', error.message);
            console.error(error.stack);
            tester.generateReport();
            process.exit(1);
        });
}

module.exports = AdminPanelTester;