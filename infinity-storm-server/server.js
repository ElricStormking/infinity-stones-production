const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const GridEngine = require('./game-logic/GridEngine');
const CascadeSynchronizer = require('./src/services/CascadeSynchronizer');
const CascadeValidator = require('./src/services/CascadeValidator');
const GameSession = require('./src/models/GameSession');
const SpinResult = require('./src/models/SpinResult');

// Load environment variables
dotenv.config();

// Initialize game engine and cascade services
const gridEngine = new GridEngine();
const cascadeSynchronizer = new CascadeSynchronizer();
const cascadeValidator = new CascadeValidator();

const app = express();
const server = http.createServer(app);

// CORS configuration
const allowedOrigins = [
    'http://localhost:3000',
    'http://127.0.0.1:3000'
];

app.use(cors({
    origin: allowedOrigins,
    credentials: true
}));

// Disable caching in development so updated assets appear immediately
app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
});

// Socket.io setup
const io = socketIo(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST"],
        credentials: true
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the parent directory (game client)
app.use(express.static(path.join(__dirname, '..')));

// Basic route for health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Infinity Storm Server is running' });
});

// Game API endpoints
app.post('/api/spin', (req, res) => {
    try {
        const { bet = 1.00, quickSpinMode = false, freeSpinsActive = false, accumulatedMultiplier = 1 } = req.body;
        
        console.log(`🎰 Spin request: bet=$${bet}, quickSpin=${quickSpinMode}, freeSpins=${freeSpinsActive}, multiplier=${accumulatedMultiplier}x`);
        
        // Generate complete spin result using GridEngine
        const spinResult = gridEngine.generateSpinResult({
            bet: parseFloat(bet),
            quickSpinMode: Boolean(quickSpinMode),
            freeSpinsActive: Boolean(freeSpinsActive),
            accumulatedMultiplier: parseFloat(accumulatedMultiplier)
        });

        if (spinResult.success) {
            console.log(`✅ Spin ${spinResult.spinId}: ${spinResult.cascades.length} cascades, $${spinResult.totalWin} win, ${spinResult.totalSpinDuration}ms duration`);
        } else {
            console.error(`❌ Spin failed: ${spinResult.errorMessage}`);
        }

        res.json(spinResult);
    } catch (error) {
        console.error('Spin error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'SPIN_GENERATION_FAILED',
            errorMessage: 'Internal server error'
        });
    }
});

// 4.1.1: Cascade synchronization endpoints
app.post('/api/cascade/sync/start', async (req, res) => {
    try {
        const { spinId, playerId, gridState } = req.body;
        
        if (!spinId || !playerId || !gridState) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'spinId, playerId, and gridState are required'
            });
        }

        // Create or get game session
        const gameSession = new GameSession(playerId);
        
        // Start sync session
        const syncSession = await cascadeSynchronizer.startSyncSession(spinId, gameSession, {
            initialGridState: gridState,
            clientTimestamp: Date.now()
        });

        res.json({
            success: true,
            syncSessionId: syncSession.syncSessionId,
            validationSalt: syncSession.validationSalt,
            syncSeed: syncSession.syncSeed,
            serverTimestamp: syncSession.serverTimestamp
        });
    } catch (error) {
        console.error('Cascade sync start error:', error);
        res.status(500).json({
            success: false,
            error: 'SYNC_START_FAILED',
            errorMessage: 'Failed to start cascade synchronization'
        });
    }
});

app.post('/api/cascade/sync/step', async (req, res) => {
    try {
        const { syncSessionId, stepIndex, gridState, clientHash, clientTimestamp } = req.body;
        
        if (!syncSessionId || stepIndex === undefined || !gridState) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'syncSessionId, stepIndex, and gridState are required'
            });
        }

        // Process step acknowledgment
        const acknowledgment = await cascadeSynchronizer.processStepAcknowledgment(syncSessionId, {
            stepIndex,
            gridState,
            clientHash,
            clientTimestamp,
            serverTimestamp: Date.now()
        });

        res.json({
            success: true,
            stepValidated: acknowledgment.validated,
            serverHash: acknowledgment.serverHash,
            nextStepData: acknowledgment.nextStepData,
            syncStatus: acknowledgment.syncStatus
        });
    } catch (error) {
        console.error('Cascade sync step error:', error);
        res.status(500).json({
            success: false,
            error: 'SYNC_STEP_FAILED',
            errorMessage: 'Failed to process cascade step'
        });
    }
});

