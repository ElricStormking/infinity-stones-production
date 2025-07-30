// NetworkService - Global object for network communication
// Requires: axios, socket.io-client

window.NetworkService = {
    baseURL: 'http://localhost:3001',
    socket: null,
    authToken: null,
    isConnected: false,
    eventHandlers: new Map(),
    api: null,
    
    init() {
        // Setup axios instance
        this.api = axios.create({
            baseURL: this.baseURL,
            timeout: 10000,
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        // Add request interceptor to include auth token
        this.api.interceptors.request.use(
            (config) => {
                if (this.authToken) {
                    config.headers.Authorization = `Bearer ${this.authToken}`;
                }
                return config;
            },
            (error) => Promise.reject(error)
        );
        
        // Add response interceptor for error handling
        this.api.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response?.status === 401) {
                    this.handleAuthError();
                }
                return Promise.reject(error);
            }
        );
    },
    
    // Authentication Methods
    setAuthToken(token) {
        this.authToken = token;
        if (token) {
            localStorage.setItem('infinity_storm_token', token);
        } else {
            localStorage.removeItem('infinity_storm_token');
        }
    },
    
    getStoredToken() {
        return localStorage.getItem('infinity_storm_token');
    },
    
    handleAuthError() {
        this.setAuthToken(null);
        this.disconnectSocket();
        this.emit('auth_error');
    },
    
    // HTTP Request Methods
    async makeRequest(method, endpoint, data = null) {
        try {
            const config = { method, url: endpoint };
            if (data) config.data = data;
            
            const response = await this.api(config);
            return { success: true, data: response.data };
        } catch (error) {
            console.error(`HTTP ${method} ${endpoint} failed:`, error);
            return { 
                success: false, 
                error: error.response?.data?.message || error.message,
                status: error.response?.status || 500
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
    
    // WebSocket Methods
    connectSocket() {
        if (this.socket && this.socket.connected) {
            return Promise.resolve();
        }
        
        return new Promise((resolve, reject) => {
            this.socket = io(this.baseURL, {
                auth: { token: this.authToken },
                timeout: 5000,
                transports: ['websocket', 'polling']
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
    },
    
    disconnectSocket() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.isConnected = false;
        }
    },
    
    // WebSocket Event Methods
    emit(event, data) {
        if (this.socket && this.socket.connected) {
            this.socket.emit(event, data);
        }
        
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => handler(data));
        }
    },
    
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
        
        if (this.socket) {
            this.socket.on(event, handler);
        }
    },
    
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
    },
    
    // Connection Status
    isSocketConnected() {
        return this.socket && this.socket.connected;
    },
    
    getConnectionStatus() {
        return {
            connected: this.isConnected,
            authenticated: !!this.authToken,
            socketId: this.socket?.id || null
        };
    }
};

// Initialize on load
window.NetworkService.init(); 