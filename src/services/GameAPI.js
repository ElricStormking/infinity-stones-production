import NetworkService from './NetworkService.js';

class GameAPI {
    constructor() {
        this.currentSession = null;
        this.gameState = null;
        this.isSpinning = false;
        
        // Setup WebSocket event listeners
        this.setupWebSocketListeners();
    }
    
    setupWebSocketListeners() {
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
    }
    
    // Session Management
    async createSession(initialBet = 10) {
        try {
            const result = await NetworkService.post('/api/v2/game/session', {
                initialBet: initialBet
            });
            
            if (result.success) {
                this.currentSession = result.data.data;
                console.log('✅ Game session created:', this.currentSession.sessionId);
                return result;
            }
            
            return result;
        } catch (error) {
            console.error('❌ Failed to create game session:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getSession(sessionId) {
        try {
            const result = await NetworkService.get(`/api/v2/game/session/${sessionId}`);
            return result;
        } catch (error) {
            console.error('❌ Failed to get session:', error);
            return { success: false, error: error.message };
        }
    }
    
    async endSession(sessionId) {
        try {
            const result = await NetworkService.delete(`/api/v2/game/session/${sessionId}`);
            if (result.success) {
                this.currentSession = null;
                console.log('✅ Game session ended');
            }
            return result;
        } catch (error) {
            console.error('❌ Failed to end session:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Game Actions
    async requestSpin(betAmount, sessionId = null) {
        if (this.isSpinning) {
            return { success: false, error: 'Spin already in progress' };
        }
        
        const targetSessionId = sessionId || this.currentSession?.sessionId;
        if (!targetSessionId) {
            return { success: false, error: 'No active session' };
        }
        
        this.isSpinning = true;
        
        try {
            // Use WebSocket for real-time spin
            if (NetworkService.isSocketConnected()) {
                return await this.requestSpinViaWebSocket(betAmount, targetSessionId);
            } else {
                // Fallback to HTTP
                return await this.requestSpinViaHTTP(betAmount, targetSessionId);
            }
        } catch (error) {
            console.error('❌ Spin request failed:', error);
            this.isSpinning = false;
            return { success: false, error: error.message };
        }
    }
    
    async requestSpinViaWebSocket(betAmount, sessionId) {
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                this.isSpinning = false;
                reject(new Error('Spin request timeout'));
            }, 10000);
            
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
            
            // Send spin request
            NetworkService.emit('spin_request', {
                betAmount: betAmount,
                sessionId: sessionId
            });
        });
    }
    
    async requestSpinViaHTTP(betAmount, sessionId) {
        try {
            const result = await NetworkService.post('/api/v2/game/spin', {
                betAmount: betAmount,
                sessionId: sessionId
            });
            
            this.isSpinning = false;
            return result;
        } catch (error) {
            this.isSpinning = false;
            throw error;
        }
    }
    
    // Game Information
    async getGameInfo() {
        try {
            const result = await NetworkService.get('/api/v2/game/info');
            return result;
        } catch (error) {
            console.error('❌ Failed to get game info:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getGameHistory(limit = 20) {
        try {
            const result = await NetworkService.get(`/api/v2/game/history?limit=${limit}`);
            return result;
        } catch (error) {
            console.error('❌ Failed to get game history:', error);
            return { success: false, error: error.message };
        }
    }
    
    async getSessionStats(sessionId) {
        try {
            const result = await NetworkService.get(`/api/v2/game/stats/${sessionId}`);
            return result;
        } catch (error) {
            console.error('❌ Failed to get session stats:', error);
            return { success: false, error: error.message };
        }
    }
    
    // Bet Management
    async updateBet(sessionId, newBetAmount) {
        try {
            const result = await NetworkService.put(`/api/v2/game/session/${sessionId}/bet`, {
                betAmount: newBetAmount
            });
            
            if (result.success && this.currentSession?.sessionId === sessionId) {
                this.currentSession.betAmount = newBetAmount;
            }
            
            return result;
        } catch (error) {
            console.error('❌ Failed to update bet:', error);
            return { success: false, error: error.message };
        }
    }
    
    // State Management
    async requestGameState(sessionId = null) {
        const targetSessionId = sessionId || this.currentSession?.sessionId;
        
        if (NetworkService.isSocketConnected()) {
            NetworkService.emit('game_state_request', { sessionId: targetSessionId });
        } else {
            return await this.getSession(targetSessionId);
        }
    }
    
    async requestBalance() {
        if (NetworkService.isSocketConnected()) {
            NetworkService.emit('balance_request');
        } else {
            // Fallback to HTTP
            try {
                const result = await NetworkService.get('/api/wallet/balance');
                return result;
            } catch (error) {
                console.error('❌ Failed to get balance:', error);
                return { success: false, error: error.message };
            }
        }
    }
    
    // Event Handlers
    handleSpinResult(data) {
        console.log('🎰 Spin result received:', data);
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
        
        // Emit custom event for UI to handle
        if (window.gameScene) {
            window.gameScene.events.emit('balance_update', data);
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
}

export default new GameAPI(); 