app.post('/api/cascade/sync/complete', async (req, res) => {
    try {
        const { syncSessionId, finalGridState, totalWin, clientHash } = req.body;
        
        if (!syncSessionId || !finalGridState) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'syncSessionId and finalGridState are required'
            });
        }

        // Complete sync session
        const completion = await cascadeSynchronizer.completeSyncSession(syncSessionId, {
            finalGridState,
            totalWin,
            clientHash,
            clientTimestamp: Date.now()
        });

        res.json({
            success: true,
            validated: completion.validated,
            performanceScore: completion.performanceScore,
            totalSteps: completion.totalSteps,
            serverTimestamp: completion.serverTimestamp
        });
    } catch (error) {
        console.error('Cascade sync complete error:', error);
        res.status(500).json({
            success: false,
            error: 'SYNC_COMPLETE_FAILED',
            errorMessage: 'Failed to complete cascade synchronization'
        });
    }
});

// 4.1.2: Validation request handlers
app.post('/api/cascade/validate/grid', async (req, res) => {
    try {
        const { gridState, expectedHash, salt } = req.body;
        
        if (!gridState) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'gridState is required'
            });
        }

        // Validate grid state
        const validation = await cascadeValidator.validateGridState(gridState, { expectedHash, salt });

        res.json({
            success: true,
            valid: validation.valid,
            generatedHash: validation.hash,
            errors: validation.errors,
            fraudScore: validation.fraudScore
        });
    } catch (error) {
        console.error('Grid validation error:', error);
        res.status(500).json({
            success: false,
            error: 'VALIDATION_FAILED',
            errorMessage: 'Failed to validate grid state'
        });
    }
});

app.post('/api/cascade/validate/step', async (req, res) => {
    try {
        const { cascadeStep, previousStep, gameConfig } = req.body;
        
        if (!cascadeStep) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'cascadeStep is required'
            });
        }

        // Validate cascade step
        const validation = await cascadeValidator.validateCascadeStep(cascadeStep, previousStep, gameConfig);

        res.json({
            success: true,
            valid: validation.valid,
            errors: validation.errors,
            fraudDetected: validation.fraudDetected,
            fraudScore: validation.fraudScore
        });
    } catch (error) {
        console.error('Step validation error:', error);
        res.status(500).json({
            success: false,
            error: 'VALIDATION_FAILED',
            errorMessage: 'Failed to validate cascade step'
        });
    }
});

app.post('/api/cascade/validate/sequence', async (req, res) => {
    try {
        const { cascadeSteps, spinResult } = req.body;
        
        if (!cascadeSteps || !Array.isArray(cascadeSteps)) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'cascadeSteps array is required'
            });
        }

        // Validate cascade sequence
        const validation = await cascadeValidator.validateCascadeSequence(cascadeSteps, spinResult);

        res.json({
            success: true,
            valid: validation.valid,
            errors: validation.errors,
            fraudDetected: validation.fraudDetected,
            overallScore: validation.overallScore,
            stepValidations: validation.stepValidations
        });
    } catch (error) {
        console.error('Sequence validation error:', error);
        res.status(500).json({
            success: false,
            error: 'VALIDATION_FAILED',
            errorMessage: 'Failed to validate cascade sequence'
        });
    }
});

// 4.3.3: Timing validation services
app.post('/api/cascade/validate/timing', async (req, res) => {
    try {
        const { timingData, context } = req.body;
        
        if (!timingData) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'timingData is required'
            });
        }

        // Validate timing data
        const validation = await cascadeValidator.validateTiming(timingData, context || {});

        res.json({
            success: true,
            valid: validation.isValid,
            errors: validation.errors,
            warnings: validation.warnings,
            timingAnalysis: {
                stepTimingValid: validation.stepTimingValid,
                sequenceTimingValid: validation.sequenceTimingValid,
                syncTimingValid: validation.syncTimingValid
            }
        });
    } catch (error) {
        console.error('Timing validation error:', error);
        res.status(500).json({
            success: false,
            error: 'TIMING_VALIDATION_FAILED',
            errorMessage: 'Failed to validate timing data'
        });
    }
});

