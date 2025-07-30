// GameAPI - Simple game service for server communication
window.GameAPI = {
    currentSession: null,
    gameState: null,
    isSpinning: false,
    
    // Session Management
    async createSession() {
        try {
            const response = await NetworkService.post('/api/v2/game/session/test', {});
            
            if (response.success) {
                this.currentSession = response.data;
                console.log('Game session created:', this.currentSession);
                return response.data;
            } else {
                throw new Error(response.error || 'Failed to create session');
            }
        } catch (error) {
            console.error('Create session error:', error);
            throw error;
        }
    },
    
    // Use a pre-initialized sample session for testing
    async useSampleSession(sessionId = 'test-session-001') {
        try {
            // Get sample sessions from server
            const response = await NetworkService.get('/api/v2/game/sample-sessions');
            
            if (response.success) {
                const sampleSession = response.data.sampleSessions.find(s => s.sessionId === sessionId);
                if (sampleSession) {
                    this.currentSession = {
                        sessionId: sampleSession.sessionId,
                        playerId: sampleSession.playerId,
                        balance: sampleSession.currentState.balance,
                        state: sampleSession.currentState.state
                    };
                    console.log('Using sample session:', this.currentSession);
                    return this.currentSession;
                } else {
                    throw new Error(`Sample session ${sessionId} not found`);
                }
            } else {
                throw new Error(response.error || 'Failed to get sample sessions');
            }
        } catch (error) {
            console.error('Sample session error:', error);
            throw error;
        }
    },
    
    // Game Actions
    async spin(betAmount = 10.00) {
        try {
            if (!this.currentSession) {
                throw new Error('No active session');
            }

            this.isSpinning = true;
            const response = await NetworkService.post('/api/v2/game/spin/test', {
                sessionId: this.currentSession.sessionId,
                betAmount: betAmount
            });
            
            this.isSpinning = false;
            
            if (response.success) {
                console.log('Spin result:', response.data);
                // Update session balance
                if (response.data.balance !== undefined) {
                    this.currentSession.balance = response.data.balance;
                }
                return response.data;
            } else {
                throw new Error(response.error || 'Spin failed');
            }
        } catch (error) {
            this.isSpinning = false;
            console.error('Spin error:', error);
            throw error;
        }
    },
    
    // Alias for GameScene compatibility
    async requestSpin(betAmount = 10.00) {
        return await this.spin(betAmount);
    },
    
    getCurrentSession() {
        return this.currentSession;
    },
    
    isCurrentlySpinning() {
        return this.isSpinning;
    }
}; 