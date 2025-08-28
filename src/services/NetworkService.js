// NetworkService - Enhanced global object for server communication
// Requires: axios, socket.io-client

window.NetworkService = new (class NetworkService {
    constructor() {
        this.baseURL = 'http://localhost:3000';
        this.socket = null;
        this.authToken = null;
        this.isConnected = false;
        this.isRetrying = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        this.retryDelay = 1000; // Start with 1 second
        this.eventHandlers = new Map();
        
        // Initialize auth token from storage on startup
        this.initializeAuth();
        
        // Setup axios instance with enhanced configuration (with safety check)
        this.initializeAxios();
    }
    
    // Authentication Methods
    initializeAuth() {
        const storedToken = localStorage.getItem('infinity_storm_token');
        if (storedToken) {
            this.authToken = storedToken;
            // Validate token on next tick to avoid blocking initialization
            setTimeout(() => this.validateStoredToken(), 100);
        }
    }
    
    initializeAxios() {
        if (typeof axios === 'undefined') {
            console.warn('⚠️ NetworkService: axios not available yet, will retry...');
            // Retry axios initialization after a short delay
            setTimeout(() => this.initializeAxios(), 100);
            return;
        }
        
        console.log('✅ NetworkService: Initializing axios...');
        this.api = axios.create({
            baseURL: this.baseURL,
            timeout: 15000, // Increased timeout for server communication
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Add request interceptor to include auth token and handle retries
        this.api.interceptors.request.use(
            (config) => {
                if (this.authToken) {
                    config.headers.Authorization = `Bearer ${this.authToken}`;
                }
                // Add request ID for tracking
                config.headers['X-Request-ID'] = this.generateRequestId();
                config.metadata = { startTime: new Date() };
                return config;
            },
            (error) => Promise.reject(error)
        );
        
        // Add response interceptor for error handling and retries
        this.api.interceptors.response.use(
            (response) => {
                // Reset retry count on successful response
                this.retryCount = 0;
                const endTime = new Date();
                const duration = endTime - response.config.metadata.startTime;
                console.log(`🌐 API ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
                return response;
            },
            async (error) => {
                const originalRequest = error.config;
                
                // Handle auth errors
                if (error.response?.status === 401) {
                    console.warn('🔒 Authentication error, clearing session...');
                    this.handleAuthError();
                    return Promise.reject(error);
                }
                
                // Handle network errors with retry logic
                if (this.shouldRetryRequest(error) && !originalRequest._retryCount) {
                    originalRequest._retryCount = (originalRequest._retryCount || 0) + 1;
                    
                    if (originalRequest._retryCount <= this.maxRetries) {
                        console.warn(`Request failed, retrying (${originalRequest._retryCount}/${this.maxRetries})...`);
                        await this.delay(this.retryDelay * originalRequest._retryCount);
                        return this.api(originalRequest);
                    }
                }
                
                const endTime = new Date();
                const duration = error.config?.metadata ? endTime - error.config.metadata.startTime : 0;
                console.error(`🌐 API Error ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'TIMEOUT'} (${duration}ms)`, error.message);
                
                return Promise.reject(error);
            }
        );
        
        console.log('✅ NetworkService axios initialized successfully');
    }
    
    async waitForAxios(maxAttempts = 50, delayMs = 100) {
        for (let i = 0; i < maxAttempts; i++) {
            if (this.api) {
                return;
            }
            console.log(`⏱️ Waiting for axios initialization... (${i + 1}/${maxAttempts})`);
            await this.delay(delayMs);
        }
        throw new Error('NetworkService: axios failed to initialize within timeout');
    }
    
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('infinity_storm_token', token);
            console.log('✅ Auth token set and stored');
        } else {
            localStorage.removeItem('infinity_storm_token');
            console.log('❌ Auth token cleared');
        }
    }
    
    getStoredToken() {
        return localStorage.getItem('infinity_storm_token');
    }
    
    async validateStoredToken() {
        if (!this.authToken) return false;
        
        try {
            const result = await this.post('/api/validate-session');
            if (!result.success) {
                console.warn('Stored token is invalid, clearing...');
                this.handleAuthError();
                return false;
            }
            console.log('✅ Stored token validated successfully');
            return true;
        } catch (error) {
            console.warn('Token validation failed:', error.message);
            this.handleAuthError();
            return false;
        }
    }
    
    handleAuthError() {
        const wasAuthenticated = !!this.authToken;
        this.setAuthToken(null);
        this.disconnectSocket();
        
        if (wasAuthenticated) {
            console.warn('🔐 Authentication error - user session expired');
            this.emit('auth_error', { reason: 'session_expired' });
        }
    }
    
    // HTTP Request Methods with Enhanced Error Handling
    async makeRequest(method, endpoint, data = null) {
        // Ensure axios is initialized before making requests
        if (!this.api) {
            console.warn('⚠️ NetworkService: axios not ready, waiting...');
            await this.waitForAxios();
        }
        
        try {
            const config = { method, url: endpoint };
            if (data) config.data = data;
            
            const response = await this.api(config);
            
            // Handle different response formats from server
            const responseData = response.data;
            
            // Server API format: { success: true, data: ... } or direct data
            if (responseData.hasOwnProperty('success')) {
                return responseData;
            } else {
                // Direct data response, wrap in success format
                return { success: true, data: responseData };
            }
        } catch (error) {
            console.error(`HTTP ${method} ${endpoint} failed:`, error);
            
            // Enhanced error handling for different error types
            let errorResponse = {
                success: false,
                error: 'NETWORK_ERROR',
                message: 'Request failed',
                status: 500
            };
            
            if (error.response) {
                // Server responded with error status
                const serverError = error.response.data;
                errorResponse = {
                    success: false,
                    error: serverError.error || 'SERVER_ERROR',
                    message: serverError.message || serverError.errorMessage || error.message,
                    status: error.response.status,
                    details: serverError.details || null
                };
            } else if (error.request) {
                // Network error
                errorResponse = {
                    success: false,
                    error: 'NETWORK_ERROR',
                    message: 'Unable to connect to server',
                    status: 0
                };
            } else {
                // Request configuration error
                errorResponse.message = error.message;
            }
            
            return errorResponse;
        }
    }
    
    async get(endpoint) {
        return this.makeRequest('GET', endpoint);
    }
    
    async post(endpoint, data) {
        return this.makeRequest('POST', endpoint, data);
    }
    
    async put(endpoint, data) {
        return this.makeRequest('PUT', endpoint, data);
    }
    
    async delete(endpoint) {
        return this.makeRequest('DELETE', endpoint);
    }
    
    // WebSocket Methods
    connectSocket() {
        if (this.socket && this.socket.connected) {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            this.socket = io(this.baseURL, {
                auth: { token: this.authToken },
                timeout: 10000, // Increased timeout
                transports: ['websocket', 'polling'],
                forceNew: false,
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 2000
            });
            
            this.socket.on('connect', () => {
                console.log('✅ Connected to server via WebSocket');
                this.isConnected = true;
                this.emit('connected');
                resolve();
            });
            
            this.socket.on('disconnect', (reason) => {
                console.log('❌ Disconnected from server:', reason);
                this.isConnected = false;
                this.emit('disconnected', reason);
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('❌ WebSocket connection error:', error);
                this.isConnected = false;
                this.emit('connection_error', error);
                reject(error);
            });
            
            this.socket.on('error', (error) => {
                console.error('❌ WebSocket error:', error);
                this.emit('error', error);
            });
            
            // Setup reconnection handling
            this.socket.on('reconnect', () => {
                console.log('🔄 Reconnected to server');
                this.isConnected = true;
                this.emit('reconnected');
            });
            
            this.socket.on('reconnect_error', (error) => {
                console.error('❌ Reconnection failed:', error);
                this.emit('reconnect_error', error);
            });
        });
    }
    
    disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    }
    
    // WebSocket Event Methods
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        }
        
        // Also emit to local event handlers
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    }
    
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        
        // Also listen on socket if connected
        if (this.socket) {
            this.socket.on(event, handler);
        }
    }
    
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            const handlers = this.eventHandlers.get(event);
            const index = handlers.indexOf(handler);
            if (index > -1) {
                handlers.splice(index, 1);
            }
        }
        
        if (this.socket) {
            this.socket.off(event, handler);
        }
    }
    
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
    }
    
    async getGameState() {
        return this.get('/api/game-state');
    }
    
    async updateGameState(stateUpdates, reason) {
        return this.put('/api/game-state', { stateUpdates, reason });
    }
    
    async getPlayerStats(period = 'month', limit = 100) {
        return this.get(`/api/player-stats?period=${period}&limit=${limit}`);
    }
    
    async getGameStatus() {
        return this.get('/api/game-status');
    }
    
    // Wallet API Methods
    async getBalance() {
        return this.get('/api/wallet/balance');
    }
    
    async getWalletStatus() {
        return this.get('/api/wallet/status');
    }
    
    async getTransactionHistory(options = {}) {
        const params = new URLSearchParams();
        if (options.page) params.append('page', options.page);
        if (options.limit) params.append('limit', options.limit);
        if (options.type) params.append('type', options.type);
        if (options.dateFrom) params.append('date_from', options.dateFrom);
        if (options.dateTo) params.append('date_to', options.dateTo);
        
        return this.get(`/api/wallet/transactions?${params.toString()}`);
    }
    
    async getWalletStats(days = 30) {
        return this.get(`/api/wallet/stats?days=${days}`);
    }
    
    async validateBalance() {
        return this.get('/api/wallet/validate');
    }
    
    // Cascade API Methods (for future cascade synchronization)
    async startCascadeSync(spinId, playerId, gridState) {
        return this.post('/api/cascade/sync/start', { spinId, playerId, gridState });
    }
    
    async processStepAcknowledgment(syncSessionId, stepData) {
        return this.post('/api/cascade/sync/step', {
            syncSessionId,
            stepIndex: stepData.stepIndex,
            gridState: stepData.gridState,
            clientHash: stepData.clientHash,
            clientTimestamp: stepData.clientTimestamp
        });
    }
    
    async completeCascadeSync(syncSessionId, finalData) {
        return this.post('/api/cascade/sync/complete', {
            syncSessionId,
            finalGridState: finalData.finalGridState,
            totalWin: finalData.totalWin,
            clientHash: finalData.clientHash
        });
    }
    
    // Utility Methods
    generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    shouldRetryRequest(error) {
        // Retry on network errors or 5xx server errors
        return !error.response || (error.response.status >= 500 && error.response.status < 600);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // Connection Status
    isSocketConnected() {
        return this.socket && this.socket.connected;
    }
    
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            authenticated: !!this.authToken,
            socketId: this.socket?.id || null,
            retryCount: this.retryCount,
            isRetrying: this.isRetrying
        };
    }
    
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
    }
    
    // Legacy compatibility methods (for backwards compatibility with existing GameAPI calls)
    async spin(betAmount, options = {}) {
        return this.processSpin({
            bet: betAmount,
            quickSpinMode: options.quickSpinMode || false,
            freeSpinsActive: options.freeSpinsActive || false,
            accumulatedMultiplier: options.accumulatedMultiplier || 1
        });
    }
    
    async requestBalance() {
        return this.getBalance();
    }
})();