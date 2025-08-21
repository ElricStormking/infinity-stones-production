/**
 * CascadeSynchronizer.test.js - Task 2.4.2: Test CascadeSynchronizer service integration
 * 
 * Comprehensive test suite for the CascadeSynchronizer service.
 * Tests real-time synchronization, client-server validation, and recovery mechanisms.
 */

const CascadeSynchronizer = require('../../src/services/CascadeSynchronizer');
const GameSession = require('../../src/models/GameSession');
const SpinResult = require('../../src/models/SpinResult');
const CascadeStep = require('../../src/models/CascadeStep');

describe('CascadeSynchronizer Service Integration', () => {
    let cascadeSynchronizer;
    let mockGameSession;
    let mockSocketManager;
    let mockCascadeSequence;
    
    beforeEach(() => {
        // Mock socket manager
        mockSocketManager = {
            sendToPlayer: jest.fn().mockResolvedValue(true),
            players: new Map()
        };
        
        // Mock game session
        mockGameSession = new GameSession('test-session', 'test-player');
        
        // Create cascade synchronizer
        cascadeSynchronizer = new CascadeSynchronizer(mockGameSession, mockSocketManager);
        
        // Mock cascade sequence
        mockCascadeSequence = {
            initial_grid: [
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
            ],
            cascades: [
                {
                    cascade_index: 0,
                    pre_cascade_grid: [
                        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
                    ],
                    post_cascade_grid: [
                        ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem'],
                        ['soul_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem']
                    ],
                    winning_clusters: [
                        {
                            symbol: 'time_gem',
                            positions: [
                                { col: 0, row: 0 }, { col: 0, row: 1 }, { col: 0, row: 2 },
                                { col: 0, row: 3 }, { col: 0, row: 4 }, { col: 1, row: 0 },
                                { col: 1, row: 1 }, { col: 1, row: 2 }
                            ]
                        }
                    ],
                    symbol_movements: [
                        {
                            movement_type: 'drop',
                            from_position: { col: 0, row: -1 },
                            to_position: { col: 0, row: 0 }
                        }
                    ],
                    timing_data: {
                        win_highlight_duration: 1000,
                        symbol_removal_duration: 500,
                        drop_phase_duration: 800,
                        settle_phase_duration: 400
                    }
                }
            ]
        };
    });
    
    afterEach(() => {
        cascadeSynchronizer.cleanup();
    });
    
    // ===========================================
    // Task 2.4.2: CascadeSynchronizer Tests
    // ===========================================
    
    describe('Cascade Synchronization Initialization', () => {
        test('should initiate cascade sync successfully', async () => {
            // Mock acknowledgment mechanism
            setTimeout(() => {
                cascadeSynchronizer.emit('clientAcknowledment', {
                    sessionId: 'mock-session-id',
                    ackType: 'initialization'
                });
            }, 100);
            
            const result = await cascadeSynchronizer.initiateCascadeSync(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            expect(result.success).toBe(true);
            expect(result.sessionId).toBeDefined();
            expect(result.totalSteps).toBe(4); // 1 cascade * 4 phases
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalled();
        });
        
        test('should create sync session with proper structure', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            expect(syncSession.id).toBeDefined();
            expect(syncSession.spinId).toBe('test-spin-123');
            expect(syncSession.playerId).toBe('test-player');
            expect(syncSession.cascadeSequence).toBe(mockCascadeSequence);
            expect(syncSession.currentCascadeIndex).toBe(0);
            expect(syncSession.currentPhase).toBe('initialization');
            expect(syncSession.acknowledgments).toBeDefined();
            expect(syncSession.performanceData).toBeDefined();
        });
        
        test('should generate secure validation data', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            // Mock acknowledgment
            setTimeout(() => {
                cascadeSynchronizer.emit('clientAcknowledment', {
                    sessionId: syncSession.id,
                    ackType: 'initialization'
                });
            }, 100);
            
            await cascadeSynchronizer.initializeValidationProtocol(syncSession);
            
            expect(syncSession.validationSalt).toBeDefined();
            expect(syncSession.validationSalt).toHaveLength(32); // 16 bytes * 2 hex chars
            expect(syncSession.syncSeed).toBeDefined();
            expect(syncSession.syncSeed).toHaveLength(64); // 32 bytes * 2 hex chars
            expect(syncSession.checkpoints).toHaveLength(1);
        });
    });
    
    describe('Step-by-Step Acknowledgment System', () => {
        test('should process cascade phases with acknowledgments', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const cascade = mockCascadeSequence.cascades[0];
            
            // Mock acknowledgments for all phases
            const phases = ['win_highlight', 'symbol_removal', 'symbol_drop', 'symbol_settle'];
            let ackCount = 0;
            
            const mockAcknowledgments = () => {
                phases.forEach((phase, index) => {
                    setTimeout(() => {
                        cascadeSynchronizer.emit('clientAcknowledment', {
                            sessionId: syncSession.id,
                            ackType: `phase_start_${phase}`
                        });
                    }, (index * 4 + 1) * 50);
                    
                    setTimeout(() => {
                        cascadeSynchronizer.emit('clientAcknowledment', {
                            sessionId: syncSession.id,
                            ackType: `phase_complete_${phase}`,
                            clientHash: 'mock-hash',
                            timestamp: Date.now()
                        });
                    }, (index * 4 + 3) * 50);
                    
                    setTimeout(() => {
                        cascadeSynchronizer.emit('clientAcknowledment', {
                            sessionId: syncSession.id,
                            ackType: `validation_mock-checkpoint-${index}`,
                            clientHash: cascadeSynchronizer.generateValidationHash(
                                cascadeSynchronizer.calculateExpectedState(cascade, phase),
                                syncSession.validationSalt || 'test-salt'
                            ),
                            timestamp: Date.now()
                        });
                    }, (index * 4 + 4) * 50);
                });
            };
            
            syncSession.validationSalt = 'test-salt';
            mockAcknowledgments();
            
            await cascadeSynchronizer.processCascadeWithAcknowledgments(syncSession, cascade);
            
            expect(syncSession.performanceData.stepTimings.length).toBeGreaterThan(0);
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledTimes(phases.length * 2); // phase_start + state_validation for each phase
        });
        
        test('should handle acknowledgment timeouts', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            // Set short timeout for testing
            cascadeSynchronizer.config.stepTimeout = 100;
            
            try {
                await cascadeSynchronizer.waitForAcknowledment(syncSession, 'test_ack', 100);
                fail('Should have thrown timeout error');
            } catch (error) {
                expect(error.message).toContain('Acknowledgment timeout');
            }
        });
        
        test('should track performance metrics during processing', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const startTime = Date.now();
            
            // Mock quick acknowledgment
            setTimeout(() => {
                cascadeSynchronizer.emit('clientAcknowledment', {
                    sessionId: syncSession.id,
                    ackType: 'test_timing'
                });
            }, 50);
            
            await cascadeSynchronizer.waitForAcknowledment(syncSession, 'test_timing', 1000);
            
            expect(syncSession.acknowledgments.has('test_timing')).toBe(true);
            expect(syncSession.acknowledgments.get('test_timing').timestamp).toBeGreaterThan(startTime);
        });
    });
    
    describe('Desynchronization Detection', () => {
        test('should detect hash mismatches', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const expectedHash = 'correct-hash';
            const clientResponse = {
                clientHash: 'wrong-hash',
                timestamp: Date.now()
            };
            
            const isDesync = await cascadeSynchronizer.detectDesynchronization(
                syncSession, expectedHash, clientResponse
            );
            
            expect(isDesync).toBe(true);
        });
        
        test('should detect timing desyncs', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            cascadeSynchronizer.config.verificationTolerance = 100;
            
            const expectedHash = 'test-hash';
            const clientResponse = {
                clientHash: 'test-hash',
                timestamp: Date.now() - 500 // 500ms ago
            };
            
            const isDesync = await cascadeSynchronizer.detectDesynchronization(
                syncSession, expectedHash, clientResponse
            );
            
            expect(isDesync).toBe(true);
        });
        
        test('should pass validation with correct data', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const expectedHash = 'test-hash';
            const clientResponse = {
                clientHash: 'test-hash',
                timestamp: Date.now()
            };
            
            const isDesync = await cascadeSynchronizer.detectDesynchronization(
                syncSession, expectedHash, clientResponse
            );
            
            expect(isDesync).toBe(false);
        });
    });
    
    describe('Recovery Mechanisms', () => {
        test('should determine appropriate recovery strategy', () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const cascade = mockCascadeSequence.cascades[0];
            
            // Test different recovery attempt counts
            syncSession.recoveryAttempts = 1;
            expect(cascadeSynchronizer.determineRecoveryStrategy(syncSession, cascade, 'win_highlight'))
                .toBe('state_resync');
            
            syncSession.recoveryAttempts = 2;
            expect(cascadeSynchronizer.determineRecoveryStrategy(syncSession, cascade, 'win_highlight'))
                .toBe('phase_replay');
            
            syncSession.recoveryAttempts = 3;
            expect(cascadeSynchronizer.determineRecoveryStrategy(syncSession, cascade, 'win_highlight'))
                .toBe('cascade_replay');
            
            syncSession.recoveryAttempts = 4;
            expect(cascadeSynchronizer.determineRecoveryStrategy(syncSession, cascade, 'win_highlight'))
                .toBe('graceful_skip');
        });
        
        test('should execute state resync recovery', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const cascade = mockCascadeSequence.cascades[0];
            
            // Mock acknowledgment
            setTimeout(() => {
                cascadeSynchronizer.emit('clientAcknowledment', {
                    sessionId: syncSession.id,
                    ackType: 'resync_complete'
                });
            }, 100);
            
            await cascadeSynchronizer.executeStateResync(syncSession, cascade, 'win_highlight');
            
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledWith(
                'test-player',
                'recovery_state_resync',
                expect.objectContaining({
                    sessionId: syncSession.id,
                    recoveryType: 'state_resync'
                })
            );
        });
        
        test('should execute graceful skip recovery', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const cascade = mockCascadeSequence.cascades[0];
            
            // Mock acknowledgment
            setTimeout(() => {
                cascadeSynchronizer.emit('clientAcknowledment', {
                    sessionId: syncSession.id,
                    ackType: 'skip_complete'
                });
            }, 100);
            
            await cascadeSynchronizer.executeGracefulSkip(syncSession, cascade, 'win_highlight');
            
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledWith(
                'test-player',
                'recovery_graceful_skip',
                expect.objectContaining({
                    sessionId: syncSession.id,
                    recoveryType: 'graceful_skip',
                    message: 'Synchronizing...'
                })
            );
        });
        
        test('should limit recovery attempts', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const cascade = mockCascadeSequence.cascades[0];
            syncSession.recoveryAttempts = cascadeSynchronizer.config.maxRecoveryAttempts + 1;
            
            try {
                await cascadeSynchronizer.handleDesynchronization(
                    syncSession, cascade, 'win_highlight', null
                );
                fail('Should have thrown max attempts error');
            } catch (error) {
                expect(error.message).toContain('Maximum recovery attempts exceeded');
            }
        });
    });
    
    describe('Performance Monitoring', () => {
        test('should calculate performance scores', () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            // Add some performance data
            syncSession.performanceData.validationResults = [
                { status: 'success' },
                { status: 'success' },
                { status: 'failed' }
            ];
            syncSession.performanceData.recoveryEvents = [
                { type: 'desync_detected' }
            ];
            
            const score = cascadeSynchronizer.calculatePerformanceScore(syncSession);
            
            expect(score).toBeGreaterThan(0);
            expect(score).toBeLessThan(100); // Should be penalized for failures and recovery
        });
        
        test('should track step timings', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const cascade = mockCascadeSequence.cascades[0];
            
            await cascadeSynchronizer.sendPhaseStart(syncSession, cascade, 'win_highlight');
            
            expect(syncSession.performanceData.stepTimings).toHaveLength(1);
            expect(syncSession.performanceData.stepTimings[0]).toMatchObject({
                cascadeIndex: 0,
                phase: 'win_highlight',
                type: 'phase_start'
            });
        });
        
        test('should handle slow phases with warnings', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            const cascade = mockCascadeSequence.cascades[0];
            const elapsedTime = 5000; // 5 seconds
            
            await cascadeSynchronizer.handleSlowPhase(syncSession, cascade, 'win_highlight', elapsedTime);
            
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledWith(
                'test-player',
                'performance_warning',
                expect.objectContaining({
                    type: 'slow_phase',
                    elapsedTime: 5000
                })
            );
        });
    });
    
    describe('Session Management', () => {
        test('should complete cascade sequences successfully', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            cascadeSynchronizer.activeSessions.set('test-spin-123', syncSession);
            
            await cascadeSynchronizer.completeCascadeSequence(syncSession);
            
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledWith(
                'test-player',
                'cascade_sequence_complete',
                expect.objectContaining({
                    sessionId: syncSession.id,
                    spinId: 'test-spin-123'
                })
            );
            
            expect(cascadeSynchronizer.activeSessions.has('test-spin-123')).toBe(false);
        });
        
        test('should handle sync failures gracefully', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            cascadeSynchronizer.activeSessions.set('test-spin-123', syncSession);
            
            await cascadeSynchronizer.handleSyncFailure(
                'test-spin-123',
                'test_failure',
                new Error('Test error')
            );
            
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledWith(
                'test-player',
                'cascade_sync_failed',
                expect.objectContaining({
                    spinId: 'test-spin-123',
                    reason: 'test_failure'
                })
            );
            
            expect(cascadeSynchronizer.activeSessions.has('test-spin-123')).toBe(false);
        });
        
        test('should clean up resources properly', () => {
            const syncSession1 = cascadeSynchronizer.createSyncSession(
                'spin-1', 'player-1', mockCascadeSequence
            );
            const syncSession2 = cascadeSynchronizer.createSyncSession(
                'spin-2', 'player-2', mockCascadeSequence
            );
            
            cascadeSynchronizer.activeSessions.set('spin-1', syncSession1);
            cascadeSynchronizer.activeSessions.set('spin-2', syncSession2);
            
            cascadeSynchronizer.cleanup();
            
            expect(cascadeSynchronizer.activeSessions.size).toBe(0);
            expect(cascadeSynchronizer.acknowledgments.size).toBe(0);
        });
    });
    
    describe('Validation Hash System', () => {
        test('should generate consistent validation hashes', () => {
            const data = { test: 'data' };
            const salt = 'test-salt';
            
            const hash1 = cascadeSynchronizer.generateValidationHash(data, salt);
            const hash2 = cascadeSynchronizer.generateValidationHash(data, salt);
            
            expect(hash1).toBe(hash2);
            expect(hash1).toHaveLength(64); // SHA-256 hex
        });
        
        test('should calculate expected states correctly', () => {
            const cascade = mockCascadeSequence.cascades[0];
            
            const winHighlightState = cascadeSynchronizer.calculateExpectedState(cascade, 'win_highlight');
            const symbolRemovalState = cascadeSynchronizer.calculateExpectedState(cascade, 'symbol_removal');
            const symbolDropState = cascadeSynchronizer.calculateExpectedState(cascade, 'symbol_drop');
            const symbolSettleState = cascadeSynchronizer.calculateExpectedState(cascade, 'symbol_settle');
            
            expect(winHighlightState).toEqual(cascade.pre_cascade_grid);
            expect(symbolSettleState).toEqual(cascade.post_cascade_grid);
            expect(symbolRemovalState).toBeDefined();
            expect(symbolDropState).toBeDefined();
        });
    });
    
    describe('Heartbeat System', () => {
        test('should send heartbeats to client', async () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            await cascadeSynchronizer.sendHeartbeat(syncSession);
            
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledWith(
                'test-player',
                'cascade_heartbeat',
                expect.objectContaining({
                    sessionId: syncSession.id,
                    status: syncSession.status
                })
            );
        });
        
        test('should handle client heartbeat responses', () => {
            const syncSession = cascadeSynchronizer.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            cascadeSynchronizer.activeSessions.set('test-spin-123', syncSession);
            
            const initialHeartbeat = syncSession.lastHeartbeat;
            
            cascadeSynchronizer.emit('clientHeartbeat', {
                spinId: 'test-spin-123'
            });
            
            expect(syncSession.lastHeartbeat).toBeGreaterThan(initialHeartbeat);
        });
    });
    
    describe('Edge Cases and Error Handling', () => {
        test('should handle missing socket manager gracefully', async () => {
            const synchronizerWithoutSocket = new CascadeSynchronizer(mockGameSession, null);
            
            const syncSession = synchronizerWithoutSocket.createSyncSession(
                'test-spin-123',
                'test-player',
                mockCascadeSequence
            );
            
            // Should not throw error
            await synchronizerWithoutSocket.sendToClient('test-player', 'test-event', {});
            
            synchronizerWithoutSocket.cleanup();
        });
        
        test('should handle invalid acknowledgment types', () => {
            cascadeSynchronizer.emit('clientAcknowledment', {
                sessionId: 'invalid-session',
                ackType: 'invalid-type'
            });
            
            // Should not crash - just no handler found
            expect(true).toBe(true);
        });
        
        test('should handle concurrent session operations', async () => {
            const promises = [];
            
            for (let i = 0; i < 5; i++) {
                const session = cascadeSynchronizer.createSyncSession(
                    `spin-${i}`,
                    `player-${i}`,
                    mockCascadeSequence
                );
                
                cascadeSynchronizer.activeSessions.set(`spin-${i}`, session);
                
                promises.push(
                    cascadeSynchronizer.sendHeartbeat(session)
                );
            }
            
            await Promise.all(promises);
            
            expect(mockSocketManager.sendToPlayer).toHaveBeenCalledTimes(5);
        });
    });
});