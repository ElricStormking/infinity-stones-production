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
    
    calculateTotalWin(matches, betAmount) {
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
            matches: this.currentSpinWins
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
} 