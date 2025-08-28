/**
 * Working Components Test Suite
 * Tests only the components that should be functional without database dependencies
 */

const axios = require('axios');
const fs = require('fs');
const path = require('path');

class WorkingComponentsTester {
    constructor() {
        this.baseUrl = 'http://localhost:3000';
        this.results = [];
    }

    async log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            error: '\x1b[31m',
            warning: '\x1b[33m'
        };
        console.log(`${colors[type]}${message}\x1b[0m`);
    }

    async testStaticContentDelivery() {
        await this.log('🌐 Testing Static Content Delivery', 'info');
        
        const staticFiles = [
            { path: '/index.html', name: 'Game Entry Point', expectedType: 'text/html' },
            { path: '/src/config/GameConfig.js', name: 'Game Configuration', expectedType: 'application/javascript' },
            { path: '/src/services/NetworkService.js', name: 'Network Service', expectedType: 'application/javascript' },
            { path: '/src/scenes/GameScene.js', name: 'Game Scene', expectedType: 'application/javascript' },
            { path: '/src/systems/GridManager.js', name: 'Grid Manager', expectedType: 'application/javascript' },
            { path: '/assets/images/BG_infinity_storm.png', name: 'Background Image', expectedType: 'image/png' },
            { path: '/assets/images/time_gem.png', name: 'Time Gem Asset', expectedType: 'image/png' },
            { path: '/phaser.min.js', name: 'Phaser Framework', expectedType: 'application/javascript' }
        ];

        let passedTests = 0;
        const startTime = Date.now();

        for (const file of staticFiles) {
            try {
                const response = await axios.get(`${this.baseUrl}${file.path}`, {
                    timeout: 10000,
                    responseType: 'arraybuffer'
                });

                const sizeKB = (response.data.byteLength / 1024).toFixed(2);
                const success = response.status === 200;
                
                if (success) {
                    passedTests++;
                    await this.log(`  ✅ ${file.name} (${sizeKB}KB)`, 'success');
                } else {
                    await this.log(`  ❌ ${file.name} - Status: ${response.status}`, 'error');
                }

                this.results.push({
                    category: 'Static Content',
                    test: file.name,
                    success,
                    details: success ? `${sizeKB}KB delivered` : `Status ${response.status}`,
                    path: file.path
                });

            } catch (error) {
                await this.log(`  ❌ ${file.name} - ${error.message}`, 'error');
                this.results.push({
                    category: 'Static Content',
                    test: file.name,
                    success: false,
                    details: error.message,
                    path: file.path
                });
            }
        }

        const totalTime = Date.now() - startTime;
        await this.log(`📊 Static Content: ${passedTests}/${staticFiles.length} files delivered successfully in ${totalTime}ms`, 
            passedTests === staticFiles.length ? 'success' : 'warning');
    }

    async testWebSocketConnection() {
        await this.log('🔌 Testing WebSocket Connection', 'info');

        return new Promise((resolve) => {
            try {
                const io = require('socket.io-client');
                const socket = io(`${this.baseUrl}`, {
                    timeout: 5000,
                    autoConnect: true
                });

                const timeout = setTimeout(() => {
                    this.results.push({
                        category: 'WebSocket',
                        test: 'Connection Establishment',
                        success: false,
                        details: 'Connection timeout after 5 seconds'
                    });
                    this.log('  ❌ WebSocket connection timeout', 'error');
                    socket.disconnect();
                    resolve();
                }, 5000);

                socket.on('connect', () => {
                    clearTimeout(timeout);
                    this.results.push({
                        category: 'WebSocket',
                        test: 'Connection Establishment',
                        success: true,
                        details: 'Connection established successfully'
                    });
                    this.log('  ✅ WebSocket connection established', 'success');

                    // Test event emission
                    socket.emit('test_event', { message: 'test' });
                    
                    setTimeout(() => {
                        socket.disconnect();
                        resolve();
                    }, 1000);
                });

                socket.on('connect_error', (error) => {
                    clearTimeout(timeout);
                    this.results.push({
                        category: 'WebSocket',
                        test: 'Connection Establishment',
                        success: false,
                        details: `Connection error: ${error.message}`
                    });
                    this.log(`  ❌ WebSocket connection error: ${error.message}`, 'error');
                    socket.disconnect();
                    resolve();
                });

            } catch (error) {
                this.results.push({
                    category: 'WebSocket',
                    test: 'WebSocket Setup',
                    success: false,
                    details: `Setup error: ${error.message}`
                });
                this.log(`  ❌ WebSocket setup error: ${error.message}`, 'error');
                resolve();
            }
        });
    }

    async testServerResponsiveness() {
        await this.log('⚡ Testing Server Responsiveness', 'info');

        const responseTimes = [];
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
            try {
                const startTime = Date.now();
                const response = await axios.get(`${this.baseUrl}/`, { timeout: 5000 });
                const responseTime = Date.now() - startTime;
                
                if (response.status === 200) {
                    responseTimes.push(responseTime);
                }
            } catch (error) {
                // Skip failed requests for responsiveness test
            }
        }

        if (responseTimes.length > 0) {
            const avgResponseTime = (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2);
            const minTime = Math.min(...responseTimes);
            const maxTime = Math.max(...responseTimes);

            this.results.push({
                category: 'Performance',
                test: 'Server Responsiveness',
                success: avgResponseTime < 1000,
                details: `Avg: ${avgResponseTime}ms, Min: ${minTime}ms, Max: ${maxTime}ms`
            });

            if (avgResponseTime < 1000) {
                await this.log(`  ✅ Average response time: ${avgResponseTime}ms`, 'success');
            } else {
                await this.log(`  ⚠️ Slow response time: ${avgResponseTime}ms`, 'warning');
            }
        } else {
            this.results.push({
                category: 'Performance',
                test: 'Server Responsiveness',
                success: false,
                details: 'No successful responses received'
            });
            await this.log('  ❌ Server not responsive', 'error');
        }
    }

    async testSecurityFeatures() {
        await this.log('🔐 Testing Security Features', 'info');

        // Test CORS headers
        try {
            const response = await axios.get(`${this.baseUrl}/`, {
                headers: { 'Origin': 'http://localhost:3000' }
            });

            const hasSecurityHeaders = 
                response.headers['access-control-allow-origin'] ||
                response.headers['x-frame-options'] ||
                response.headers['x-content-type-options'];

            this.results.push({
                category: 'Security',
                test: 'CORS and Security Headers',
                success: !!hasSecurityHeaders,
                details: hasSecurityHeaders ? 'Security headers present' : 'No security headers detected'
            });

            if (hasSecurityHeaders) {
                await this.log('  ✅ Security headers configured', 'success');
            } else {
                await this.log('  ⚠️ Security headers missing', 'warning');
            }

        } catch (error) {
            this.results.push({
                category: 'Security',
                test: 'CORS and Security Headers',
                success: false,
                details: `Error testing security: ${error.message}`
            });
            await this.log(`  ❌ Security test failed: ${error.message}`, 'error');
        }
    }

    async testGameAssetIntegrity() {
        await this.log('🎮 Testing Game Asset Integrity', 'info');

        try {
            // Test GameConfig.js content
            const configResponse = await axios.get(`${this.baseUrl}/src/config/GameConfig.js`);
            const configContent = configResponse.data;

            const configTests = [
                {
                    name: 'Symbol Definitions',
                    test: () => configContent.includes('SYMBOLS') && configContent.includes('time_gem'),
                    importance: 'critical'
                },
                {
                    name: 'Grid Configuration',
                    test: () => configContent.includes('ROWS') && configContent.includes('COLS'),
                    importance: 'critical'
                },
                {
                    name: 'RTP Settings',
                    test: () => configContent.includes('RTP') || configContent.includes('96.5'),
                    importance: 'important'
                },
                {
                    name: 'Paytable Data',
                    test: () => configContent.includes('PAYTABLE') || configContent.includes('payout'),
                    importance: 'critical'
                }
            ];

            let criticalPassed = 0;
            let totalCritical = 0;

            for (const test of configTests) {
                const passed = test.test();
                
                if (test.importance === 'critical') {
                    totalCritical++;
                    if (passed) criticalPassed++;
                }

                this.results.push({
                    category: 'Game Assets',
                    test: `GameConfig - ${test.name}`,
                    success: passed,
                    details: `${test.importance} game configuration element`,
                    importance: test.importance
                });

                const icon = passed ? '✅' : '❌';
                await this.log(`  ${icon} ${test.name} (${test.importance})`, passed ? 'success' : 'error');
            }

            const configHealthy = criticalPassed === totalCritical;
            await this.log(`📊 Game Configuration: ${criticalPassed}/${totalCritical} critical elements present`, 
                configHealthy ? 'success' : 'error');

        } catch (error) {
            this.results.push({
                category: 'Game Assets',
                test: 'Game Configuration Access',
                success: false,
                details: `Cannot access GameConfig: ${error.message}`
            });
            await this.log(`  ❌ GameConfig access failed: ${error.message}`, 'error');
        }
    }

    async testRoutingSystem() {
        await this.log('🛣️ Testing Routing System', 'info');

        const routes = [
            { path: '/', name: 'Root Route', expectedStatus: 200 },
            { path: '/admin/login', name: 'Admin Login Page', expectedStatus: 200 },
            { path: '/nonexistent', name: 'Invalid Route', expectedStatus: 404 }
        ];

        let workingRoutes = 0;

        for (const route of routes) {
            try {
                const response = await axios.get(`${this.baseUrl}${route.path}`, {
                    validateStatus: () => true,
                    timeout: 5000
                });

                const success = response.status === route.expectedStatus;
                if (success) workingRoutes++;

                this.results.push({
                    category: 'Routing',
                    test: route.name,
                    success,
                    details: `Expected ${route.expectedStatus}, got ${response.status}`,
                    path: route.path
                });

                const icon = success ? '✅' : '❌';
                await this.log(`  ${icon} ${route.name} - Status: ${response.status}`, 
                    success ? 'success' : 'error');

            } catch (error) {
                this.results.push({
                    category: 'Routing',
                    test: route.name,
                    success: false,
                    details: `Request failed: ${error.message}`,
                    path: route.path
                });
                await this.log(`  ❌ ${route.name} - ${error.message}`, 'error');
            }
        }

        await this.log(`📊 Routing: ${workingRoutes}/${routes.length} routes working correctly`, 
            workingRoutes > routes.length / 2 ? 'success' : 'warning');
    }

    generateReport() {
        const categories = {};
        
        // Group results by category
        this.results.forEach(result => {
            if (!categories[result.category]) {
                categories[result.category] = [];
            }
            categories[result.category].push(result);
        });

        console.log('\n' + '='.repeat(60));
        console.log('📋 WORKING COMPONENTS TEST SUMMARY');
        console.log('='.repeat(60));

        let totalTests = 0;
        let totalPassed = 0;

        Object.entries(categories).forEach(([category, tests]) => {
            const passed = tests.filter(t => t.success).length;
            const total = tests.length;
            const percentage = ((passed / total) * 100).toFixed(1);
            
            totalTests += total;
            totalPassed += passed;

            const status = passed === total ? '✅' : passed > total / 2 ? '⚠️' : '❌';
            console.log(`${status} ${category}: ${passed}/${total} tests passed (${percentage}%)`);
        });

        const overallPercentage = ((totalPassed / totalTests) * 100).toFixed(1);
        console.log('\n' + '-'.repeat(60));
        console.log(`📊 OVERALL WORKING COMPONENTS: ${totalPassed}/${totalTests} (${overallPercentage}%)`);

        // System health assessment
        let healthStatus;
        if (overallPercentage >= 80) {
            healthStatus = '🟢 HEALTHY - Core systems operational';
        } else if (overallPercentage >= 60) {
            healthStatus = '🟡 PARTIAL - Some components working';
        } else {
            healthStatus = '🔴 CRITICAL - Major system issues';
        }

        console.log(`🎯 System Health: ${healthStatus}`);
        console.log('-'.repeat(60));

        // Key findings
        console.log('\n🔍 KEY FINDINGS:');
        
        const staticContentPassed = categories['Static Content']?.filter(t => t.success).length || 0;
        const staticContentTotal = categories['Static Content']?.length || 0;
        
        if (staticContentPassed === staticContentTotal) {
            console.log('✅ Static content delivery system is fully operational');
        }

        const websocketPassed = categories['WebSocket']?.filter(t => t.success).length || 0;
        if (websocketPassed > 0) {
            console.log('✅ Real-time communication system is working');
        }

        const gameAssetsPassed = categories['Game Assets']?.filter(t => t.success).length || 0;
        const gameAssetsTotal = categories['Game Assets']?.length || 0;
        if (gameAssetsPassed > gameAssetsTotal / 2) {
            console.log('✅ Game configuration and assets are accessible');
        }

        // Save results
        const reportData = {
            timestamp: new Date().toISOString(),
            summary: {
                totalTests,
                totalPassed,
                overallPercentage: parseFloat(overallPercentage),
                healthStatus
            },
            categories,
            results: this.results
        };

        const reportPath = path.join(__dirname, 'working-components-test-results.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

        console.log(`\n📄 Detailed results saved to: ${reportPath}`);
        console.log('='.repeat(60));
    }

    async runTests() {
        await this.log('🎰 TESTING WORKING COMPONENTS ONLY', 'info');
        await this.log('(Skipping database-dependent features)', 'info');
        console.log('');

        await this.testStaticContentDelivery();
        await this.testWebSocketConnection();
        await this.testServerResponsiveness();
        await this.testSecurityFeatures();
        await this.testGameAssetIntegrity();
        await this.testRoutingSystem();

        this.generateReport();
    }
}

// Run tests if executed directly
if (require.main === module) {
    const tester = new WorkingComponentsTester();
    
    tester.runTests()
        .then(() => {
            console.log('\n✨ Working components testing completed!');
            process.exit(0);
        })
        .catch(error => {
            console.error('\n💥 Testing failed:', error.message);
            process.exit(1);
        });
}

module.exports = WorkingComponentsTester;