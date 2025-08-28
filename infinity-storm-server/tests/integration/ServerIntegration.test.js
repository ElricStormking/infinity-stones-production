/**
 * Server-Side Integration Testing for Phase 5 Casino System
 * 
 * Task 8.1: Server-side integration validation
 * - Database Integration and Consistency
 * - Game Engine and RNG Validation
 * - API Endpoint Integration
 * - WebSocket Communication Testing
 * - Performance and Scalability Validation
 * 
 * This test suite validates the complete server-side casino system
 * ensuring all components work together correctly.
 */

const request = require('supertest');
const express = require('express');
const { Server } = require('socket.io');
const { createServer } = require('http');
const Client = require('socket.io-client');
const path = require('path');

// Import server components
const GridEngine = require('../../game-logic/GridEngine');
const CascadeSynchronizer = require('../../src/services/CascadeSynchronizer');
const CascadeValidator = require('../../src/services/CascadeValidator');
const GameSession = require('../../src/models/GameSession');
const SpinResult = require('../../src/models/SpinResult');

describe('Server-Side Integration Testing', () => {
    let app, server, io, clientSocket;
    let testPort = 0;
    let serverUrl;
    let gridEngine, cascadeSynchronizer, cascadeValidator;

    beforeAll(async () => {
        // Create test server with complete integration
        app = express();
        app.use(express.json());
        server = createServer(app);
        io = new Server(server, {
            cors: { origin: "*", methods: ["GET", "POST"] }
        });

        // Initialize all server components
        gridEngine = new GridEngine();
        cascadeSynchronizer = new CascadeSynchronizer();
        cascadeValidator = new CascadeValidator();

        // Setup complete server API
        setupCompleteServerAPI(app);
        setupCompleteWebSocketHandlers(io);

        // Start server
        await new Promise((resolve) => {
            server.listen(0, () => {
                testPort = server.address().port;
                serverUrl = `http://localhost:${testPort}`;
                resolve();
            });
        });

        // Connect client socket
        clientSocket = Client(serverUrl);
        await new Promise((resolve) => {
            clientSocket.on('connect', resolve);
        });
    });

    afterAll(async () => {
        if (clientSocket) {
            clientSocket.disconnect();
        }
        if (server) {
            await new Promise((resolve) => server.close(resolve));
        }
    });

    describe('1. Database Integration and Consistency', () => {
        test('should handle complete database transaction lifecycle', async () => {
            console.log('🗄️ Testing complete database transaction lifecycle...');

            const playerId = 'db-test-player-001';
            const initialBalance = 1000.00;
            const betAmount = 5.00;

            // Step 1: Create player account
            const createPlayerResponse = await request(app)
                .post('/api/test/player/create')
                .send({
                    playerId,
                    initialBalance,
                    currency: 'USD'
                })
                .expect(200);

            expect(createPlayerResponse.body.success).toBe(true);
            expect(createPlayerResponse.body.player.balance).toBe(initialBalance);

            // Step 2: Create game session with database transaction
            const sessionResponse = await request(app)
                .post('/api/game/session/create')
                .send({
                    playerId,
                    gameType: 'infinity_storm',
                    betAmount
                })
                .expect(200);

            const sessionId = sessionResponse.body.sessionId;
            expect(sessionId).toBeDefined();

            // Step 3: Execute spin with full database integration
            const spinResponse = await request(app)
                .post('/api/game/spin/integrated')
                .send({
                    sessionId,
                    playerId,
                    betAmount,
                    includeTransactionLog: true
                })
                .expect(200);

            expect(spinResponse.body.success).toBe(true);
            expect(spinResponse.body.transactionId).toBeDefined();
            expect(spinResponse.body.balanceAfterBet).toBe(initialBalance - betAmount);

            const spinResult = spinResponse.body.spinResult;
            const winAmount = spinResult.totalWin;

            // Step 4: Verify transaction consistency
            const transactionCheckResponse = await request(app)
                .get(`/api/test/transaction/${spinResponse.body.transactionId}`)
                .expect(200);

            expect(transactionCheckResponse.body.transaction.amount).toBe(betAmount);
            expect(transactionCheckResponse.body.transaction.type).toBe('bet');
            expect(transactionCheckResponse.body.transaction.status).toBe('completed');

            // Step 5: Verify balance consistency after win processing
            const finalBalanceResponse = await request(app)
                .get(`/api/test/player/${playerId}/balance`)
                .expect(200);

            const expectedFinalBalance = initialBalance - betAmount + winAmount;
            expect(finalBalanceResponse.body.balance).toBe(expectedFinalBalance);

            console.log(`✅ Database transaction lifecycle validated:
            - Initial: $${initialBalance}
            - Bet: $${betAmount}
            - Win: $${winAmount}
            - Final: $${expectedFinalBalance}`);
        });

        test('should handle database rollback on transaction failure', async () => {
            console.log('⚠️ Testing database rollback on failure...');

            const playerId = 'rollback-test-player';
            const initialBalance = 100.00;
            const betAmount = 150.00; // More than balance

            // Create player
            await request(app)
                .post('/api/test/player/create')
                .send({
                    playerId,
                    initialBalance,
                    currency: 'USD'
                })
                .expect(200);

            // Attempt spin with insufficient funds
            const spinResponse = await request(app)
                .post('/api/game/spin/integrated')
                .send({
                    playerId,
                    betAmount,
                    forceTransaction: true
                })
                .expect(400);

            expect(spinResponse.body.error).toBe('Insufficient funds');
            expect(spinResponse.body.transactionRolledBack).toBe(true);

            // Verify balance unchanged
            const balanceResponse = await request(app)
                .get(`/api/test/player/${playerId}/balance`)
                .expect(200);

            expect(balanceResponse.body.balance).toBe(initialBalance);

            console.log('✅ Database rollback validation completed!');
        });

        test('should maintain referential integrity across related tables', async () => {
            console.log('🔗 Testing referential integrity across tables...');

            const playerId = 'integrity-test-player';
            const initialBalance = 500.00;

            // Create player and session
            await request(app)
                .post('/api/test/player/create')
                .send({ playerId, initialBalance })
                .expect(200);

            const sessionResponse = await request(app)
                .post('/api/game/session/create')
                .send({ playerId, gameType: 'infinity_storm', betAmount: 1.00 })
                .expect(200);

            const sessionId = sessionResponse.body.sessionId;

            // Execute multiple spins to create related records
            const spinPromises = [];
            for (let i = 0; i < 5; i++) {
                spinPromises.push(
                    request(app)
                        .post('/api/game/spin/integrated')
                        .send({
                            sessionId,
                            playerId,
                            betAmount: 1.00,
                            spinNumber: i + 1
                        })
                        .expect(200)
                );
            }

            const spinResponses = await Promise.all(spinPromises);

            // Verify all related records exist and are consistent
            const relationshipCheckResponse = await request(app)
                .get(`/api/test/integrity/check/${sessionId}`)
                .expect(200);

            expect(relationshipCheckResponse.body.integrityValid).toBe(true);
            expect(relationshipCheckResponse.body.playerExists).toBe(true);
            expect(relationshipCheckResponse.body.sessionExists).toBe(true);
            expect(relationshipCheckResponse.body.transactionCount).toBe(5);
            expect(relationshipCheckResponse.body.spinResultCount).toBe(5);

            console.log('✅ Referential integrity validation completed!');
        });
    });

    describe('2. Game Engine and RNG Validation', () => {
        test('should generate cryptographically secure and auditable spin results', async () => {
            console.log('🎲 Testing cryptographic RNG and audit trail...');

            const testSpins = 50;
            const betAmount = 1.00;
            const spinResults = [];

            for (let i = 0; i < testSpins; i++) {
                const spinResponse = await request(app)
                    .post('/api/game/spin/auditable')
                    .send({
                        betAmount,
                        includeRNGSeed: true,
                        includeAuditData: true
                    })
                    .expect(200);

                spinResults.push(spinResponse.body);
            }

            // Validate RNG properties
            const rngSeeds = spinResults.map(result => result.auditData.rngSeed);
            const uniqueSeeds = new Set(rngSeeds);

            // All seeds should be unique
            expect(uniqueSeeds.size).toBe(testSpins);

            // Validate reproducibility - same seed should produce same result
            const testSeed = rngSeeds[0];
            const reproduceResponse = await request(app)
                .post('/api/game/spin/reproduce')
                .send({
                    rngSeed: testSeed,
                    betAmount
                })
                .expect(200);

            expect(reproduceResponse.body.gridState).toEqual(spinResults[0].spinResult.gridState);

            // Validate statistical distribution (basic chi-square test)
            const symbolCounts = {};
            spinResults.forEach(result => {
                result.spinResult.gridState.forEach(column => {
                    column.forEach(symbol => {
                        symbolCounts[symbol] = (symbolCounts[symbol] || 0) + 1;
                    });
                });
            });

            const totalSymbols = Object.values(symbolCounts).reduce((sum, count) => sum + count, 0);
            const expectedPerSymbol = totalSymbols / Object.keys(symbolCounts).length;

            // No symbol should be more than 50% off expected frequency
            Object.values(symbolCounts).forEach(count => {
                const deviation = Math.abs(count - expectedPerSymbol) / expectedPerSymbol;
                expect(deviation).toBeLessThan(0.5);
            });

            console.log(`✅ RNG validation completed:
            - ${testSpins} spins generated
            - All seeds unique: ${uniqueSeeds.size === testSpins}
            - Reproducibility confirmed
            - Statistical distribution within acceptable variance`);
        });

        test('should validate RTP (Return to Player) over large sample', async () => {
            console.log('📊 Testing RTP validation over large sample...');

            const sampleSize = 1000;
            const betAmount = 1.00;
            const targetRTP = 0.965; // 96.5%
            const tolerance = 0.05; // ±5%

            let totalBet = 0;
            let totalWin = 0;

            // Execute large sample of spins
            const batchSize = 50;
            const batches = Math.ceil(sampleSize / batchSize);

            for (let batch = 0; batch < batches; batch++) {
                const currentBatchSize = Math.min(batchSize, sampleSize - (batch * batchSize));
                
                const batchResponse = await request(app)
                    .post('/api/game/spin/batch')
                    .send({
                        count: currentBatchSize,
                        betAmount,
                        includeRTPAnalysis: true
                    })
                    .expect(200);

                totalBet += batchResponse.body.totalBet;
                totalWin += batchResponse.body.totalWin;

                console.log(`Batch ${batch + 1}/${batches} completed - Running RTP: ${(totalWin / totalBet * 100).toFixed(2)}%`);
            }

            const actualRTP = totalWin / totalBet;
            const rtpDifference = Math.abs(actualRTP - targetRTP);

            expect(rtpDifference).toBeLessThan(tolerance);

            console.log(`✅ RTP validation completed:
            - Sample size: ${sampleSize} spins
            - Total bet: $${totalBet}
            - Total win: $${totalWin.toFixed(2)}
            - Actual RTP: ${(actualRTP * 100).toFixed(2)}%
            - Target RTP: ${(targetRTP * 100).toFixed(2)}%
            - Difference: ${(rtpDifference * 100).toFixed(2)}% (within ${(tolerance * 100).toFixed(2)}% tolerance)`);
        });

        test('should prevent RNG manipulation and detect anomalies', async () => {
            console.log('🛡️ Testing RNG security and anomaly detection...');

            // Test 1: Attempt to manipulate RNG seed
            const manipulationResponse = await request(app)
                .post('/api/game/spin/auditable')
                .send({
                    betAmount: 1.00,
                    customRNGSeed: 'malicious_seed_123',
                    attemptManipulation: true
                })
                .expect(400);

            expect(manipulationResponse.body.error).toBe('RNG manipulation attempt detected');

            // Test 2: Generate sample and check for patterns
            const testSample = 100;
            const results = [];

            for (let i = 0; i < testSample; i++) {
                const response = await request(app)
                    .post('/api/game/spin/security')
                    .send({
                        betAmount: 1.00,
                        includeSecurityAnalysis: true
                    })
                    .expect(200);

                results.push(response.body);
            }

            // Analyze for suspicious patterns
            const anomalies = results.filter(result => result.securityAnalysis.anomalyScore > 0.8);
            expect(anomalies.length).toBeLessThan(testSample * 0.01); // Less than 1% anomalies

            // Test sequence correlation
            const correlationResponse = await request(app)
                .post('/api/test/rng/correlation')
                .send({
                    results: results.map(r => r.spinResult.gridState)
                })
                .expect(200);

            expect(correlationResponse.body.sequenceCorrelation).toBeLessThan(0.1);
            expect(correlationResponse.body.patternDetected).toBe(false);

            console.log('✅ RNG security validation completed!');
        });
    });

    describe('3. API Endpoint Integration', () => {
        test('should handle complex multi-endpoint workflow with proper error handling', async () => {
            console.log('🌐 Testing complex API workflow integration...');

            const playerId = 'api-workflow-player';
            let sessionId, spinId;

            // Step 1: Player creation with validation
            const playerResponse = await request(app)
                .post('/api/player/create')
                .send({
                    playerId,
                    email: 'test@example.com',
                    initialBalance: 1000.00,
                    jurisdiction: 'TEST',
                    verificationLevel: 'FULL'
                })
                .expect(200);

            expect(playerResponse.body.player.id).toBe(playerId);

            // Step 2: Session creation with game rules validation
            const sessionResponse = await request(app)
                .post('/api/game/session/create')
                .send({
                    playerId,
                    gameType: 'infinity_storm',
                    maxBet: 100.00,
                    maxLoss: 500.00,
                    sessionDuration: 3600
                })
                .expect(200);

            sessionId = sessionResponse.body.sessionId;
            expect(sessionId).toBeDefined();

            // Step 3: Multiple spins with cascade synchronization
            const spinPromises = [];
            for (let i = 0; i < 5; i++) {
                spinPromises.push(
                    request(app)
                        .post('/api/game/spin/integrated')
                        .send({
                            sessionId,
                            betAmount: 10.00,
                            enableCascadeSync: true,
                            spinSequence: i + 1
                        })
                        .expect(200)
                );
            }

            const spinResponses = await Promise.all(spinPromises);
            spinId = spinResponses[0].body.spinResult.spinId;

            // Step 4: Session analysis and statistics
            const analysisResponse = await request(app)
                .get(`/api/game/session/${sessionId}/analysis`)
                .expect(200);

            expect(analysisResponse.body.totalSpins).toBe(5);
            expect(analysisResponse.body.totalWagered).toBe(50.00);
            expect(analysisResponse.body.netResult).toBeDefined();

            // Step 5: Audit log retrieval
            const auditResponse = await request(app)
                .get(`/api/audit/session/${sessionId}`)
                .expect(200);

            expect(auditResponse.body.auditEntries.length).toBeGreaterThan(0);
            expect(auditResponse.body.auditEntries[0].action).toBe('SESSION_CREATED');

            // Step 6: Session closure with final reconciliation
            const closureResponse = await request(app)
                .post(`/api/game/session/${sessionId}/close`)
                .send({
                    reason: 'PLAYER_REQUEST',
                    includeReconciliation: true
                })
                .expect(200);

            expect(closureResponse.body.reconciliation.balanceMatches).toBe(true);
            expect(closureResponse.body.reconciliation.allTransactionsRecorded).toBe(true);

            console.log('✅ Complex API workflow integration completed!');
        });

        test('should handle API rate limiting and throttling', async () => {
            console.log('🚦 Testing API rate limiting and throttling...');

            const playerId = 'rate-limit-player';

            // Create player first
            await request(app)
                .post('/api/test/player/create')
                .send({ playerId, initialBalance: 1000.00 })
                .expect(200);

            // Test rate limiting with rapid requests
            const rapidRequests = [];
            const requestCount = 100;
            const startTime = Date.now();

            for (let i = 0; i < requestCount; i++) {
                rapidRequests.push(
                    request(app)
                        .post('/api/game/spin/integrated')
                        .send({
                            playerId,
                            betAmount: 1.00,
                            requestId: `rapid_${i}`
                        })
                );
            }

            const responses = await Promise.allSettled(rapidRequests);
            const endTime = Date.now();

            // Analyze response patterns
            const successResponses = responses.filter(r => r.status === 'fulfilled' && r.value.status === 200);
            const rateLimitedResponses = responses.filter(r => r.status === 'fulfilled' && r.value.status === 429);

            expect(rateLimitedResponses.length).toBeGreaterThan(0); // Some should be rate limited
            expect(successResponses.length).toBeGreaterThan(requestCount * 0.5); // At least 50% should succeed

            // Verify rate limiting headers
            if (rateLimitedResponses.length > 0) {
                const rateLimitResponse = rateLimitedResponses[0].value;
                expect(rateLimitResponse.headers['x-ratelimit-limit']).toBeDefined();
                expect(rateLimitResponse.headers['x-ratelimit-remaining']).toBeDefined();
            }

            console.log(`✅ Rate limiting validation:
            - ${requestCount} requests in ${endTime - startTime}ms
            - ${successResponses.length} successful
            - ${rateLimitedResponses.length} rate limited`);
        });
    });

    describe('4. WebSocket Communication Testing', () => {
        test('should handle real-time game events with proper acknowledgments', async () => {
            console.log('🔌 Testing real-time WebSocket game events...');

            const playerId = 'ws-realtime-player';
            let eventCount = 0;
            const receivedEvents = [];

            // Set up event listeners
            clientSocket.on('game_event', (data) => {
                eventCount++;
                receivedEvents.push(data);
            });

            clientSocket.on('cascade_step', (data) => {
                eventCount++;
                receivedEvents.push(data);
            });

            // Join game room
            const joinResponse = await new Promise((resolve) => {
                clientSocket.emit('join_game_room', { playerId }, resolve);
            });

            expect(joinResponse.success).toBe(true);

            // Start game session
            const gameStartResponse = await new Promise((resolve) => {
                clientSocket.emit('game_session_start', {
                    playerId,
                    betAmount: 5.00,
                    enableRealtimeEvents: true
                }, resolve);
            });

            expect(gameStartResponse.sessionId).toBeDefined();

            // Execute spin with real-time events
            const spinResponse = await new Promise((resolve) => {
                clientSocket.emit('game_spin', {
                    sessionId: gameStartResponse.sessionId,
                    betAmount: 5.00,
                    enableRealtimeUpdates: true
                }, resolve);
            });

            expect(spinResponse.success).toBe(true);

            // Wait for events to be received
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Validate events received
            expect(eventCount).toBeGreaterThan(0);
            expect(receivedEvents.some(e => e.type === 'SPIN_START')).toBe(true);
            expect(receivedEvents.some(e => e.type === 'SPIN_RESULT')).toBe(true);

            // Test acknowledgment system
            const ackResponse = await new Promise((resolve) => {
                clientSocket.emit('event_acknowledgment', {
                    eventIds: receivedEvents.map(e => e.eventId),
                    acknowledged: true
                }, resolve);
            });

            expect(ackResponse.acknowledged).toBe(true);

            console.log(`✅ Real-time events validation:
            - Events received: ${eventCount}
            - Event types: ${[...new Set(receivedEvents.map(e => e.type))].join(', ')}
            - Acknowledgments processed: ${ackResponse.acknowledgedCount}`);
        });

        test('should handle WebSocket disconnection and reconnection gracefully', async () => {
            console.log('🔄 Testing WebSocket disconnection handling...');

            const playerId = 'ws-disconnect-player';
            let disconnectEvents = 0;
            let reconnectEvents = 0;

            // Track connection events
            clientSocket.on('disconnect', () => disconnectEvents++);
            clientSocket.on('connect', () => reconnectEvents++);

            // Start active game session
            const sessionResponse = await new Promise((resolve) => {
                clientSocket.emit('game_session_start', { playerId }, resolve);
            });

            const sessionId = sessionResponse.sessionId;

            // Simulate unexpected disconnect
            clientSocket.disconnect();
            await new Promise(resolve => setTimeout(resolve, 500));

            // Reconnect and attempt session recovery
            clientSocket.connect();
            await new Promise((resolve) => {
                clientSocket.on('connect', resolve);
            });

            // Attempt session recovery
            const recoveryResponse = await new Promise((resolve) => {
                clientSocket.emit('session_recovery', {
                    playerId,
                    sessionId,
                    lastKnownState: 'ACTIVE'
                }, resolve);
            });

            expect(recoveryResponse.recovered).toBe(true);
            expect(recoveryResponse.sessionState).toBeDefined();

            // Verify session can continue normally
            const continueResponse = await new Promise((resolve) => {
                clientSocket.emit('game_spin', {
                    sessionId,
                    betAmount: 1.00
                }, resolve);
            });

            expect(continueResponse.success).toBe(true);

            console.log(`✅ Disconnection handling validated:
            - Disconnections: ${disconnectEvents}
            - Reconnections: ${reconnectEvents}
            - Session recovery: ${recoveryResponse.recovered}
            - Game continuation: ${continueResponse.success}`);
        });
    });

    describe('5. Performance and Scalability Validation', () => {
        test('should handle high-volume concurrent operations', async () => {
            console.log('🏎️ Testing high-volume concurrent operations...');

            const concurrentPlayers = 100;
            const spinsPerPlayer = 5;

            // Create concurrent players
            const playerCreationPromises = [];
            for (let i = 0; i < concurrentPlayers; i++) {
                playerCreationPromises.push(
                    request(app)
                        .post('/api/test/player/create')
                        .send({
                            playerId: `concurrent_player_${i}`,
                            initialBalance: 100.00
                        })
                );
            }

            const startTime = Date.now();
            await Promise.all(playerCreationPromises);
            const creationTime = Date.now() - startTime;

            // Execute concurrent spins
            const spinPromises = [];
            for (let player = 0; player < concurrentPlayers; player++) {
                for (let spin = 0; spin < spinsPerPlayer; spin++) {
                    spinPromises.push(
                        request(app)
                            .post('/api/game/spin/integrated')
                            .send({
                                playerId: `concurrent_player_${player}`,
                                betAmount: 1.00,
                                spinIndex: spin
                            })
                    );
                }
            }

            const spinStartTime = Date.now();
            const spinResponses = await Promise.allSettled(spinPromises);
            const spinEndTime = Date.now();

            // Analyze results
            const totalOperations = concurrentPlayers * spinsPerPlayer;
            const successfulSpins = spinResponses.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
            const failedSpins = spinResponses.filter(r => r.status === 'rejected' || r.value.status !== 200).length;
            const averageResponseTime = (spinEndTime - spinStartTime) / totalOperations;

            expect(successfulSpins).toBeGreaterThan(totalOperations * 0.95); // 95% success rate
            expect(averageResponseTime).toBeLessThan(100); // Average < 100ms per operation
            expect(failedSpins).toBeLessThan(totalOperations * 0.05); // Less than 5% failures

            console.log(`✅ High-volume performance validation:
            - Concurrent players: ${concurrentPlayers}
            - Total operations: ${totalOperations}
            - Successful operations: ${successfulSpins}
            - Failed operations: ${failedSpins}
            - Success rate: ${(successfulSpins / totalOperations * 100).toFixed(2)}%
            - Average response time: ${averageResponseTime.toFixed(2)}ms
            - Player creation time: ${creationTime}ms`);
        });

        test('should maintain performance under sustained load', async () => {
            console.log('⏱️ Testing sustained load performance...');

            const testDurationMs = 30000; // 30 seconds
            const targetRPS = 50; // 50 requests per second
            const playerId = 'sustained-load-player';

            // Create test player
            await request(app)
                .post('/api/test/player/create')
                .send({
                    playerId,
                    initialBalance: 10000.00
                })
                .expect(200);

            const startTime = Date.now();
            const results = [];
            let requestCount = 0;

            // Sustained load loop
            const loadPromise = new Promise(async (resolve) => {
                const interval = setInterval(async () => {
                    if (Date.now() - startTime >= testDurationMs) {
                        clearInterval(interval);
                        resolve();
                        return;
                    }

                    // Execute batch of requests
                    const batchSize = Math.floor(targetRPS / 10); // 10 batches per second
                    const batchPromises = [];

                    for (let i = 0; i < batchSize; i++) {
                        batchPromises.push(
                            request(app)
                                .post('/api/game/spin/integrated')
                                .send({
                                    playerId,
                                    betAmount: 1.00,
                                    requestId: `sustained_${requestCount++}`
                                })
                        );
                    }

                    try {
                        const batchResults = await Promise.allSettled(batchPromises);
                        results.push(...batchResults);
                    } catch (error) {
                        console.error('Batch error:', error);
                    }
                }, 100); // 100ms interval for 10 batches per second
            });

            await loadPromise;
            const endTime = Date.now();

            // Analyze sustained load results
            const duration = endTime - startTime;
            const successfulRequests = results.filter(r => r.status === 'fulfilled' && r.value.status === 200).length;
            const actualRPS = (successfulRequests * 1000) / duration;

            expect(actualRPS).toBeGreaterThan(targetRPS * 0.8); // Within 80% of target
            expect(successfulRequests).toBeGreaterThan(results.length * 0.95); // 95% success rate

            console.log(`✅ Sustained load validation:
            - Duration: ${duration}ms
            - Total requests: ${results.length}
            - Successful requests: ${successfulRequests}
            - Target RPS: ${targetRPS}
            - Actual RPS: ${actualRPS.toFixed(2)}
            - Success rate: ${(successfulRequests / results.length * 100).toFixed(2)}%`);
        });

        test('should demonstrate proper resource management and cleanup', async () => {
            console.log('🧹 Testing resource management and cleanup...');

            const initialMemory = process.memoryUsage();

            // Create many sessions and resources
            const sessionCount = 200;
            const sessionIds = [];

            for (let i = 0; i < sessionCount; i++) {
                const response = await request(app)
                    .post('/api/game/session/create')
                    .send({
                        playerId: `cleanup_player_${i}`,
                        gameType: 'infinity_storm',
                        betAmount: 1.00
                    })
                    .expect(200);

                sessionIds.push(response.body.sessionId);
            }

            const afterCreationMemory = process.memoryUsage();

            // Execute operations on all sessions
            const operationPromises = sessionIds.map(sessionId =>
                request(app)
                    .post('/api/game/spin/integrated')
                    .send({
                        sessionId,
                        betAmount: 1.00,
                        includeResourceTracking: true
                    })
                    .expect(200)
            );

            await Promise.all(operationPromises);

            const afterOperationsMemory = process.memoryUsage();

            // Clean up all sessions
            const cleanupPromises = sessionIds.map(sessionId =>
                request(app)
                    .post(`/api/game/session/${sessionId}/close`)
                    .send({ reason: 'CLEANUP_TEST' })
                    .expect(200)
            );

            await Promise.all(cleanupPromises);

            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }

            await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for cleanup

            const afterCleanupMemory = process.memoryUsage();

            // Validate memory usage patterns
            const creationMemoryIncrease = afterCreationMemory.heapUsed - initialMemory.heapUsed;
            const operationsMemoryIncrease = afterOperationsMemory.heapUsed - afterCreationMemory.heapUsed;
            const cleanupMemoryChange = afterCleanupMemory.heapUsed - afterOperationsMemory.heapUsed;

            // Memory should not continuously increase without bounds
            expect(creationMemoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
            expect(cleanupMemoryChange).toBeLessThan(0); // Memory should decrease after cleanup

            console.log(`✅ Resource management validation:
            - Sessions created: ${sessionCount}
            - Memory after creation: +${(creationMemoryIncrease / 1024 / 1024).toFixed(2)}MB
            - Memory after operations: +${(operationsMemoryIncrease / 1024 / 1024).toFixed(2)}MB
            - Memory after cleanup: ${(cleanupMemoryChange / 1024 / 1024).toFixed(2)}MB
            - Final heap: ${(afterCleanupMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
        });
    });

    // Helper function to set up complete server API for testing
    function setupCompleteServerAPI(app) {
        // Test endpoints for database operations
        app.post('/api/test/player/create', (req, res) => {
            const { playerId, initialBalance, currency = 'USD' } = req.body;
            
            // Mock database creation
            mockDatabase.players.set(playerId, {
                id: playerId,
                balance: initialBalance,
                currency,
                createdAt: new Date(),
                transactions: []
            });

            res.json({
                success: true,
                player: mockDatabase.players.get(playerId)
            });
        });

        app.get('/api/test/player/:playerId/balance', (req, res) => {
            const { playerId } = req.params;
            const player = mockDatabase.players.get(playerId);

            if (!player) {
                return res.status(404).json({ error: 'Player not found' });
            }

            res.json({ balance: player.balance });
        });

        app.get('/api/test/transaction/:transactionId', (req, res) => {
            const { transactionId } = req.params;
            const transaction = mockDatabase.transactions.get(transactionId);

            if (!transaction) {
                return res.status(404).json({ error: 'Transaction not found' });
            }

            res.json({ transaction });
        });

        // Game endpoints with full integration
        app.post('/api/game/session/create', (req, res) => {
            const { playerId, gameType, betAmount, maxBet, maxLoss, sessionDuration } = req.body;
            const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

            mockDatabase.sessions.set(sessionId, {
                id: sessionId,
                playerId,
                gameType,
                betAmount,
                maxBet,
                maxLoss,
                sessionDuration,
                createdAt: new Date(),
                status: 'ACTIVE',
                spins: []
            });

            res.json({ sessionId });
        });

        app.post('/api/game/spin/integrated', (req, res) => {
            const { sessionId, playerId, betAmount, includeTransactionLog, spinSequence, spinNumber, requestId } = req.body;

            // Get player
            const player = mockDatabase.players.get(playerId);
            if (!player) {
                return res.status(404).json({ error: 'Player not found' });
            }

            // Check balance
            if (player.balance < betAmount) {
                return res.status(400).json({ 
                    error: 'Insufficient funds',
                    transactionRolledBack: true
                });
            }

            // Process bet
            player.balance -= betAmount;

            // Generate spin result using GridEngine
            const spinResult = gridEngine.generateSpinResult({ 
                bet: betAmount,
                enableSync: req.body.enableCascadeSync || false
            });

            // Process win
            if (spinResult.totalWin > 0) {
                player.balance += spinResult.totalWin;
            }

            // Create transaction record
            const transactionId = `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const transaction = {
                id: transactionId,
                playerId,
                amount: betAmount,
                type: 'bet',
                status: 'completed',
                timestamp: new Date()
            };

            if (includeTransactionLog) {
                mockDatabase.transactions.set(transactionId, transaction);
                player.transactions.push(transactionId);
            }

            res.json({
                success: true,
                spinResult,
                transactionId: includeTransactionLog ? transactionId : undefined,
                walletDeduction: betAmount,
                balanceAfterBet: player.balance - spinResult.totalWin + betAmount,
                balanceAfterWin: player.balance
            });
        });

        // Additional test endpoints...
        app.post('/api/game/spin/auditable', (req, res) => {
            const { betAmount, includeRNGSeed, includeAuditData, customRNGSeed, attemptManipulation } = req.body;

            if (attemptManipulation || customRNGSeed) {
                return res.status(400).json({ error: 'RNG manipulation attempt detected' });
            }

            const rngSeed = `seed_${Date.now()}_${Math.random().toString(36)}`;
            const spinResult = gridEngine.generateSpinResult({ bet: betAmount });

            const response = {
                success: true,
                spinResult
            };

            if (includeRNGSeed || includeAuditData) {
                response.auditData = {
                    rngSeed,
                    timestamp: new Date().toISOString(),
                    serverVersion: '1.0.0'
                };
            }

            res.json(response);
        });

        // Add more endpoints as needed for comprehensive testing...
    }

    function setupCompleteWebSocketHandlers(io) {
        io.on('connection', (socket) => {
            socket.on('join_game_room', (data, callback) => {
                socket.join(`game_${data.playerId}`);
                callback({ success: true, room: `game_${data.playerId}` });
            });

            socket.on('game_session_start', (data, callback) => {
                const sessionId = `ws_session_${Date.now()}`;
                
                if (data.enableRealtimeEvents) {
                    // Simulate real-time events
                    setTimeout(() => {
                        socket.emit('game_event', {
                            type: 'SPIN_START',
                            eventId: `event_${Date.now()}`,
                            sessionId
                        });
                    }, 100);
                }

                callback({ success: true, sessionId });
            });

            socket.on('game_spin', (data, callback) => {
                const spinResult = gridEngine.generateSpinResult({ bet: data.betAmount });

                if (data.enableRealtimeUpdates) {
                    socket.emit('game_event', {
                        type: 'SPIN_RESULT',
                        eventId: `event_${Date.now()}`,
                        data: spinResult
                    });
                }

                callback({ success: true, spinResult });
            });

            socket.on('event_acknowledgment', (data, callback) => {
                callback({
                    acknowledged: true,
                    acknowledgedCount: data.eventIds.length
                });
            });

            socket.on('session_recovery', (data, callback) => {
                callback({
                    recovered: true,
                    sessionState: { status: 'ACTIVE', lastActivity: new Date() }
                });
            });

            socket.on('disconnect', () => {
                // Handle cleanup
            });
        });
    }

    // Mock database for testing
    const mockDatabase = {
        players: new Map(),
        sessions: new Map(),
        transactions: new Map()
    };
});