// 4.3.4: Fraud detection endpoints
app.post('/api/cascade/validate/fraud/grid', async (req, res) => {
    try {
        const { gridState } = req.body;
        
        if (!gridState) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'gridState is required'
            });
        }

        // Detect grid fraud
        const fraudAnalysis = cascadeValidator.detectGridFraud(gridState);

        res.json({
            success: true,
            suspicious: fraudAnalysis.suspicious,
            fraudScore: fraudAnalysis.fraudScore,
            warnings: fraudAnalysis.warnings,
            detectionDetails: {
                impossiblePatterns: fraudAnalysis.impossiblePatterns,
                distributionAnalysis: fraudAnalysis.distributionAnalysis,
                patternAnalysis: fraudAnalysis.patternAnalysis
            }
        });
    } catch (error) {
        console.error('Grid fraud detection error:', error);
        res.status(500).json({
            success: false,
            error: 'FRAUD_DETECTION_FAILED',
            errorMessage: 'Failed to analyze grid for fraud'
        });
    }
});

app.post('/api/cascade/validate/fraud/step', async (req, res) => {
    try {
        const { cascadeStep } = req.body;
        
        if (!cascadeStep) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'cascadeStep is required'
            });
        }

        // Detect cascade step fraud
        const fraudAnalysis = cascadeValidator.detectCascadeStepFraud(cascadeStep);

        res.json({
            success: true,
            suspicious: fraudAnalysis.suspicious,
            fraudScore: fraudAnalysis.fraudScore,
            warnings: fraudAnalysis.warnings,
            detectionDetails: {
                matchAnalysis: fraudAnalysis.matchAnalysis,
                payoutAnalysis: fraudAnalysis.payoutAnalysis,
                timingAnalysis: fraudAnalysis.timingAnalysis
            }
        });
    } catch (error) {
        console.error('Step fraud detection error:', error);
        res.status(500).json({
            success: false,
            error: 'FRAUD_DETECTION_FAILED',
            errorMessage: 'Failed to analyze cascade step for fraud'
        });
    }
});

app.post('/api/cascade/validate/fraud/spin', async (req, res) => {
    try {
        const { spinResult, sessionId } = req.body;
        
        if (!spinResult) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'spinResult is required'
            });
        }

        // Get session for context if provided
        let session = null;
        if (sessionId) {
            session = await GameSession.getById(sessionId);
        }

        // Analyze complete spin result for fraud
        const fraudAnalysis = cascadeValidator.analyzeSpinResultFraud(spinResult, session);

        res.json({
            success: true,
            suspicious: fraudAnalysis.suspicious,
            fraudScore: fraudAnalysis.fraudScore,
            warnings: fraudAnalysis.warnings,
            detectionDetails: {
                winRateAnalysis: fraudAnalysis.winRateAnalysis,
                payoutAnalysis: fraudAnalysis.payoutAnalysis,
                cascadeAnalysis: fraudAnalysis.cascadeAnalysis
            }
        });
    } catch (error) {
        console.error('Spin fraud detection error:', error);
        res.status(500).json({
            success: false,
            error: 'FRAUD_DETECTION_FAILED',
            errorMessage: 'Failed to analyze spin result for fraud'
        });
    }
});

app.get('/api/cascade/validate/fraud/stats', async (req, res) => {
    try {
        // Get all fraud detection statistics
        const stats = cascadeValidator.getFraudDetectionStats();

        res.json({
            success: true,
            sessionId: 'all',
            fraudStats: stats,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Fraud stats retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'FRAUD_STATS_FAILED',
            errorMessage: 'Failed to retrieve fraud detection statistics'
        });
    }
});

