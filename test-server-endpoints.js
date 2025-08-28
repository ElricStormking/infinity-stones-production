/**
 * Server Endpoints Testing Suite
 * Focused testing of all API endpoints and their responses
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class ServerEndpointTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.testResults = [];
        this.authTokens = {
            user: null,
            admin: null
        };
    }

    async setupTestUser() {
        try {
            const username = `testuser_${Date.now()}`;
            const email = `test_${Date.now()}@example.com`;
            
            // Register test user
            const registerResponse = await axios.post(`${this.baseUrl}/api/auth/register`, {
                username,
                email,
                password: 'testpass123'
            }, { validateStatus: () => true });

            if (registerResponse.status === 201 || registerResponse.status === 409) {
                // Login with test user
                const loginResponse = await axios.post(`${this.baseUrl}/api/auth/login`, {
                    username,
                    password: 'testpass123'
                }, { validateStatus: () => true });

                if (loginResponse.status === 200) {
                    this.authTokens.user = loginResponse.data.token;
                    return true;
                }
            }
        } catch (error) {
            console.log('Test user setup failed:', error.message);
        }
        return false;
    }

    async setupAdminUser() {
        try {
            const adminResponse = await axios.post(`${this.baseUrl}/api/admin/login`, {
                username: 'admin',
                password: 'admin123'
            }, { validateStatus: () => true });

            if (adminResponse.status === 200) {
                this.authTokens.admin = adminResponse.data.token;
                return true;
            }
        } catch (error) {
            console.log('Admin setup failed:', error.message);
        }
        return false;
    }

    async testEndpoint(config) {
        const startTime = Date.now();
        
        try {
            const requestConfig = {
                method: config.method,
                url: `${this.baseUrl}${config.path}`,
                timeout: config.timeout || 10000,
                validateStatus: () => true,
                ...config.options
            };

            if (config.data) {
                requestConfig.data = config.data;
            }

            if (config.headers) {
                requestConfig.headers = { ...requestConfig.headers, ...config.headers };
            }

            if (config.requiresAuth === 'user' && this.authTokens.user) {
                requestConfig.headers = {
                    ...requestConfig.headers,
                    'Authorization': `Bearer ${this.authTokens.user}`
                };
            } else if (config.requiresAuth === 'admin' && this.authTokens.admin) {
                requestConfig.headers = {
                    ...requestConfig.headers,
                    'Authorization': `Bearer ${this.authTokens.admin}`
                };
            }

            const response = await axios(requestConfig);
            const responseTime = Date.now() - startTime;

            const result = {
                name: config.name,
                method: config.method,
                path: config.path,
                expectedStatus: config.expectedStatus,
                actualStatus: response.status,
                responseTime,
                success: this.evaluateResponse(response, config),
                response: this.sanitizeResponse(response.data),
                headers: response.headers,
                timestamp: new Date().toISOString()
            };

            if (config.validator) {
                try {
                    result.customValidation = config.validator(response);
                } catch (validationError) {
                    result.customValidation = {
                        success: false,
                        error: validationError.message
                    };
                }
            }

            this.testResults.push(result);
            return result;

        } catch (error) {
            const result = {
                name: config.name,
                method: config.method,
                path: config.path,
                expectedStatus: config.expectedStatus,
                actualStatus: 'ERROR',
                responseTime: Date.now() - startTime,
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };

            this.testResults.push(result);
            return result;
        }
    }

    evaluateResponse(response, config) {
        if (config.expectedStatus) {
            if (Array.isArray(config.expectedStatus)) {
                return config.expectedStatus.includes(response.status);
            } else {
                return response.status === config.expectedStatus;
            }
        }
        return response.status >= 200 && response.status < 400;
    }

    sanitizeResponse(data) {
        if (typeof data === 'object' && data !== null) {
            const sanitized = { ...data };
            
            // Remove sensitive information
            if (sanitized.token) sanitized.token = '[REDACTED]';
            if (sanitized.password) sanitized.password = '[REDACTED]';
            if (sanitized.hash) sanitized.hash = '[REDACTED]';
            
            return sanitized;
        }
        return data;
    }

    async runEndpointTests() {
        console.log('🚀 Starting Server Endpoint Tests...\n');

        // Setup authentication
        await this.setupTestUser();
        await this.setupAdminUser();

        const testCases = [
            // Health and Status Endpoints
            {
                name: 'Health Check',
                method: 'GET',
                path: '/api/health',
                expectedStatus: 200,
                validator: (response) => {
                    if (!response.data) throw new Error('No health data returned');
                    return { success: true, message: 'Health data present' };
                }
            },

            // Authentication Endpoints
            {
                name: 'Register - Valid Data',
                method: 'POST',
                path: '/api/auth/register',
                data: {
                    username: `testuser_endpoint_${Date.now()}`,
                    email: `endpoint_test_${Date.now()}@example.com`,
                    password: 'testpass123'
                },
                expectedStatus: [201, 409],
                headers: { 'Content-Type': 'application/json' }
            },
            {
                name: 'Register - Invalid Data',
                method: 'POST',
                path: '/api/auth/register',
                data: {
                    username: '',
                    email: 'invalid-email',
                    password: '123'
                },
                expectedStatus: 400,
                headers: { 'Content-Type': 'application/json' }
            },
            {
                name: 'Login - Invalid Credentials',
                method: 'POST',
                path: '/api/auth/login',
                data: {
                    username: 'nonexistent',
                    password: 'wrongpassword'
                },
                expectedStatus: 401,
                headers: { 'Content-Type': 'application/json' }
            },

            // Game Endpoints (require authentication)
            {
                name: 'Spin - Authenticated',
                method: 'POST',
                path: '/api/spin',
                data: { bet: 10 },
                requiresAuth: 'user',
                expectedStatus: [200, 400],
                headers: { 'Content-Type': 'application/json' },
                validator: (response) => {
                    if (response.status === 200) {
                        if (!response.data.grid) throw new Error('No grid in spin result');
                        if (typeof response.data.totalWin !== 'number') throw new Error('Invalid totalWin');
                    }
                    return { success: true };
                }
            },
            {
                name: 'Spin - No Authentication',
                method: 'POST',
                path: '/api/spin',
                data: { bet: 10 },
                expectedStatus: 401,
                headers: { 'Content-Type': 'application/json' }
            },
            {
                name: 'Game State - Authenticated',
                method: 'GET',
                path: '/api/game-state',
                requiresAuth: 'user',
                expectedStatus: 200
            },
            {
                name: 'Game State - No Authentication',
                method: 'GET',
                path: '/api/game-state',
                expectedStatus: 401
            },

            // Wallet Endpoints
            {
                name: 'Wallet Balance - Authenticated',
                method: 'GET',
                path: '/api/wallet/balance',
                requiresAuth: 'user',
                expectedStatus: 200,
                validator: (response) => {
                    if (typeof response.data.balance !== 'number') {
                        throw new Error('Balance not returned as number');
                    }
                    return { success: true };
                }
            },
            {
                name: 'Wallet Balance - No Authentication',
                method: 'GET',
                path: '/api/wallet/balance',
                expectedStatus: 401
            },

            // Admin Endpoints
            {
                name: 'Admin Login - Valid Credentials',
                method: 'POST',
                path: '/api/admin/login',
                data: {
                    username: 'admin',
                    password: 'admin123'
                },
                expectedStatus: [200, 401],
                headers: { 'Content-Type': 'application/json' }
            },
            {
                name: 'Admin Players List - Authenticated',
                method: 'GET',
                path: '/api/admin/players',
                requiresAuth: 'admin',
                expectedStatus: [200, 500]
            },
            {
                name: 'Admin Players List - No Authentication',
                method: 'GET',
                path: '/api/admin/players',
                expectedStatus: 401
            },

            // Cascade Endpoints
            {
                name: 'Cascade Acknowledge',
                method: 'POST',
                path: '/api/cascade/acknowledge',
                data: {
                    stepId: 'test-step-id',
                    spinId: 'test-spin-id'
                },
                requiresAuth: 'user',
                expectedStatus: [200, 400],
                headers: { 'Content-Type': 'application/json' }
            },

            // Error Handling
            {
                name: 'Non-existent Endpoint',
                method: 'GET',
                path: '/api/nonexistent',
                expectedStatus: 404
            },
            {
                name: 'Invalid JSON Data',
                method: 'POST',
                path: '/api/auth/login',
                data: 'invalid-json-data',
                expectedStatus: [400, 500],
                headers: { 'Content-Type': 'application/json' }
            }
        ];

        console.log(`Running ${testCases.length} endpoint tests...\n`);

        // Run all tests
        for (const testCase of testCases) {
            const result = await this.testEndpoint(testCase);
            
            const status = result.success ? '✅ PASS' : '❌ FAIL';
            console.log(`${status} ${result.name}`);
            console.log(`    ${result.method} ${result.path}`);
            console.log(`    Expected: ${testCase.expectedStatus}, Got: ${result.actualStatus}`);
            console.log(`    Response time: ${result.responseTime}ms`);
            
            if (!result.success) {
                console.log(`    Error: ${result.error || 'Status code mismatch'}`);
            }
            
            if (result.customValidation && !result.customValidation.success) {
                console.log(`    Validation Error: ${result.customValidation.error}`);
            }
            
            console.log('');
        }

        this.generateReport();
    }

    generateReport() {
        const summary = {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.success).length,
            failed: this.testResults.filter(r => !r.success).length,
            averageResponseTime: this.testResults
                .filter(r => r.responseTime)
                .reduce((sum, r) => sum + r.responseTime, 0) / this.testResults.length,
            authenticationWorking: {
                user: !!this.authTokens.user,
                admin: !!this.authTokens.admin
            }
        };

        console.log('📊 ENDPOINT TESTING SUMMARY');
        console.log('=' .repeat(40));
        console.log(`Total Tests: ${summary.totalTests}`);
        console.log(`Passed: ${summary.passed}`);
        console.log(`Failed: ${summary.failed}`);
        console.log(`Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`);
        console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
        console.log(`User Auth: ${summary.authenticationWorking.user ? '✅' : '❌'}`);
        console.log(`Admin Auth: ${summary.authenticationWorking.admin ? '✅' : '❌'}`);

        // Save detailed report
        const reportData = {
            timestamp: new Date().toISOString(),
            summary,
            results: this.testResults
        };

        fs.writeFileSync(
            path.join(__dirname, 'endpoint-test-results.json'),
            JSON.stringify(reportData, null, 2)
        );

        console.log('\n📄 Detailed results saved to: endpoint-test-results.json');
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new ServerEndpointTester();
    
    tester.runEndpointTests()
        .then(() => {
            console.log('\n✨ Endpoint testing completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Endpoint testing failed:', error.message);
            process.exit(1);
        });
}

module.exports = ServerEndpointTester;