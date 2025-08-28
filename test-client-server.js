/**
 * Client-Server Integration Testing Suite
 * Tests the integration between the game client and server components
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

class ClientServerIntegrationTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.testResults = [];
        this.gameAssets = [];
        this.userToken = null;
        this.gameState = null;
    }

    async log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m',
            reset: '\x1b[0m'
        };
        
        const timestamp = new Date().toISOString().slice(11, 19);
        console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
    }

    async setupTestUser() {
        try {
            const username = `integration_test_${Date.now()}`;
            const email = `integration_${Date.now()}@example.com`;
            
            // Register test user
            const registerResponse = await axios.post(`${this.baseUrl}/api/auth/register`, {
                username,
                email,
                password: 'testpass123'
            }, { validateStatus: () => true });

            let loginData;
            if (registerResponse.status === 201) {
                loginData = { username, password: 'testpass123' };
            } else {
                // Try with existing test user
                loginData = { username: 'testuser_1724706969985', password: 'testpass123' };
            }

            // Login
            const loginResponse = await axios.post(`${this.baseUrl}/api/auth/login`, 
                loginData, { validateStatus: () => true });

            if (loginResponse.status === 200 && loginResponse.data.token) {
                this.userToken = loginResponse.data.token;
                await this.log('Test user authentication successful', 'success');
                return true;
            }
        } catch (error) {
            await this.log(`Test user setup failed: ${error.message}`, 'error');
        }
        return false;
    }

    async testStaticAssets() {
        await this.log('=== Testing Static Asset Delivery ===');

        const criticalAssets = [
            // Core game files
            '/index.html',
            '/src/main.js',
            '/src/config/GameConfig.js',
            '/src/services/NetworkService.js',
            '/src/scenes/GameScene.js',
            '/src/systems/GridManager.js',
            '/src/systems/WinCalculator.js',
            
            // Phaser framework
            '/phaser.min.js',
            
            // Game assets
            '/assets/images/BG_infinity_storm.png',
            '/assets/images/time_gem.png',
            '/assets/images/space_gem.png',
            '/assets/audio/BGM_infinity_storm.mp3'
        ];

        for (const assetPath of criticalAssets) {
            const startTime = performance.now();
            
            try {
                const response = await axios.get(`${this.baseUrl}${assetPath}`, {
                    timeout: 10000,
                    responseType: 'arraybuffer'
                });
                
                const loadTime = performance.now() - startTime;
                const sizeKB = (response.data.byteLength / 1024).toFixed(2);
                
                this.testResults.push({
                    category: 'Static Assets',
                    name: `Asset: ${path.basename(assetPath)}`,
                    success: response.status === 200,
                    loadTime,
                    size: `${sizeKB}KB`,
                    path: assetPath,
                    contentType: response.headers['content-type']
                });

                await this.log(`✅ ${assetPath} (${sizeKB}KB, ${loadTime.toFixed(2)}ms)`, 'success');

            } catch (error) {
                this.testResults.push({
                    category: 'Static Assets',
                    name: `Asset: ${path.basename(assetPath)}`,
                    success: false,
                    error: error.message,
                    path: assetPath
                });

                await this.log(`❌ ${assetPath} - ${error.message}`, 'error');
            }
        }
    }

    async testGameConfigIntegration() {
        await this.log('=== Testing Game Configuration Integration ===');

        try {
            // Fetch GameConfig.js
            const configResponse = await axios.get(`${this.baseUrl}/src/config/GameConfig.js`);
            
            if (configResponse.status === 200) {
                const configContent = configResponse.data;
                
                // Validate config structure (basic checks)
                const tests = [
                    {
                        name: 'GameConfig Contains Symbols',
                        check: () => configContent.includes('SYMBOLS') && configContent.includes('time_gem'),
                        details: 'Symbol definitions present'
                    },
                    {
                        name: 'GameConfig Contains Paytable',
                        check: () => configContent.includes('PAYTABLE') || configContent.includes('payout'),
                        details: 'Payout table definitions present'
                    },
                    {
                        name: 'GameConfig Contains Grid Settings',
                        check: () => configContent.includes('GRID') && configContent.includes('ROWS'),
                        details: 'Grid configuration present'
                    },
                    {
                        name: 'GameConfig Contains RTP Settings',
                        check: () => configContent.includes('RTP') || configContent.includes('96.5'),
                        details: 'RTP configuration present'
                    }
                ];

                for (const test of tests) {
                    const success = test.check();
                    this.testResults.push({
                        category: 'Game Config',
                        name: test.name,
                        success,
                        details: test.details
                    });
                    
                    await this.log(`${success ? '✅' : '❌'} ${test.name}`, success ? 'success' : 'error');
                }
            }

        } catch (error) {
            this.testResults.push({
                category: 'Game Config',
                name: 'Config File Access',
                success: false,
                error: error.message
            });
            await this.log(`❌ GameConfig access failed: ${error.message}`, 'error');
        }
    }

    async testNetworkServiceIntegration() {
        await this.log('=== Testing NetworkService Integration ===');

        if (!this.userToken) {
            await this.log('❌ No user token available for NetworkService tests', 'error');
            return;
        }

        const networkTests = [
            {
                name: 'Wallet Balance Request',
                request: async () => {
                    return await axios.get(`${this.baseUrl}/api/wallet/balance`, {
                        headers: { 'Authorization': `Bearer ${this.userToken}` }
                    });
                },
                validator: (response) => {
                    return response.data && typeof response.data.balance === 'number';
                }
            },
            {
                name: 'Game State Request',
                request: async () => {
                    return await axios.get(`${this.baseUrl}/api/game-state`, {
                        headers: { 'Authorization': `Bearer ${this.userToken}` }
                    });
                },
                validator: (response) => {
                    this.gameState = response.data;
                    return response.data && typeof response.data === 'object';
                }
            },
            {
                name: 'Spin Request',
                request: async () => {
                    return await axios.post(`${this.baseUrl}/api/spin`, 
                        { bet: 10 },
                        { headers: { 'Authorization': `Bearer ${this.userToken}` } }
                    );
                },
                validator: (response) => {
                    return response.data && 
                           Array.isArray(response.data.grid) &&
                           typeof response.data.totalWin === 'number';
                }
            }
        ];

        for (const test of networkTests) {
            const startTime = performance.now();
            
            try {
                const response = await test.request();
                const responseTime = performance.now() - startTime;
                const isValid = test.validator ? test.validator(response) : true;
                
                this.testResults.push({
                    category: 'Network Service',
                    name: test.name,
                    success: response.status === 200 && isValid,
                    responseTime,
                    status: response.status,
                    dataSize: JSON.stringify(response.data).length
                });

                await this.log(`${response.status === 200 && isValid ? '✅' : '❌'} ${test.name} (${responseTime.toFixed(2)}ms)`, 
                    response.status === 200 && isValid ? 'success' : 'error');

            } catch (error) {
                this.testResults.push({
                    category: 'Network Service',
                    name: test.name,
                    success: false,
                    error: error.message
                });
                
                await this.log(`❌ ${test.name} - ${error.message}`, 'error');
            }
        }
    }

    async testWebSocketIntegration() {
        await this.log('=== Testing WebSocket Integration ===');

        return new Promise((resolve) => {
            try {
                const io = require('socket.io-client');
                const socket = io(`${this.baseUrl}`, {
                    timeout: 5000,
                    autoConnect: true
                });

                const tests = [];
                let connectionEstablished = false;

                const cleanup = () => {
                    socket.disconnect();
                    resolve();
                };

                const timeout = setTimeout(() => {
                    tests.push({
                        category: 'WebSocket',
                        name: 'Connection Timeout',
                        success: false,
                        error: 'Connection timeout after 5 seconds'
                    });
                    cleanup();
                }, 5000);

                socket.on('connect', () => {
                    connectionEstablished = true;
                    clearTimeout(timeout);
                    
                    tests.push({
                        category: 'WebSocket',
                        name: 'WebSocket Connection',
                        success: true,
                        details: 'Successfully connected to WebSocket server'
                    });

                    this.log('✅ WebSocket connection established', 'success');

                    // Test cascade event emission (if cascade system is active)
                    socket.emit('test_cascade_event', {
                        spinId: 'test-spin-123',
                        stepId: 'test-step-456'
                    });

                    // Test spin event
                    socket.emit('spin_request', {
                        bet: 10,
                        token: this.userToken
                    });

                    // Listen for responses
                    socket.on('cascade_step', (data) => {
                        tests.push({
                            category: 'WebSocket',
                            name: 'Cascade Event Response',
                            success: true,
                            details: `Received cascade step: ${JSON.stringify(data).slice(0, 100)}`
                        });
                        this.log('✅ Cascade event received', 'success');
                    });

                    socket.on('spin_result', (data) => {
                        tests.push({
                            category: 'WebSocket',
                            name: 'Spin Event Response',
                            success: true,
                            details: `Received spin result with ${data.totalWin} win`
                        });
                        this.log('✅ Spin result received', 'success');
                    });

                    // Wait for responses then cleanup
                    setTimeout(() => {
                        this.testResults.push(...tests);
                        cleanup();
                    }, 2000);
                });

                socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    tests.push({
                        category: 'WebSocket',
                        name: 'WebSocket Connection',
                        success: false,
                        error: error.message
                    });
                    
                    this.log(`❌ WebSocket connection failed: ${error.message}`, 'error');
                    this.testResults.push(...tests);
                    cleanup();
                });

            } catch (error) {
                this.testResults.push({
                    category: 'WebSocket',
                    name: 'WebSocket Setup',
                    success: false,
                    error: error.message
                });
                
                this.log(`❌ WebSocket setup failed: ${error.message}`, 'error');
                resolve();
            }
        });
    }

    async testGameFlowIntegration() {
        await this.log('=== Testing Complete Game Flow Integration ===');

        if (!this.userToken) {
            await this.log('❌ No user token for game flow tests', 'error');
            return;
        }

        try {
            // 1. Get initial game state
            const initialStateResponse = await axios.get(`${this.baseUrl}/api/game-state`, {
                headers: { 'Authorization': `Bearer ${this.userToken}` }
            });

            // 2. Get wallet balance
            const balanceResponse = await axios.get(`${this.baseUrl}/api/wallet/balance`, {
                headers: { 'Authorization': `Bearer ${this.userToken}` }
            });

            // 3. Perform a spin
            const spinResponse = await axios.post(`${this.baseUrl}/api/spin`,
                { bet: 10 },
                { headers: { 'Authorization': `Bearer ${this.userToken}` } }
            );

            // 4. Validate complete game flow
            const gameFlowValid = 
                initialStateResponse.status === 200 &&
                balanceResponse.status === 200 &&
                spinResponse.status === 200 &&
                typeof balanceResponse.data.balance === 'number' &&
                Array.isArray(spinResponse.data.grid);

            this.testResults.push({
                category: 'Game Flow',
                name: 'Complete Game Flow Integration',
                success: gameFlowValid,
                details: {
                    gameState: initialStateResponse.status === 200,
                    wallet: balanceResponse.status === 200,
                    spin: spinResponse.status === 200,
                    initialBalance: balanceResponse.data.balance,
                    spinResult: spinResponse.data.totalWin
                }
            });

            await this.log(`${gameFlowValid ? '✅' : '❌'} Complete game flow integration`, 
                gameFlowValid ? 'success' : 'error');

            // Test cascade flow if spin had cascades
            if (spinResponse.data.cascades && spinResponse.data.cascades.length > 0) {
                await this.log(`🎯 Cascade flow detected: ${spinResponse.data.cascades.length} steps`);
                
                for (let i = 0; i < spinResponse.data.cascades.length; i++) {
                    const cascade = spinResponse.data.cascades[i];
                    
                    // Test cascade acknowledgment
                    try {
                        const ackResponse = await axios.post(`${this.baseUrl}/api/cascade/acknowledge`,
                            {
                                spinId: spinResponse.data.spinId,
                                stepId: cascade.stepId
                            },
                            { headers: { 'Authorization': `Bearer ${this.userToken}` } }
                        );

                        this.testResults.push({
                            category: 'Game Flow',
                            name: `Cascade Step ${i + 1} Acknowledgment`,
                            success: ackResponse.status === 200,
                            details: `Step ${cascade.stepId} acknowledged`
                        });

                    } catch (ackError) {
                        this.testResults.push({
                            category: 'Game Flow',
                            name: `Cascade Step ${i + 1} Acknowledgment`,
                            success: false,
                            error: ackError.message
                        });
                    }
                }
            }

        } catch (error) {
            this.testResults.push({
                category: 'Game Flow',
                name: 'Game Flow Integration',
                success: false,
                error: error.message
            });
            await this.log(`❌ Game flow integration failed: ${error.message}`, 'error');
        }
    }

    async testErrorHandling() {
        await this.log('=== Testing Error Handling Integration ===');

        const errorTests = [
            {
                name: 'Invalid API Endpoint',
                request: async () => axios.get(`${this.baseUrl}/api/nonexistent`, { validateStatus: () => true }),
                expectedStatus: 404
            },
            {
                name: 'Unauthorized Game Request',
                request: async () => axios.post(`${this.baseUrl}/api/spin`, { bet: 10 }, { validateStatus: () => true }),
                expectedStatus: 401
            },
            {
                name: 'Invalid Spin Data',
                request: async () => axios.post(`${this.baseUrl}/api/spin`, 
                    { bet: -1 }, 
                    { 
                        headers: { 'Authorization': `Bearer ${this.userToken}` },
                        validateStatus: () => true 
                    }),
                expectedStatus: 400
            },
            {
                name: 'Malformed JSON Request',
                request: async () => axios.post(`${this.baseUrl}/api/spin`, 
                    'invalid-json',
                    {
                        headers: { 
                            'Authorization': `Bearer ${this.userToken}`,
                            'Content-Type': 'application/json'
                        },
                        validateStatus: () => true
                    }),
                expectedStatus: [400, 500]
            }
        ];

        for (const test of errorTests) {
            try {
                const response = await test.request();
                const expectedStatuses = Array.isArray(test.expectedStatus) ? test.expectedStatus : [test.expectedStatus];
                const success = expectedStatuses.includes(response.status);
                
                this.testResults.push({
                    category: 'Error Handling',
                    name: test.name,
                    success,
                    expectedStatus: test.expectedStatus,
                    actualStatus: response.status,
                    details: response.data
                });

                await this.log(`${success ? '✅' : '❌'} ${test.name} (Expected: ${test.expectedStatus}, Got: ${response.status})`,
                    success ? 'success' : 'error');

            } catch (error) {
                this.testResults.push({
                    category: 'Error Handling',
                    name: test.name,
                    success: false,
                    error: error.message
                });
                
                await this.log(`❌ ${test.name} - ${error.message}`, 'error');
            }
        }
    }

    async runIntegrationTests() {
        await this.log('🔗 Starting Client-Server Integration Tests', 'info');
        await this.log('=' .repeat(50));

        // Setup
        const userSetup = await this.setupTestUser();
        if (!userSetup) {
            await this.log('⚠️  User setup failed. Some tests may not work properly.', 'warning');
        }

        // Run all test suites
        await this.testStaticAssets();
        await this.testGameConfigIntegration();
        await this.testNetworkServiceIntegration();
        await this.testWebSocketIntegration();
        await this.testGameFlowIntegration();
        await this.testErrorHandling();

        // Generate report
        this.generateReport();
    }

    generateReport() {
        const categories = {};
        
        // Group results by category
        this.testResults.forEach(result => {
            if (!categories[result.category]) {
                categories[result.category] = [];
            }
            categories[result.category].push(result);
        });

        const summary = {
            totalTests: this.testResults.length,
            passed: this.testResults.filter(r => r.success).length,
            failed: this.testResults.filter(r => !r.success).length,
            categories: {},
            userAuthWorking: !!this.userToken,
            averageResponseTime: 0
        };

        // Calculate category statistics
        Object.entries(categories).forEach(([name, tests]) => {
            summary.categories[name] = {
                total: tests.length,
                passed: tests.filter(t => t.success).length,
                failed: tests.filter(t => !t.success).length
            };
        });

        // Calculate average response time
        const testsWithTime = this.testResults.filter(r => r.responseTime);
        if (testsWithTime.length > 0) {
            summary.averageResponseTime = testsWithTime
                .reduce((sum, r) => sum + r.responseTime, 0) / testsWithTime.length;
        }

        console.log('\n📊 CLIENT-SERVER INTEGRATION TEST SUMMARY');
        console.log('=' .repeat(50));
        console.log(`Total Tests: ${summary.totalTests}`);
        console.log(`Passed: ${summary.passed} ✅`);
        console.log(`Failed: ${summary.failed} ❌`);
        console.log(`Success Rate: ${((summary.passed / summary.totalTests) * 100).toFixed(1)}%`);
        console.log(`User Authentication: ${summary.userAuthWorking ? '✅ Working' : '❌ Failed'}`);
        
        if (summary.averageResponseTime > 0) {
            console.log(`Average Response Time: ${summary.averageResponseTime.toFixed(2)}ms`);
        }

        console.log('\nCategory Breakdown:');
        Object.entries(summary.categories).forEach(([category, stats]) => {
            const successRate = ((stats.passed / stats.total) * 100).toFixed(1);
            console.log(`  ${category}: ${stats.passed}/${stats.total} passed (${successRate}%)`);
        });

        // Show failed tests
        const failedTests = this.testResults.filter(r => !r.success);
        if (failedTests.length > 0) {
            console.log('\n❌ Failed Tests:');
            failedTests.forEach(test => {
                console.log(`  - ${test.category}: ${test.name}`);
                if (test.error) console.log(`    Error: ${test.error}`);
                if (test.expectedStatus && test.actualStatus) {
                    console.log(`    Expected: ${test.expectedStatus}, Got: ${test.actualStatus}`);
                }
            });
        }

        // Save detailed report
        const reportData = {
            timestamp: new Date().toISOString(),
            summary,
            testResults: this.testResults,
            categories
        };

        const reportPath = path.join(__dirname, 'client-server-integration-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        console.log(`\n📄 Detailed report saved to: ${reportPath}`);

        // Overall assessment
        const integrationHealth = this.assessIntegrationHealth(summary);
        console.log(`\n🎯 Integration Health: ${integrationHealth.status} - ${integrationHealth.message}`);
    }

    assessIntegrationHealth(summary) {
        const successRate = (summary.passed / summary.totalTests) * 100;
        
        const criticalSystems = ['Network Service', 'Game Flow'];
        const criticalSystemsHealth = criticalSystems.map(system => {
            const category = summary.categories[system];
            return category ? (category.passed / category.total) : 0;
        });

        const avgCriticalHealth = criticalSystemsHealth.reduce((a, b) => a + b, 0) / criticalSystemsHealth.length;

        if (successRate >= 80 && avgCriticalHealth >= 0.8) {
            return {
                status: 'EXCELLENT',
                message: 'All integration systems working properly'
            };
        } else if (successRate >= 60 && avgCriticalHealth >= 0.6) {
            return {
                status: 'GOOD',
                message: 'Most systems working, minor issues present'
            };
        } else if (successRate >= 40) {
            return {
                status: 'DEGRADED',
                message: 'Significant integration issues detected'
            };
        } else {
            return {
                status: 'CRITICAL',
                message: 'Major integration failures - system may not be functional'
            };
        }
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new ClientServerIntegrationTester();
    
    // Handle graceful shutdown
    process.on('SIGINT', () => {
        console.log('\nTest interrupted. Generating partial report...');
        tester.generateReport();
        process.exit(0);
    });

    tester.runIntegrationTests()
        .then(() => {
            console.log('\n✨ Client-server integration testing completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Integration testing failed:', error.message);
            console.error(error.stack);
            tester.generateReport();
            process.exit(1);
        });
}

module.exports = ClientServerIntegrationTester;