// GameConfig is loaded globally

window.WinCalculator = class WinCalculator {
    constructor(scene) {
        this.scene = scene;
        this.stateManager = scene.game.stateManager;
        
        // Win history for current spin
        this.currentSpinWins = [];
        
        // Session win history
        this.sessionHistory = [];
        this.maxHistorySize = 100;
        
        // Win categories
        this.winCategories = {
            SMALL: { min: 0, max: 10, name: 'Small Win' },
            MEDIUM: { min: 10, max: 50, name: 'Medium Win' },
            BIG: { min: 50, max: 100, name: 'Big Win' },
            MEGA: { min: 100, max: 250, name: 'Mega Win' },
            EPIC: { min: 250, max: 500, name: 'Epic Win' },
            LEGENDARY: { min: 500, max: Infinity, name: 'Legendary Win' }
        };
        
        // Enhanced Cascade Synchronization state (Task 3.3)
        this.serverValidationEnabled = true;
        this.cascadeStepHistory = new Map(); // Track step-wise calculations
        this.validationResults = new Map(); // Server validation results
        this.payoutVerifications = new Map(); // Payout validation cache
        this.multiplierValidations = new Map(); // Multiplier validation history
        this.winDataSyncState = {
            lastSyncedStep: -1,
            pendingValidations: new Set(),
            validationErrors: [],
            recoveryAttempts: 0
        };
        
        // Validation configuration
        this.validationConfig = {
            enableServerVerification: true,
            enablePayoutValidation: true,
            enableMultiplierValidation: true,
            toleranceThreshold: 0.01, // 1 cent tolerance for floating point precision
            maxValidationRetries: 3,
            validationTimeoutMs: 5000
        };
        
        console.log('🎰 WinCalculator initialized with Enhanced Cascade Synchronization');
    }
    
    calculateMatchWin(match, betAmount) {
        if (!match || match.length < window.GameConfig.MIN_MATCH_COUNT) {
            return 0;
        }
        
        // Get symbol info
        const symbolType = match[0].symbol.symbolType;
        const symbolInfo = window.GameConfig.SYMBOLS[symbolType.toUpperCase()];
        
        if (!symbolInfo || !symbolInfo.payouts) {
            return 0;
        }
        
        // Get the appropriate payout multiplier based on match size
        const matchSize = match.length;
        let payoutMultiplier = 0;
        
        // For scatter symbols, use exact match counts
        if (symbolInfo.type === 'scatter') {
            payoutMultiplier = symbolInfo.payouts[matchSize] || 0;
        } else {
            // For regular symbols, use tiered system
            if (matchSize >= 12) {
                payoutMultiplier = symbolInfo.payouts[12];
            } else if (matchSize >= 10) {
                payoutMultiplier = symbolInfo.payouts[10];
            } else if (matchSize >= 8) {
                payoutMultiplier = symbolInfo.payouts[8];
            }
        }
        
        if (payoutMultiplier === 0) {
            return 0;
        }
        
        // Base win calculation using new formula: (Bet Amount / 20) * Symbol Payout Multiplier
        const baseWin = (betAmount / 20) * payoutMultiplier;
        
        // Get highest symbol multiplier in the match (from special symbols)
        const symbolMultiplier = this.getHighestSymbolMultiplier(match);
        
        // Calculate total win (no additional match size multiplier needed since it's built into the tiered payouts)
        const totalWin = baseWin * symbolMultiplier;
        
        // Validate win
        const validatedWin = this.validateWin(totalWin, betAmount);
        
        // Record win details
        this.recordMatchWin({
            symbolType,
            matchSize: match.length,
            payoutMultiplier,
            baseWin,
            symbolMultiplier,
            totalWin: validatedWin,
            positions: match.map(m => ({ col: m.col, row: m.row }))
        });
        
        return validatedWin;
    }
    
    // Removed calculateMatchSizeMultiplier - now using tiered payouts from GameConfig
    
    getHighestSymbolMultiplier(match) {
        let highest = 1;
        
        for (const { symbol } of match) {
            if (symbol && symbol.multiplier > highest) {
                highest = symbol.multiplier;
            }
        }
        
        return highest;
    }
    
    calculateTotalWin(matches, betAmount, serverResult = null, stepIndex = 0) {
        let totalWin = 0;
        
        // Clear current spin wins
        this.currentSpinWins = [];
        
        // Calculate win for each match
        for (const match of matches) {
            const matchWin = this.calculateMatchWin(match, betAmount);
            totalWin += matchWin;
        }
        
        // Apply free spins multiplier if active
        if (this.stateManager.freeSpinsData.active) {
            const multiplier = this.stateManager.freeSpinsData.multiplierAccumulator;
            totalWin *= multiplier;
        }
        
        // Validate total win
        totalWin = this.validateWin(totalWin, betAmount);
        
        // Task 3.3.1: Server result verification
        if (serverResult && this.validationConfig.enableServerVerification) {
            this.verifyServerResult(totalWin, serverResult, stepIndex);
        }
        
        // Task 3.3.3: Step-wise calculation tracking
        this.trackStepCalculation(stepIndex, {
            matches: matches,
            betAmount: betAmount,
            totalWin: totalWin,
            multiplier: this.stateManager.freeSpinsData.multiplierAccumulator || 1,
            timestamp: Date.now()
        });
        
        // Determine win category
        const winCategory = this.getWinCategory(totalWin, betAmount);
        
        // Record spin result
        this.recordSpinResult({
            betAmount,
            totalWin,
            winCategory,
            matchCount: matches.length,
            isFreeSpins: this.stateManager.freeSpinsData.active,
            multiplier: this.stateManager.freeSpinsData.multiplierAccumulator || 1,
            matches: this.currentSpinWins,
            stepIndex: stepIndex,
            serverValidated: !!serverResult
        });
        
        return totalWin;
    }
    
    validateWin(win, betAmount) {
        // Ensure win is not negative
        if (win < 0) return 0;
        
        // Cap win at max win multiplier
        const maxWin = betAmount * window.GameConfig.MAX_WIN_MULTIPLIER;
        if (win > maxWin) {
            console.warn(`Win capped at max multiplier: ${win} -> ${maxWin}`);
            return maxWin;
        }
        
        // Round to 2 decimal places
        return Math.round(win * 100) / 100;
    }
    
    getWinCategory(win, betAmount) {
        const winMultiplier = win / betAmount;
        
        for (const [key, category] of Object.entries(this.winCategories)) {
            if (winMultiplier >= category.min && winMultiplier < category.max) {
                return {
                    key,
                    name: category.name,
                    multiplier: winMultiplier
                };
            }
        }
        
        return null;
    }
    
    recordMatchWin(matchData) {
        this.currentSpinWins.push({
            ...matchData,
            timestamp: Date.now()
        });
    }
    
    recordSpinResult(spinData) {
        const record = {
            ...spinData,
            timestamp: Date.now(),
            spinNumber: this.stateManager.sessionData.spinsCount
        };
        
        // Add to session history
        this.sessionHistory.push(record);
        
        // Trim history if too large
        if (this.sessionHistory.length > this.maxHistorySize) {
            this.sessionHistory.shift();
        }
        
        // Update session statistics
        this.updateSessionStats(record);
    }
    
    updateSessionStats(spinRecord) {
        // Update biggest win
        if (spinRecord.totalWin > this.stateManager.sessionData.biggestWin) {
            this.stateManager.sessionData.biggestWin = spinRecord.totalWin;
        }
        
        // Track win categories
        if (!this.stateManager.sessionData.winCategories) {
            this.stateManager.sessionData.winCategories = {};
        }
        
        if (spinRecord.winCategory) {
            const category = spinRecord.winCategory.key;
            if (!this.stateManager.sessionData.winCategories[category]) {
                this.stateManager.sessionData.winCategories[category] = 0;
            }
            this.stateManager.sessionData.winCategories[category]++;
        }
    }
    
    getSessionStats() {
        const totalSpins = this.sessionHistory.length;
        const wins = this.sessionHistory.filter(s => s.totalWin > 0);
        const totalWon = wins.reduce((sum, s) => sum + s.totalWin, 0);
        const totalBet = this.sessionHistory.reduce((sum, s) => sum + s.betAmount, 0);
        
        return {
            totalSpins,
            totalWins: wins.length,
            winRate: totalSpins > 0 ? (wins.length / totalSpins * 100).toFixed(1) : 0,
            totalWon: totalWon.toFixed(2),
            totalBet: totalBet.toFixed(2),
            rtp: totalBet > 0 ? (totalWon / totalBet * 100).toFixed(2) : 0,
            biggestWin: this.stateManager.sessionData.biggestWin,
            averageWin: wins.length > 0 ? (totalWon / wins.length).toFixed(2) : 0,
            winCategories: this.stateManager.sessionData.winCategories || {}
        };
    }
    
    getRecentWins(count = 10) {
        return this.sessionHistory
            .filter(s => s.totalWin > 0)
            .slice(-count)
            .reverse();
    }
    
    getBiggestWins(count = 5) {
        return [...this.sessionHistory]
            .filter(s => s.totalWin > 0)
            .sort((a, b) => b.totalWin - a.totalWin)
            .slice(0, count);
    }
    
    getWinStreaks() {
        let currentStreak = 0;
        let bestStreak = 0;
        let currentLossStreak = 0;
        let worstLossStreak = 0;
        
        for (const spin of this.sessionHistory) {
            if (spin.totalWin > 0) {
                currentStreak++;
                currentLossStreak = 0;
                bestStreak = Math.max(bestStreak, currentStreak);
            } else {
                currentLossStreak++;
                currentStreak = 0;
                worstLossStreak = Math.max(worstLossStreak, currentLossStreak);
            }
        }
        
        return {
            currentWinStreak: currentStreak,
            bestWinStreak: bestStreak,
            currentLossStreak: currentLossStreak,
            worstLossStreak: worstLossStreak
        };
    }
    
    simulateWinProbability(betAmount, simulations = 1000) {
        // SECURITY: Use controlled RNG for win probability simulation
        if (!window.RNG) {
            throw new Error('SECURITY: WinCalculator requires window.RNG to be initialized.');
        }
        const rng = new window.RNG();
        
        // Simple win probability simulation based on current RTP
        const stats = this.getSessionStats();
        const observedRTP = parseFloat(stats.rtp) / 100 || GameConfig.RTP;
        const winRate = parseFloat(stats.winRate) / 100 || 0.25; // Default 25% win rate
        
        let wins = 0;
        let totalPayout = 0;
        
        for (let i = 0; i < simulations; i++) {
            if (rng.chance(winRate)) {
                wins++;
                // Simulate win amount based on RTP using controlled RNG
                const avgWinMultiplier = observedRTP / winRate;
                const winAmount = betAmount * avgWinMultiplier * (0.5 + rng.random() * 1.5);
                totalPayout += winAmount;
            }
        }
        
        return {
            winProbability: (wins / simulations * 100).toFixed(1),
            expectedReturn: (totalPayout / (betAmount * simulations) * 100).toFixed(1),
            averageWinAmount: wins > 0 ? (totalPayout / wins).toFixed(2) : 0
        };
    }
    
    exportHistory() {
        return {
            sessionHistory: this.sessionHistory,
            stats: this.getSessionStats(),
            streaks: this.getWinStreaks(),
            biggestWins: this.getBiggestWins(),
            exportTime: new Date().toISOString()
        };
    }
    
    clearHistory() {
        this.sessionHistory = [];
        this.currentSpinWins = [];
    }
    
    /**
     * Task 3.3.1: Server result verification
     */
    verifyServerResult(clientResult, serverResult, stepIndex) {
        try {
            console.log(`🔍 Verifying server result for step ${stepIndex}`);
            
            const verification = {
                stepIndex: stepIndex,
                clientResult: clientResult,
                serverResult: serverResult.totalWin || serverResult,
                timestamp: Date.now(),
                isValid: false,
                tolerance: this.validationConfig.toleranceThreshold,
                difference: 0
            };
            
            // Calculate difference
            verification.difference = Math.abs(clientResult - verification.serverResult);
            
            // Check if within tolerance
            verification.isValid = verification.difference <= verification.tolerance;
            
            if (verification.isValid) {
                console.log(`✅ Server result verified for step ${stepIndex}`);
                console.log(`Client: ${clientResult}, Server: ${verification.serverResult}, Diff: ${verification.difference}`);
            } else {
                console.warn(`⚠️ Server result mismatch for step ${stepIndex}`);
                console.warn(`Client: ${clientResult}, Server: ${verification.serverResult}, Diff: ${verification.difference}`);
                
                // Track validation error
                this.winDataSyncState.validationErrors.push({
                    type: 'server_result_mismatch',
                    stepIndex: stepIndex,
                    verification: verification,
                    timestamp: Date.now()
                });
                
                // Attempt recovery if enabled
                if (this.validationConfig.enableServerVerification) {
                    this.handleServerResultMismatch(verification);
                }
            }
            
            // Store validation result
            this.validationResults.set(stepIndex, verification);
            
            return verification;
            
        } catch (error) {
            console.error('❌ Server result verification failed:', error);
            this.winDataSyncState.validationErrors.push({
                type: 'verification_error',
                stepIndex: stepIndex,
                error: error.message,
                timestamp: Date.now()
            });
            return null;
        }
    }
    
    handleServerResultMismatch(verification) {
        console.warn('🔧 Handling server result mismatch');
        
        // Report to CascadeAPI if available
        if (window.cascadeAPI) {
            window.cascadeAPI.detectDesync('win_calculation_mismatch', {
                stepIndex: verification.stepIndex,
                clientResult: verification.clientResult,
                serverResult: verification.serverResult,
                difference: verification.difference
            });
        }
        
        // Update sync state
        this.winDataSyncState.recoveryAttempts++;
        this.winDataSyncState.pendingValidations.add(verification.stepIndex);
    }
    
    /**
     * Task 3.3.2: Cascading win validation
     */
    validateCascadingWins(cascadeSteps, betAmount) {
        try {
            console.log(`🔄 Validating cascading wins across ${cascadeSteps.length} steps`);
            
            let cumulativeWin = 0;
            const validationResults = [];
            
            for (let i = 0; i < cascadeSteps.length; i++) {
                const step = cascadeSteps[i];
                const stepResult = this.validateCascadeStep(step, betAmount, i);
                
                validationResults.push(stepResult);
                cumulativeWin += stepResult.stepWin;
                
                // Task 3.3.4: Win data synchronization
                this.synchronizeWinData(i, stepResult, step.serverData);
            }
            
            const cascadeValidation = {
                totalSteps: cascadeSteps.length,
                cumulativeWin: cumulativeWin,
                stepResults: validationResults,
                isValid: validationResults.every(r => r.isValid),
                timestamp: Date.now()
            };
            
            console.log(`${cascadeValidation.isValid ? '✅' : '❌'} Cascading win validation completed`);
            console.log(`Total win: ${cumulativeWin} across ${cascadeSteps.length} steps`);
            
            return cascadeValidation;
            
        } catch (error) {
            console.error('❌ Cascading win validation failed:', error);
            return {
                totalSteps: 0,
                cumulativeWin: 0,
                stepResults: [],
                isValid: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    validateCascadeStep(step, betAmount, stepIndex) {
        try {
            // Calculate client-side win for this step
            const matches = this.findMatches(step.gridState);
            const clientWin = this.calculateStepWin(matches, betAmount, step.multiplier);
            
            // Compare with server result if available
            const serverWin = step.serverData?.stepWin || 0;
            const difference = Math.abs(clientWin - serverWin);
            const isValid = difference <= this.validationConfig.toleranceThreshold;
            
            const stepResult = {
                stepIndex: stepIndex,
                clientWin: clientWin,
                serverWin: serverWin,
                stepWin: isValid ? serverWin : clientWin, // Use server if valid
                difference: difference,
                isValid: isValid,
                matches: matches.length,
                multiplier: step.multiplier || 1,
                timestamp: Date.now()
            };
            
            if (!isValid) {
                console.warn(`⚠️ Step ${stepIndex} win mismatch: Client=${clientWin}, Server=${serverWin}`);
            }
            
            return stepResult;
            
        } catch (error) {
            console.error(`❌ Step ${stepIndex} validation failed:`, error);
            return {
                stepIndex: stepIndex,
                clientWin: 0,
                serverWin: 0,
                stepWin: 0,
                difference: 0,
                isValid: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    findMatches(gridState) {
        // Use existing match finding logic or integrate with GridManager
        if (window.GridManager && window.GridManager.findConnectedMatches) {
            return window.GridManager.findConnectedMatches(gridState);
        }
        
        // Fallback: return empty array if match finding not available
        console.warn('⚠️ Match finding not available, using empty matches');
        return [];
    }
    
    calculateStepWin(matches, betAmount, multiplier = 1) {
        let stepWin = 0;
        
        for (const match of matches) {
            const matchWin = this.calculateMatchWin(match, betAmount);
            stepWin += matchWin;
        }
        
        // Apply step multiplier
        stepWin *= multiplier;
        
        return this.validateWin(stepWin, betAmount);
    }
    
    /**
     * Task 3.3.3: Step-wise calculation tracking
     */
    trackStepCalculation(stepIndex, calculationData) {
        try {
            const stepTracking = {
                stepIndex: stepIndex,
                ...calculationData,
                calculationHash: this.generateCalculationHash(calculationData),
                tracked: true
            };
            
            this.cascadeStepHistory.set(stepIndex, stepTracking);
            
            // Update sync state
            this.winDataSyncState.lastSyncedStep = Math.max(this.winDataSyncState.lastSyncedStep, stepIndex);
            
            console.log(`📊 Step ${stepIndex} calculation tracked: ${calculationData.totalWin}`);
            
            // Cleanup old tracking data
            this.cleanupStepHistory();
            
            return stepTracking;
            
        } catch (error) {
            console.error('❌ Step calculation tracking failed:', error);
            return null;
        }
    }
    
    generateCalculationHash(calculationData) {
        // Simple hash for calculation verification
        const dataString = JSON.stringify({
            matches: calculationData.matches?.length || 0,
            betAmount: calculationData.betAmount,
            totalWin: calculationData.totalWin,
            multiplier: calculationData.multiplier
        });
        
        // Basic hash using string manipulation (could be enhanced with crypto)
        let hash = 0;
        for (let i = 0; i < dataString.length; i++) {
            const char = dataString.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        
        return hash.toString(16);
    }
    
    getStepCalculation(stepIndex) {
        return this.cascadeStepHistory.get(stepIndex) || null;
    }
    
    getCalculationHistory(maxSteps = 10) {
        const history = Array.from(this.cascadeStepHistory.entries())
            .sort(([a], [b]) => b - a) // Sort by step index descending
            .slice(0, maxSteps)
            .map(([stepIndex, data]) => ({ stepIndex, ...data }));
        
        return history;
    }
    
    cleanupStepHistory() {
        // Keep only recent steps to prevent memory bloat
        const maxHistorySize = 50;
        
        if (this.cascadeStepHistory.size > maxHistorySize) {
            const sortedKeys = Array.from(this.cascadeStepHistory.keys()).sort((a, b) => a - b);
            const keysToDelete = sortedKeys.slice(0, this.cascadeStepHistory.size - maxHistorySize);
            
            for (const key of keysToDelete) {
                this.cascadeStepHistory.delete(key);
            }
            
            console.log(`🧹 Cleaned up ${keysToDelete.length} old step calculations`);
        }
    }
    
    /**
     * Task 3.3.2: Payout verification methods
     */
    verifyPayout(calculatedPayout, serverPayout, context = {}) {
        try {
            const verification = {
                calculatedPayout: calculatedPayout,
                serverPayout: serverPayout,
                difference: Math.abs(calculatedPayout - serverPayout),
                tolerance: this.validationConfig.toleranceThreshold,
                isValid: false,
                context: context,
                timestamp: Date.now()
            };
            
            verification.isValid = verification.difference <= verification.tolerance;
            
            if (verification.isValid) {
                console.log(`✅ Payout verified: ${calculatedPayout} ≈ ${serverPayout}`);
            } else {
                console.warn(`⚠️ Payout mismatch: ${calculatedPayout} vs ${serverPayout} (diff: ${verification.difference})`);
                
                // Store for analysis
                this.payoutVerifications.set(`${context.stepIndex || 0}_${Date.now()}`, verification);
                
                // Report if significant mismatch
                if (verification.difference > verification.tolerance * 10) {
                    this.reportSignificantPayoutMismatch(verification);
                }
            }
            
            return verification;
            
        } catch (error) {
            console.error('❌ Payout verification failed:', error);
            return {
                calculatedPayout: calculatedPayout,
                serverPayout: serverPayout,
                isValid: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    reportSignificantPayoutMismatch(verification) {
        console.error('🚨 Significant payout mismatch detected!');
        console.error('Verification details:', verification);
        
        // Report to CascadeAPI if available
        if (window.cascadeAPI) {
            window.cascadeAPI.detectDesync('significant_payout_mismatch', {
                verification: verification,
                severity: 'high'
            });
        }
    }
    
    /**
     * Task 3.3.2: Multiplier validation
     */
    validateMultiplier(clientMultiplier, serverMultiplier, context = {}) {
        try {
            const validation = {
                clientMultiplier: clientMultiplier,
                serverMultiplier: serverMultiplier,
                difference: Math.abs(clientMultiplier - serverMultiplier),
                tolerance: 0.001, // Stricter tolerance for multipliers
                isValid: false,
                context: context,
                timestamp: Date.now()
            };
            
            validation.isValid = validation.difference <= validation.tolerance;
            
            if (validation.isValid) {
                console.log(`✅ Multiplier validated: ${clientMultiplier}x ≈ ${serverMultiplier}x`);
            } else {
                console.warn(`⚠️ Multiplier mismatch: ${clientMultiplier}x vs ${serverMultiplier}x`);
                
                // Store validation result
                this.multiplierValidations.set(`${context.stepIndex || 0}_${Date.now()}`, validation);
            }
            
            return validation;
            
        } catch (error) {
            console.error('❌ Multiplier validation failed:', error);
            return {
                clientMultiplier: clientMultiplier,
                serverMultiplier: serverMultiplier,
                isValid: false,
                error: error.message,
                timestamp: Date.now()
            };
        }
    }
    
    /**
     * Task 3.3.4: Win data synchronization
     */
    synchronizeWinData(stepIndex, clientData, serverData) {
        try {
            console.log(`🔄 Synchronizing win data for step ${stepIndex}`);
            
            const syncResult = {
                stepIndex: stepIndex,
                clientData: clientData,
                serverData: serverData,
                synchronized: false,
                corrections: [],
                timestamp: Date.now()
            };
            
            // Validate and synchronize different aspects
            if (serverData) {
                // Synchronize win amount
                if (serverData.stepWin !== undefined) {
                    const payoutVerification = this.verifyPayout(
                        clientData.stepWin || clientData.clientWin,
                        serverData.stepWin,
                        { stepIndex: stepIndex }
                    );
                    
                    if (!payoutVerification.isValid) {
                        syncResult.corrections.push({
                            type: 'payout_correction',
                            from: clientData.stepWin || clientData.clientWin,
                            to: serverData.stepWin,
                            applied: true
                        });
                        
                        // Apply server correction
                        if (clientData.stepWin !== undefined) {
                            clientData.stepWin = serverData.stepWin;
                        }
                    }
                }
                
                // Synchronize multiplier
                if (serverData.multiplier !== undefined) {
                    const multiplierValidation = this.validateMultiplier(
                        clientData.multiplier,
                        serverData.multiplier,
                        { stepIndex: stepIndex }
                    );
                    
                    if (!multiplierValidation.isValid) {
                        syncResult.corrections.push({
                            type: 'multiplier_correction',
                            from: clientData.multiplier,
                            to: serverData.multiplier,
                            applied: true
                        });
                        
                        // Apply server correction
                        clientData.multiplier = serverData.multiplier;
                    }
                }
                
                syncResult.synchronized = true;
            }
            
            // Update sync state
            this.winDataSyncState.lastSyncedStep = Math.max(this.winDataSyncState.lastSyncedStep, stepIndex);
            this.winDataSyncState.pendingValidations.delete(stepIndex);
            
            if (syncResult.corrections.length > 0) {
                console.log(`🔧 Applied ${syncResult.corrections.length} corrections for step ${stepIndex}`);
                syncResult.corrections.forEach(correction => {
                    console.log(`  - ${correction.type}: ${correction.from} → ${correction.to}`);
                });
            } else {
                console.log(`✅ Win data already synchronized for step ${stepIndex}`);
            }
            
            return syncResult;
            
        } catch (error) {
            console.error('❌ Win data synchronization failed:', error);
            this.winDataSyncState.validationErrors.push({
                type: 'sync_error',
                stepIndex: stepIndex,
                error: error.message,
                timestamp: Date.now()
            });
            return null;
        }
    }
    
    /**
     * Enhanced validation and synchronization utility methods
     */
    getValidationStats() {
        const validationCount = this.validationResults.size;
        const validResults = Array.from(this.validationResults.values()).filter(v => v.isValid);
        
        return {
            totalValidations: validationCount,
            successfulValidations: validResults.length,
            successRate: validationCount > 0 ? (validResults.length / validationCount * 100).toFixed(1) : 0,
            pendingValidations: this.winDataSyncState.pendingValidations.size,
            validationErrors: this.winDataSyncState.validationErrors.length,
            lastSyncedStep: this.winDataSyncState.lastSyncedStep,
            recoveryAttempts: this.winDataSyncState.recoveryAttempts
        };
    }
    
    getSyncStatus() {
        return {
            enabled: this.serverValidationEnabled,
            syncState: this.winDataSyncState,
            config: this.validationConfig,
            stats: this.getValidationStats(),
            stepHistorySize: this.cascadeStepHistory.size,
            validationResultsSize: this.validationResults.size
        };
    }
    
    setValidationConfig(config) {
        this.validationConfig = { ...this.validationConfig, ...config };
        console.log('🔧 Validation configuration updated:', this.validationConfig);
    }
    
    clearValidationState() {
        this.cascadeStepHistory.clear();
        this.validationResults.clear();
        this.payoutVerifications.clear();
        this.multiplierValidations.clear();
        
        this.winDataSyncState = {
            lastSyncedStep: -1,
            pendingValidations: new Set(),
            validationErrors: [],
            recoveryAttempts: 0
        };
        
        console.log('🧹 Validation state cleared');
    }
    
    // Integration with CascadeAPI for seamless synchronization
    async requestServerValidation(stepIndex, clientData) {
        if (!window.cascadeAPI) {
            console.warn('⚠️ CascadeAPI not available for server validation');
            return null;
        }
        
        try {
            // Request validation via CascadeAPI
            const validationRequest = {
                stepIndex: stepIndex,
                clientData: clientData,
                timestamp: Date.now()
            };
            
            // This would typically integrate with the server validation endpoint
            console.log(`📤 Requesting server validation for step ${stepIndex}`);
            
            // For now, log the request (actual implementation would use CascadeAPI)
            // const serverResponse = await window.cascadeAPI.validateStep(validationRequest);
            // return serverResponse;
            
            return validationRequest;
            
        } catch (error) {
            console.error('❌ Server validation request failed:', error);
            return null;
        }
    }
} 