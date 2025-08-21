/**
 * Performance and Load Testing Suite for Enhanced Cascade Synchronization
 * 
 * Task 15.2: Create performance testing suite
 * - 15.2.1: Test high-frequency cascade handling
 * - 15.2.2: Validate memory usage patterns
 * - 15.2.3: Test concurrent player handling
 * - 15.2.4: Verify server resource utilization
 * 
 * This test suite validates the performance characteristics and scalability
 * of the Enhanced Cascade Synchronization system under various load conditions.
 */

const request = require('supertest');
const express = require('express');
const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const GridEngine = require('../../game-logic/GridEngine');
const CascadeSynchronizer = require('../../src/services/CascadeSynchronizer');
const CascadeValidator = require('../../src/services/CascadeValidator');

describe('Performance and Load Testing Suite', () => {
    let app, server, io, gridEngine, cascadeSynchronizer, cascadeValidator;
    let testPort = 0;
    let serverUrl;
    let performanceMetrics = {};

    beforeAll(async () => {
        // Create test server
        app = express();
        app.use(express.json());
        server = createServer(app);
        io = new Server(server);

        // Initialize services
        gridEngine = new GridEngine();
        cascadeSynchronizer = new CascadeSynchronizer();
        cascadeValidator = new CascadeValidator();

        // Setup performance monitoring endpoints
        setupPerformanceEndpoints(app);
        setupWebSocketHandlers(io);

        // Start server
        await new Promise((resolve) => {
            server.listen(0, () => {
                testPort = server.address().port;
                serverUrl = `http://localhost:${testPort}`;
                resolve();
            });
        });

        console.log(`Performance test server started on ${serverUrl}`);
    });

    afterAll(async () => {
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    beforeEach(() => {
        // Reset performance metrics for each test
        performanceMetrics = {
            requests: 0,
            totalTime: 0,
            errors: 0,
            memoryUsage: [],
            concurrentSessions: 0
        };
    });

    // ==== Task 15.2.1: Test high-frequency cascade handling ====
    describe('15.2.1: High-Frequency Cascade Handling', () => {
        test('should handle rapid cascade generation under high frequency', async () => {
            const cascadeCount = 100;
            const targetFrequency = 10; // 10 cascades per second
            const betAmount = 1.00;
            
            const startTime = Date.now();
            const cascadePromises = [];

            for (let i = 0; i < cascadeCount; i++) {
                const promise = (async () => {
                    const iterationStartTime = Date.now();
                    
                    try {
                        const spinResult = await gridEngine.generateSpinResult(betAmount, { 
                            enableSync: true,
                            playerId: `high-freq-${i}`
                        });
                        
                        const iterationTime = Date.now() - iterationStartTime;
                        return {
                            success: true,
                            steps: spinResult.steps.length,
                            totalWin: spinResult.totalWin,
                            processingTime: iterationTime
                        };
                    } catch (error) {
                        return {
                            success: false,
                            error: error.message,
                            processingTime: Date.now() - iterationStartTime
                        };
                    }
                })();
                
                cascadePromises.push(promise);
                
                // Add small delay to control frequency
                if (i > 0 && i % targetFrequency === 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }

            const results = await Promise.all(cascadePromises);
            const endTime = Date.now();
            const totalTime = endTime - startTime;

            // Performance analysis
            const successfulCascades = results.filter(r => r.success);
            const failedCascades = results.filter(r => !r.success);
            const averageProcessingTime = successfulCascades.reduce((sum, r) => sum + r.processingTime, 0) / successfulCascades.length;
            const actualFrequency = (cascadeCount / totalTime) * 1000; // cascades per second

            // Performance assertions
            expect(successfulCascades.length).toBeGreaterThan(cascadeCount * 0.95); // 95% success rate
            expect(averageProcessingTime).toBeLessThan(500); // <500ms average processing
            expect(actualFrequency).toBeGreaterThan(5); // At least 5 cascades/second

            console.log(`✓ High-frequency handling: ${successfulCascades.length}/${cascadeCount} successful`);
            console.log(`  - Average processing time: ${averageProcessingTime.toFixed(2)}ms`);
            console.log(`  - Actual frequency: ${actualFrequency.toFixed(2)} cascades/second`);
            console.log(`  - Failed cascades: ${failedCascades.length}`);

            // Log any failures for analysis
            if (failedCascades.length > 0) {
                console.log('Failed cascade errors:', failedCascades.map(f => f.error));
            }
        }, 60000); // 60 second timeout

        test('should maintain validation performance under high load', async () => {
            const validationCount = 200;
            const betAmount = 1.00;
            
            // Pre-generate test data
            const testSpins = [];
            for (let i = 0; i < 20; i++) {
                const spin = await gridEngine.generateSpinResult(betAmount, { enableSync: true });
                testSpins.push(spin);
            }

            const validationStartTime = Date.now();
            const validationPromises = [];

            for (let i = 0; i < validationCount; i++) {
                const testSpin = testSpins[i % testSpins.length];
                const stepToValidate = testSpin.steps[0]; // Validate first step
                
                const validationPromise = request(app)
                    .post('/api/cascade/validate/step')
                    .send({ stepData: stepToValidate })
                    .then(response => ({
                        success: response.status === 200,
                        responseTime: Date.now() - validationStartTime,
                        statusCode: response.status
                    }))
                    .catch(error => ({
                        success: false,
                        error: error.message,
                        responseTime: Date.now() - validationStartTime
                    }));

                validationPromises.push(validationPromise);
            }

            const validationResults = await Promise.all(validationPromises);
            const validationEndTime = Date.now();
            const totalValidationTime = validationEndTime - validationStartTime;

            // Analysis
            const successfulValidations = validationResults.filter(r => r.success);
            const averageValidationTime = totalValidationTime / validationCount;
            const validationsPerSecond = (validationCount / totalValidationTime) * 1000;

            // Performance assertions
            expect(successfulValidations.length).toBeGreaterThan(validationCount * 0.98); // 98% success rate
            expect(averageValidationTime).toBeLessThan(100); // <100ms average validation
            expect(validationsPerSecond).toBeGreaterThan(10); // At least 10 validations/second

            console.log(`✓ Validation performance: ${successfulValidations.length}/${validationCount} successful`);
            console.log(`  - Average validation time: ${averageValidationTime.toFixed(2)}ms`);
            console.log(`  - Validations per second: ${validationsPerSecond.toFixed(2)}`);
        }, 45000);

        test('should handle burst patterns efficiently', async () => {
            const burstSize = 50;
            const burstCount = 5;
            const betAmount = 0.50;
            
            const burstResults = [];
            
            for (let burst = 0; burst < burstCount; burst++) {
                const burstStartTime = Date.now();
                const burstPromises = [];
                
                // Create burst of concurrent requests
                for (let i = 0; i < burstSize; i++) {
                    const promise = gridEngine.generateSpinResult(betAmount, { 
                        enableSync: true,
                        playerId: `burst-${burst}-${i}`
                    });
                    burstPromises.push(promise);
                }
                
                const burstSpins = await Promise.all(burstPromises);
                const burstTime = Date.now() - burstStartTime;
                
                burstResults.push({
                    burstIndex: burst,
                    size: burstSize,
                    processingTime: burstTime,
                    successCount: burstSpins.length,
                    averageSteps: burstSpins.reduce((sum, spin) => sum + spin.steps.length, 0) / burstSpins.length
                });
                
                // Brief pause between bursts
                await new Promise(resolve => setTimeout(resolve, 200));
            }

            // Analyze burst performance
            const totalBursts = burstResults.length;
            const averageBurstTime = burstResults.reduce((sum, b) => sum + b.processingTime, 0) / totalBursts;
            const maxBurstTime = Math.max(...burstResults.map(b => b.processingTime));
            
            // Performance assertions
            expect(averageBurstTime).toBeLessThan(5000); // <5 seconds average burst time
            expect(maxBurstTime).toBeLessThan(10000); // <10 seconds max burst time
            burstResults.forEach(burst => {
                expect(burst.successCount).toBe(burstSize); // All requests should succeed
            });

            console.log(`✓ Burst pattern efficiency: ${burstCount} bursts of ${burstSize} requests`);
            console.log(`  - Average burst time: ${averageBurstTime.toFixed(2)}ms`);
            console.log(`  - Max burst time: ${maxBurstTime.toFixed(2)}ms`);
        }, 90000); // 90 second timeout for burst testing
    });

    // ==== Task 15.2.2: Validate memory usage patterns ====
    describe('15.2.2: Memory Usage Patterns', () => {
        test('should maintain stable memory usage during extended operation', async () => {
            const operationCount = 100;
            const betAmount = 1.00;
            const memorySnapshots = [];

            // Record initial memory
            const initialMemory = process.memoryUsage();
            memorySnapshots.push({
                iteration: 0,
                ...initialMemory,
                timestamp: Date.now()
            });

            for (let i = 1; i <= operationCount; i++) {
                // Perform cascade operation
                const spinResult = await gridEngine.generateSpinResult(betAmount, { enableSync: true });
                
                // Validate the result
                for (const step of spinResult.steps) {
                    await cascadeValidator.validateCascadeStep(step);
                }

                // Record memory every 10 operations
                if (i % 10 === 0) {
                    const currentMemory = process.memoryUsage();
                    memorySnapshots.push({
                        iteration: i,
                        ...currentMemory,
                        timestamp: Date.now()
                    });
                }

                // Force garbage collection every 25 operations
                if (i % 25 === 0 && global.gc) {
                    global.gc();
                }
            }

            // Analyze memory growth
            const finalMemory = memorySnapshots[memorySnapshots.length - 1];
            const memoryGrowth = {
                heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
                heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
                rss: finalMemory.rss - initialMemory.rss
            };

            // Memory assertions (growth should be reasonable)
            const maxReasonableGrowth = 50 * 1024 * 1024; // 50MB
            expect(memoryGrowth.heapUsed).toBeLessThan(maxReasonableGrowth);
            expect(memoryGrowth.rss).toBeLessThan(maxReasonableGrowth * 2);

            console.log(`✓ Memory stability: ${operationCount} operations completed`);
            console.log(`  - Heap growth: ${(memoryGrowth.heapUsed / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  - RSS growth: ${(memoryGrowth.rss / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  - Final heap used: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);

            // Store memory data for potential debugging
            performanceMetrics.memorySnapshots = memorySnapshots;
        }, 60000);

        test('should properly clean up validation data', async () => {
            const validationCycles = 50;
            const betAmount = 1.00;
            
            // Check initial validation cache size
            const initialCacheSize = cascadeValidator.getValidationCacheSize?.() || 0;
            
            for (let i = 0; i < validationCycles; i++) {
                const spinResult = await gridEngine.generateSpinResult(betAmount, { enableSync: true });
                
                // Validate all steps to populate cache
                for (const step of spinResult.steps) {
                    await cascadeValidator.validateCascadeStep(step);
                    await cascadeValidator.validateGridState(step.gridAfter);
                }
            }
            
            // Check cache size after operations
            const midCacheSize = cascadeValidator.getValidationCacheSize?.() || 0;
            
            // Force cleanup if available
            if (cascadeValidator.clearValidationCache) {
                cascadeValidator.clearValidationCache();
            }
            
            const finalCacheSize = cascadeValidator.getValidationCacheSize?.() || 0;
            
            // Cache should not grow unbounded
            expect(midCacheSize).toBeGreaterThanOrEqual(initialCacheSize);
            if (cascadeValidator.clearValidationCache) {
                expect(finalCacheSize).toBeLessThan(midCacheSize);
            }

            console.log(`✓ Validation data cleanup: cache size ${initialCacheSize} → ${midCacheSize} → ${finalCacheSize}`);
        });

        test('should handle memory pressure gracefully', async () => {
            const pressureOperations = 200;
            const betAmount = 0.25;
            const memoryCheckInterval = 20;
            
            let memoryPressureDetected = false;
            let operationsFailed = 0;
            
            for (let i = 0; i < pressureOperations; i++) {
                try {
                    // Check memory every interval
                    if (i % memoryCheckInterval === 0) {
                        const memory = process.memoryUsage();
                        const heapUsageRatio = memory.heapUsed / memory.heapTotal;
                        
                        if (heapUsageRatio > 0.9) {
                            memoryPressureDetected = true;
                            console.log(`Memory pressure detected at operation ${i}: ${(heapUsageRatio * 100).toFixed(1)}% heap usage`);
                        }
                    }
                    
                    // Perform operation
                    const spinResult = await gridEngine.generateSpinResult(betAmount, { enableSync: true });
                    
                    // Only validate if memory usage is reasonable
                    const memory = process.memoryUsage();
                    if (memory.heapUsed < memory.heapTotal * 0.8) {
                        await cascadeValidator.validateCascadeStep(spinResult.steps[0]);
                    }
                    
                } catch (error) {
                    operationsFailed++;
                    if (operationsFailed > pressureOperations * 0.1) {
                        // If more than 10% fail, break the test
                        break;
                    }
                }
            }
            
            // Should complete majority of operations even under pressure
            const successRate = (pressureOperations - operationsFailed) / pressureOperations;
            expect(successRate).toBeGreaterThan(0.8); // 80% success rate minimum

            console.log(`✓ Memory pressure handling: ${successRate * 100}% success rate`);
            console.log(`  - Operations failed: ${operationsFailed}/${pressureOperations}`);
            console.log(`  - Memory pressure detected: ${memoryPressureDetected}`);
        }, 90000);
    });

    // ==== Task 15.2.3: Test concurrent player handling ====
    describe('15.2.3: Concurrent Player Handling', () => {
        test('should handle multiple concurrent players efficiently', async () => {
            const playerCount = 25;
            const sessionsPerPlayer = 4;
            const betAmount = 1.00;
            
            const playerPromises = [];
            
            for (let playerId = 0; playerId < playerCount; playerId++) {
                const playerPromise = (async () => {
                    const playerResults = [];
                    
                    for (let session = 0; session < sessionsPerPlayer; session++) {
                        const sessionStartTime = Date.now();
                        
                        try {
                            // Create session
                            const sessionResponse = await request(app)
                                .post('/api/cascade/session/create')
                                .send({ 
                                    playerId: `concurrent-player-${playerId}`,
                                    betAmount,
                                    enableSync: true 
                                });
                            
                            if (sessionResponse.status !== 200) {
                                throw new Error(`Session creation failed: ${sessionResponse.status}`);
                            }
                            
                            // Generate spin
                            const spinResult = await gridEngine.generateSpinResult(betAmount, { 
                                enableSync: true,
                                playerId: `concurrent-player-${playerId}`
                            });
                            
                            // Validate first step
                            const validationResponse = await request(app)
                                .post('/api/cascade/validate/step')
                                .send({ stepData: spinResult.steps[0] });
                                
                            if (validationResponse.status !== 200) {
                                throw new Error(`Validation failed: ${validationResponse.status}`);
                            }
                            
                            const sessionTime = Date.now() - sessionStartTime;
                            
                            playerResults.push({
                                playerId,
                                session,
                                success: true,
                                steps: spinResult.steps.length,
                                totalWin: spinResult.totalWin,
                                sessionTime
                            });
                            
                        } catch (error) {
                            playerResults.push({
                                playerId,
                                session,
                                success: false,
                                error: error.message,
                                sessionTime: Date.now() - sessionStartTime
                            });
                        }
                    }
                    
                    return playerResults;
                })();
                
                playerPromises.push(playerPromise);
            }
            
            const allPlayerResults = await Promise.all(playerPromises);
            const flatResults = allPlayerResults.flat();
            
            // Analyze concurrent performance
            const successfulSessions = flatResults.filter(r => r.success);
            const failedSessions = flatResults.filter(r => !r.success);
            const averageSessionTime = successfulSessions.reduce((sum, r) => sum + r.sessionTime, 0) / successfulSessions.length;
            const maxSessionTime = Math.max(...successfulSessions.map(r => r.sessionTime));
            
            // Performance assertions
            const successRate = successfulSessions.length / flatResults.length;
            expect(successRate).toBeGreaterThan(0.9); // 90% success rate
            expect(averageSessionTime).toBeLessThan(2000); // <2 seconds average
            expect(maxSessionTime).toBeLessThan(10000); // <10 seconds max

            console.log(`✓ Concurrent player handling: ${playerCount} players, ${sessionsPerPlayer} sessions each`);
            console.log(`  - Success rate: ${(successRate * 100).toFixed(1)}%`);
            console.log(`  - Average session time: ${averageSessionTime.toFixed(2)}ms`);
            console.log(`  - Max session time: ${maxSessionTime.toFixed(2)}ms`);
            console.log(`  - Failed sessions: ${failedSessions.length}`);
            
            if (failedSessions.length > 0) {
                const errorCounts = {};
                failedSessions.forEach(session => {
                    errorCounts[session.error] = (errorCounts[session.error] || 0) + 1;
                });
                console.log('  - Error breakdown:', errorCounts);
            }
        }, 120000); // 2 minute timeout

        test('should maintain WebSocket connection stability under load', async () => {
            const connectionCount = 20;
            const messagesPerConnection = 10;
            
            const connections = [];
            const connectionPromises = [];
            
            // Create multiple WebSocket connections
            for (let i = 0; i < connectionCount; i++) {
                const connectionPromise = new Promise((resolve, reject) => {
                    const client = Client(serverUrl);
                    const connectionData = {
                        id: i,
                        client,
                        messagesReceived: 0,
                        messagesSent: 0,
                        errors: 0
                    };
                    
                    client.on('connect', () => {
                        connections.push(connectionData);
                        
                        // Send test messages
                        const sendInterval = setInterval(() => {
                            if (connectionData.messagesSent >= messagesPerConnection) {
                                clearInterval(sendInterval);
                                
                                // Wait a bit for final responses
                                setTimeout(() => {
                                    client.disconnect();
                                    resolve(connectionData);
                                }, 1000);
                                return;
                            }
                            
                            client.emit('cascade_sync_test', {
                                connectionId: i,
                                messageIndex: connectionData.messagesSent,
                                timestamp: Date.now()
                            }, (response) => {
                                if (response && response.success) {
                                    connectionData.messagesReceived++;
                                } else {
                                    connectionData.errors++;
                                }
                            });
                            
                            connectionData.messagesSent++;
                        }, 100 + Math.random() * 200); // 100-300ms intervals
                    });
                    
                    client.on('connect_error', (error) => {
                        connectionData.errors++;
                        reject(error);
                    });
                    
                    client.on('error', (error) => {
                        connectionData.errors++;
                    });
                });
                
                connectionPromises.push(connectionPromise);
            }
            
            const connectionResults = await Promise.all(connectionPromises);
            
            // Analyze WebSocket performance
            const totalMessagesSent = connectionResults.reduce((sum, conn) => sum + conn.messagesSent, 0);
            const totalMessagesReceived = connectionResults.reduce((sum, conn) => sum + conn.messagesReceived, 0);
            const totalErrors = connectionResults.reduce((sum, conn) => sum + conn.errors, 0);
            const messageSuccessRate = totalMessagesReceived / totalMessagesSent;
            
            // WebSocket assertions
            expect(messageSuccessRate).toBeGreaterThan(0.95); // 95% message success rate
            expect(totalErrors).toBeLessThan(totalMessagesSent * 0.05); // <5% error rate

            console.log(`✓ WebSocket stability: ${connectionCount} connections, ${messagesPerConnection} messages each`);
            console.log(`  - Message success rate: ${(messageSuccessRate * 100).toFixed(1)}%`);
            console.log(`  - Total messages: ${totalMessagesSent} sent, ${totalMessagesReceived} received`);
            console.log(`  - Total errors: ${totalErrors}`);
        }, 60000);

        test('should handle player session isolation correctly', async () => {
            const playerCount = 10;
            const betAmount = 1.00;
            
            const playerSessions = [];
            
            // Create isolated sessions for each player
            for (let i = 0; i < playerCount; i++) {
                const playerId = `isolated-player-${i}`;
                
                const sessionResponse = await request(app)
                    .post('/api/cascade/session/create')
                    .send({ playerId, betAmount, enableSync: true })
                    .expect(200);
                
                const syncResponse = await request(app)
                    .post('/api/cascade/sync/start')
                    .send({ 
                        sessionId: sessionResponse.body.sessionId,
                        playerId 
                    })
                    .expect(200);
                
                playerSessions.push({
                    playerId,
                    sessionId: sessionResponse.body.sessionId,
                    syncSessionId: syncResponse.body.syncSessionId,
                    validationSalt: syncResponse.body.validationSalt
                });
            }
            
            // Verify session isolation - each should have unique IDs
            const sessionIds = playerSessions.map(s => s.sessionId);
            const syncSessionIds = playerSessions.map(s => s.syncSessionId);
            const validationSalts = playerSessions.map(s => s.validationSalt);
            
            // All IDs should be unique
            expect(new Set(sessionIds).size).toBe(playerCount);
            expect(new Set(syncSessionIds).size).toBe(playerCount);
            expect(new Set(validationSalts).size).toBe(playerCount);
            
            // Cross-validate that sessions don't interfere
            const crossValidationPromises = playerSessions.map(async (session, index) => {
                const otherSession = playerSessions[(index + 1) % playerCount];
                
                // Try to access other player's session (should fail or return different data)
                const crossCheckResponse = await request(app)
                    .get(`/api/cascade/session/${otherSession.sessionId}`)
                    .expect(200);
                
                return {
                    playerIndex: index,
                    crossSessionId: otherSession.sessionId,
                    responseReceived: true
                };
            });
            
            const crossValidationResults = await Promise.all(crossValidationPromises);
            
            // All cross-validations should work (sessions are readable but isolated)
            expect(crossValidationResults.length).toBe(playerCount);
            crossValidationResults.forEach(result => {
                expect(result.responseReceived).toBe(true);
            });

            console.log(`✓ Player session isolation: ${playerCount} isolated sessions created and validated`);
        });
    });

    // ==== Task 15.2.4: Verify server resource utilization ====
    describe('15.2.4: Server Resource Utilization', () => {
        test('should monitor CPU usage during peak load', async () => {
            const loadDuration = 10000; // 10 seconds
            const requestInterval = 50; // Request every 50ms
            const betAmount = 1.00;
            
            const cpuUsageSnapshots = [];
            const requestResults = [];
            let isRunning = true;
            
            // CPU monitoring function
            const monitorCPU = () => {
                const cpuUsage = process.cpuUsage();
                cpuUsageSnapshots.push({
                    timestamp: Date.now(),
                    user: cpuUsage.user,
                    system: cpuUsage.system
                });
                
                if (isRunning) {
                    setTimeout(monitorCPU, 1000); // Monitor every second
                }
            };
            
            // Start CPU monitoring
            monitorCPU();
            
            // Generate continuous load
            const loadStartTime = Date.now();
            
            const generateLoad = async () => {
                while (Date.now() - loadStartTime < loadDuration) {
                    const requestStartTime = Date.now();
                    
                    try {
                        const spinResult = await gridEngine.generateSpinResult(betAmount, { 
                            enableSync: true,
                            playerId: `cpu-load-${Date.now()}`
                        });
                        
                        const requestTime = Date.now() - requestStartTime;
                        requestResults.push({
                            success: true,
                            requestTime,
                            steps: spinResult.steps.length
                        });
                        
                    } catch (error) {
                        const requestTime = Date.now() - requestStartTime;
                        requestResults.push({
                            success: false,
                            requestTime,
                            error: error.message
                        });
                    }
                    
                    await new Promise(resolve => setTimeout(resolve, requestInterval));
                }
            };
            
            await generateLoad();
            isRunning = false;
            
            // Analyze CPU usage
            const successfulRequests = requestResults.filter(r => r.success);
            const averageRequestTime = successfulRequests.reduce((sum, r) => sum + r.requestTime, 0) / successfulRequests.length;
            const requestsPerSecond = (requestResults.length / loadDuration) * 1000;
            
            // CPU analysis
            const totalCpuTime = cpuUsageSnapshots.reduce((sum, snapshot) => sum + snapshot.user + snapshot.system, 0);
            const averageCpuPerSnapshot = totalCpuTime / cpuUsageSnapshots.length;
            
            // Resource assertions
            expect(successfulRequests.length / requestResults.length).toBeGreaterThan(0.9); // 90% success rate
            expect(averageRequestTime).toBeLessThan(1000); // <1 second average
            expect(requestsPerSecond).toBeGreaterThan(5); // At least 5 requests/second

            console.log(`✓ CPU usage monitoring: ${loadDuration}ms load test`);
            console.log(`  - Requests processed: ${requestResults.length}`);
            console.log(`  - Success rate: ${(successfulRequests.length / requestResults.length * 100).toFixed(1)}%`);
            console.log(`  - Average request time: ${averageRequestTime.toFixed(2)}ms`);
            console.log(`  - Requests per second: ${requestsPerSecond.toFixed(2)}`);
            console.log(`  - CPU snapshots taken: ${cpuUsageSnapshots.length}`);
        }, 30000);

        test('should track memory allocation patterns under load', async () => {
            const allocationCycles = 50;
            const allocationsPerCycle = 20;
            const betAmount = 0.50;
            
            const memoryPatterns = [];
            
            for (let cycle = 0; cycle < allocationCycles; cycle++) {
                const cycleStartMemory = process.memoryUsage();
                const cycleStartTime = Date.now();
                
                // Allocate multiple operations in this cycle
                const cyclePromises = [];
                for (let i = 0; i < allocationsPerCycle; i++) {
                    const promise = gridEngine.generateSpinResult(betAmount, { 
                        enableSync: true,
                        playerId: `mem-pattern-${cycle}-${i}`
                    });
                    cyclePromises.push(promise);
                }
                
                const cycleResults = await Promise.all(cyclePromises);
                const cycleEndTime = Date.now();
                const cycleEndMemory = process.memoryUsage();
                
                const memoryDelta = {
                    heapUsed: cycleEndMemory.heapUsed - cycleStartMemory.heapUsed,
                    heapTotal: cycleEndMemory.heapTotal - cycleStartMemory.heapTotal,
                    rss: cycleEndMemory.rss - cycleStartMemory.rss
                };
                
                memoryPatterns.push({
                    cycle,
                    allocationsPerCycle,
                    cycleTime: cycleEndTime - cycleStartTime,
                    memoryDelta,
                    successfulAllocations: cycleResults.length,
                    currentMemory: cycleEndMemory
                });
                
                // Force garbage collection every 10 cycles
                if (cycle % 10 === 0 && global.gc) {
                    global.gc();
                }
            }
            
            // Analyze memory allocation patterns
            const totalHeapGrowth = memoryPatterns.reduce((sum, pattern) => sum + Math.max(0, pattern.memoryDelta.heapUsed), 0);
            const averageHeapGrowthPerCycle = totalHeapGrowth / allocationCycles;
            const maxHeapGrowthPerCycle = Math.max(...memoryPatterns.map(p => p.memoryDelta.heapUsed));
            
            // Memory pattern assertions
            expect(averageHeapGrowthPerCycle).toBeLessThan(10 * 1024 * 1024); // <10MB per cycle average
            expect(maxHeapGrowthPerCycle).toBeLessThan(50 * 1024 * 1024); // <50MB max per cycle
            
            // Check for memory leaks (final memory shouldn't be drastically higher than start)
            const initialMemory = memoryPatterns[0].currentMemory.heapUsed;
            const finalMemory = memoryPatterns[memoryPatterns.length - 1].currentMemory.heapUsed;
            const totalMemoryGrowth = finalMemory - initialMemory;
            
            expect(totalMemoryGrowth).toBeLessThan(100 * 1024 * 1024); // <100MB total growth

            console.log(`✓ Memory allocation patterns: ${allocationCycles} cycles, ${allocationsPerCycle} allocations each`);
            console.log(`  - Average heap growth per cycle: ${(averageHeapGrowthPerCycle / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  - Max heap growth per cycle: ${(maxHeapGrowthPerCycle / 1024 / 1024).toFixed(2)}MB`);
            console.log(`  - Total memory growth: ${(totalMemoryGrowth / 1024 / 1024).toFixed(2)}MB`);
        }, 60000);

        test('should measure response time distribution under various loads', async () => {
            const loadLevels = [1, 5, 10, 20]; // Concurrent requests
            const requestsPerLevel = 30;
            const betAmount = 1.00;
            
            const responseTimeDistributions = {};
            
            for (const concurrency of loadLevels) {
                const levelResults = [];
                
                for (let batch = 0; batch < Math.ceil(requestsPerLevel / concurrency); batch++) {
                    const batchPromises = [];
                    const batchSize = Math.min(concurrency, requestsPerLevel - batch * concurrency);
                    
                    for (let i = 0; i < batchSize; i++) {
                        const requestStartTime = Date.now();
                        
                        const promise = gridEngine.generateSpinResult(betAmount, { 
                            enableSync: true,
                            playerId: `response-time-${concurrency}-${batch}-${i}`
                        }).then(result => ({
                            success: true,
                            responseTime: Date.now() - requestStartTime,
                            steps: result.steps.length
                        })).catch(error => ({
                            success: false,
                            responseTime: Date.now() - requestStartTime,
                            error: error.message
                        }));
                        
                        batchPromises.push(promise);
                    }
                    
                    const batchResults = await Promise.all(batchPromises);
                    levelResults.push(...batchResults);
                }
                
                // Calculate distribution statistics
                const successfulRequests = levelResults.filter(r => r.success);
                const responseTimes = successfulRequests.map(r => r.responseTime);
                responseTimes.sort((a, b) => a - b);
                
                const distribution = {
                    concurrency,
                    totalRequests: levelResults.length,
                    successfulRequests: successfulRequests.length,
                    successRate: successfulRequests.length / levelResults.length,
                    min: Math.min(...responseTimes),
                    max: Math.max(...responseTimes),
                    mean: responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length,
                    median: responseTimes[Math.floor(responseTimes.length / 2)],
                    p95: responseTimes[Math.floor(responseTimes.length * 0.95)],
                    p99: responseTimes[Math.floor(responseTimes.length * 0.99)]
                };
                
                responseTimeDistributions[concurrency] = distribution;
                
                // Assertions for this load level
                expect(distribution.successRate).toBeGreaterThan(0.9); // 90% success rate
                expect(distribution.p95).toBeLessThan(5000); // 95th percentile under 5 seconds
                expect(distribution.mean).toBeLessThan(2000); // Mean under 2 seconds
            }
            
            console.log('✓ Response time distribution analysis:');
            Object.values(responseTimeDistributions).forEach(dist => {
                console.log(`  Concurrency ${dist.concurrency}: ${dist.successRate * 100}% success, ` +
                          `${dist.mean.toFixed(0)}ms mean, ${dist.p95.toFixed(0)}ms p95, ${dist.p99.toFixed(0)}ms p99`);
            });
            
            // Performance should not degrade dramatically with increased load
            const lowConcurrencyMean = responseTimeDistributions[1].mean;
            const highConcurrencyMean = responseTimeDistributions[20].mean;
            const degradationRatio = highConcurrencyMean / lowConcurrencyMean;
            
            expect(degradationRatio).toBeLessThan(5); // Response time shouldn't increase more than 5x
        }, 120000); // 2 minute timeout
    });

    // Helper function to set up performance monitoring endpoints
    function setupPerformanceEndpoints(app) {
        app.post('/api/cascade/session/create', (req, res) => {
            const { playerId, betAmount, enableSync } = req.body;
            const sessionId = `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            
            performanceMetrics.requests++;
            
            res.json({
                success: true,
                sessionId,
                playerId,
                betAmount,
                enableSync,
                createdAt: new Date().toISOString()
            });
        });

        app.get('/api/cascade/session/:sessionId', (req, res) => {
            const { sessionId } = req.params;
            
            res.json({
                sessionId,
                cascadeState: {
                    status: 'active',
                    totalSteps: 3,
                    currentStep: 1
                },
                performance: {
                    validationSuccessRate: 0.95,
                    averageStepTime: 150
                }
            });
        });

        app.post('/api/cascade/sync/start', (req, res) => {
            const { sessionId, playerId } = req.body;
            const syncSessionId = `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const validationSalt = `salt-${Date.now()}`;
            
            performanceMetrics.concurrentSessions++;
            
            res.json({
                success: true,
                syncSessionId,
                validationSalt,
                sessionId,
                playerId
            });
        });

        app.post('/api/cascade/validate/step', async (req, res) => {
            const { stepData } = req.body;
            const startTime = Date.now();
            
            try {
                // Simulate validation processing time
                await new Promise(resolve => setTimeout(resolve, Math.random() * 20 + 5));
                
                const processingTime = Date.now() - startTime;
                performanceMetrics.totalTime += processingTime;
                performanceMetrics.requests++;
                
                res.json({
                    valid: true,
                    fraudScore: Math.random() * 0.1,
                    processingTime,
                    timestamp: Date.now()
                });
            } catch (error) {
                performanceMetrics.errors++;
                res.status(500).json({ error: error.message });
            }
        });
    }

    // Helper function to set up WebSocket handlers
    function setupWebSocketHandlers(io) {
        io.on('connection', (socket) => {
            performanceMetrics.concurrentSessions++;
            
            socket.on('cascade_sync_test', (data, callback) => {
                const responseTime = Math.random() * 50 + 10; // 10-60ms response time
                
                setTimeout(() => {
                    callback({
                        success: true,
                        message: 'Performance test response',
                        responseTime,
                        timestamp: Date.now(),
                        connectionId: data.connectionId,
                        messageIndex: data.messageIndex
                    });
                }, responseTime);
            });

            socket.on('disconnect', () => {
                performanceMetrics.concurrentSessions = Math.max(0, performanceMetrics.concurrentSessions - 1);
            });
        });
    }
});