app.get('/api/cascade/validate/fraud/stats/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        // Get fraud detection statistics for specific session
        const stats = cascadeValidator.getFraudDetectionStats(sessionId);

        if (!stats) {
            return res.status(404).json({
                success: false,
                error: 'SESSION_NOT_FOUND',
                errorMessage: 'No fraud detection statistics found for session'
            });
        }

        res.json({
            success: true,
            sessionId: sessionId,
            fraudStats: stats,
            timestamp: Date.now()
        });
    } catch (error) {
        console.error('Fraud stats retrieval error:', error);
        res.status(500).json({
            success: false,
            error: 'FRAUD_STATS_FAILED',
            errorMessage: 'Failed to retrieve fraud detection statistics'
        });
    }
});

// 4.1.3: Recovery request endpoints
app.post('/api/cascade/recovery/request', async (req, res) => {
    try {
        const { syncSessionId, desyncType, clientState, stepIndex } = req.body;
        
        if (!syncSessionId || !desyncType || !clientState) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'syncSessionId, desyncType, and clientState are required'
            });
        }

        // Request recovery data
        const recovery = await cascadeSynchronizer.requestRecovery(syncSessionId, {
            desyncType,
            clientState,
            stepIndex,
            requestTimestamp: Date.now()
        });

        res.json({
            success: true,
            recoveryType: recovery.recoveryType,
            recoveryData: recovery.recoveryData,
            requiredSteps: recovery.requiredSteps,
            recoveryId: recovery.recoveryId
        });
    } catch (error) {
        console.error('Recovery request error:', error);
        res.status(500).json({
            success: false,
            error: 'RECOVERY_REQUEST_FAILED',
            errorMessage: 'Failed to process recovery request'
        });
    }
});

app.post('/api/cascade/recovery/apply', async (req, res) => {
    try {
        const { recoveryId, clientState, recoveryResult } = req.body;
        
        if (!recoveryId || !clientState) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'recoveryId and clientState are required'
            });
        }

        // Apply recovery and validate result
        const application = await cascadeSynchronizer.applyRecovery(recoveryId, {
            clientState,
            recoveryResult,
            applicationTimestamp: Date.now()
        });

        res.json({
            success: true,
            recoverySuccessful: application.successful,
            syncRestored: application.syncRestored,
            newSyncState: application.newSyncState,
            nextActions: application.nextActions
        });
    } catch (error) {
        console.error('Recovery apply error:', error);
        res.status(500).json({
            success: false,
            error: 'RECOVERY_APPLY_FAILED',
            errorMessage: 'Failed to apply recovery'
        });
    }
});

app.get('/api/cascade/recovery/status/:recoveryId', async (req, res) => {
    try {
        const { recoveryId } = req.params;
        
        if (!recoveryId) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'recoveryId is required'
            });
        }

        // Get recovery status
        const status = await cascadeSynchronizer.getRecoveryStatus(recoveryId);

        res.json({
            success: true,
            status: status.status,
            progress: status.progress,
            estimatedCompletion: status.estimatedCompletion,
            errors: status.errors
        });
    } catch (error) {
        console.error('Recovery status error:', error);
        res.status(500).json({
            success: false,
            error: 'RECOVERY_STATUS_FAILED',
            errorMessage: 'Failed to get recovery status'
        });
    }
});

// 4.1.4: Session management endpoints
app.post('/api/cascade/session/create', async (req, res) => {
    try {
        const { playerId, gameConfig } = req.body;
        
        if (!playerId) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'playerId is required'
            });
        }

        // Create new game session
        const gameSession = new GameSession(playerId, gameConfig);
        await gameSession.initialize();

        res.json({
            success: true,
            sessionId: gameSession.sessionId,
            playerId: gameSession.playerId,
            createdAt: gameSession.createdAt,
            config: gameSession.getPublicConfig()
        });
    } catch (error) {
        console.error('Session create error:', error);
        res.status(500).json({
            success: false,
            error: 'SESSION_CREATE_FAILED',
            errorMessage: 'Failed to create game session'
        });
    }
});

