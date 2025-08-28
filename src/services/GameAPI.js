// GameAPI - Enhanced game service for server communication
// Uses global NetworkService for Phaser compatibility

window.GameAPI = new (class GameAPI {
    constructor() {
        this.currentSession = null;
        this.gameState = null;
        this.isSpinning = false;
        this.balance = 0;
        this.playerStats = null;
        
        // Setup WebSocket event listeners
        this.setupWebSocketListeners();
        
        // Initialize session on startup if authenticated
        this.initialize();
    }
    
    async initialize() {
        // Wait for NetworkService to be ready
        if (!window.NetworkService) {
            setTimeout(() => this.initialize(), 100);
            return;
        }
        
        // Check if we have a valid session
        if (NetworkService.authToken) {
            try {
                await this.validateAndRestoreSession();
            } catch (error) {
                console.warn('Session restoration failed:', error.message);
            }
        }
    }
    
    setupWebSocketListeners() {
        if (!window.NetworkService) {
            setTimeout(() => this.setupWebSocketListeners(), 100);
            return;
        }
        
        // Listen for spin results
        NetworkService.on('spin_result', (data) => {
            this.handleSpinResult(data);
        });
        
        // Listen for game state changes
        NetworkService.on('game_state_change', (data) => {
            this.handleGameStateChange(data);
        });
        
        // Listen for balance updates
        NetworkService.on('balance_update', (data) => {
            this.handleBalanceUpdate(data);
        });
        
        // Listen for connection events
        NetworkService.on('connected', () => {
            this.onWebSocketConnected();
        });
        
        NetworkService.on('disconnected', () => {
            this.onWebSocketDisconnected();
        });
        
        // Listen for authentication events
        NetworkService.on('auth_error', () => {
            this.handleAuthError();
        });
    }
    
    // Session Management
    async validateAndRestoreSession() {
        try {
            const sessionResult = await NetworkService.validateSession();
            if (sessionResult.success) {
                // Get current game state
                const gameStateResult = await NetworkService.getGameState();
                if (gameStateResult.success) {
                    this.gameState = gameStateResult.data;
                    this.currentSession = {
                        sessionId: sessionResult.data.sessionId,
                        playerId: sessionResult.data.playerId,
                        isValid: true
                    };
                    console.log('✅ Game session restored');
                }
                
                // Get current balance
                const balanceResult = await NetworkService.getBalance();
                if (balanceResult.success) {
                    this.balance = balanceResult.data.balance;
                }
                
                return true;
            }
        } catch (error) {
            console.warn('Failed to restore session:', error.message);
        }
        return false;
    }
    
    async createSession(initialBet = 10) {
        try {
            // For our server, session creation is handled by authentication
            // We just need to validate the current session
            const result = await this.validateAndRestoreSession();
            
            if (result) {
                console.log('✅ Game session ready');
                return { success: true, data: this.currentSession };
            } else {
                return { 
                    success: false, 
                    error: 'SESSION_CREATE_FAILED',
                    message: 'Unable to create or validate session' 
                };
            }
        } catch (error) {
            console.error('❌ Failed to create game session:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getSession(sessionId) {
        try {
            const result = await NetworkService.getGameState();
            if (result.success) {
                return result;
            }
            return { success: false, error: 'Session not found' };
        } catch (error) {
            console.error('❌ Failed to get session:', error);
            return { success: false, error: error.message };
        }
    }
    
    async endSession(sessionId) {
        try {
            // Our server handles session cleanup automatically
            this.currentSession = null;
            this.gameState = null;
            console.log('✅ Game session ended');
            return { success: true };
        } catch (error) {
            console.error('❌ Failed to end session:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Game Actions - Updated for server endpoints
    async requestSpin(betAmount = 10, sessionId = null) {
        if (this.isSpinning) {
            return { success: false, error: 'Spin already in progress' };
        }
        
        if (!NetworkService.authToken) {
            return { success: false, error: 'No authentication token' };
        }
        
        this.isSpinning = true;
        
        try {
            // Prefer WebSocket if connected, otherwise HTTP
            if (NetworkService.isSocketConnected()) {
                return await this.requestSpinViaWebSocket(betAmount);
            }
            return await this.requestSpinViaHTTP(betAmount);
        } catch (error) {
            console.error('❌ Spin request failed:', error);
            this.isSpinning = false;
            return { success: false, error: error.message };
        }
    }
    
    async requestSpinViaWebSocket(betAmount) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.isSpinning = false;
                reject(new Error('Spin request timeout'));
            }, 15000); // Increased timeout
            
            // Listen for spin result
            const handleSpinResult = (data) => {
                clearTimeout(timeout);
                NetworkService.off('spin_result', handleSpinResult);
                NetworkService.off('error', handleError);
                
                this.isSpinning = false;
                resolve({ success: true, data: data });
            };
            
            const handleError = (error) => {
                clearTimeout(timeout);
                NetworkService.off('spin_result', handleSpinResult);
                NetworkService.off('error', handleError);
                
                this.isSpinning = false;
                reject(error);
            };
            
            NetworkService.on('spin_result', handleSpinResult);
            NetworkService.on('error', handleError);
            
            // Send spin request using server format
            NetworkService.emit('spin_request', {
                bet: betAmount,
                quickSpinMode: true,
                freeSpinsActive: false,
                accumulatedMultiplier: 1
            });
        });
    }
    
    async requestSpinViaHTTP(betAmount) {
        try {
            // Use new NetworkService processSpin method
            const result = await NetworkService.processSpin({
                bet: betAmount,
                quickSpinMode: true,
                freeSpinsActive: false,
                accumulatedMultiplier: 1
            });
            
            this.isSpinning = false;
            
            // Update balance if provided in response
            if (result.success && result.data && result.data.balance !== undefined) {
                this.balance = result.data.balance;
            }
            
            return result;
        } catch (error) {
            this.isSpinning = false;
            throw error;
        }
    }
    
    // Backwards compatibility - alias for requestSpin
    async spin(betAmount = 10) {
        return await this.requestSpin(betAmount);
    }
    
    // Game Information
    async getGameInfo() {
        try {
            const result = await NetworkService.getGameStatus();
            return result;
        } catch (error) {
            console.error('❌ Failed to get game info:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getGameHistory(limit = 20) {
        try {
            const result = await NetworkService.getPlayerStats('all', limit);
            return result;
        } catch (error) {
            console.error('❌ Failed to get game history:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getSessionStats(sessionId) {
        try {
            const result = await NetworkService.getPlayerStats('day');
            return result;
        } catch (error) {
            console.error('❌ Failed to get session stats:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Bet Management
    async updateBet(sessionId, newBetAmount) {
        try {
            // Our server handles bet amounts per spin, no persistent bet setting
            console.log(`Bet amount will be ${newBetAmount} for next spin`);
            return { success: true, betAmount: newBetAmount };
        } catch (error) {
            console.error('❌ Failed to update bet:', error);
            return { success: false, error: error.message };
        }
    }
    
    // State Management
    async requestGameState(sessionId = null) {
        try {
            if (NetworkService.isSocketConnected()) {
                NetworkService.emit('game_state_request', { sessionId });
            } else {
                const result = await NetworkService.getGameState();
                if (result.success) {
                    this.gameState = result.data;
                    this.handleGameStateChange({ data: result.data });
                }
                return result;
            }
        } catch (error) {
            console.error('❌ Failed to request game state:', error);
            return { success: false, error: error.message };
        }
    }
    
    async requestBalance() {
        try {
            if (NetworkService.isSocketConnected()) {
                NetworkService.emit('balance_request');
            } else {
                const result = await NetworkService.getBalance();
                if (result.success) {
                    this.balance = result.data.balance;
                    this.handleBalanceUpdate({ balance: result.data.balance });
                }
                return result;
            }
        } catch (error) {
            console.error('❌ Failed to get balance:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Wallet Integration
    async getWalletStatus() {
        try {
            return await NetworkService.getWalletStatus();
        } catch (error) {
            console.error('❌ Failed to get wallet status:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getTransactionHistory(options = {}) {
        try {
            return await NetworkService.getTransactionHistory(options);
        } catch (error) {
            console.error('❌ Failed to get transaction history:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Event Handlers
    handleSpinResult(data) {
        console.log('🎰 Spin result received:', data);
        
        // Update balance if provided
        if (data.balance !== undefined) {
            this.balance = data.balance;
        }
        
        // Emit custom event for game scene to handle
        if (window.gameScene) {
            window.gameScene.events.emit('spin_result', data);
        }
    }
    
    handleGameStateChange(data) {
        console.log('🔄 Game state changed:', data);
        this.gameState = data.data;
        
        // Emit custom event for game scene to handle
        if (window.gameScene) {
            window.gameScene.events.emit('game_state_change', data);
        }
    }
    
    handleBalanceUpdate(data) {
        console.log('💰 Balance updated:', data.balance);
        this.balance = data.balance;
        
        // Emit custom event for UI to handle
        if (window.gameScene) {
            window.gameScene.events.emit('balance_update', data);
        }
    }
    
    handleAuthError() {
        console.warn('🔐 Authentication error in GameAPI');
        this.currentSession = null;
        this.gameState = null;
        this.balance = 0;
        this.isSpinning = false;
        
        // Emit auth error for game scene
        if (window.gameScene) {
            window.gameScene.events.emit('auth_error');
        }
    }
    
    onWebSocketConnected() {
        console.log('🔌 Game API WebSocket connected');
        // Request current game state and balance
        this.requestGameState();
        this.requestBalance();
    }
    
    onWebSocketDisconnected() {
        console.log('🔌 Game API WebSocket disconnected');
        this.isSpinning = false;
    }
    
    // Getters
    getCurrentSession() {
        return this.currentSession;
    }
    
    getGameState() {
        return this.gameState;
    }
    
    isCurrentlySpinning() {
        return this.isSpinning;
    }
    
    getCurrentBalance() {
        return this.balance;
    }
    
    getPlayerStats() {
        return this.playerStats;
    }
    
    // Utility Methods
    validateBetAmount(betAmount) {
        const validBets = [1, 2, 5, 10, 20, 50, 100, 200, 500];
        return validBets.includes(betAmount);
    }
    
    formatWinAmount(amount) {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(amount);
    }
    
    // Connection and Health Status
    getConnectionStatus() {
        return NetworkService.getConnectionStatus();
    }
    
    isConnected() {
        return NetworkService.getConnectionStatus().connected;
    }
    
    isAuthenticated() {
        return NetworkService.getConnectionStatus().authenticated;
    }
    
    // Server Health Check
    async checkServerHealth() {
        return await NetworkService.checkServerHealth();
    }
})();