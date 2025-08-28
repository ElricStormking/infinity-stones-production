// GameAPI - Simple game service for server communication
window.GameAPI = {
    currentSession: null,
    gameState: null,
    isSpinning: false,
    balance: 0,
    
    // Session Management
    async createSession() {
        try {
            // For our server, session creation is handled by authentication
            // We just need to validate the current session
            const response = await NetworkService.validateSession();
            
            if (response.success) {
                this.currentSession = {
                    sessionId: response.data.sessionId,
                    playerId: response.data.playerId,
                    isValid: true
                };
                console.log('✅ Game session created:', this.currentSession);
                
                // Get current balance
                const balanceResult = await NetworkService.getBalance();
                if (balanceResult.success) {
                    this.balance = balanceResult.data.balance;
                }
                
                return this.currentSession;
            } else {
                throw new Error(response.error || 'Failed to create session');
            }
        } catch (error) {
            console.error('❌ Create session error:', error);
            throw error;
        }
    },
    
    // Use demo session for testing (fallback when not authenticated)
    async useSampleSession(sessionId = 'demo-session') {
        try {
            console.log('⚠️ Using demo session - no server authentication required');
            this.currentSession = {
                sessionId: sessionId,
                playerId: 'demo-player',
                balance: 1000.00, // Demo balance
                state: 'demo'
            };
            this.balance = 1000.00;
            console.log('✅ Using demo session:', this.currentSession);
            return this.currentSession;
        } catch (error) {
            console.error('❌ Demo session error:', error);
            throw error;
        }
    },
    
    // Game Actions - Updated for server endpoints
    async spin(betAmount = 10.00) {
        try {
            if (this.isSpinning) {
                throw new Error('Spin already in progress');
            }

            this.isSpinning = true;
            
            // Check if we have authentication
            if (NetworkService.authToken) {
                // Use server authoritative spin endpoint
                const response = await NetworkService.processSpin({
                    bet: betAmount,
                    quickSpinMode: true,
                    freeSpinsActive: false,
                    accumulatedMultiplier: 1
                });
                
                this.isSpinning = false;
                
                if (response.success) {
                    const data = response.data;
                    console.log('🎰 Spin result:', data);
                    
                    // Update balance if provided in response
                    if (data.balance !== undefined) {
                        this.balance = data.balance;
                    }
                    
                    return data;
                } else {
                    throw new Error(response.message || response.error || 'Spin failed');
                }
            } else {
                // Demo mode - use local simulation
                console.log('⚠️ Demo mode spin - no server communication');
                
                // Simple demo spin simulation
                const demoResult = {
                    spinId: `demo-${Date.now()}`,
                    success: true,
                    initialGrid: this.generateDemoGrid(),
                    cascades: [],
                    totalWin: Math.random() > 0.7 ? betAmount * (Math.random() * 5 + 1) : 0,
                    betAmount: betAmount,
                    balance: this.balance - betAmount
                };
                
                // Add win to balance
                this.balance = demoResult.balance + demoResult.totalWin;
                demoResult.balance = this.balance;
                
                // Simulate processing time
                await new Promise(resolve => setTimeout(resolve, 500));
                
                this.isSpinning = false;
                console.log('🎮 Demo spin result:', demoResult);
                return demoResult;
            }
        } catch (error) {
            this.isSpinning = false;
            console.error('❌ Spin error:', error);
            throw error;
        }
    },
    
    // Generate demo grid for testing
    generateDemoGrid() {
        const symbols = ['time_gem', 'space_gem', 'mind_gem', 'power_gem', 'reality_gem', 'soul_gem', 'thanos_weapon', 'scarlet_witch', 'thanos'];
        const grid = [];
        
        for (let col = 0; col < 6; col++) {
            grid[col] = [];
            for (let row = 0; row < 5; row++) {
                grid[col][row] = symbols[Math.floor(Math.random() * symbols.length)];
            }
        }
        
        return grid;
    },
    
    // Alias for backwards compatibility
    async requestSpin(betAmount = 10.00) {
        return await this.spin(betAmount);
    },
    
    // Session info getters
    getCurrentSession() {
        return this.currentSession;
    },
    
    isCurrentlySpinning() {
        return this.isSpinning;
    },
    
    getCurrentBalance() {
        return this.balance;
    },
    
    // Game state management
    async getGameState() {
        try {
            if (NetworkService.authToken) {
                const result = await NetworkService.getGameState();
                if (result.success) {
                    this.gameState = result.data;
                    return result.data;
                }
            }
            return this.gameState;
        } catch (error) {
            console.warn('Failed to get game state:', error.message);
            return this.gameState;
        }
    },
    
    // Balance management
    async requestBalance() {
        try {
            if (NetworkService.authToken) {
                const result = await NetworkService.getBalance();
                if (result.success) {
                    this.balance = result.data.balance;
                    return result;
                }
            }
            return { success: true, data: { balance: this.balance } };
        } catch (error) {
            console.warn('Failed to get balance:', error.message);
            return { success: true, data: { balance: this.balance } };
        }
    },
    
    // Wallet integration
    async getWalletStatus() {
        try {
            if (NetworkService.authToken) {
                return await NetworkService.getWalletStatus();
            }
            return {
                success: true,
                data: {
                    balance: this.balance,
                    status: 'demo',
                    lastTransaction: null
                }
            };
        } catch (error) {
            console.warn('Failed to get wallet status:', error.message);
            return { success: false, error: error.message };
        }
    },
    
    async getTransactionHistory(options = {}) {
        try {
            if (NetworkService.authToken) {
                return await NetworkService.getTransactionHistory(options);
            }
            return {
                success: true,
                data: {
                    transactions: [],
                    totalCount: 0,
                    page: 1,
                    limit: options.limit || 50
                }
            };
        } catch (error) {
            console.warn('Failed to get transaction history:', error.message);
            return { success: false, error: error.message };
        }
    },
    
    // Connection status
    getConnectionStatus() {
        return NetworkService.getConnectionStatus();
    },
    
    isConnected() {
        return NetworkService.getConnectionStatus().connected;
    },
    
    isAuthenticated() {
        return NetworkService.getConnectionStatus().authenticated;
    },
    
    // Server health check
    async checkServerHealth() {
        return await NetworkService.checkServerHealth();
    },
    
    // Utility methods
    validateBetAmount(betAmount) {
        const validBets = [1, 2, 5, 10, 20, 50, 100, 200, 500];
        return validBets.includes(betAmount);
    },
    
    formatWinAmount(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    }
};