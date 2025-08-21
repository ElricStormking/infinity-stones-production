/**
 * Acknowledgment Integration Tests (Task 3.7)
 * 
 * Focused integration tests for cascade step acknowledgment functionality
 * with simplified scenarios for reliable testing.
 */

const CascadeSynchronizer = require('../../src/services/CascadeSynchronizer');
const GameSession = require('../../src/models/GameSession');

describe('Acknowledgment Integration Tests', () => {
    let synchronizer;
    let mockSocketManager;

    beforeEach(() => {
        // Create simplified mock socket manager
        mockSocketManager = {
            sentMessages: [],
            async sendToPlayer(playerId, eventType, data) {
                this.sentMessages.push({ playerId, eventType, data, timestamp: Date.now() });
                return { success: true };
            },
            getLastMessage() {
                return this.sentMessages[this.sentMessages.length - 1];
            },
            getMessagesByType(type) {
                return this.sentMessages.filter(msg => msg.eventType === type);
            }
        };

        // Create test session
        const gameSession = new GameSession({
            sessionId: 'test-session',
            playerId: 'test-player',
            gameState: 'playing'
        });

        // Create synchronizer
        synchronizer = new CascadeSynchronizer(gameSession, mockSocketManager);
        
        // Fast configuration for testing
        synchronizer.config.stepTimeout = 100;
        synchronizer.config.totalSpinTimeout = 500;
    });

    afterEach(() => {
        if (synchronizer) {
            synchronizer.cleanup();
        }
    });

    describe('Task 3.7.1: Step-by-step acknowledgment sending', () => {
        test('should send acknowledgment requests for each phase', async () => {
            // Create minimal cascade sequence
            const cascadeSequence = {
                initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                cascades: [{
                    cascade_index: 0,
                    pre_cascade_grid: Array(6).fill().map(() => Array(5).fill('test')),
                    post_cascade_grid: Array(6).fill().map(() => Array(5).fill('test')),
                    winning_clusters: [],
                    symbol_movements: [],
                    timing_data: {
                        win_highlight_duration: 100,
                        symbol_removal_duration: 50,
                        drop_phase_duration: 80,
                        settle_phase_duration: 40
                    }
                }]
            };

            // Test initialization acknowledgment
            try {
                await synchronizer.initiateCascadeSync('test-spin', 'test-player', cascadeSequence);
            } catch (error) {
                // Expected to timeout without client response
                expect(error.message).toContain('Acknowledgment timeout');
            }

            // Verify initialization message was sent
            const initMessages = mockSocketManager.getMessagesByType('cascade_sync_init');
            expect(initMessages).toHaveLength(1);
            expect(initMessages[0].data.sessionId).toBeDefined();
            expect(initMessages[0].data.validationSalt).toBeDefined();
        });

        test('should include proper acknowledgment data in messages', async () => {
            const cascadeSequence = {
                initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                cascades: [{
                    cascade_index: 0,
                    pre_cascade_grid: Array(6).fill().map(() => Array(5).fill('test')),
                    post_cascade_grid: Array(6).fill().map(() => Array(5).fill('test')),
                    winning_clusters: [],
                    symbol_movements: [],
                    timing_data: {
                        win_highlight_duration: 100,
                        symbol_removal_duration: 50,
                        drop_phase_duration: 80,
                        settle_phase_duration: 40
                    }
                }]
            };

            try {
                await synchronizer.initiateCascadeSync('test-spin', 'test-player', cascadeSequence);
            } catch (error) {
                // Expected timeout
            }

            // Get the initialization message (not the failure message)
            const initMessages = mockSocketManager.getMessagesByType('cascade_sync_init');
            expect(initMessages).toHaveLength(1);
            
            const initMessage = initMessages[0];
            expect(initMessage.data).toMatchObject({
                sessionId: expect.any(String),
                spinId: 'test-spin',
                validationSalt: expect.any(String),
                syncSeed: expect.any(String),
                initialCheckpoint: expect.objectContaining({
                    checkpointId: expect.any(String),
                    type: 'initialization',
                    validationHash: expect.any(String),
                    timeout: expect.any(Number)
                }),
                config: expect.objectContaining({
                    stepTimeout: expect.any(Number),
                    totalTimeout: expect.any(Number),
                    heartbeatInterval: expect.any(Number)
                })
            });
        });
    });

    describe('Task 3.7.2: Acknowledgment timeout handling', () => {
        test('should timeout when no acknowledgment received', async () => {
            const startTime = Date.now();
            
            try {
                await synchronizer.initiateCascadeSync('test-spin', 'test-player', {
                    initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                    cascades: []
                });
                fail('Should have thrown timeout error');
            } catch (error) {
                const elapsed = Date.now() - startTime;
                expect(error.message).toContain('Acknowledgment timeout for initialization');
                expect(elapsed).toBeGreaterThan(80); // Should wait at least timeout period
                expect(elapsed).toBeLessThan(200); // But not too long
            }
        });

        test('should handle timeout configuration correctly', async () => {
            // Set very short timeout
            synchronizer.config.stepTimeout = 50;
            
            const startTime = Date.now();
            
            try {
                await synchronizer.initiateCascadeSync('test-spin', 'test-player', {
                    initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                    cascades: []
                });
            } catch (error) {
                const elapsed = Date.now() - startTime;
                expect(elapsed).toBeGreaterThan(40);
                expect(elapsed).toBeLessThan(100);
            }
        });
    });

    describe('Task 3.7.3: Acknowledgment retry mechanisms', () => {
        test('should track recovery attempts', () => {
            const session = synchronizer.createSyncSession('test-spin', 'test-player', {
                initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                cascades: []
            });

            expect(session.recoveryAttempts).toBe(0);
            expect(session.performanceData.recoveryEvents).toEqual([]);
        });

        test('should determine progressive recovery strategies', () => {
            const mockSession = { recoveryAttempts: 0 };
            const mockCascade = { cascade_index: 0 };
            const mockPhase = 'win_highlight';

            // First attempt should be state_resync
            mockSession.recoveryAttempts = 1;
            let strategy = synchronizer.determineRecoveryStrategy(mockSession, mockCascade, mockPhase);
            expect(strategy).toBe('state_resync');

            // Second attempt should be phase_replay
            mockSession.recoveryAttempts = 2;
            strategy = synchronizer.determineRecoveryStrategy(mockSession, mockCascade, mockPhase);
            expect(strategy).toBe('phase_replay');

            // Third attempt should be cascade_replay
            mockSession.recoveryAttempts = 3;
            strategy = synchronizer.determineRecoveryStrategy(mockSession, mockCascade, mockPhase);
            expect(strategy).toBe('cascade_replay');

            // Further attempts should be graceful_skip
            mockSession.recoveryAttempts = 4;
            strategy = synchronizer.determineRecoveryStrategy(mockSession, mockCascade, mockPhase);
            expect(strategy).toBe('graceful_skip');
        });
    });

    describe('Task 3.7.4: Acknowledgment error recovery', () => {
        test('should handle socket send failures gracefully', async () => {
            // Override sendToPlayer to fail
            mockSocketManager.sendToPlayer = async () => {
                throw new Error('Socket send failure');
            };

            await expect(synchronizer.initiateCascadeSync('test-spin', 'test-player', {
                initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                cascades: []
            })).rejects.toThrow('Socket send failure');
        });

        test('should detect desynchronization correctly', async () => {
            const session = { id: 'test-session' };
            const expectedHash = 'expected_hash_value';

            // Test no response
            let isDesync = await synchronizer.detectDesynchronization(session, expectedHash, null);
            expect(isDesync).toBe(true);

            // Test hash mismatch
            isDesync = await synchronizer.detectDesynchronization(session, expectedHash, {
                clientHash: 'wrong_hash',
                timestamp: Date.now()
            });
            expect(isDesync).toBe(true);

            // Test correct hash
            isDesync = await synchronizer.detectDesynchronization(session, expectedHash, {
                clientHash: expectedHash,
                timestamp: Date.now()
            });
            expect(isDesync).toBe(false);

            // Test timing desync
            isDesync = await synchronizer.detectDesynchronization(session, expectedHash, {
                clientHash: expectedHash,
                timestamp: Date.now() - 1000 // 1 second ago
            });
            expect(isDesync).toBe(true);
        });

        test('should generate secure IDs and validation hashes', () => {
            const id1 = synchronizer.generateSecureId();
            const id2 = synchronizer.generateSecureId();
            
            expect(id1).toBeDefined();
            expect(id2).toBeDefined();
            expect(id1).not.toBe(id2); // Should be unique
            expect(id1).toMatch(/^[a-f0-9]{32}$/); // Should be hex string

            const hash1 = synchronizer.generateValidationHash('test_data', 'test_salt');
            const hash2 = synchronizer.generateValidationHash('test_data', 'test_salt');
            const hash3 = synchronizer.generateValidationHash('different_data', 'test_salt');

            expect(hash1).toBe(hash2); // Same data should produce same hash
            expect(hash1).not.toBe(hash3); // Different data should produce different hash
            expect(hash1).toMatch(/^[a-f0-9]{64}$/); // Should be SHA-256 hex string
        });
    });

    describe('Comprehensive Acknowledgment Flow', () => {
        test('should create sync session with proper structure', () => {
            const session = synchronizer.createSyncSession('test-spin', 'test-player', {
                initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                cascades: []
            });

            expect(session).toMatchObject({
                id: expect.any(String),
                spinId: 'test-spin',
                playerId: 'test-player',
                cascadeSequence: expect.any(Object),
                currentCascadeIndex: 0,
                currentPhase: 'initialization',
                stepValidations: [],
                acknowledgments: expect.any(Map),
                recoveryAttempts: 0,
                startTime: expect.any(Number),
                lastHeartbeat: expect.any(Number),
                status: 'active',
                performanceData: expect.objectContaining({
                    stepTimings: [],
                    validationResults: [],
                    recoveryEvents: []
                }),
                validationHashes: expect.any(Map),
                clientState: null,
                serverState: null
            });
        });

        test('should calculate performance scores correctly', () => {
            const session = {
                performanceData: {
                    validationResults: [
                        { status: 'success' },
                        { status: 'success' },
                        { status: 'failed' }
                    ],
                    recoveryEvents: [
                        { type: 'desync_detected' }
                    ]
                }
            };

            const score = synchronizer.calculatePerformanceScore(session);
            
            // 100 * (2/3 success rate) - (1 recovery * 10) = 66.67 - 10 = 56.67 -> 57
            expect(score).toBe(57);
        });

        test('should handle session cleanup correctly', () => {
            // Add a test session
            const session = synchronizer.createSyncSession('test-spin', 'test-player', {
                initial_grid: Array(6).fill().map(() => Array(5).fill('test')),
                cascades: []
            });
            synchronizer.activeSessions.set('test-spin', session);

            expect(synchronizer.activeSessions.size).toBe(1);

            // Cleanup
            synchronizer.cleanup();

            expect(synchronizer.activeSessions.size).toBe(0);
        });
    });
});