app.get('/api/cascade/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'sessionId is required'
            });
        }

        // Get session data
        const session = await GameSession.getById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'SESSION_NOT_FOUND',
                errorMessage: 'Game session not found'
            });
        }

        res.json({
            success: true,
            sessionId: session.sessionId,
            playerId: session.playerId,
            status: session.status,
            cascadeState: session.getCascadeState(),
            performance: session.getPerformanceMetrics()
        });
    } catch (error) {
        console.error('Session get error:', error);
        res.status(500).json({
            success: false,
            error: 'SESSION_GET_FAILED',
            errorMessage: 'Failed to get game session'
        });
    }
});

app.put('/api/cascade/session/:sessionId/state', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { cascadeState, syncStatus } = req.body;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'sessionId is required'
            });
        }

        // Update session state
        const session = await GameSession.getById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'SESSION_NOT_FOUND',
                errorMessage: 'Game session not found'
            });
        }

        if (cascadeState) {
            session.updateCascadeState(cascadeState);
        }
        if (syncStatus) {
            session.updateSyncStatus(syncStatus);
        }

        await session.save();

        res.json({
            success: true,
            sessionId: session.sessionId,
            updated: true,
            newState: session.getCascadeState()
        });
    } catch (error) {
        console.error('Session update error:', error);
        res.status(500).json({
            success: false,
            error: 'SESSION_UPDATE_FAILED',
            errorMessage: 'Failed to update game session'
        });
    }
});

app.delete('/api/cascade/session/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'INVALID_REQUEST',
                errorMessage: 'sessionId is required'
            });
        }

        // Clean up session
        const session = await GameSession.getById(sessionId);
        if (session) {
            await session.cleanup();
            await session.delete();
        }

        res.json({
            success: true,
            sessionId: sessionId,
            deleted: true
        });
    } catch (error) {
        console.error('Session delete error:', error);
        res.status(500).json({
            success: false,
            error: 'SESSION_DELETE_FAILED',
            errorMessage: 'Failed to delete game session'
        });
    }
});

