// NetworkService - Enhanced global object for server communication
// Requires: axios, socket.io-client

window.NetworkService = new (class NetworkService {
    constructor() {
        // Use current page origin to avoid 127.0.0.1 vs localhost CORS mismatches
        this.baseURL = window.location.origin;
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
            console.warn('?��? NetworkService: axios not available yet, will retry...');
            // Retry axios initialization after a short delay
            setTimeout(() => this.initializeAxios(), 100);
            return;
        }
        
        console.log('??NetworkService: Initializing axios...');
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
                console.log(`?? API ${response.config.method?.toUpperCase()} ${response.config.url} - ${response.status} (${duration}ms)`);
                return response;
            },
            async (error) => {
                const originalRequest = error.config;
                
                // Handle auth errors
                if (error.response?.status === 401) {
                    console.warn('?? Authentication error, clearing session...');
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
                console.error(`?? API Error ${error.config?.method?.toUpperCase()} ${error.config?.url} - ${error.response?.status || 'TIMEOUT'} (${duration}ms)`, error.message);
                
                return Promise.reject(error);
            }
        );
        
        console.log('??NetworkService axios initialized successfully');
    }
    
    async waitForAxios(maxAttempts = 50, delayMs = 100) {
        for (let i = 0; i < maxAttempts; i++) {
            if (this.api) {
                return;
            }
            console.log(`?��? Waiting for axios initialization... (${i + 1}/${maxAttempts})`);
            await this.delay(delayMs);
        }
        throw new Error('NetworkService: axios failed to initialize within timeout');
    }
    
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('infinity_storm_token', token);
            console.log('??Auth token set and stored');
        } else {
            localStorage.removeItem('infinity_storm_token');
            console.log('??Auth token cleared');
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
            console.log('??Stored token validated successfully');
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
            console.warn('?? Authentication error - user session expired');
            this.emit('auth_error', { reason: 'session_expired' });
        }
    }
    
    // HTTP Request Methods with Enhanced Error Handling
    async makeRequest(method, endpoint, data = null, forceDemo = false) {
        // Ensure axios is initialized before making requests
        if (!this.api) {
            console.warn('?��? NetworkService: axios not ready, waiting...');
            await this.waitForAxios();
        }

        try {
            const response = await this.api({
                method,
                url: endpoint,
                data,
                headers: this.buildRequestHeaders(forceDemo)
            });
            
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
    
    async get(endpoint, forceDemo = false) {
        return this.makeRequest('GET', endpoint, null, forceDemo);
    }
    
    async post(endpoint, data, forceDemo = false) {
        return this.makeRequest('POST', endpoint, data, forceDemo);
    }
    
    async put(endpoint, data, forceDemo = false) {
        return this.makeRequest('PUT', endpoint, data, forceDemo);
    }
    
    async delete(endpoint, forceDemo = false) {
        return this.makeRequest('DELETE', endpoint, null, forceDemo);
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
                console.log('??Connected to server via WebSocket');
                this.isConnected = true;
                this.emit('connected');
                resolve();
            });
            
            this.socket.on('disconnect', (reason) => {
                console.log('??Disconnected from server:', reason);
                this.isConnected = false;
                this.emit('disconnected', reason);
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('??WebSocket connection error:', error);
                this.isConnected = false;
                this.emit('connection_error', error);
                reject(error);
            });
            
            this.socket.on('error', (error) => {
                console.error('??WebSocket error:', error);
                this.emit('error', error);
            });
            
            // Setup reconnection handling
            this.socket.on('reconnect', () => {
                console.log('?? Reconnected to server');
                this.isConnected = true;
                this.emit('reconnected');
            });
            
            this.socket.on('reconnect_error', (error) => {
                console.error('??Reconnection failed:', error);
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

    // Spin history (game history) API
    async getSpinHistory(page = 1, limit = 200, order = 'desc') {
        const p = new URLSearchParams();
        p.append('page', String(page || 1));
        p.append('limit', String(Math.min(Math.max(1, limit || 200), 200)));
        if (order && (order === 'asc' || order === 'desc')) p.append('order', order);
        return this.get(`/api/history/spins?${p.toString()}`);
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

    // Normalize server HTTP /api/spin response to canonical SpinResult shape
    normalizeSpinHttpResponse(resp) {
        // Expected server formats:
        // A) { success: true, player: { credits }, spin: { ... } }
        // B) { success: true, data: { ...canonical... } }
        // C) { success: true, <flat spin fields> } (demo-spin)
        if (!resp) return { success: false, error: 'EMPTY_RESPONSE' };
        if (resp.success && resp.data) {
            const d = resp.data;
            if (!Array.isArray(d.cascades) && Array.isArray(d.cascadeSteps)) {
                d.cascades = d.cascadeSteps;
            }
            if (d.initialGrid) {
                d.initialGrid = this.normalizeGrid(d.initialGrid);
            }
            if (d.finalGrid) {
                d.finalGrid = this.normalizeGrid(d.finalGrid);
            }
            if (Array.isArray(d.cascades)) {
                const cascadesNormalized = d.cascades.map((step, index) => Object.assign({}, step, {
                    gridBefore: this.normalizeGrid(step.gridBefore || step.gridStateBefore || step.grid || step.gridStateStart),
                    gridAfter: this.normalizeGrid(step.gridAfter || step.gridStateAfter || step.newGrid || step.gridStateEnd),
                    gridAfterRemoval: this.normalizeGrid(step.gridAfterRemoval || step.gridStateAfterRemoval || step.gridMid || step.gridStateMid || null),
                    matchedClusters: this.normalizeClusterList(step.matchedClusters),
                    matches: this.normalizeClusterList(step.matches),
                    stepNumber: step.stepNumber ?? step.stepIndex ?? index,
                    symbolsToRemove: this.normalizeSymbolRemoval(step.symbolsToRemove || step.removedPositions || []),
                    droppingSymbols: this.normalizeDropPatterns(step.droppingSymbols || step.dropPatterns || []),
                    newSymbols: this.normalizeNewSymbolList(step.newSymbols || []),
                    win: typeof step.win === 'number' ? step.win : (Array.isArray(step.wins) ? step.wins.reduce((sum, w) => sum + (w?.payout || 0), 0) : (step.cascadeWin ?? 0))
                }));
                d.cascades = cascadesNormalized;
                d.cascadeSteps = cascadesNormalized;
            } else {
                d.cascades = [];
                d.cascadeSteps = [];
            }
            const cascades = d.cascades || [];
            const randomMultipliers = this.normalizeRandomMultipliers((d.bonusFeatures && d.bonusFeatures.randomMultipliers) || d.randomMultipliers || []);
            const multiplierEvents = this.normalizeMultiplierEvents(d.multiplierEvents || [], randomMultipliers);
            const multiplierAwarded = this.normalizeMultiplierAward(d.multiplierAwarded, multiplierEvents, randomMultipliers);
            const bonusFeatures = d.bonusFeatures ? Object.assign({}, d.bonusFeatures, { randomMultipliers }) : { randomMultipliers };

            const freeSpinInfo = this.extractFreeSpinsInfo(d, bonusFeatures);

            const data = {
                requestId: d.clientRequestId || resp.requestId || null,
                spinId: d.spinId || resp.spinId || null,
                betAmount: d.betAmount,
                initialGrid: d.initialGrid,
                finalGrid: d.finalGrid || (cascades.length ? cascades[cascades.length - 1].gridAfter : d.initialGrid),
                cascades,
                bonusFeatures,
                randomMultipliers,
                multiplierEvents,
                multiplierAwarded,
                totalWin: d.totalWin ?? 0,
                totalMultiplier: d.totalMultiplier ?? 1,
                timing: d.timing || {},
                metadata: d.metadata || {},
                rngSeed: d.rngSeed,
                balance: (typeof d.balance === 'number') ? d.balance : (typeof d.playerCredits === 'number' ? d.playerCredits : undefined)
            };
            Object.assign(data, freeSpinInfo);
            return { success: true, data };
        }

        if (resp.success && resp.spin) {
            const s = resp.spin;
            const balanceFromPlayer = (resp.player && typeof resp.player.credits === 'number') ? resp.player.credits : undefined;
            const balanceFromSpin = (typeof s.newBalance === 'number') ? s.newBalance : undefined;
            const balance = balanceFromPlayer !== undefined ? balanceFromPlayer : balanceFromSpin;

            // Map cascade step fields
            const cascades = (s.cascades || s.cascadeSteps || []).map(step => ({
                stepNumber: step.stepNumber ?? step.stepIndex ?? 0,
                gridBefore: this.normalizeGrid(step.gridBefore || step.gridStateBefore || step.grid || step.gridStateStart),
                matches: this.normalizeClusterList(step.matches),
                matchedClusters: this.normalizeClusterList(step.matchedClusters),
                gridAfter: this.normalizeGrid(step.gridAfter || step.gridStateAfter || step.newGrid || step.gridStateEnd),
                gridAfterRemoval: this.normalizeGrid(step.gridAfterRemoval || step.gridStateAfterRemoval || step.gridMid || step.gridStateMid || null),
                symbolsToRemove: this.normalizeSymbolRemoval(step.symbolsToRemove || step.removedPositions || []),
                droppingSymbols: this.normalizeDropPatterns(step.droppingSymbols || step.dropPatterns || []),
                newSymbols: this.normalizeNewSymbolList(step.newSymbols || []),
                win: typeof step.win === 'number' ? step.win : (Array.isArray(step.wins) ? step.wins.reduce((sum, w) => sum + (w?.payout || 0), 0) : (step.cascadeWin ?? 0)),
                wins: this.normalizeWinList(step.wins),
                timing: step.timing || {},
                dropPatterns: step.dropPatterns || []
            }));
            cascades.forEach((cascade, idx) => console.debug('[normalizeSpinHttpResponse] cascade', idx, cascade));

            const randomMultipliers = this.normalizeRandomMultipliers((s.bonusFeatures && s.bonusFeatures.randomMultipliers) || s.randomMultipliers || []);
            const multiplierEvents = this.normalizeMultiplierEvents(s.multiplierEvents || [], randomMultipliers);
            const multiplierAwarded = this.normalizeMultiplierAward(s.multiplierAwarded, multiplierEvents, randomMultipliers);
            const bonusFeatures = s.bonusFeatures ? Object.assign({}, s.bonusFeatures, { randomMultipliers }) : { randomMultipliers };

            const freeSpinInfo = this.extractFreeSpinsInfo(s, (s.bonusFeatures || {}));

            const data = {
                requestId: s.clientRequestId || resp.requestId || null,
                spinId: s.spinId,
                betAmount: s.betAmount,
                initialGrid: this.normalizeGrid(s.initialGrid),
                finalGrid: this.normalizeGrid(s.finalGrid || (cascades.length ? cascades[cascades.length - 1].gridAfter : s.initialGrid)),
                cascades,
                bonusFeatures,
                randomMultipliers,
                multiplierEvents,
                multiplierAwarded,
                totalWin: s.totalWin ?? 0,
                totalMultiplier: s.totalMultiplier ?? 1,
                timing: s.timing || {},
                metadata: s.metadata || {},
                rngSeed: s.rngSeed,
                balance
            };
            Object.assign(data, freeSpinInfo);
            return { success: true, data };
        }

        if (resp.success && (resp.spinId || resp.initialGrid || resp.cascadeSteps)) {
            const s = resp;
            const cascadesRaw = s.cascades || s.cascadeSteps || [];
            const cascades = cascadesRaw.map((step, index) => {
                const gridBefore = this.normalizeGrid(step.gridBefore || step.gridStateBefore || step.grid || step.gridStateStart);
                const gridAfter = this.normalizeGrid(step.gridAfter || step.gridStateAfter || step.newGrid || step.gridStateEnd);
                const gridAfterRemoval = this.normalizeGrid(step.gridAfterRemoval || step.gridStateAfterRemoval || step.gridMid || step.gridStateMid || null);
                const normalizedStep = Object.assign({ symbolsToRemove: [] }, {
                    stepNumber: step.stepNumber ?? step.stepIndex ?? index,
                    gridBefore,
                    matches: this.normalizeClusterList(step.matches),
                    matchedClusters: this.normalizeClusterList(step.matchedClusters),
                    gridAfter,
                    gridAfterRemoval,
                    symbolsToRemove: this.normalizeSymbolRemoval(step.symbolsToRemove || step.removedPositions || []),
                    droppingSymbols: this.normalizeDropPatterns(step.droppingSymbols || step.dropPatterns || []),
                    newSymbols: this.normalizeNewSymbolList(step.newSymbols || []),
                    win: typeof step.win === 'number' ? step.win : (Array.isArray(step.wins) ? step.wins.reduce((sum, w) => sum + (w?.payout || 0), 0) : (step.cascadeWin ?? 0)),
                    wins: this.normalizeWinList(step.wins),
                    timing: step.timing || {},
                    dropPatterns: step.dropPatterns || []
                });
                console.debug('[normalizeSpinHttpResponse] cascade flat', index, normalizedStep);
                return normalizedStep;
            });

            const initialGrid = this.normalizeGrid(s.initialGrid);
            const finalGrid = this.normalizeGrid(s.finalGrid || (cascades.length ? cascades[cascades.length - 1].gridAfter : s.initialGrid));

            const randomMultipliers = this.normalizeRandomMultipliers((s.bonusFeatures && s.bonusFeatures.randomMultipliers) || s.randomMultipliers || []);
            const multiplierEvents = this.normalizeMultiplierEvents(s.multiplierEvents || [], randomMultipliers);
            const multiplierAwarded = this.normalizeMultiplierAward(s.multiplierAwarded, multiplierEvents, randomMultipliers);
            const bonusFeatures = s.bonusFeatures ? Object.assign({}, s.bonusFeatures, { randomMultipliers }) : { randomMultipliers };

            const data = {
                requestId: s.clientRequestId || resp.requestId || null,
                spinId: s.spinId,
                betAmount: s.betAmount,
                initialGrid,
                finalGrid,
                cascades,
                bonusFeatures,
                randomMultipliers,
                multiplierEvents,
                multiplierAwarded,
                totalWin: s.totalWin ?? 0,
                totalMultiplier: s.totalMultiplier ?? 1,
                timing: s.timing || {},
                metadata: s.metadata || {},
                rngSeed: s.rngSeed,
                balance: (typeof s.balance === 'number') ? s.balance : (typeof s.playerCredits === 'number' ? s.playerCredits : undefined)
            };
            Object.assign(data, freeSpinInfo);
            return { success: true, data };
        }

        if (resp.success && !resp.data) {
            const data = Object.assign({}, resp);
            const bonusFeatures = data.bonusFeatures || {};
            const randomMultipliers = this.normalizeRandomMultipliers((data.bonusFeatures && data.bonusFeatures.randomMultipliers) || data.randomMultipliers || []);
            const multiplierEvents = this.normalizeMultiplierEvents(data.multiplierEvents || [], randomMultipliers);
            const multiplierAwarded = this.normalizeMultiplierAward(data.multiplierAwarded, multiplierEvents, randomMultipliers);
            if (data.bonusFeatures) { data.bonusFeatures.randomMultipliers = randomMultipliers; }
            data.randomMultipliers = randomMultipliers;
            data.multiplierEvents = multiplierEvents;
            data.multiplierAwarded = multiplierAwarded;
            Object.assign(data, this.extractFreeSpinsInfo(data, bonusFeatures));
            delete data.success;
            if (!Array.isArray(data.cascades) && Array.isArray(data.cascadeSteps)) {
                data.cascades = data.cascadeSteps;
            }
            return { success: true, data };
        }

        return resp; // fallback: unknown format
    }

    // Public method used by GameAPI
    async processSpin(spinData) {
        const isDemoSession = !this.authToken;
        const payload = {
            betAmount: spinData.bet || spinData.betAmount,
            quickSpinMode: !!spinData.quickSpinMode,
            freeSpinsActive: !!spinData.freeSpinsActive,
            accumulatedMultiplier: spinData.accumulatedMultiplier || 1,
            bonusMode: !!spinData.bonusMode,
            rngSeed: spinData.rngSeed, // optional for deterministic replay/testing
            clientRequestId: spinData.requestId || spinData.clientRequestId || null
        };

        if (!payload.clientRequestId) {
            delete payload.clientRequestId;
        }

        const primaryEndpoint = isDemoSession ? '/api/demo-spin' : '/api/spin';

        try {
            const resp = await this.post(primaryEndpoint, payload, isDemoSession);
            const normalized = this.normalizeSpinHttpResponse(resp);
            if (normalized.success || isDemoSession) {
                return normalized;
            }
            if (!isDemoSession) {
                console.warn('Primary spin request returned failure payload:', normalized);
            }
        } catch (error) {
            console.error('NetworkService.processSpin failed:', error);
            if (isDemoSession) {
                const normalizedError = error?.response?.data || {};
                return {
                    success: false,
                    error: normalizedError.error || error.message || 'DEMO_SPIN_FAILED',
                    message: normalizedError.message || error.message,
                    details: normalizedError
                };
            }
        }

        if (!isDemoSession) {
            try {
                const resp = await this.post('/api/demo-spin', payload, true);
                const normalized = this.normalizeSpinHttpResponse(resp);
                if (!normalized.success) {
                    console.warn('Demo spin fallback returned failure payload:', normalized);
                }
                return normalized;
            } catch (demoError) {
                console.warn('Demo spin fallback failed:', demoError.message);
                const normalizedError = demoError?.response?.data || {};
                return {
                    success: false,
                    error: normalizedError.error || demoError.message || 'SPIN_REQUEST_FAILED',
                    message: normalizedError.message || demoError.message,
                    details: normalizedError
                };
            }
        }

        return {
            success: false,
            error: 'SPIN_REQUEST_FAILED',
            message: 'Unable to process spin request'
        };
    }

    async getPendingSpinResult(requestId) {
        if (!requestId) {
            return null;
        }
        try {
            const resp = await this.get(`/api/spin/result/${encodeURIComponent(requestId)}`);
            if (!resp) {
                return null;
            }
            if (resp.success) {
                return this.normalizeSpinHttpResponse(resp);
            }
            return resp;
        } catch (error) {
            console.warn('Pending spin result request failed:', error.message);
            return null;
        }
    }

    async requestBalance() {
        return this.getBalance();
    }

    isDemoMode() {
        return !this.authToken;
    }

    buildRequestHeaders(forceDemo = false) {
        const headers = {
            'Content-Type': 'application/json'
        };

        if (this.authToken) {
            headers.Authorization = `Bearer ${this.authToken}`;
        }

        if (forceDemo || !this.authToken) {
            headers['x-demo-bypass'] = 'true';
        }

        return headers;
    }

    normalizeWinList(wins) {
        if (!Array.isArray(wins)) {
            return [];
        }
        return wins.map(win => {
            if (!win) {
                return { payout: 0, symbolType: null, clusterSize: 0 };
            }
            return {
                payout: typeof win.payout === 'number' ? win.payout : (win.win ?? 0),
                symbolType: win.symbolType || win.type || win.id || null,
                clusterSize: typeof win.clusterSize === 'number' ? win.clusterSize : (Array.isArray(win.positions) ? win.positions.length : 0)
            };
        });
    }

    normalizeClusterList(clusters) {
        if (!Array.isArray(clusters)) {
            return [];
        }
        return clusters.map((cluster, index) => {
            if (!cluster) {
                return { symbolType: null, positions: [], clusterIndex: index };
            }
            if (Array.isArray(cluster)) {
                return {
                    symbolType: null,
                    positions: cluster.map(pos => ({
                        col: pos?.col ?? pos?.column ?? pos?.x ?? (Array.isArray(pos) ? pos[0] : 0),
                        row: pos?.row ?? pos?.y ?? (Array.isArray(pos) ? pos[1] : 0)
                    })),
                    clusterIndex: index
                };
            }
            const symbolType = cluster.symbolType || cluster.type || cluster.id || cluster.symbol || null;
            const positionsRaw = Array.isArray(cluster.positions) ? cluster.positions : [];
            const positions = positionsRaw.map(pos => ({
                col: pos?.col ?? pos?.column ?? pos?.x ?? (Array.isArray(pos) ? pos[0] : 0),
                row: pos?.row ?? pos?.y ?? (Array.isArray(pos) ? pos[1] : 0)
            }));
            return {
                symbolType,
                positions,
                clusterSize: typeof cluster.clusterSize === 'number' ? cluster.clusterSize : positions.length,
                payout: typeof cluster.payout === 'number' ? cluster.payout : (cluster.win ?? 0),
                clusterIndex: index
            };
        });
    }

    normalizeGrid(gridState) {
        if (!Array.isArray(gridState)) { return []; }
        const normalizeSymbol = (value) => {
            if (!value) return null;
            if (typeof value === 'string') return value;
            if (typeof value === 'object') {
                return value.symbolType || value.type || value.id || null;
            }
            return String(value);
        };
        const cols = gridState.length;
        const looksLikeColMajor = cols === 6 && Array.isArray(gridState[0]) && gridState[0].length === 5;
        if (looksLikeColMajor) {
            return gridState.map(col => col.map(normalizeSymbol));
        }
        const normalized = Array.from({ length: 6 }, () => Array(5).fill(null));
        if (cols === 5 && Array.isArray(gridState[0]) && gridState[0].length === 6) {
            for (let r = 0; r < 5; r++) {
                for (let c = 0; c < 6; c++) {
                    normalized[c][r] = normalizeSymbol(gridState[r][c]);
                }
            }
        } else {
            for (let c = 0; c < 6; c++) {
                for (let r = 0; r < 5; r++) {
                    normalized[c][r] = normalizeSymbol(gridState[c]?.[r] ?? null);
                }
            }
        }
        return normalized;
    }

    gridColumnMajor(gridState) {
        const normalized = this.normalizeGrid(gridState);
        return normalized;
    }

    normalizeSymbolRemoval(removals) {
        if (!Array.isArray(removals)) {
            return [];
        }
        return removals.map(entry => {
            if (!entry) {
                return { positions: [] };
            }
            if (Array.isArray(entry.positions)) {
                return {
                    symbolType: entry.symbolType || entry.type || entry.id || entry.symbol || null,
                    positions: entry.positions.map(pos => ({
                        col: pos?.col ?? pos?.column ?? pos?.x ?? (Array.isArray(pos) ? pos[0] : 0),
                        row: pos?.row ?? pos?.y ?? (Array.isArray(pos) ? pos[1] : 0)
                    }))
                };
            }
            if (entry.col !== undefined && entry.row !== undefined) {
                return {
                    symbolType: entry.symbolType || entry.type || entry.id || entry.symbol || null,
                    positions: [{
                        col: entry.col,
                        row: entry.row
                    }]
                };
            }
            if (Array.isArray(entry) && entry.length === 2 && typeof entry[0] === 'number' && typeof entry[1] === 'number') {
                return {
                    symbolType: entry.symbolType || entry.type || entry.id || entry.symbol || null,
                    positions: [{ col: entry[0], row: entry[1] }]
                };
            }
            return { positions: [] };
        });
    }

    normalizeDropPatterns(patterns) {
        if (!Array.isArray(patterns)) {
            return [];
        }
        // Already normalized structure coming from server
        if (patterns.length && patterns[0]?.from && patterns[0]?.to) {
            return patterns;
        }
        return patterns.flatMap(pattern => {
            const column = pattern.column ?? pattern.col ?? pattern.c;
            return (pattern.drops || pattern.dropList || []).map(drop => ({
                from: {
                    col: column,
                    row: drop.from?.row ?? drop.fromRow ?? drop.from ?? 0
                },
                to: {
                    col: column,
                    row: drop.to?.row ?? drop.toRow ?? drop.to ?? 0
                },
                symbolType: drop.symbol || drop.symbolType || drop.type || null,
                dropDistance: drop.dropDistance,
                dropTime: drop.dropTime
            }));
        });
    }

    normalizeMultiplierPosition(position) {
        if (Array.isArray(position)) {
            return {
                col: position[0] ?? 0,
                row: position[1] ?? 0
            };
        }
        if (position && typeof position === 'object') {
            return {
                col: position.col ?? position.x ?? position.column ?? 0,
                row: position.row ?? position.y ?? position.r ?? 0
            };
        }
        return { col: 0, row: 0 };
    }

    normalizeRandomMultipliers(entries) {
        if (!Array.isArray(entries)) {
            return [];
        }
        const animationFallback = window.GameConfig?.RANDOM_MULTIPLIER?.ANIMATION_DURATION || 2000;
        return entries.map((entry, index) => {
            if (!entry) {
                return {
                    id: `rm-${index}`,
                    type: 'random_multiplier',
                    multiplier: 0,
                    position: { col: 0, row: 0 },
                    character: 'thanos',
                    sequenceIndex: index,
                    appearDelay: 0,
                    animationDuration: animationFallback,
                    originalWin: null,
                    finalWin: null,
                    metadata: null
                };
            }
            const candidateId = entry.id || entry.eventId || entry.metadata?.eventId || `rm-${index}`;
            return {
                id: candidateId,
                type: entry.type || 'random_multiplier',
                multiplier: Number(entry.multiplier) || 0,
                position: this.normalizeMultiplierPosition(entry.position),
                character: entry.character || 'thanos',
                sequenceIndex: entry.sequenceIndex ?? index,
                appearDelay: entry.appearDelay ?? 0,
                animationDuration: entry.animationDuration ?? animationFallback,
                originalWin: typeof entry.originalWin === 'number' ? entry.originalWin : (entry.metadata?.originalWin ?? null),
                finalWin: typeof entry.multipliedWin === 'number' ? entry.multipliedWin : (entry.metadata?.multipliedWin ?? null),
                metadata: entry.metadata || null
            };
        });
    }

    normalizeMultiplierEvents(events, normalizedMultipliers) {
        if (!Array.isArray(events)) {
            return [];
        }
        const multipliersById = new Map();
        normalizedMultipliers.forEach(entry => {
            if (entry && entry.id) {
                multipliersById.set(entry.id, entry);
            }
        });
        const ensureMultiplier = (raw, index) => {
            if (!raw) {
                return null;
            }
            const lookupId = raw.id || raw.eventId || raw.metadata?.eventId;
            if (lookupId && multipliersById.has(lookupId)) {
                return multipliersById.get(lookupId);
            }
            const normalized = this.normalizeRandomMultipliers([raw])[0];
            if (normalized && normalized.id && !multipliersById.has(normalized.id)) {
                multipliersById.set(normalized.id, normalized);
                normalizedMultipliers.push(normalized);
            }
            return normalized;
        };
        return events.map((event, eventIndex) => {
            const mapped = Array.isArray(event?.multipliers)
                ? event.multipliers.map((raw, idx) => ensureMultiplier(raw, idx)).filter(Boolean)
                : [];
            const totalMultiplier = event?.totalMultiplier ?? mapped.reduce((sum, entry) => sum + (entry.multiplier || 0), 0);
            return {
                type: event?.type || (mapped.length > 1 ? 'cascade_random_multiplier' : 'random_multiplier'),
                totalMultiplier,
                multipliers: mapped,
                originalWin: typeof event?.originalWin === 'number' ? event.originalWin : (event?.metadata?.originalWin ?? null),
                finalWin: typeof event?.finalWin === 'number' ? event.finalWin : (event?.metadata?.finalWin ?? null),
                sequenceIndex: event?.sequenceIndex ?? eventIndex,
                metadata: event?.metadata || null
            };
        });
    }

    normalizeMultiplierAward(award, events, normalizedMultipliers) {
        if (!award) {
            return null;
        }
        const normalizedEvents = (Array.isArray(events) && events.length)
            ? events
            : this.normalizeMultiplierEvents(award.events || [], normalizedMultipliers);
        const originalWin = typeof award.originalWin === 'number' ? award.originalWin : (award?.metadata?.originalWin ?? null);
        const finalWin = typeof award.finalWin === 'number' ? award.finalWin : (award?.metadata?.finalWin ?? null);
        let totalAppliedMultiplier = typeof award.totalAppliedMultiplier === 'number' ? award.totalAppliedMultiplier : null;
        if (totalAppliedMultiplier == null && originalWin && finalWin != null && originalWin !== 0) {
            totalAppliedMultiplier = finalWin / originalWin;
        }
        if (totalAppliedMultiplier == null && normalizedEvents.length > 0) {
            totalAppliedMultiplier = normalizedEvents.reduce((product, evt) => product * (evt.totalMultiplier || 1), 1);
        }
        return {
            originalWin,
            finalWin,
            totalAppliedMultiplier,
            hasCascade: award.hasCascade ?? normalizedEvents.some(evt => evt.type === 'cascade_random_multiplier'),
            hasRandom: award.hasRandom ?? normalizedEvents.some(evt => evt.type === 'random_multiplier'),
            events: normalizedEvents
        };
    }
    extractFreeSpinsInfo(source = {}, bonusFeatures = {}) {
        const freeFeature = source?.features?.free_spins || {};
        let awarded = source?.freeSpinsAwarded ?? bonusFeatures?.freeSpinsAwarded ?? freeFeature?.spinsAwarded ?? 0;
        const activeFlag = source?.freeSpinsActive ?? freeFeature?.active;
        const triggeredFlag = source?.freeSpinsTriggered;
        const retriggerFlag = source?.freeSpinsRetriggered ?? bonusFeatures?.freeSpinsRetriggered ?? freeFeature?.retrigger;
        const remaining = source?.freeSpinsRemaining ?? source?.freeSpinsNextCount ?? freeFeature?.count ?? freeFeature?.remaining ?? 0;
        const ended = source?.freeSpinsEnded ?? false;
        
        // CRITICAL: Extract server's accumulated multiplier (authoritative during free spins)
        const accumulatedMultiplier = source?.accumulatedMultiplier ?? freeFeature?.multiplier ?? 1;

        // If server provided a count but no explicit awarded value, treat count as awarded when not already active
        if ((!awarded || awarded === 0) && remaining > 0 && !activeFlag) {
            awarded = remaining;
        }

        return {
            freeSpinsAwarded: awarded,
            freeSpinsTriggered: (triggeredFlag !== undefined) ? !!triggeredFlag : (awarded > 0 && !activeFlag),
            freeSpinsRetriggered: retriggerFlag !== undefined ? !!retriggerFlag : false,
            freeSpinsActive: activeFlag !== undefined ? !!activeFlag : false,
            freeSpinsRemaining: remaining,
            freeSpinsEnded: !!ended,
            accumulatedMultiplier: accumulatedMultiplier  // Server-authoritative accumulated multiplier
        };
    }

    normalizeNewSymbolList(newSymbols) {
        if (!Array.isArray(newSymbols)) {
            return [];
        }
        return newSymbols.map(entry => {
            if (!entry) {
                return null;
            }
            const col = entry.position?.col ?? entry.col ?? entry.c ?? 0;
            const row = entry.position?.row ?? entry.row ?? entry.r ?? 0;
            return {
                position: { col, row },
                symbolType: entry.symbolType || entry.symbol || entry.type || null,
                dropFromRow: entry.dropFromRow ?? entry.dropFrom ?? entry.startRow ?? null,
                dropTime: entry.dropTime,
                emptyRowsAbove: entry.emptyRowsAbove
            };
        }).filter(Boolean);
    }
})();

