// NetworkService - Simple network service for server communication
window.NetworkService = {
    baseURL: 'http://localhost:3000',
    authToken: null,
    retryCount: 0,
    maxRetries: 3,
    
    init() {
        // Get stored token if any
        this.authToken = localStorage.getItem('infinity_storm_token');
        
        // Validate token if present
        if (this.authToken) {
            this.validateStoredToken();
        }
    },
    
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('infinity_storm_token', token);
            console.log('✅ Auth token set and stored');
        } else {
            localStorage.removeItem('infinity_storm_token');
            console.log('❌ Auth token cleared');
        }
    },
    
    getStoredToken() {
        return localStorage.getItem('infinity_storm_token');
    },
    
    async validateStoredToken() {
        if (!this.authToken) return false;
        
        try {
            const result = await this.post('/api/validate-session');
            if (!result.success) {
                console.warn('Stored token is invalid, clearing...');
                this.setAuthToken(null);
                return false;
            }
            console.log('✅ Stored token validated successfully');
            return true;
        } catch (error) {
            console.warn('Token validation failed:', error.message);
            this.setAuthToken(null);
            return false;
        }
    },
    
    async makeRequest(method, endpoint, data = null, retryAttempt = 0) {
        try {
            const config = {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                }
            };
            
            if (this.authToken) {
                config.headers.Authorization = `Bearer ${this.authToken}`;
            }
            
            if (data) {
                config.body = JSON.stringify(data);
            }
            
            const response = await fetch(this.baseURL + endpoint, config);
            
            // Handle auth errors
            if (response.status === 401) {
                console.warn('🔐 Authentication error - clearing token');
                this.setAuthToken(null);
                this.emit('auth_error', { reason: 'session_expired' });
            }
            
            const responseData = await response.json();
            
            if (!response.ok) {
                // Handle server error responses
                const errorResponse = {
                    success: false,
                    error: responseData.error || responseData.message || 'Request failed',
                    message: responseData.errorMessage || responseData.message || 'Request failed',
                    details: responseData.details || null,
                    status: response.status
                };
                
                // Retry on server errors
                if (response.status >= 500 && retryAttempt < this.maxRetries) {
                    console.warn(`Server error, retrying (${retryAttempt + 1}/${this.maxRetries})...`);
                    await this.delay(1000 * (retryAttempt + 1));
                    return this.makeRequest(method, endpoint, data, retryAttempt + 1);
                }
                
                return errorResponse;
            }
            
            // Handle different response formats from server
            if (responseData.hasOwnProperty('success')) {
                return responseData;
            } else {
                // Direct data response, wrap in success format
                return { success: true, data: responseData };
            }
        } catch (error) {
            console.error(`HTTP ${method} ${endpoint} failed:`, error);
            
            // Retry on network errors
            if (retryAttempt < this.maxRetries && this.isNetworkError(error)) {
                console.warn(`Network error, retrying (${retryAttempt + 1}/${this.maxRetries})...`);
                await this.delay(1000 * (retryAttempt + 1));
                return this.makeRequest(method, endpoint, data, retryAttempt + 1);
            }
            
            return { 
                success: false, 
                error: 'NETWORK_ERROR',
                message: error.message || 'Network error',
                status: error.status || 0
            };
        }
    },
    
    async get(endpoint) {
        return this.makeRequest('GET', endpoint);
    },
    
    async post(endpoint, data) {
        return this.makeRequest('POST', endpoint, data);
    },
    
    async put(endpoint, data) {
        return this.makeRequest('PUT', endpoint, data);
    },
    
    async delete(endpoint) {
        return this.makeRequest('DELETE', endpoint);
    },
    
    // Server API Integration Methods
    
    // Game API Methods
    async processSpin(spinData) {
        return this.post('/api/spin', {
            betAmount: spinData.bet || spinData.betAmount,
            quickSpinMode: spinData.quickSpinMode || false,
            freeSpinsActive: spinData.freeSpinsActive || false,
            accumulatedMultiplier: spinData.accumulatedMultiplier || 1,
            bonusMode: spinData.bonusMode || false
        });
    },
    
    async getGameState() {
        return this.get('/api/game-state');
    },
    
    async updateGameState(stateUpdates, reason) {
        return this.put('/api/game-state', { stateUpdates, reason });
    },
    
    async getPlayerStats(period = 'month', limit = 100) {
        return this.get(`/api/player-stats?period=${period}&limit=${limit}`);
    },
    
    async getGameStatus() {
        return this.get('/api/game-status');
    },
    
    // Wallet API Methods
    async getBalance() {
        return this.get('/api/wallet/balance');
    },
    
    async getWalletStatus() {
        return this.get('/api/wallet/status');
    },
    
    async getTransactionHistory(options = {}) {
        const params = new URLSearchParams();
        if (options.page) params.append('page', options.page);
        if (options.limit) params.append('limit', options.limit);
        if (options.type) params.append('type', options.type);
        if (options.dateFrom) params.append('date_from', options.dateFrom);
        if (options.dateTo) params.append('date_to', options.dateTo);
        
        return this.get(`/api/wallet/transactions?${params.toString()}`);
    },
    
    async getWalletStats(days = 30) {
        return this.get(`/api/wallet/stats?days=${days}`);
    },
    
    async validateBalance() {
        return this.get('/api/wallet/validate');
    },
    
    // Session Management
    async validateSession() {
        if (!this.authToken) {
            return { success: false, error: 'NO_TOKEN', message: 'No authentication token' };
        }
        
        try {
            return await this.post('/api/validate-session');
        } catch (error) {
            console.error('Session validation failed:', error);
            return { 
                success: false, 
                error: 'VALIDATION_FAILED', 
                message: 'Session validation failed' 
            };
        }
    },
    
    // Legacy compatibility methods
    async spin(betAmount, options = {}) {
        return this.processSpin({
            bet: betAmount,
            quickSpinMode: options.quickSpinMode || false,
            freeSpinsActive: options.freeSpinsActive || false,
            accumulatedMultiplier: options.accumulatedMultiplier || 1
        });
    },
    
    async requestBalance() {
        return this.getBalance();
    },
    
    // Utility Methods
    isNetworkError(error) {
        return !error.response || error.name === 'TypeError' || error.name === 'NetworkError';
    },
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    // Simple event system
    eventHandlers: new Map(),
    
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    },
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
    },
    
    emit(event, data) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    },
    
    isSocketConnected() {
        return false; // Simple version doesn't use WebSocket
    },
    
    getConnectionStatus() {
        return {
            connected: true,
            authenticated: !!this.authToken,
            socketId: null,
            retryCount: this.retryCount,
            isRetrying: false
        };
    },
    
    // Health Check
    async checkServerHealth() {
        try {
            const result = await this.getGameStatus();
            return result.success;
        } catch (error) {
            console.warn('Server health check failed:', error.message);
            return false;
        }
    }
};

// Initialize on load
window.NetworkService.init();