// Socket.io connection handling with cascade synchronization
io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Enhanced spin request with cascade synchronization support
    socket.on('spin_request', (data) => {
        console.log(`🎰 WebSocket spin request:`, data);
        
        try {
            const { bet = 1.00, quickSpinMode = false, freeSpinsActive = false, accumulatedMultiplier = 1, enableSync = false } = data;
            
            // Generate complete spin result using GridEngine
            const spinResult = gridEngine.generateSpinResult({
                bet: parseFloat(bet),
                quickSpinMode: Boolean(quickSpinMode),
                freeSpinsActive: Boolean(freeSpinsActive),
                accumulatedMultiplier: parseFloat(accumulatedMultiplier)
            });

            if (spinResult.success) {
                console.log(`✅ WebSocket Spin ${spinResult.spinId}: ${spinResult.cascades.length} cascades, $${spinResult.totalWin} win, ${spinResult.totalSpinDuration}ms duration`);
                
                // If cascade sync enabled, prepare sync session data
                if (enableSync) {
                    spinResult.syncEnabled = true;
                    spinResult.validationSalt = cascadeSynchronizer.generateValidationSalt();
                    spinResult.syncSeed = cascadeSynchronizer.generateSyncSeed();
                }
            } else {
                console.error(`❌ WebSocket Spin failed: ${spinResult.errorMessage}`);
            }

            socket.emit('spin_result', spinResult);
        } catch (error) {
            console.error('WebSocket spin error:', error);
            socket.emit('spin_result', {
                success: false,
                error: 'SPIN_GENERATION_FAILED',
                errorMessage: 'Internal server error'
            });
        }
    });

    // Cascade synchronization WebSocket events
    socket.on('cascade_sync_start', async (data) => {
        try {
            const { spinId, playerId, gridState } = data;
            console.log(`🔄 Cascade sync start: ${spinId} for player ${playerId}`);
            
            const gameSession = new GameSession(playerId);
            const syncSession = await cascadeSynchronizer.startSyncSession(spinId, gameSession, {
                initialGridState: gridState,
                clientTimestamp: Date.now(),
                socketId: socket.id
            });
            
            socket.emit('sync_session_start', {
                success: true,
                syncSessionId: syncSession.syncSessionId,
                validationSalt: syncSession.validationSalt,
                syncSeed: syncSession.syncSeed,
                serverTimestamp: syncSession.serverTimestamp
            });
        } catch (error) {
            console.error('WebSocket cascade sync start error:', error);
            socket.emit('sync_session_start', {
                success: false,
                error: 'SYNC_START_FAILED',
                errorMessage: 'Failed to start cascade synchronization'
            });
        }
    });

    socket.on('step_validation_request', async (data) => {
        try {
            const { syncSessionId, stepIndex, gridState, clientHash, clientTimestamp } = data;
            console.log(`✅ Step validation: session ${syncSessionId}, step ${stepIndex}`);
            
            const acknowledgment = await cascadeSynchronizer.processStepAcknowledgment(syncSessionId, {
                stepIndex,
                gridState,
                clientHash,
                clientTimestamp,
                serverTimestamp: Date.now()
            });
            
            socket.emit('step_validation_response', {
                success: true,
                stepIndex,
                stepValidated: acknowledgment.validated,
                serverHash: acknowledgment.serverHash,
                nextStepData: acknowledgment.nextStepData,
                syncStatus: acknowledgment.syncStatus
            });
        } catch (error) {
            console.error('WebSocket step validation error:', error);
            socket.emit('step_validation_response', {
                success: false,
                error: 'STEP_VALIDATION_FAILED',
                errorMessage: 'Failed to validate cascade step'
            });
        }
    });

    socket.on('desync_detected', async (data) => {
        try {
            const { syncSessionId, desyncType, clientState, stepIndex } = data;
            console.log(`⚠️ Desync detected: session ${syncSessionId}, type ${desyncType}, step ${stepIndex}`);
            
            const recovery = await cascadeSynchronizer.requestRecovery(syncSessionId, {
                desyncType,
                clientState,
                stepIndex,
                requestTimestamp: Date.now()
            });
            
            socket.emit('recovery_data', {
                success: true,
                recoveryType: recovery.recoveryType,
                recoveryData: recovery.recoveryData,
                requiredSteps: recovery.requiredSteps,
                recoveryId: recovery.recoveryId
            });
        } catch (error) {
            console.error('WebSocket desync handling error:', error);
            socket.emit('recovery_data', {
                success: false,
                error: 'DESYNC_RECOVERY_FAILED',
                errorMessage: 'Failed to handle desynchronization'
            });
        }
    });

    socket.on('sync_session_complete', async (data) => {
        try {
            const { syncSessionId, finalGridState, totalWin, clientHash } = data;
            console.log(`🏁 Cascade sync complete: session ${syncSessionId}`);
            
            const completion = await cascadeSynchronizer.completeSyncSession(syncSessionId, {
                finalGridState,
                totalWin,
                clientHash,
                clientTimestamp: Date.now()
            });
            
            socket.emit('sync_session_complete', {
                success: true,
                validated: completion.validated,
                performanceScore: completion.performanceScore,
                totalSteps: completion.totalSteps,
                serverTimestamp: completion.serverTimestamp
            });
        } catch (error) {
            console.error('WebSocket sync complete error:', error);
            socket.emit('sync_session_complete', {
                success: false,
                error: 'SYNC_COMPLETE_FAILED',
                errorMessage: 'Failed to complete cascade synchronization'
            });
        }
    });

    // Register socket with cascade synchronizer for real-time updates
    cascadeSynchronizer.registerSocket(socket);

    socket.on('test', (data) => {
        console.log('Test message received:', data);
        socket.emit('test_response', { message: 'Test successful', data: data });
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
        // Clean up any active sync sessions for this socket
        cascadeSynchronizer.unregisterSocket(socket);
    });
});

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

server.listen(PORT, () => {
    console.log(`🎰 Infinity Storm Server running on port ${PORT}`);
    console.log(`🌐 Client URL: ${CLIENT_URL}`);
    console.log(`📡 WebSocket server ready`);
    console.log(`🎮 Game available at: http://localhost:${PORT}`);
});

module.exports = { app, server, io };
